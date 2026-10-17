import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, type IssuedTokens } from "@fm/shared/auth";
import { BACKEND_URL } from "@/lib/api/backend-url";
import { fetchBackend } from "@/lib/api/retry";
import { authCookies, clearedAuthCookies } from "@/lib/auth/cookies";

const PUBLIC_PATHS = ["/login", "/register"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// Reads the expiry out of the access token without checking its signature: only the backend holds the
// secret, and it verifies the token on every call. This only decides whether to ask for a new one.
function hasUnexpiredToken(token: string | undefined): boolean {
  try {
    const payload = JSON.parse(atob((token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// New tokens; null when the backend refused the refresh token (it is wrong, expired or revoked); "unavailable"
// when the backend could not be asked (restarting, down, erroring). The two must not be mixed up: only a
// refusal means the person is signed out. Treating "could not ask" as a refusal would sign everyone out
// whenever the backend restarts.
async function refreshSession(refreshToken: string): Promise<IssuedTokens | null | "unavailable"> {
  try {
    const response = await fetchBackend(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (response.status === 401) return null;
    if (!response.ok) return "unavailable";
    return ((await response.json()) as { tokens: IssuedTokens }).tokens;
  } catch {
    return "unavailable";
  }
}

// A fresh Content Security Policy for every page: scripts run only if they carry this request's nonce
// (Next.js adds it to its own scripts, see the "Content Security Policy" guide in the Next.js docs) or
// were loaded by one that did. Inline style attributes stay allowed: charts and the UI set them.
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // In development React needs eval for its debugging aids, and hot reload talks over a WebSocket.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Optimistic gate only: renews expired access tokens and bounces signed-out visitors to /login.
// Real authorization happens in the backend, on every call the pages and actions make to it.
// Also sets the security headers that change per request (the CSP nonce, HSTS on HTTPS).
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const fresh = hasUnexpiredToken(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  const refreshed = !fresh && refreshToken ? await refreshSession(refreshToken) : null;
  const unavailable = refreshed === "unavailable";
  const tokens = refreshed === "unavailable" ? null : refreshed;
  // Forward the new access token so Server Components rendering this same request already see it.
  if (tokens) request.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken);

  let response: NextResponse;
  // With the backend unreachable the page goes ahead (and shows its own error, or recovers on retry): the
  // person is neither sent to the sign-in page nor signed out for something that is not their doing.
  if (fresh || tokens || unavailable || isPublicPath(request.nextUrl.pathname)) {
    // Next.js reads the nonce for its scripts from the request's CSP header.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("content-security-policy", csp);
    requestHeaders.set("x-nonce", nonce);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    response = NextResponse.redirect(loginUrl);
  }

  if (tokens) {
    for (const cookie of authCookies(tokens)) response.cookies.set(cookie);
  } else if (!fresh && refreshToken && !unavailable) {
    for (const cookie of clearedAuthCookies()) response.cookies.set(cookie);
  }

  response.headers.set("content-security-policy", csp);
  // Only meaningful over HTTPS (directly, or behind a proxy that says so).
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  if (https) response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
