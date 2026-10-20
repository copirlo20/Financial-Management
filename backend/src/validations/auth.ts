import { z } from "zod";

const emailField = z
  .string({ error: "Vui lòng nhập email." })
  .trim()
  .toLowerCase()
  .max(254, { error: "Email quá dài." })
  .pipe(z.email({ error: "Email không hợp lệ." }));

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Vui lòng nhập mật khẩu." })
    .min(1, { error: "Vui lòng nhập mật khẩu." })
    .max(128, { error: "Mật khẩu quá dài." }),
});

// Shared with the settings forms, so signing up and changing the name or password follow the same rules.
export const personNameField = z
  .string({ error: "Vui lòng nhập họ tên." })
  .trim()
  .min(1, { error: "Vui lòng nhập họ tên." })
  .max(100, { error: "Họ tên tối đa 100 ký tự." });

export const newPasswordField = (requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .min(8, { error: "Mật khẩu phải có ít nhất 8 ký tự." })
    .max(128, { error: "Mật khẩu tối đa 128 ký tự." })
    .regex(/[A-Za-z]/, { error: "Mật khẩu phải có ít nhất một chữ cái." })
    .regex(/[0-9]/, { error: "Mật khẩu phải có ít nhất một chữ số." });

export const registerSchema = z
  .object({
    name: personNameField,
    email: emailField,
    password: newPasswordField("Vui lòng nhập mật khẩu."),
    confirmPassword: z.string({ error: "Vui lòng nhập lại mật khẩu." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

// Where to go after signing in: only a path of this site. An allow-list rather than a block-list, because
// browsers silently drop tabs and line breaks in URLs ("/<tab>/evil.example" becomes "//evil.example") and
// treat "\" like "/". The refine resolves the path the way a browser would and insists on staying here.
const SAFE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/;
const SITE = "http://site.invalid";

export const redirectPathSchema = z
  .string()
  .max(2000)
  .regex(SAFE_PATH)
  .refine((path) => URL.parse(path, SITE)?.origin === SITE)
  .catch("/dashboard");
