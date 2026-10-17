import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@fm/shared/auth";
import { LOCALE_COOKIE } from "@fm/shared/i18n/config";
import {
  CLIENT_IP_HEADER,
  LOCALE_HEADER,
  REFRESH_TOKEN_HEADER,
  type CommandBody,
  type CommandResult,
} from "@fm/shared/wire";
import { authCookies, clearedAuthCookies } from "@/lib/auth/cookies";
import { getI18n, getLanguage } from "@/lib/i18n/server";
import { BackendConnectionError, fetchBackend } from "./retry";
import { decode } from "./wire";

// Everything the frontend knows or changes goes through the backend's API. These calls are made by the
// frontend's server side only (Server Components, Server Actions, route handlers): the browser never
// talks to the backend, and the session token never reaches the page's JavaScript.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

type Query = Record<string, string | string[] | undefined>;

function queryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) params.append(name, item);
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

// The browser's address: the last entry of X-Forwarded-For, which is the one added by whatever stands
// directly in front of this server (a reverse proxy, or Next.js itself when there is none).
async function clientIp(): Promise<string | null> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  return forwarded.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? null;
}

// A call to the backend as the signed-in user (if any), in the language the browser uses.
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const requestHeaders = new Headers(init.headers);
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  requestHeaders.set(LOCALE_HEADER, await getLanguage());
  const ip = await clientIp();
  if (ip) requestHeaders.set(CLIENT_IP_HEADER, ip);
  return fetchBackend(`${BACKEND_URL}/api${path}`, { ...init, headers: requestHeaders, cache: "no-store" });
}

function unexpected(response: Response, what: string): Error {
  return new Error(`The backend answered ${response.status} to ${what}`);
}

// Reads data for a page. null means the backend has no such thing for this user (the page then shows
// "not found"); a signed-out caller is sent to the sign-in page.
export async function apiGet<T>(path: string, query?: Query): Promise<T | null> {
  const response = await backendFetch(path + queryString(query));
  if (response.status === 404) return null;
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw unexpected(response, `GET ${path}`);
  return decode(await response.json()) as T;
}

// For pages whose data always exists (lists, summaries): a 404 there is a fault, not "not found".
export async function apiLoad<T>(path: string, query?: Query): Promise<T> {
  const data = await apiGet<T>(path, query);
  if (data === null) throw new Error(`The backend has nothing at GET ${path}`);
  return data;
}

// Finishes a Server Action from the backend's answer: stores the cookies it asked for, drops cached
// pages (something may have changed), follows its redirect, and returns the state for the form.
async function finish<State>(response: Response, what: string): Promise<State> {
  if (response.status === 401) redirect("/login");
  // The backend answers "not found" to anything the caller may not know exists (admin routes for a
  // non-admin, for one); the browser gets the same.
  if (response.status === 404) notFound();
  if (!response.ok) throw unexpected(response, what);
  const result = decode(await response.json()) as CommandResult<State>;

  const cookieStore = await cookies();
  if (result.tokens !== undefined) {
    for (const cookie of result.tokens ? authCookies(result.tokens) : clearedAuthCookies()) cookieStore.set(cookie);
  }
  if (result.locale) {
    cookieStore.set(LOCALE_COOKIE, result.locale, { path: "/", maxAge: 365 * 24 * 60 * 60, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
  if (result.redirect) redirect(result.redirect);
  return result.state as State;
}

type Method = "POST" | "PUT" | "DELETE";

// Sends a submitted form to a backend route that changes something. Call it from a Server Action.
export async function command<State = void>(method: Method, path: string, formData?: FormData): Promise<State> {
  const body: CommandBody = { fields: [] };
  for (const [name, value] of formData?.entries() ?? []) {
    // Files travel separately (see upload); "$ACTION…" fields are Next.js bookkeeping.
    if (typeof value === "string" && !name.startsWith("$ACTION")) body.fields.push([name, value]);
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Signing out has to name the session to end.
  if (path === "/auth/logout") {
    const refreshToken = (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) headers[REFRESH_TOKEN_HEADER] = refreshToken;
  }
  const response = await backendFetch(path, { method, headers, body: JSON.stringify(body) });
  return finish<State>(response, `${method} ${path}`);
}

// Sends one uploaded file as the request body; the form's other fields go in the query string.
export async function upload<State>(path: string, file: File | null, query: Query): Promise<State> {
  const response = await backendFetch(path + queryString(query), {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(file?.name ?? "") },
    body: file ? await file.arrayBuffer() : new ArrayBuffer(0),
  });
  return finish<State>(response, `POST ${path}`);
}

// What a form's action may answer: every form state of this app can carry a message (and the values to
// put back in the fields).
type MessageState = { message?: string; values?: Record<string, string> } | undefined;

// When the backend cannot be talked to, a form says so itself, keeping what was typed, instead of the page
// turning into an error page. Whether the change may have been made decides what the person is told:
// sending it again after a cut-off could make it twice.
async function answerOnForm<State extends MessageState>(send: Promise<State>, formData?: FormData): Promise<State> {
  try {
    return await send;
  } catch (error) {
    if (!(error instanceof BackendConnectionError)) throw error;
    console.error(error);
    const { t } = await getI18n();
    const values: Record<string, string> = {};
    // Passwords are never sent back to the page, as the backend never does either.
    for (const [name, value] of formData?.entries() ?? []) {
      if (typeof value === "string" && !name.startsWith("$ACTION") && !/password/i.test(name)) values[name] = value;
    }
    const message = error.mayHaveRun
      ? t("Mất kết nối tới máy chủ khi đang lưu. Thay đổi có thể đã được lưu hoặc chưa, hãy kiểm tra lại trước khi gửi lại.")
      : t("Không kết nối được máy chủ nên chưa có gì thay đổi. Hãy thử lại sau giây lát.");
    return { message, values } as State;
  }
}

// command() for a form that shows its state (useActionState): connection failures come back as a message.
export function formCommand<State extends MessageState>(method: Method, path: string, formData?: FormData): Promise<State> {
  return answerOnForm(command<State>(method, path, formData), formData);
}

// upload() for a form that shows its state, in the same way.
export function formUpload<State extends MessageState>(path: string, file: File | null, query: Query, formData?: FormData): Promise<State> {
  return answerOnForm(upload<State>(path, file, query), formData);
}

// A record id taken from a submitted form, as a URL path segment. An empty or odd value still gives a
// valid path; the backend then answers as it does for any id it does not know.
export function idSegment(formData: FormData, field = "id"): string {
  const value = formData.get(field);
  return encodeURIComponent(typeof value === "string" && value ? value : "-");
}
