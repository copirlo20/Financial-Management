import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { formText, type FormState } from "@fm/shared/form-state";
import { formatImportErrors, serializeImportErrors } from "@fm/shared/imports";
import { requireUser, type CurrentUser } from "../auth/current-user";
import { getTransactionOptions } from "../data/transaction-options";
import { convertToDefaultCurrency, refreshRates, type Conversion } from "../exchange";
import { redirect } from "../http/respond";
import { getI18n } from "../i18n";
import {
  AiImportError,
  aiImportAvailable,
  extractDocumentRows,
  extractTableRows,
  takeAiQuota,
} from "../imports/ai";
import { readAnalysis, type ImportAnalysis } from "../imports/analysis";
import { buildRows, type ParsedRow, type RowError } from "../imports/mapping";
import {
  MAX_FILE_BYTES,
  StatementFileError,
  parseStatementFile,
  statementExtension,
  type Cell,
} from "../imports/parse-file";
import { deleteImportFile, importFileExtension, readImportFile, saveImportFile } from "../imports/storage";
import { idSchema } from "../validations/common";
import { documentConfirmSchema, mappingSchema } from "../validations/import";

export type UploadFormState = FormState<"accountId" | "file">;
const MAPPING_FIELDS = [
  "headerRow",
  "dateColumn",
  "dateFormat",
  "amountMode",
  "amountColumn",
  "debitColumn",
  "creditColumn",
  "descriptionColumn",
  "decimalSeparator",
  "expenseCategoryId",
  "incomeCategoryId",
] as const;
type MappingField = (typeof MAPPING_FIELDS)[number];
// rowCategories: what the user picked per row (row number -> category id, "" = default), kept across a failed submit.
type RowCategoryState = { rowCategories?: Record<string, string> };
export type MappingFormState = FormState<MappingField>;
export type DocumentFormState =
  | (NonNullable<FormState<"expenseCategoryId" | "incomeCategoryId">> & RowCategoryState)
  | undefined;
export type RollbackState = { message: string } | undefined;

const MAX_PENDING_IMPORTS = 5;
const INSERT_CHUNK = 1000;
const ROW_CATEGORY_PREFIX = "rowCategory-";
const MAX_ROW_CATEGORIES = 500;

