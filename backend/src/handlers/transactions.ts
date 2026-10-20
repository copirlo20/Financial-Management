import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { formText, type FormState } from "@fm/shared/form-state";
import { isInflow, type Movement } from "@fm/shared/transactions";
import { requireUser } from "../auth/current-user";
import { convertToDefaultCurrency, refreshRates, type Conversion } from "../exchange";
import { redirect } from "../http/respond";
import { getI18n } from "../i18n";
import { idSchema } from "../validations/common";
import { transactionSchema, transferSchema } from "../validations/transaction";

export type TransactionFormState = FormState<"type" | "accountId" | "categoryId" | "amount" | "date" | "note">;
export type TransferFormState = FormState<
  "fromAccountId" | "toAccountId" | "amount" | "toAmount" | "date" | "note"
>;

type Tx = Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Không tìm thấy giao dịch.";

function signedAmount(row: Movement & { amount: Prisma.Decimal }): Prisma.Decimal {
  return isInflow(row) ? row.amount : row.amount.neg();
}

// Always runs in the same database transaction as the row change it accounts for, so the cached balance cannot drift.
async function adjustBalance(tx: Tx, userId: string, accountId: string, delta: Prisma.Decimal) {
  await tx.account.updateMany({
    where: { id: accountId, userId },
    data: { currentBalance: { increment: delta } },
  });
}

