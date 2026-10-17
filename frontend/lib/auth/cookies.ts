import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  type IssuedTokens,
} from "@fm/shared/auth";

// The session tokens come from the backend; the frontend only stores them, in cookies the page's
// JavaScript cannot read.
type AuthCookie = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

function authCookie(name: string, value: string, maxAge: number): AuthCookie {
  return {
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function authCookies({ accessToken, refreshToken }: IssuedTokens): AuthCookie[] {
  return [
    authCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_TTL_SECONDS),
    authCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_TTL_SECONDS),
  ];
}

export function clearedAuthCookies(): AuthCookie[] {
  return [authCookie(ACCESS_TOKEN_COOKIE, "", 0), authCookie(REFRESH_TOKEN_COOKIE, "", 0)];
}