export async function uploadImport(_prev: UploadFormState, formData: FormData): Promise<UploadFormState> {
  const user = await requireUser();
  const values = { accountId: formText(formData, "accountId") };
  const useAi = formData.get("useAi") === "on";

  const accountId = idSchema.safeParse(values.accountId);
  if (!accountId.success) return { errors: { accountId: ["Vui lòng chọn tài khoản."] }, values };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { file: ["Vui lòng chọn file sao kê."] }, values };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { errors: { file: ["File vượt quá 5 MB."] }, values };
  }
  const extension = statementExtension(file.name);
  const isPdf = /\.pdf$/i.test(file.name);
  if (!extension && !isPdf) {
    const supported = aiImportAvailable()
      ? "Chỉ hỗ trợ file .csv, .xlsx và .pdf (file .xls cũ cần lưu lại thành .xlsx)."
      : "Chỉ hỗ trợ file .csv và .xlsx (file .xls cũ cần lưu lại thành .xlsx).";
    return { errors: { file: [supported] }, values };
  }
  // A PDF has no cells to read, so without the assistant there is nothing to import from it.
  if (isPdf && !aiImportAvailable()) {
    return { errors: { file: ["File PDF cần trợ lý AI, nhưng trợ lý AI chưa được cấu hình trên máy chủ."] }, values };
  }
  if (isPdf && !useAi) {
    return { errors: { file: ["File PDF chỉ đọc được bằng trợ lý AI. Hãy bật trợ lý AI rồi tải lại."] }, values };
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId.data, userId: user.id, archivedAt: null },
    select: { id: true, currency: true },
  });
  if (!account) return { errors: { accountId: ["Tài khoản không tồn tại hoặc đã được lưu trữ."] }, values };

  const pending = await prisma.importBatch.count({ where: { userId: user.id, status: "PENDING" } });
  if (pending >= MAX_PENDING_IMPORTS) {
    return {
      message: (await getI18n()).t("Bạn đang có {0} lần nhập chưa hoàn tất. Hãy xác nhận hoặc hủy bớt trước khi tải file mới.", pending),
      values,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let table: Cell[][] | null = null;
  if (extension) {
    try {
      table = await parseStatementFile(buffer, extension);
    } catch (error) {
      if (error instanceof StatementFileError) {
        return { errors: { file: [(await getI18n()).t(error.message, ...error.args)] }, values };
      }
      throw error;
    }
  } else if (!buffer.subarray(0, 1024).includes("%PDF-")) {
    return { errors: { file: ["Không đọc được file. Hãy kiểm tra file có đúng định dạng PDF không."] }, values };
  }

  let analysis: ImportAnalysis | null = null;
  if (useAi && aiImportAvailable()) {
    if (!(await takeAiQuota(user.id))) {
      return {
        message: "Bạn đã dùng trợ lý AI nhiều lần trong một giờ qua. Hãy thử lại sau, hoặc bỏ chọn trợ lý AI để tự ghép cột.",
        values,
      };
    }
    const { categoryOptions } = await getTransactionOptions(user.id);
    try {
      const extraction = table
        ? await extractTableRows(user.id, table, categoryOptions, account.currency)
        : await extractDocumentRows(user.id, buffer, categoryOptions, account.currency);
      analysis = { kind: "document", ...extraction };
    } catch (error) {
      if (!(error instanceof AiImportError)) throw error;
      // A spreadsheet can still be mapped by hand; a PDF cannot be read any other way.
      if (!table) return { errors: { file: [error.message] }, values };
      analysis = { kind: "table", failed: true };
    }
    if (analysis.kind === "document" && analysis.rows.length === 0) {
      if (!table) return { errors: { file: ["Trợ lý AI không tìm thấy giao dịch nào trong file PDF này."] }, values };
      analysis = { kind: "table", failed: true };
    }
  }

  // A file the assistant read is not kept: its rows live in the analysis, so nothing would read it again.
  const extracted = analysis?.kind === "document" ? analysis : null;
  const tempFileKey = table && extension && !extracted ? await saveImportFile(buffer, extension) : null;
  const rowCount = extracted ? extracted.rows.length + extracted.errors.length : (table?.length ?? 0);
  const batch = await prisma.importBatch.create({
    data: {
      userId: user.id,
      accountId: account.id,
      fileName: file.name.slice(0, 200),
      tempFileKey,
      rowCount,
      aiAnalysis: analysis ?? undefined,
    },
    select: { id: true },
  });

  redirect(`/imports/${batch.id}`);
}

type PendingBatch = {
  id: string;
  tempFileKey: string | null;
  aiAnalysis: Prisma.JsonValue;
  account: { id: string; currency: string; archivedAt: Date | null };
};

function loadPendingBatch(batchId: string, userId: string): Promise<PendingBatch | null> {
  return prisma.importBatch.findFirst({
    where: { id: batchId, userId, status: "PENDING" },
    select: {
      id: true,
      tempFileKey: true,
      aiAnalysis: true,
      account: { select: { id: true, currency: true, archivedAt: true } },
    },
  });
}

function submittedRowCategories(formData: FormData): Record<string, string> {
  const picked: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(ROW_CATEGORY_PREFIX) || typeof value !== "string") continue;
    if (++count > MAX_ROW_CATEGORIES) break;
    picked[key.slice(ROW_CATEGORY_PREFIX.length)] = value;
  }
  return picked;
}

// Decides each row's category: what the user picked for that row, else what the assistant suggested,
// else the default for the row's type. Only categories this user may use, of the row's type, count.
async function rowCategoryPicker(
  userId: string,
  defaults: { expenseCategoryId: string; incomeCategoryId: string },
  picked: Record<string, string>,
  suggested: Record<string, string>,
) {
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    select: { id: true, type: true },
  });
  const typeOf = new Map(categories.map((category) => [category.id, category.type]));
  if (typeOf.get(defaults.expenseCategoryId) !== "EXPENSE") {
    return { error: { expenseCategoryId: ["Danh mục khoản chi không hợp lệ."] } };
  }
  if (typeOf.get(defaults.incomeCategoryId) !== "INCOME") {
    return { error: { incomeCategoryId: ["Danh mục khoản thu không hợp lệ."] } };
  }
  return {
    categoryOf(row: ParsedRow): string {
      const key = String(row.rowNumber);
      // An empty pick means "use the default", which overrides the assistant's suggestion too.
      const candidate = key in picked ? picked[key] : suggested[key];
      if (candidate && typeOf.get(candidate) === row.type) return candidate;
      return row.type === "EXPENSE" ? defaults.expenseCategoryId : defaults.incomeCategoryId;
    },
  };
}

