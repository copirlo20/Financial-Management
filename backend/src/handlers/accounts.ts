import { z } from "zod";
import { prisma } from "@fm/database";
import { formText, type FormState } from "@fm/shared/form-state";
import { requireUser } from "../auth/current-user";
import { sameName } from "../data/names";
import { redirect } from "../http/respond";
import { getI18n } from "../i18n";
import { MAX_ACCOUNTS_PER_USER } from "../limits";
import { createAccountSchema, updateAccountSchema } from "../validations/account";
import { idSchema } from "../validations/common";

export type AccountFormState = FormState<"name" | "type" | "currency" | "initialBalance">;

const NOT_FOUND_MESSAGE = "Không tìm thấy tài khoản.";

async function isNameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
  return (await prisma.account.findFirst({ where: { userId, ...sameName(name, exceptId) }, select: { id: true } })) !== null;
}

export async function createAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    type: formText(formData, "type"),
    currency: formText(formData, "currency"),
    initialBalance: formText(formData, "initialBalance"),
  };
  const parsed = createAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, type, currency, initialBalance } = parsed.data;
  if (await isNameTaken(user.id, name)) {
    return { errors: { name: ["Bạn đã có tài khoản với tên này."] }, values };
  }
  if ((await prisma.account.count({ where: { userId: user.id } })) >= MAX_ACCOUNTS_PER_USER) {
    return {
      message: (await getI18n()).t("Mỗi người dùng có tối đa {0} tài khoản, tính cả tài khoản đã lưu trữ.", MAX_ACCOUNTS_PER_USER),
      values,
    };
  }

  await prisma.account.create({
    data: { userId: user.id, name, type, currency, initialBalance, currentBalance: initialBalance },
  });

  return { success: true };
}

export async function updateAccount(
  accountId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    type: formText(formData, "type"),
    initialBalance: formText(formData, "initialBalance"),
  };
  const id = idSchema.safeParse(accountId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = updateAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, type, initialBalance } = parsed.data;
  if (await isNameTaken(user.id, name, id.data)) {
    return { errors: { name: ["Bạn đã có tài khoản với tên này."] }, values };
  }

  // One statement so the cached balance shifts by exactly the change in opening balance,
  // even if transactions or another edit land at the same moment.
  const updated = await prisma.$executeRaw`
    UPDATE "accounts"
    SET "name" = ${name},
        "type" = ${type}::"AccountType",
        "currentBalance" = "currentBalance" + (${initialBalance}::numeric - "initialBalance"),
        "initialBalance" = ${initialBalance}::numeric,
        "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE "id" = ${id.data} AND "userId" = ${user.id}`;
  if (updated === 0) return { message: NOT_FOUND_MESSAGE, values };

  redirect("/accounts");
}

async function setArchived(formData: FormData, archived: boolean): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.account.updateMany({
    where: { id: id.data, userId: user.id, archivedAt: archived ? null : { not: null } },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export async function archiveAccount(formData: FormData): Promise<void> {
  await setArchived(formData, true);
}

export async function restoreAccount(formData: FormData): Promise<void> {
  await setArchived(formData, false);
}
