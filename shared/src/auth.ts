// The backend issues the tokens; the frontend keeps them in httpOnly cookies and presents the access
// token on every call to the backend. Both sides need the names and lifetimes.
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type IssuedTokens = { accessToken: string; refreshToken: string };
