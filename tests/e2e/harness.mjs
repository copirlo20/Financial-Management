import { createRequire } from "node:module";

// What every e2e suite shares: the project's settings, a PASS/FAIL tally, reading pages and their forms,
// sending forms the way a browser without JavaScript does, cookies, and the database.
// Suites run through tests/run-e2e.mjs, which sets the working directory to the project root.

export const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const { Client } = createRequire(root + "package.json")("pg");

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Makes the e-mail addresses of one run unique; the "e2e-" prefix is what the runner cleans up.
export const STAMP = Date.now();
export const PASSWORD = "abc12345";

// ---------- Results ----------
let failures = 0;
export function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}
// The last lines of a suite: the runner reads them, and the exit code.
export function report() {
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

// ---------- Pages ----------
export const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// The text of a page as a person reads it: no scripts or styles, entities decoded, React's markers and
// non-breaking spaces (from number and date formatting) taken out.
export const clean = (s) =>
  decode(s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, ""))
    .replace(/<!-- -->/g, "")
    .replace(/\u00a0|\u202f/g, " ");

// ---------- Cookies ----------
export function readCookies(res, jar = {}) {
  for (const header of res.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    const i = pair.indexOf("=");
    jar[pair.slice(0, i).trim()] = pair.slice(i + 1);
  }
  return jar;
}
// A cleared cookie (empty value) is left out, as the browser drops it.
export const cookieHeader = (jar) => Object.entries(jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");

// ---------- Requests ----------
export const get = (path, jar = {}) => fetch(BASE + path, { redirect: "manual", headers: { cookie: cookieHeader(jar) } });
export const page = async (path, jar) => (await get(path, jar)).text();

export function formWith(html, marker) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`no form containing ${marker}`);
  return form;
}

// Sends a form as the browser would without JavaScript: its hidden fields (the Server Action's own among
// them) unless `data` sets them, then `data`. A value { bytes, name } is sent as a file.
export async function submit(path, form, data, jar) {
  const body = new FormData();
  for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = decode(tag.match(/name="([^"]*)"/)?.[1] ?? "");
    if (name && !(name in data)) body.append(name, decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object") body.append(k, new Blob([v.bytes]), v.name);
    else body.append(k, v);
  }
  return fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie: cookieHeader(jar), origin: BASE } });
}

// A new account, signed in: the cookies its registration set.
export async function registerUser(email, name) {
  const html = await page("/register");
  const res = await submit("/register", formWith(html, 'name="confirmPassword"'), { name, email, password: PASSWORD, confirmPassword: PASSWORD }, {});
  return readCookies(res, {});
}

// ---------- Database ----------
// Connected by each suite (and closed in its finally), so a suite that never needs it does not wait on it.
export const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
export const one = async (sql, params) => (await db.query(sql, params)).rows[0];
export const userId = async (email) => (await one(`select id from users where email = $1`, [email])).id;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
