import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { UserRole } from "@fm/database";
import { ACCESS_TOKEN_TTL_SECONDS } from "@fm/shared/auth";

const ISSUER = "financial-management";

// sessionId: the sign-in this token belongs to (see refresh_tokens.sessionId); revoking it ends the token too.
export type AccessTokenPayload = { userId: string; role: UserRole; sessionId: string };
const claimsSchema = z.object({ sub: z.string().min(1), role: z.enum(UserRole), sid: z.string().min(1) });

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export function signAccessToken({ userId, role, sessionId }: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role, sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessTokenPayload | null> {
  if (!token) return null;
  const key = getSecretKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: ISSUER,
    });
    const claims = claimsSchema.safeParse(payload);
    return claims.success ? { userId: claims.data.sub, role: claims.data.role, sessionId: claims.data.sid } : null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
