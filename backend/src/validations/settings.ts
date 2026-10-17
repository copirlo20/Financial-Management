import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { LOCALES } from "@fm/shared/i18n/config";

export const languageSchema = z.enum(LOCALES, { error: "Ngôn ngữ không được hỗ trợ." });

const newPasswordField = z
  .string({ error: "Vui lòng nhập mật khẩu mới." })
  .min(8, { error: "Mật khẩu phải có ít nhất 8 ký tự." })
  .max(128, { error: "Mật khẩu tối đa 128 ký tự." })
  .regex(/[A-Za-z]/, { error: "Mật khẩu phải có ít nhất một chữ cái." })
  .regex(/[0-9]/, { error: "Mật khẩu phải có ít nhất một chữ số." });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Vui lòng nhập mật khẩu hiện tại." })
      .min(1, { error: "Vui lòng nhập mật khẩu hiện tại." })
      .max(128, { error: "Mật khẩu quá dài." }),
    newPassword: newPasswordField,
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
  name: z
    .string({ error: "Vui lòng nhập họ tên." })
    .trim()
    .min(1, { error: "Vui lòng nhập họ tên." })
    .max(100, { error: "Họ tên tối đa 100 ký tự." }),
  language: languageSchema,
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES, { error: "Loại tiền tệ không được hỗ trợ." }),
});
