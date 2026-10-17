import type { IssuedTokens } from "@fm/shared/auth";
import type { Locale } from "@fm/shared/i18n/config";
import { requestContext } from "./context";

// Thrown by redirect() to end a handler; the route wrapper turns it into { redirect } in the response.
export class RedirectSignal extends Error {
  constructor(readonly path: string) {
    super(`Redirect to ${path}`);
  }
}

// Ends the handler and tells the frontend to send the browser to `path` (a path of the frontend).
export function redirect(path: string): never {
  throw new RedirectSignal(path);
}

// Hands new session tokens to the frontend to store as cookies; null signs the browser out.
export function setSessionTokens(tokens: IssuedTokens | null): void {
  requestContext().effects.tokens = tokens;
}

// Tells the frontend to remember this language for the browser.
export function setLocale(locale: Locale): void {
  requestContext().effects.locale = locale;
}