// Row locks make concurrent edits/deletes of the same transaction (or transfer pair) wait for each other,
// so each one reverts the amount that is actually stored rather than a stale read.
async function lockTransactionRows(tx: Tx, userId: string, id: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT t."id" FROM "transactions" t
    WHERE t."userId" = ${userId}
      AND (t."id" = ${id} OR t."transferGroupId" IN (
        SELECT x."transferGroupId" FROM "transactions" x
        WHERE x."id" = ${id} AND x."userId" = ${userId} AND x."transferGroupId" IS NOT NULL))
    FOR UPDATE`;
  return tx.transaction.findMany({
    where: { id: { in: locked.map((row) => row.id) }, userId },
    select: { id: true, type: true, transferDirection: true, amount: true, accountId: true },
  });
}

function findCategory(db: Pick<Tx, "category">, userId: string, id: string, type: "EXPENSE" | "INCOME") {
  return db.category.findFirst({
    where: { id, type, OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
}

const CATEGORY_ERROR = "Danh mục không tồn tại hoặc không cùng loại với giao dịch.";
const ACCOUNT_ERROR = "Tài khoản không tồn tại hoặc đã được lưu trữ.";

function transactionValues(formData: FormData) {
  return {
    type: formText(formData, "type"),
    accountId: formText(formData, "accountId"),
    categoryId: formText(formData, "categoryId"),
    amount: formText(formData, "amount"),
    date: formText(formData, "date"),
    note: formText(formData, "note"),
  };
}

// The submitted income or expense, checked, with its amount and date as they are stored.
function parseEntry(values: ReturnType<typeof transactionValues>) {
  const parsed = transactionSchema.safeParse(values);
  if (!parsed.success) return { ok: false as const, errors: z.flattenError(parsed.error).fieldErrors };
  return { ok: true as const, entry: { ...parsed.data, amount: new Prisma.Decimal(parsed.data.amount), date: isoDateToDate(parsed.data.date) } };
}
type Entry = Extract<ReturnType<typeof parseEntry>, { ok: true }>["entry"];

// The columns an income or expense entry writes, in the currency of the account it is on.
function entryData(entry: Entry, account: { id: string; currency: string }, categoryId: string, conversion: Conversion) {
  const { type, amount, date, note } = entry;
  return { accountId: account.id, categoryId, type, amount, currency: account.currency, date, note, ...conversion };
}

export async function createTransaction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await requireUser();

  const values = transactionValues(formData);
  const parsed = parseEntry(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const { entry } = parsed;

  const [account, category] = await Promise.all([
    prisma.account.findFirst({
      where: { id: entry.accountId, userId: user.id, archivedAt: null },
      select: { id: true, currency: true },
    }),
    findCategory(prisma, user.id, entry.categoryId, entry.type),
  ]);
  if (!account) return { errors: { accountId: [ACCOUNT_ERROR] }, values };
  if (!category) return { errors: { categoryId: [CATEGORY_ERROR] }, values };

  if (account.currency !== user.defaultCurrency) await refreshRates();
  const conversion = await convertToDefaultCurrency(prisma, entry.amount, account.currency, user.defaultCurrency, entry.date);

  await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: { userId: user.id, ...entryData(entry, account, category.id, conversion) },
      select: { type: true, transferDirection: true, amount: true },
    });
    await adjustBalance(tx, user.id, account.id, signedAmount(created));
  });

  return { success: true };
}

export async function updateTransaction(
  transactionId: string,
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await requireUser();

  const values = transactionValues(formData);
  const id = idSchema.safeParse(transactionId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = parseEntry(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const { entry } = parsed;

  await refreshRates();
  const failure = await prisma.$transaction(async (tx): Promise<TransactionFormState> => {
    const [existing] = await lockTransactionRows(tx, user.id, id.data);
    // Transfers are a linked pair and are replaced by delete + recreate, not edited here.
    if (!existing || existing.type === "TRANSFER") return { message: NOT_FOUND_MESSAGE, values };

    const account = await tx.account.findFirst({
      where: { id: entry.accountId, userId: user.id },
      select: { id: true, currency: true, archivedAt: true },
    });
    // Moving a transaction onto an archived account is not allowed; leaving it on one is.
    if (!account || (account.archivedAt && account.id !== existing.accountId)) {
      return { errors: { accountId: [ACCOUNT_ERROR] }, values };
    }
    const category = await findCategory(tx, user.id, entry.categoryId, entry.type);
    if (!category) return { errors: { categoryId: [CATEGORY_ERROR] }, values };

    const conversion = await convertToDefaultCurrency(tx, entry.amount, account.currency, user.defaultCurrency, entry.date);

    await adjustBalance(tx, user.id, existing.accountId, signedAmount(existing).neg());
    const updated = await tx.transaction.update({
      where: { id: existing.id },
      data: entryData(entry, account, category.id, conversion),
      select: { type: true, transferDirection: true, amount: true },
    });
    await adjustBalance(tx, user.id, account.id, signedAmount(updated));
    return undefined;
  });
  if (failure) return failure;

  redirect("/transactions");
}

export async function createTransfer(_prev: TransferFormState, formData: FormData): Promise<TransferFormState> {
  const user = await requireUser();

  const values = {
    fromAccountId: formText(formData, "fromAccountId"),
    toAccountId: formText(formData, "toAccountId"),
    amount: formText(formData, "amount"),
    toAmount: formText(formData, "toAmount"),
    date: formText(formData, "date"),
    note: formText(formData, "note"),
  };
  const parsed = transferSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { fromAccountId, toAccountId, note } = parsed.data;
  const date = isoDateToDate(parsed.data.date);

  const accounts = await prisma.account.findMany({
    where: { id: { in: [fromAccountId, toAccountId] }, userId: user.id, archivedAt: null },
    select: { id: true, currency: true },
  });
  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);
  if (!from) return { errors: { fromAccountId: [ACCOUNT_ERROR] }, values };
  if (!to) return { errors: { toAccountId: [ACCOUNT_ERROR] }, values };

  const amountOut = new Prisma.Decimal(parsed.data.amount);
  let amountIn = amountOut;
  if (from.currency !== to.currency) {
    if (!parsed.data.toAmount) {
      return {
        errors: { toAmount: [(await getI18n()).t("Hai tài khoản khác tiền tệ, vui lòng nhập số tiền nhận ({0}).", to.currency)] },
        values,
      };
    }
    amountIn = new Prisma.Decimal(parsed.data.toAmount);
  } else if (parsed.data.toAmount && !amountOut.equals(parsed.data.toAmount)) {
    return {
      errors: { toAmount: ["Hai tài khoản cùng tiền tệ nên số tiền nhận phải bằng số tiền chuyển (hoặc để trống)."] },
      values,
    };
  }

  await refreshRates();
  const [outConversion, inConversion] = await Promise.all([
    convertToDefaultCurrency(prisma, amountOut, from.currency, user.defaultCurrency, date),
    convertToDefaultCurrency(prisma, amountIn, to.currency, user.defaultCurrency, date),
  ]);
  const shared = { userId: user.id, type: "TRANSFER" as const, transferGroupId: randomUUID(), date, note };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        ...shared,
        ...outConversion,
        accountId: from.id,
        transferDirection: "OUT",
        amount: amountOut,
        currency: from.currency,
      },
    });
    await tx.transaction.create({
      data: {
        ...shared,
        ...inConversion,
        accountId: to.id,
        transferDirection: "IN",
        amount: amountIn,
        currency: to.currency,
      },
    });
    await adjustBalance(tx, user.id, from.id, amountOut.neg());
    await adjustBalance(tx, user.id, to.id, amountIn);
  });

  return { success: true };
}

// Deleting either side of a transfer removes both sides.
export async function deleteTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.$transaction(async (tx) => {
    const rows = await lockTransactionRows(tx, user.id, id.data);
    for (const row of rows) {
      await adjustBalance(tx, user.id, row.accountId, signedAmount(row).neg());
    }
    await tx.transaction.deleteMany({ where: { id: { in: rows.map((row) => row.id) }, userId: user.id } });
  });
}
