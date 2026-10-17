import type { IssuedTokens } from "./auth";
import type { Locale } from "./i18n/config";

// How frontend and backend talk. Bodies are JSON, with two kinds of value JSON cannot carry tagged so
// that they arrive as what they were: money (decimals) and dates.
export const DECIMAL_TAG = "$decimal";
export const DATE_TAG = "$date";

// Headers the frontend sends with every call.
export const LOCALE_HEADER = "x-locale";
export const REFRESH_TOKEN_HEADER = "x-refresh-token";
// The browser's address as the frontend received it (used for per-address limits on signing in).
export const CLIENT_IP_HEADER = "x-client-ip";

// A form submission: the fields of the browser's form, in order (a name may repeat).
export type CommandBody = { fields: [string, string][] };

// The backend's answer to a command. `state` goes back to the form. The rest are things only the
// frontend can do for the browser: go to another page, or set cookies.
export type CommandResult<State = unknown> = {
  state?: State;
  redirect?: string;
  // New session tokens to store; null means sign out.
  tokens?: IssuedTokens | null;
  locale?: Locale;
};
