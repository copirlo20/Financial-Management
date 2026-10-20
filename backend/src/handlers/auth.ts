import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import type { UserRole } from "@fm/database";
import { formText } from "@fm/shared/form-state";
import { isLocale } from "@fm/shared/i18n/config";
import {
  PASSWORD_CHECK_BUSY_MESSAGE,
  PasswordCheckBusyError,
  hashPassword,
  simulatePasswordCheck,
  verifyPassword,
} from "../auth/password";
import { currentSessionId, requireUser } from "../auth/current-user";
import { issueTokens, revokeRefreshToken, revokeSession, revokeUserSessions } from "../auth/session";
import { recordLoginFailure, refuseLogin, refuseRegistration } from "../auth/throttle";
import { requestContext } from "../http/context";
import { redirect, setLocale, setSessionTokens } from "../http/respond";
import { getLanguage } from "../i18n";
import { loginSchema, redirectPathSchema, registerSchema } from "../validations/auth";

export type AuthFormState =
  | {
      message?: string;
      errors?: Partial<Record<"name" | "email" | "password" | "confirmPassword", string[]>>;
      values?: { name?: string; email?: string };
    }
  | undefined;

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { name: formText(formData, "name"), email: formText(formData, "email") };
  const parsed = registerSchema.safeParse({
    ...values,
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, email, password } = parsed.data;
  const refused = await refuseRegistration();
  if (refused) return { message: refused, values };

  let user: { id: string; role: UserRole };
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), locale: await getLanguage() },
      select: { id: true, role: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { email: ["Email này đã được đăng ký."] }, values };
    }
    if (error instanceof PasswordCheckBusyError) return { message: PASSWORD_CHECK_BUSY_MESSAGE, values };
    throw error;
  }

  setSessionTokens(await issueTokens(user));
  redirect("/dashboard");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: formText(formData, "email") };
  const parsed = loginSchema.safeParse({ ...values, password: formText(formData, "password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, password } = parsed.data;
  // Before any password is hashed: a refused attempt costs next to nothing.
  const refused = await refuseLogin(email);
  if (refused) return { message: refused, values };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, passwordHash: true, locale: true },
  });
  let passwordMatches: boolean;
  try {
    if (user) passwordMatches = await verifyPassword(password, user.passwordHash);
    else {
      await simulatePasswordCheck(password);
      passwordMatches = false;
    }
  } catch (error) {
    if (error instanceof PasswordCheckBusyError) return { message: PASSWORD_CHECK_BUSY_MESSAGE, values };
    throw error;
  }
  if (!user || !passwordMatches) {
    await recordLoginFailure(email);
    return { message: "Email hoặc mật khẩu không đúng.", values };
  }
  if (user.status !== "ACTIVE") {
    return { message: "Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.", values };
  }

  setSessionTokens(await issueTokens(user));
  // Signing in on a new device brings the saved language with it.
  if (isLocale(user.locale)) setLocale(user.locale);
  redirect(redirectPathSchema.parse(formData.get("next")));
}

// Ends this sign-in: its access token stops working at once, not only its refresh token.
export async function logout(): Promise<void> {
  const sessionId = currentSessionId();
  if (sessionId) await revokeSession(sessionId);
  // The access token may already have expired; the refresh token still names the session to end.
  const refreshToken = requestContext().refreshToken;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  setSessionTokens(null);
  redirect("/login");
}

// Ends every sign-in of this user on every device, this one included.
export async function logoutEverywhere(): Promise<void> {
  const user = await requireUser();
  await revokeUserSessions(user.id);
  setSessionTokens(null);
  redirect("/login");
}
