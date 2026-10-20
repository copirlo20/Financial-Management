import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { LOCALES } from "@fm/shared/i18n/config";
import { newPasswordField, personNameField } from "./auth";

export const languageSchema = z.enum(LOCALES, { error: "Ngôn ngữ không được hỗ trợ." });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Vui lòng nhập mật khẩu hiện tại." })
      .min(1, { error: "Vui lòng nhập mật khẩu hiện tại." })
      .max(128, { error: "Mật khẩu quá dài." }),
    newPassword: newPasswordField("Vui lòng nhập mật khẩu mới."),
    confirmPassword: z.string({ error: "Vui lòng nhập lại mật khẩu mới." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Mật khẩu mới phải khác mật khẩu hiện tại.",
    path: ["newPassword"],
  });

export const settingsSchema = z.object({
  name: personNameField,
  language: languageSchema,
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES, { error: "Loại tiền tệ không được hỗ trợ." }),
});
