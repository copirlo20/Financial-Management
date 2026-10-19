import { createRequire } from "node:module";
import { root, STAMP, check, report, get, page, formWith, submit, registerUser, db, one, userId, formDefaults } from "../harness.mjs";

const require = createRequire(root + "package.json");
const ExcelJS = require("exceljs");

const EMAIL = `e2e-tpl-${STAMP}@example.com`;

await db.connect();

try {
  const jar = await registerUser(EMAIL, "Tpl");
  const uid = await userId(EMAIL);

  check("template requires login", [307, 401].includes((await get("/imports/template")).status));
  const html = await page("/imports", jar);
  check("imports page links to the Excel template only", html.includes('href="/imports/template"') && !/template\?format=csv|File mẫu CSV/.test(html));

  const res = await get("/imports/template", jar);
  const bytes = Buffer.from(await res.arrayBuffer());
  check("downloads as an Excel attachment", res.status === 200 && res.headers.get("content-disposition") === 'attachment; filename="mau-sao-ke.xlsx"', `${res.status} ${res.headers.get("content-disposition")}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.worksheets[0];
  check("opens with header, a date cell and a number cell", sheet.getCell("A1").value === "Ngày giao dịch" && sheet.getCell("A2").value instanceof Date && sheet.getCell("C2").value === -45000);

  // Round trip: the template must import with the auto-detected mapping, untouched.
  const accountId = (await one(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt")
     values (gen_random_uuid()::text,$1,'Acc','BANK','VND',0,0,now()) returning id`, [uid])).id;
  const up = await submit("/imports", formWith(await page("/imports", jar), 'name="file"'), { accountId, file: { bytes, name: "mau-sao-ke.xlsx" } }, jar);
  const location = up.headers.get("location") ?? "";
  const mapForm = formWith(await page(location, jar), 'name="headerRow"');
  const defaults = formDefaults(mapForm);
  check("columns are detected without manual mapping", defaults.headerRow === "1" && defaults.dateColumn === "0" && defaults.descriptionColumn === "1" && defaults.amountMode === "signed" && defaults.amountColumn === "2" && defaults.dateFormat === "DMY" && defaults.decimalSeparator === ".", JSON.stringify(defaults));
  await submit(location, mapForm, defaults, jar);
  const rows = (await db.query(`select type, amount, note, date from transactions where "accountId" = $1 order by date`, [accountId])).rows;
  const balance = (await one(`select "currentBalance" b from accounts where id = $1`, [accountId])).b;
  check("sample rows import correctly",
    rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}/${r.date.getMonth() + 1}:${r.note}`).join(" | ") ===
      "EXPENSE:45000.00:5/10:Ví dụ: Cà phê sáng | INCOME:20000000.00:6/10:Ví dụ: Lương tháng 10 | EXPENSE:1250000.50:7/10:Ví dụ: Tiền điện" && balance === "18704999.50",
    `${rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}/${r.date.getMonth() + 1}`).join(" | ")} → ${balance}`);
} finally {
  await db.query(`delete from users where email = $1`, [EMAIL]);
  await db.end();
}
report();
