import { positiveIntegerFromEnv } from "../env";
import { requestContext } from "../http/context";
import { getI18n } from "../i18n";
import { hit, minutesLeft, used } from "../rate-limit";
import { HOUR_MS, MINUTE_MS } from "../time";

// Limits on signing in and signing up, against password guessing and floods of costly password hashing.
//
// Per e-mail: after LOGIN_FAILURES_PER_EMAIL wrong passwords in a window, that e-mail cannot sign in until
// the window ends. Counted the same way for e-mails that do not exist, so the limit reveals nothing.
// Per client address: attempts of any kind. The address comes from the frontend (see clientIp in
// http/context.ts) and is only as trustworthy as the X-Forwarded-For it saw: behind a reverse proxy that
// appends the client address it is exact; with Next.js exposed directly a client can choose it, and then
// the per-e-mail limit and the cap on concurrent hashing (auth/password.ts) are what still hold.
const WINDOW_MS = 15 * MINUTE_MS;
const LOGIN_FAILURES_PER_EMAIL = 5;

const LOGIN_ATTEMPTS_PER_IP = positiveIntegerFromEnv("AUTH_LIMIT_PER_IP", 30);
const REGISTRATIONS_PER_IP = positiveIntegerFromEnv("REGISTER_LIMIT_PER_IP", 10);

const emailKey = (email: string) => `login:fail:${email.toLowerCase()}`;

// A message for the form when this attempt must be refused, otherwise null. Counts the attempt.
export async function refuseLogin(email: string): Promise<string | null> {
  const { t } = await getI18n();
  const ip = requestContext().clientIp;
  if (ip && (await hit(`login:ip:${ip}`, WINDOW_MS)) > LOGIN_ATTEMPTS_PER_IP) {
    return t("Có quá nhiều lần đăng nhập từ địa chỉ này. Hãy thử lại sau {0} phút.", minutesLeft(WINDOW_MS));
  }
  if ((await used(emailKey(email), WINDOW_MS)) >= LOGIN_FAILURES_PER_EMAIL) {
    return t("Đăng nhập tạm khóa vì nhập sai quá nhiều lần. Hãy thử lại sau {0} phút.", minutesLeft(WINDOW_MS));
  }
  return null;
}

export async function recordLoginFailure(email: string): Promise<void> {
  await hit(emailKey(email), WINDOW_MS);
}

export async function refuseRegistration(): Promise<string | null> {
  const ip = requestContext().clientIp;
  if (ip && (await hit(`register:ip:${ip}`, HOUR_MS)) > REGISTRATIONS_PER_IP) {
    const { t } = await getI18n();
    return t("Có quá nhiều tài khoản được tạo từ địa chỉ này. Hãy thử lại sau {0} phút.", minutesLeft(HOUR_MS));
  }
  return null;
}