// Writes the rows of a pending batch as transactions. Returns false when the batch was no longer pending.
async function writeImport(
  user: CurrentUser,
  batch: PendingBatch,
  rows: ParsedRow[],
  errors: RowError[],
  categoryOf: (row: ParsedRow) => string,
  columnMapping: Prisma.InputJsonObject,
): Promise<boolean> {
  const account = batch.account;

  // The hash includes how many identical rows came before it in this file, so two genuine identical
  // purchases on one day are both kept, while re-importing the same file skips every row.
  const occurrences = new Map<string, number>();
  const hashed = rows.map((row) => {
    const signed = row.type === "EXPENSE" ? `-${row.amount}` : row.amount;
    const key = [account.id, row.date, new Prisma.Decimal(signed).toFixed(2), row.description.toLowerCase()].join("|");
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return { ...row, dedupeHash: createHash("sha256").update(`${key}|${occurrence}`).digest("hex") };
  });

  const existing = await prisma.transaction.findMany({
    where: { userId: user.id, accountId: account.id, dedupeHash: { in: hashed.map((row) => row.dedupeHash) } },
    select: { dedupeHash: true },
  });
  const known = new Set(existing.map((row) => row.dedupeHash));
  const fresh = hashed.filter((row) => !known.has(row.dedupeHash));

  if (account.currency !== user.defaultCurrency) await refreshRates();
  const rates = new Map<string, Prisma.Decimal | null>();
  let balanceDelta = new Prisma.Decimal(0);
  // Identical createdAt/updatedAt lets rollback tell untouched rows from ones the user edited afterwards.
  const now = new Date();
  const data: Prisma.TransactionCreateManyInput[] = [];
  for (const row of fresh) {
    const amount = new Prisma.Decimal(row.amount);
    const date = isoDateToDate(row.date);
    let conversion: Conversion;
    if (account.currency === user.defaultCurrency) {
      conversion = { amountInDefaultCurrency: amount, exchangeRateUsed: new Prisma.Decimal(1) };
    } else {
      // One rate lookup per distinct date, not per row.
      let rate = rates.get(row.date);
      if (rate === undefined) {
        rate = (await convertToDefaultCurrency(prisma, amount, account.currency, user.defaultCurrency, date))
          .exchangeRateUsed;
        rates.set(row.date, rate);
      }
      conversion = {
        amountInDefaultCurrency: rate ? amount.mul(rate).toDecimalPlaces(2) : null,
        exchangeRateUsed: rate,
      };
    }
    balanceDelta = row.type === "INCOME" ? balanceDelta.plus(amount) : balanceDelta.minus(amount);
    data.push({
      userId: user.id,
      accountId: account.id,
      categoryId: categoryOf(row),
      type: row.type,
      amount,
      currency: account.currency,
      date,
      note: row.description || null,
      source: "IMPORT",
      importBatchId: batch.id,
      dedupeHash: row.dedupeHash,
      createdAt: now,
      updatedAt: now,
      ...conversion,
    });
  }

  const claimed = await prisma.$transaction(
    async (tx) => {
      // Claiming the batch first makes a double submit a no-op instead of a double import.
      const claim = await tx.importBatch.updateMany({
        where: { id: batch.id, userId: user.id, status: "PENDING" },
        data: {
          status: "PROCESSED",
          columnMapping,
          tempFileKey: null,
          // Like the temp file, the analysis holds statement contents and is not needed after the import.
          aiAnalysis: Prisma.DbNull,
          rowCount: rows.length + errors.length,
          importedCount: fresh.length,
          skippedCount: hashed.length - fresh.length,
          errorMessage: serializeImportErrors(errors),
        },
      });
      if (claim.count === 0) return false;

      for (let start = 0; start < data.length; start += INSERT_CHUNK) {
        await tx.transaction.createMany({ data: data.slice(start, start + INSERT_CHUNK) });
      }
      await tx.account.updateMany({
        where: { id: account.id, userId: user.id },
        data: { currentBalance: { increment: balanceDelta } },
      });
      return true;
    },
    { timeout: 60_000 },
  );
  if (!claimed) return false;

  if (batch.tempFileKey) await deleteImportFile(batch.tempFileKey);
  return true;
}

