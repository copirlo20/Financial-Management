import { prisma } from "@fm/database";
import { requestContext } from "../http/context";
import { HttpError } from "../http/errors";
import { verifyAccessToken } from "./tokens";

const USER_FIELDS = { id: true, email: true, name: true, role: true, defaultCurrency: true, locale: true } as const;

// Hits the database so that a disabled or deleted account, or a session that was ended (sign-out,
// "sign out everywhere", password change), loses access immediately rather than when the JWT expires.
// A session is open while it has a refresh token that is neither revoked nor expired.
export async function loadUser(accessToken: string) {
  const token = await verifyAccessToken(accessToken);
  if (!token) return null;
  const user = await prisma.user.findFirst({
    where: {
      id: token.userId,
      status: "ACTIVE",
      refreshTokens: { some: { sessionId: token.sessionId, revokedAt: null, expiresAt: { gt: new Date() } } },
    },
    select: USER_FIELDS,
  });
  return user && { user, sessionId: token.sessionId };
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>["user"];

// The user making the current request (see http/context.ts), or null when nobody is signed in.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return requestContext().user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = requestContext().user;
  if (!user) throw new HttpError(401, "Not signed in");
  return user;
}

// The session the current request was made in (see revokeSession in session.ts).
export function currentSessionId(): string | null {
  return requestContext().sessionId;
}

// 404 rather than "forbidden" so non-admins cannot tell that admin routes exist.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(404, "Not found");
  return user;
}
