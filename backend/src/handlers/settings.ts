import { z } from "zod";
import { prisma } from "@fm/database";
import { formText, type FormState } from "@fm/shared/form-state";
import { currentSessionId, getCurrentUser, requireUser } from "../auth/current-user";
import { PasswordCheckBusyError, hashPassword, verifyPassword } from "../auth/password";
import { revokeUserSessions } from "../auth/session";
import { recordLoginFailure, refuseLogin } from "../auth/throttle";
import { exchangeRate, recomputeConversions, refreshRates } from "../exchange";
import { setLocale } from "../http/respond";
import { getI18n } from "../i18n";
import { changePasswordSchema, languageSchema, settingsSchema } from "../validations/settings";

export type SettingsFormState = FormState<"name" | "language" | "defaultCurrency">;
export type PasswordFormState = FormState<"currentPassword" | "newPassword" | "confirmPassword">;
export type RefreshRatesState = { message: string } | undefined;

// Works signed out too (login/register pages); signed-in users also get it saved to their profile.
export async function setLanguage(formData: FormData): Promise<void> {
  const language = languageSchema.safeParse(formData.get("language"));
  if (!language.success) return;

  setLocale(language.data);
  const user = await getCurrentUser();
  if (user) await prisma.user.updateMany({ where: { id: user.id }, data: { locale: language.data } });
}

export async function updateSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  const { t } = await getI18n();

  const values = {
    name: formText(formData, "name"),
    language: formText(formData, "language"),
    defaultCurrency: formText(formData, "defaultCurrency"),
  };
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { name, language, defaultCurrency } = parsed.data;

  if (defaultCurrency === user.defaultCurrency) {
    await prisma.user.updateMany({ where: { id: user.id }, data: { name, locale: language } });
  } else {
    // Every stored snapshot and budget limit is expressed in the old default currency, so all of them
    // are re-expressed in the new one. That needs a rate for every currency the user's data uses.
    await refreshRates();
    const [transactionCurrencies, budgetCurrencies] = await Promise.all([
      prisma.transaction.findMany({ where: { userId: user.id }, distinct: ["currency"], select: { currency: true } }),
      prisma.budget.findMany({ where: { userId: user.id }, distinct: ["currency"], select: { currency: true } }),
    ]);
    const today = new Date();
    const needed = new Set([...transactionCurrencies, ...budgetCurrencies].map((row) => row.currency));
    for (const currency of needed) {
      if (!(await exchangeRate(prisma, currency, defaultCurrency, today))) {
        return {
          errors: {
            defaultCurrency: [t("Chưa có tỷ giá giữa {0} và {1} nên chưa đổi được tiền tệ mặc định.", currency, defaultCurrency)],
          },
          values,
        };
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.user.updateMany({ where: { id: user.id }, data: { name, locale: language, defaultCurrency } });
        await recomputeConversions(tx, { userId: user.id, onlyMissing: false });
        for (const { currency } of budgetCurrencies) {
          if (currency === defaultCurrency) continue;
          const rate = await exchangeRate(tx, currency, defaultCurrency, today);
          // Checked above; GREATEST keeps a tiny limit from rounding down to zero.
          await tx.$executeRaw`
            UPDATE "budgets"
            SET "amountLimit" = GREATEST(round("amountLimit" * ${rate}::numeric, 2), 0.01),
                "currency" = ${defaultCurrency},
                "updatedAt" = now() AT TIME ZONE 'UTC'
            WHERE "userId" = ${user.id} AND "currency" = ${currency}`;
        }
      },
      { timeout: 60_000 },
    );
  }

  setLocale(language);
  return { success: true };
}

export async function refreshExchangeRates(): Promise<RefreshRatesState> {
  await requireUser();
  const { t } = await getI18n();

  const result = await refreshRates({ manual: true });
  if (result === "failed") return { message: t("Không lấy được tỷ giá mới. Đang dùng tỷ giá đã lưu.") };
  if (result === "fresh") return { message: t("Tỷ giá vừa được cập nhật trong 10 phút qua.") };
  return { message: t("Đã cập nhật tỷ giá.") };
}

// Changes the password after checking the current one. Every other sign-in of the user ends (whoever
// knew the old password is signed out); this one stays. Wrong current passwords count towards the same
// lock as wrong passwords at sign-in, so this form cannot be used to guess one either.
export async function changePassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const user = await requireUser();
  // Passwords are never sent back to fill the form again.
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formText(formData, "currentPassword"),
    newPassword: formText(formData, "newPassword"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const refused = await refuseLogin(user.email);
  if (refused) return { message: refused };

  const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  try {
    if (!(await verifyPassword(parsed.data.currentPassword, stored.passwordHash))) {
      await recordLoginFailure(user.email);
      return { errors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } };
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.updateMany({ where: { id: user.id }, data: { passwordHash } });
  } catch (error) {
    if (error instanceof PasswordCheckBusyError) return { message: "Hệ thống đang bận. Hãy thử lại sau ít giây." };
    throw error;
  }

  await revokeUserSessions(user.id, currentSessionId() ?? undefined);
  return { success: true, message: "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất." };
}
