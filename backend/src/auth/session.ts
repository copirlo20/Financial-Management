import type { UserRole } from "@fm/database";
import { randomUUID } from "node:crypto";
import { prisma } from "@fm/database";
import { REFRESH_TOKEN_TTL_SECONDS, type IssuedTokens } from "@fm/shared/auth";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens";

// Concurrent requests (e.g. parallel prefetches) can all present the same refresh token right as the
// access token expires; within this window a just-rotated token is still accepted instead of being treated as stolen.
const ROTATION_GRACE_MS = 10_000;

// A new sign-in starts a session; rotating a refresh token continues the one it belongs to.
export async function issueTokens(user: { id: string; role: UserRole }, sessionId: string = randomUUID()): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  const accessToken = await signAccessToken({ userId: user.id, role: user.role, sessionId });
  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(rawToken: string): Promise<IssuedTokens | null> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      expiresAt: true,
      rotatedAt: true,
      revokedAt: true,
      user: { select: { id: true, role: true, status: true } },
    },
  });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) return null;

  if (stored.rotatedAt) {
    if (Date.now() - stored.rotatedAt.getTime() > ROTATION_GRACE_MS) {
      // An old rotated token being replayed means it leaked: sign the user out on every device.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
  } else {
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null },
      data: { rotatedAt: new Date() },
    });
  }

  if (stored.user.status !== "ACTIVE") return null;
  return issueTokens(stored.user, stored.sessionId);
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Ends one sign-in: its refresh tokens stop working, and so do its access tokens (current-user.ts checks).
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// Ends every sign-in of the user, except `keepSessionId` when given (the one making the request).
export async function revokeUserSessions(userId: string, keepSessionId?: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, ...(keepSessionId ? { sessionId: { not: keepSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
