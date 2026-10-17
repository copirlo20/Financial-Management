import { createRequire } from "node:module";

// Run through tests/run-e2e.mjs, which sets the working directory to the project root.
const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const require = createRequire(root + "package.json");
const { Client } = require("pg");
const ExcelJS = require("exceljs");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = `e2e-tpl-${Date.now()}@example.com`;
let failures = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const get = (path, jar = {}) => fetch(BASE + path, { redirect: "manual", headers: { cookie: cookieHeader(jar) } });
const page = async (path, jar) => (await get(path, jar)).text();
function formWith(html, marker) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`no form containing ${marker}`);
  return form;
}
async function submit(path, form, data, jar) {
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
function formDefaults(form) {
  const values = {};
  for (const [select] of form.matchAll(/<select[\s\S]*?<\/select>/g)) {
    const name = select.match(/name="([^"]*)"/)?.[1];
    const selected = select.match(/<option[^>]*value="([^"]*)"[^>]*selected/);
    if (name) values[name] = decode(selected?.[1] ?? select.match(/<option[^>]*value="([^"]*)"/)?.[1] ?? "");
  }
  values.headerRow = form.match(/name="headerRow"[^>]*value="([^"]*)"/)?.[1] ?? form.match(/value="([^"]*)"[^>]*name="headerRow"/)?.[1];
  return values;
}

const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
await db.connect();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

try {
  const reg = await page("/register");
  const res0 = await submit("/register", formWith(reg, 'name="confirmPassword"'), { name: "Tpl", email: EMAIL, password: "abc12345", confirmPassword: "abc12345" }, {});
  const jar = {};
  for (const header of res0.headers.getSetCookie()) { const [pair] = header.split(";"); jar[pair.slice(0, pair.indexOf("="))] = pair.slice(pair.indexOf("=") + 1); }
  const uid = (await one(`select id from users where email = $1`, [EMAIL])).id;

  check("template requires login", [307, 401].includes((await get("/imports/template?format=csv")).status));
  check("unknown format rejected", (await get("/imports/template?format=exe", jar)).status === 400);
  const html = await page("/imports", jar);
  check("imports page links to both templates", html.includes('href="/imports/template?format=csv"') && html.includes('href="/imports/template?format=xlsx"'));

  for (const format of ["csv", "xlsx"]) {
    const res = await get(`/imports/template?format=${format}`, jar);
    const bytes = Buffer.from(await res.arrayBuffer());
    check(`${format}: downloads as an attachment`, res.status === 200 && res.headers.get("content-disposition") === `attachment; filename="mau-sao-ke.${format}"`, `${res.status} ${res.headers.get("content-disposition")}`);
    if (format === "csv") {
      check("csv: UTF-8 with BOM and readable Vietnamese", bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && bytes.toString("utf8").includes("Ngày giao dịch,Diễn giải,Số tiền"));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes);
      const sheet = workbook.worksheets[0];
      check("xlsx: opens with header, a date cell and a number cell", sheet.getCell("A1").value === "Ngày giao dịch" && sheet.getCell("A2").value instanceof Date && sheet.getCell("C2").value === -45000);
    }

    // Round trip: the template must import with the auto-detected mapping, untouched.
    const accountId = (await one(
      `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt")
       values (gen_random_uuid()::text,$1,$2,'BANK','VND',0,0,now()) returning id`, [uid, `Acc ${format}`])).id;
    const up = await submit("/imports", formWith(await page("/imports", jar), 'name="file"'), { accountId, file: { bytes, name: `mau-sao-ke.${format}` } }, jar);
    const location = up.headers.get("location") ?? "";
    const mapForm = formWith(await page(location, jar), 'name="headerRow"');
    const defaults = formDefaults(mapForm);
    check(`${format}: columns are detected without manual mapping`, defaults.headerRow === "1" && defaults.dateColumn === "0" && defaults.descriptionColumn === "1" && defaults.amountMode === "signed" && defaults.amountColumn === "2" && defaults.dateFormat === "DMY" && defaults.decimalSeparator === ".", JSON.stringify(defaults));
    await submit(location, mapForm, defaults, jar);
    const rows = (await db.query(`select type, amount, note, date from transactions where "accountId" = $1 order by date`, [accountId])).rows;
    const balance = (await one(`select "currentBalance" b from accounts where id = $1`, [accountId])).b;
    check(`${format}: sample rows import correctly`,
      rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}/${r.date.getMonth() + 1}:${r.note}`).join(" | ") ===
        "EXPENSE:45000.00:5/10:Ví dụ: Cà phê sáng | INCOME:20000000.00:6/10:Ví dụ: Lương tháng 10 | EXPENSE:1250000.50:7/10:Ví dụ: Tiền điện" && balance === "18704999.50",
      `${rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}/${r.date.getMonth() + 1}`).join(" | ")} → ${balance}`);
  }
} finally {
  await db.query(`delete from users where email = $1`, [EMAIL]);
  await db.end();
}
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