export async function confirmImport(
  batchId: string,
  _prev: MappingFormState,
  formData: FormData,
): Promise<MappingFormState> {
  const user = await requireUser();
  const { t } = await getI18n();

  const values = Object.fromEntries(MAPPING_FIELDS.map((field) => [field, formText(formData, field)])) as Record<
    MappingField,
    string
  >;
  const keep = { values };
  const id = idSchema.safeParse(batchId);
  if (!id.success) return { message: "Không tìm thấy lần nhập.", ...keep };

  const parsed = mappingSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, ...keep };
  }
  const { expenseCategoryId, incomeCategoryId, ...mapping } = parsed.data;

  const batch = await loadPendingBatch(id.data, user.id);
  if (!batch || !batch.tempFileKey) return { message: "Lần nhập này không còn chờ xác nhận.", ...keep };
  if (batch.account.archivedAt) return { message: "Tài khoản đã được lưu trữ nên không nhập thêm được.", ...keep };

  const picker = await rowCategoryPicker(user.id, { expenseCategoryId, incomeCategoryId }, {}, {});
  if ("error" in picker) return { errors: picker.error, ...keep };

  const buffer = await readImportFile(batch.tempFileKey);
  if (!buffer) return { message: "File tạm đã bị xóa. Hãy hủy lần nhập này và tải file lên lại.", ...keep };
  const table = await parseStatementFile(buffer, importFileExtension(batch.tempFileKey));

  const { rows, errors } = buildRows(table, mapping);
  if (rows.length === 0) {
    return {
      message: `${t("Không đọc được dòng giao dịch nào với cách ghép cột này. Hãy kiểm tra lại dòng tiêu đề, cột ngày và cột số tiền.")}\n${formatImportErrors(serializeImportErrors(errors), t) ?? ""}`,
      ...keep,
    };
  }

  const written = await writeImport(user, batch, rows, errors, picker.categoryOf, {
    ...mapping,
    expenseCategoryId,
    incomeCategoryId,
  });
  if (!written) return { message: "Lần nhập này không còn chờ xác nhận.", ...keep };
  redirect(`/imports/${batch.id}`);
}

// Confirms an import whose rows the assistant extracted at upload (any PDF, or a spreadsheet it read).
export async function confirmDocumentImport(
  batchId: string,
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await requireUser();

  const values = {
    expenseCategoryId: formText(formData, "expenseCategoryId"),
    incomeCategoryId: formText(formData, "incomeCategoryId"),
  };
  const keep = { values, rowCategories: submittedRowCategories(formData) };
  const id = idSchema.safeParse(batchId);
  if (!id.success) return { message: "Không tìm thấy lần nhập.", ...keep };

  const parsed = documentConfirmSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, ...keep };

  const batch = await loadPendingBatch(id.data, user.id);
  const analysis = batch && readAnalysis(batch.aiAnalysis);
  if (!batch || analysis?.kind !== "document") return { message: "Lần nhập này không còn chờ xác nhận.", ...keep };
  if (batch.account.archivedAt) return { message: "Tài khoản đã được lưu trữ nên không nhập thêm được.", ...keep };

  const picker = await rowCategoryPicker(user.id, parsed.data, keep.rowCategories, analysis.categories);
  if ("error" in picker) return { errors: picker.error, ...keep };

  const written = await writeImport(user, batch, analysis.rows, analysis.errors, picker.categoryOf, {
    source: "ai-document",
    ...parsed.data,
  });
  if (!written) return { message: "Lần nhập này không còn chờ xác nhận.", ...keep };
  redirect(`/imports/${batch.id}`);
}

