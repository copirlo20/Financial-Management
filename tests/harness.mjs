import { rmSync } from "node:fs";
import { createRequire } from "node:module";

// What every suite shares (tests/e2e over HTTP, tests/browser in a real browser): the project's settings,
// a PASS/FAIL tally, reading pages and their forms, sending forms the way a browser without JavaScript does,
// cookies, signing up, statement PDFs, and the database.
// Suites run through tests/run-e2e.mjs, which sets the working directory to the project root.

export const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const require = createRequire(root + "package.json");
const { Client } = require("pg");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

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
// The same cookies for a real browser (DevTools Protocol Network.setCookie).
export const browserCookies = (jar) => Object.entries(jar).filter(([, v]) => v).map(([name, value]) => ({ name, value, httpOnly: true }));

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

// What a form would send untouched: each <select>'s chosen (or first) option, and the header-row field
// when there is one.
export function formDefaults(form) {
  const values = {};
  for (const [select] of form.matchAll(/<select[\s\S]*?<\/select>/g)) {
    const name = select.match(/name="([^"]*)"/)?.[1];
    const selected = select.match(/<option[^>]*value="([^"]*)"[^>]*selected/) ?? select.match(/<option[^>]*selected[^>]*value="([^"]*)"/);
    if (name) values[name] = decode(selected?.[1] ?? select.match(/<option[^>]*value="([^"]*)"/)?.[1] ?? "");
  }
  const headerRow = form.match(/name="headerRow"[^>]*value="([^"]*)"/)?.[1] ?? form.match(/value="([^"]*)"[^>]*name="headerRow"/)?.[1];
  if (headerRow !== undefined) values.headerRow = headerRow;
  return values;
}

// A new account, signed in: the cookies its registration set.
export async function registerUser(email, name) {
  const html = await page("/register");
  const res = await submit("/register", formWith(html, 'name="confirmPassword"'), { name, email, password: PASSWORD, confirmPassword: PASSWORD }, {});
  return readCookies(res, {});
}

// ---------- Statement files ----------
// A statement as an Excel file: `rows` on its first sheet, each cell as given (text, number or date).
export async function statementXlsx(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sao ke");
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// A bank statement as a PDF, laid out the way banks print one: text placed in columns, no cells. Each row
// is one line of cells; "\n" in a cell wraps it onto the lines below. `widths` sets the columns (100 pt
// by default), `right` the right-aligned ones; after `perPage` rows a new page starts, with `header`
// repeated at its top. `password` locks the file, `extraPages` adds empty pages, `stray` puts texts
// ({ text, x, y }) anywhere on the first page, even far off it.
export function statementPdf(rows, { widths = [], right = [], perPage = Infinity, header, password, extraPages = 0, stray = [] } = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 40, ...(password ? { userPassword: password } : {}) });
  doc.registerFont("regular", root + "backend/assets/fonts/NotoSans-Regular.ttf");
  doc.font("regular").fontSize(9);
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  for (const { text, x, y } of stray) doc.text(text, x, y, { lineBreak: false });
  let y = 40;
  const draw = (row) => {
    let x = 40;
    let lines = 1;
    row.forEach((cell, column) => {
      const width = widths[column] ?? 100;
      String(cell ?? "").split("\n").forEach((text, line) => {
        // ccmp off: with it, pdfkit splits "ị" and "ụ" into a letter and a dot whose text it records wrongly.
        if (text) doc.text(text, x, y + line * 10, { width: width - 6, align: right.includes(column) ? "right" : "left", lineBreak: false, features: { ccmp: false } });
        lines = Math.max(lines, line + 1);
      });
      x += width;
    });
    y += lines * 10 + 8;
  };
  rows.forEach((row, index) => {
    if (index > 0 && index % perPage === 0) {
      doc.addPage();
      y = 40;
      if (header) draw(header);
    }
    draw(row);
  });
  for (let i = 0; i < extraPages; i++) doc.addPage();
  doc.end();
  return done;
}

// ---------- Database ----------
// Connected by each suite (and closed in its finally), so a suite that never needs it does not wait on it.
export const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
export const one = async (sql, params) => (await db.query(sql, params)).rows[0];
export const userId = async (email) => (await one(`select id from users where email = $1`, [email])).id;

// ---------- Fixtures written straight to the database ----------
export const systemCategory = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;

// An account of `owner` holding `balance`, with no transactions yet.
export async function addAccount(owner, name, currency = "VND", balance = 0, type = "CASH") {
  return (await one(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt")
     values (gen_random_uuid()::text,$1,$2,$3,$4,$5,$5,now()) returning id`,
    [owner, name, type, currency, balance],
  )).id;
}

// Where uploaded statements wait between upload and confirm (backend/src/imports/storage.ts).
export const importFilePath = (key) => `${root}backend/storage/imports/${key}`;

// Removes test users and all that is theirs: their rows go with them (cascade), and the statement files of
// their unfinished imports are deleted from disk.
export async function removeUsers(emails) {
  const { rows } = await db.query(
    `select b."tempFileKey" k from import_batches b join users u on u.id = b."userId" where u.email = any($1) and b."tempFileKey" is not null`,
    [emails],
  );
  for (const { k } of rows) rmSync(importFilePath(k), { force: true });
  await db.query(`delete from users where email = any($1)`, [emails]);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
