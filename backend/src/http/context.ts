import { AsyncLocalStorage } from "node:async_hooks";
import type { IssuedTokens } from "@fm/shared/auth";
import type { Locale } from "@fm/shared/i18n/config";
import type { CurrentUser } from "../auth/current-user";

// What a request carries while it is being handled. Kept in AsyncLocalStorage so that code deep inside a
// handler can ask "who is this?" and "which language?" without those being passed down every call.
export type RequestContext = {
  // The signed-in user, loaded from the access token; null for anonymous calls.
  user: CurrentUser | null;
  // The sign-in the access token belongs to; null for anonymous calls.
  sessionId: string | null;
  locale: Locale;
  // The browser's address as the frontend received it; null when unknown. See auth/throttle.ts.
  clientIp: string | null;
  // Sent only by the sign-out call, to revoke it.
  refreshToken?: string;
  // Things the handler wants the frontend to do for the browser (see CommandResult in @fm/shared/wire).
  effects: { tokens?: IssuedTokens | null; locale?: Locale };
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, run: () => T): T {
  return storage.run(context, run);
}

export function requestContext(): RequestContext {
  const context = storage.getStore();
  if (!context) throw new Error("No request is being handled");
  return context;
}