export async function cancelImport(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  const batch = await prisma.importBatch.findFirst({
    where: { id: id.data, userId: user.id, status: "PENDING" },
    select: { id: true, tempFileKey: true },
  });
  if (batch) {
    const deleted = await prisma.importBatch.deleteMany({
      where: { id: batch.id, userId: user.id, status: "PENDING" },
    });
    if (deleted.count > 0 && batch.tempFileKey) await deleteImportFile(batch.tempFileKey);
  }

  redirect("/imports");
}

type BatchTransaction = { type: string; amount: Prisma.Decimal; accountId: string };

// Deletes a batch's transactions and takes their amounts back out of the account balances.
// The caller holds the locks on the batch and on these rows.
async function removeBatchTransactions(
  tx: Prisma.TransactionClient,
  batchId: string,
  userId: string,
  rows: BatchTransaction[],
) {
  const deltas = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    const revert = row.type === "INCOME" ? row.amount.neg() : row.amount;
    deltas.set(row.accountId, (deltas.get(row.accountId) ?? new Prisma.Decimal(0)).plus(revert));
  }
  for (const [accountId, delta] of deltas) {
    await tx.account.updateMany({ where: { id: accountId, userId }, data: { currentBalance: { increment: delta } } });
  }
  await tx.transaction.deleteMany({ where: { importBatchId: batchId, userId } });
}

// Removes an import in any state from the history, together with its uploaded file and every
// transaction it created (also ones edited by hand since), giving the amounts back to the balances.
export async function deleteImport(_prev: RollbackState, formData: FormData): Promise<RollbackState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: "Không tìm thấy lần nhập." };

  const tempFileKey = await prisma.$transaction(
    async (tx) => {
      // The lock makes a confirm or rollback racing with this delete wait, then find nothing to act on.
      const locked = await tx.$queryRaw<{ tempFileKey: string | null }[]>`
        SELECT "tempFileKey" FROM "import_batches" WHERE "id" = ${id.data} AND "userId" = ${user.id} FOR UPDATE`;
      if (locked.length === 0) return undefined;

      await tx.$queryRaw`
        SELECT "id" FROM "transactions" WHERE "importBatchId" = ${id.data} AND "userId" = ${user.id} FOR UPDATE`;
      const rows = await tx.transaction.findMany({
        where: { importBatchId: id.data, userId: user.id },
        select: { type: true, amount: true, accountId: true },
      });
      await removeBatchTransactions(tx, id.data, user.id, rows);
      await tx.importBatch.deleteMany({ where: { id: id.data, userId: user.id } });
      return locked[0].tempFileKey;
    },
    { timeout: 60_000 },
  );
  if (tempFileKey === undefined) return { message: "Không tìm thấy lần nhập." };

  if (tempFileKey) await deleteImportFile(tempFileKey);
  redirect("/imports");
}

export async function rollbackImport(_prev: RollbackState, formData: FormData): Promise<RollbackState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: "Không tìm thấy lần nhập." };

  const failure = await prisma.$transaction(
    async (tx): Promise<RollbackState> => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "import_batches"
        WHERE "id" = ${id.data} AND "userId" = ${user.id} AND "status" = 'PROCESSED'
        FOR UPDATE`;
      if (locked.length === 0) return { message: "Lần nhập này không thể hoàn tác." };

      // Lock the rows so an edit racing with this rollback cannot change an amount after it was read.
      await tx.$queryRaw`
        SELECT "id" FROM "transactions" WHERE "importBatchId" = ${id.data} AND "userId" = ${user.id} FOR UPDATE`;
      const rows = await tx.transaction.findMany({
        where: { importBatchId: id.data, userId: user.id },
        select: { id: true, type: true, amount: true, accountId: true, createdAt: true, updatedAt: true },
      });
      const edited = rows.filter((row) => row.updatedAt.getTime() !== row.createdAt.getTime()).length;
      if (edited > 0) {
        return {
          message: (await getI18n()).t("Có {0} giao dịch trong lần nhập này đã được sửa tay nên không hoàn tác được cả lô. Hãy xóa từng giao dịch nếu cần.", edited),
        };
      }

      await removeBatchTransactions(tx, id.data, user.id, rows);
      await tx.importBatch.updateMany({
        where: { id: id.data, userId: user.id },
        data: { status: "ROLLED_BACK" },
      });
      return undefined;
    },
    { timeout: 60_000 },
  );
  if (failure) return failure;

  return undefined;
}
