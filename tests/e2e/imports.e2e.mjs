import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32, deflateRawSync } from "node:zlib";
import { root, STAMP, check, report, clean, get, page, formWith, submit, registerUser, db, one, userId, formDefaults, statementPdf, removeUsers, importFilePath, addAccount } from "../harness.mjs";

const require = createRequire(root + "package.json");
const ExcelJS = require("exceljs");

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;

// Reads the values the server pre-selected in the mapping form (i.e. the auto-detected mapping).
await db.connect();

const balance = async (id) => (await one(`select "currentBalance" b from accounts where id = $1`, [id])).b;
const batchOf = (id) => one(`select * from import_batches where id = $1`, [id]);
const txCount = async (accountId) => (await one(`select count(*)::int n from transactions where "accountId" = $1`, [accountId])).n;

// ---------- Fixture files ----------
// A bank's PDF: a heading, money out and money in in two right-aligned columns, a description that wraps,
// lines that are no transaction (a note, the totals) and two rows that cannot be imported.
const PDF1 = await statementPdf(
  [
    ["NGAN HANG ABC"],
    ["Sao kê tài khoản 123"],
    ["Ngày GD", "Diễn giải", "Ghi nợ", "Ghi có"],
    ["05/10/2026", "Cà phê, bánh", "45,000", ""],
    ["05/10/2026", "Cà phê, bánh", "45,000", ""],
    ["06/10/2026", "Lương\ntháng 10", "", "20,000,000"],
    ["07/10/2026 08:15:00", "Tiền điện", "1,250,000.50", ""],
    ["dòng rác", "abc"],
    ["08/10/2026", "Cả hai", "1", "2"],
    ["32/10/2026", "Ngày sai", "5,000", ""],
    ["Tổng cộng", "", "1,340,000.50", "20,000,000"],
  ],
  { widths: [110, 200, 90, 90], right: [2, 3] },
);
// One signed column, comma decimals, ISO dates.
const PDF2 = await statementPdf(
  [
    ["Date", "Description", "Amount"],
    ["2026-10-05", "Cà phê, bánh", "-45.000,00"],
    ["2026-10-09", "Cà phê đô", "150.000,00"],
    ["2026-10-10", "Phí", "-1.100,5"],
  ],
  { widths: [110, 200, 110], right: [2] },
);
// A minimal zip writer, to build archives exceljs would never produce. `claimedSize` lets an entry lie
// about how large it inflates to, which is how a "zip bomb" slips past checks that trust the header.
function makeZip(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const { name, data, claimedSize = data.length } of entries) {
    const nameBytes = Buffer.from(name);
    const packed = deflateRawSync(data, { level: 9 });
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(claimedSize, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    parts.push(header, nameBytes, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(claimedSize, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, nameBytes);
    offset += header.length + nameBytes.length + packed.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, central, end]);
}

async function makeXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sao ke");
  sheet.addRow(["Ngày", "Nội dung", "Số tiền"]);
  sheet.addRow([new Date(Date.UTC(2026, 9, 11)), "Excel chi", -20.5]);
  sheet.addRow([new Date(Date.UTC(2026, 9, 12)), "Excel thu", 5.25]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = await userId(A);
  const bId = await userId(B);
  const bank = await addAccount(aId, "Bank", "VND", 1000000);
  const usd = await addAccount(aId, "Đô", "USD", 100);
  const spare = await addAccount(aId, "Phụ", "VND", 0);
  const pages = await addAccount(aId, "Nhiều trang", "VND", 0);
  const usd2 = await addAccount(aId, "Đô 2", "USD", 0);
  await addAccount(bId, "Bank B", "VND", 0);
  const salary = (await one(`select id from categories where "systemKey" = 'salary'`)).id;

  check("signed-out /imports redirects to login", (await get("/imports")).status === 307);
  let html = await page("/imports", jarA);
  check("imports page shows empty state, nav link and upload form", clean(html).includes("Chưa có lần nhập nào") && html.includes('href="/imports"') && html.includes('name="file"'));
  const upload = async (file, accountId = bank, jar = jarA) =>
    submit("/imports", formWith(await page("/imports", jar), 'name="file"'), { accountId, file }, jar);
  const uploadOk = async (file, accountId = bank, jar = jarA) => {
    const res = await upload(file, accountId, jar);
    const location = res.headers.get("location") ?? "";
    if (res.status !== 303 || !location.startsWith("/imports/")) throw new Error(`upload failed: ${res.status} ${clean(await res.text()).match(/role="alert"[^>]*>([^<]*)/)?.[1]}`);
    return location.split("/").pop();
  };

  // ---------- Upload validation ----------
  check("unsupported extension rejected", clean(await (await upload({ bytes: PDF1, name: "sao-ke.txt" })).text()).includes("Chỉ hỗ trợ file .pdf và .xlsx"));
  check("a CSV statement is no longer accepted", clean(await (await upload({ bytes: Buffer.from("Ngày,Số tiền\n05/10/2026,-45000\n"), name: "sao-ke.csv" })).text()).includes("Chỉ hỗ trợ file .pdf và .xlsx"));
  check("empty file rejected", clean(await (await upload({ bytes: Buffer.alloc(0), name: "rong.pdf" })).text()).includes("Vui lòng chọn file sao kê."));
  check("oversized file rejected", clean(await (await upload({ bytes: Buffer.alloc(5 * 1024 * 1024 + 10, "a"), name: "to.pdf" })).text()).includes("File vượt quá 5 MB."));
  check("a .pdf that is not a PDF is rejected", clean(await (await upload({ bytes: Buffer.from("hello"), name: "gia.pdf" })).text()).includes("đúng định dạng PDF"));
  check("a PDF without text (a scan) is refused with the reason", clean(await (await upload({ bytes: await statementPdf([]), name: "scan.pdf" })).text()).includes("File PDF không có chữ để đọc"));
  check("a password-protected PDF is refused with the reason", clean(await (await upload({ bytes: await statementPdf([["01/10/2026", "Khóa", "-1"]], { password: "1234" }), name: "khoa.pdf" })).text()).includes("File PDF có mật khẩu"));
  check("a PDF with too many pages is refused", clean(await (await upload({ bytes: await statementPdf([["x"]], { extraPages: 200 }), name: "dai.pdf" })).text()).includes("File PDF có hơn 200 trang"));
  // Columns are counted point by point across the text's width: text a billion points off the page must
  // not make that a billion slots.
  const strayStart = Date.now();
  const strayId = await uploadOk({ bytes: await statementPdf([["Ngày", "Nội dung", "Số tiền"], ["05/10/2026", "Xa trang", "-1,000"]], { right: [2], stray: [{ text: "05/10/2026 -9", x: 1e9, y: 300 }, { text: "rác", x: -1e9, y: 300 }] }), name: "xa.pdf" }, spare);
  const strayPreview = clean(await page(`/imports/${strayId}`, jarA));
  check("text placed far off the page is ignored, and reading stays quick", strayPreview.includes("Xa trang") && !strayPreview.includes("rác") && Date.now() - strayStart < 10_000, `${Date.now() - strayStart} ms`);
  await submit(`/imports/${strayId}`, formWith(await page(`/imports/${strayId}`, jarA), "Hủy lần nhập này"), {}, jarA);
  check("corrupt xlsx rejected", clean(await (await upload({ bytes: Buffer.from("not a zip at all"), name: "hong.xlsx" })).text()).includes("Không đọc được file."));
  // 30 MB of spaces packs into about 30 KB: the upload limit alone would let it through.
  const filler = Buffer.alloc(30 * 1024 * 1024, 0x20);
  const bomb = makeZip([{ name: "[Content_Types].xml", data: Buffer.from("<Types/>") }, { name: "xl/worksheets/sheet1.xml", data: filler }]);
  const liar = makeZip([{ name: "xl/worksheets/sheet1.xml", data: filler, claimedSize: 1000 }]);
  check("a zip-bomb workbook is small enough to upload", bomb.length < 1024 * 1024, `${bomb.length} bytes`);
  let started = Date.now();
  check("a workbook that inflates too far is refused", clean(await (await upload({ bytes: bomb, name: "bom.xlsx" })).text()).includes("File Excel quá lớn khi giải nén"));
  check("…also when it lies about its size", clean(await (await upload({ bytes: liar, name: "bom-gia.xlsx" })).text()).includes("File Excel quá lớn khi giải nén"));
  check("refusing it is quick and the server keeps answering", Date.now() - started < 10_000 && (await get("/imports", jarA)).status === 200, `${Date.now() - started} ms`);
  check("a workbook with an unknown compression method is refused as unreadable", clean(await (await upload({ bytes: (() => { const zip = makeZip([{ name: "a.xml", data: Buffer.from("<a/>") }]); zip.writeUInt16LE(99, zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 10); return zip; })(), name: "la.xlsx" })).text()).includes("Không đọc được file."));
  check("other user's account rejected", clean(await (await upload({ bytes: PDF1, name: "a.pdf" }, bank, jarB)).text()).includes("Tài khoản không tồn tại"));
  check("rejected uploads leave no batch", (await one(`select count(*)::int n from import_batches where "userId" = any($1)`, [[aId, bId]])).n === 0);

  // ---------- PDF with a heading, wrapped text and junk lines, split debit/credit ----------
  const batch1 = await uploadOk({ bytes: PDF1, name: "sao-ke-thang-10.pdf" });
  let batch = await batchOf(batch1);
  check("upload creates a pending batch and stores the file", batch.status === "PENDING" && batch.rowCount === 9 && batch.tempFileKey?.endsWith(".pdf") && existsSync(importFilePath(batch.tempFileKey)), `${batch.rowCount} ${batch.tempFileKey}`);
  check("nothing is imported before confirmation", (await txCount(bank)) === 0 && (await balance(bank)) === "1000000.00");
  const key1 = batch.tempFileKey;

  html = await page(`/imports/${batch1}`, jarA);
  let body = clean(html);
  check("preview shows the rows read from the PDF, a wrapped description joined", body.includes("Lương tháng 10") && body.includes("NGAN HANG ABC") && body.includes("trong tổng số 9 dòng"));
  check("lines after the table that are no transaction (a note, the totals) are left out", !body.includes("dòng rác") && !body.includes("Tổng cộng"));
  let mapForm = formWith(html, 'name="headerRow"');
  let defaults = formDefaults(mapForm);
  check("mapping is auto-detected (header row, split columns, format)",
    defaults.headerRow === "3" && defaults.dateColumn === "0" && defaults.amountMode === "split" && defaults.debitColumn === "2" && defaults.creditColumn === "3" && defaults.descriptionColumn === "1" && defaults.dateFormat === "DMY" && defaults.decimalSeparator === ".",
    JSON.stringify(defaults));
  const confirm = (id, form, data, jar = jarA) => submit(`/imports/${id}`, form, data, jar);

  check("other user sees not-found on the batch page, not its rows", clean(await (await get(`/imports/${batch1}`, jarB)).text()).includes("Không tìm thấy trang") && !clean(await (await get(`/imports/${batch1}`, jarB)).text()).includes("Lương tháng 10"));
  let res = await confirm(batch1, mapForm, { ...defaults, dateColumn: "1" });
  body = clean(await res.text());
  check("wrong date column imports nothing and keeps the batch pending", body.includes("Không đọc được dòng giao dịch nào") && (await batchOf(batch1)).status === "PENDING" && (await txCount(bank)) === 0);
  res = await confirm(batch1, mapForm, { ...defaults, debitColumn: "", creditColumn: "" });
  body = clean(await res.text());
  check("split mode requires both columns", body.includes("Vui lòng chọn cột tiền ra.") && body.includes("Vui lòng chọn cột tiền vào."));
  check("same column for in and out rejected", clean(await (await confirm(batch1, mapForm, { ...defaults, creditColumn: "2" })).text()).includes("Cột tiền vào phải khác cột tiền ra."));
  check("category of the wrong type rejected", clean(await (await confirm(batch1, mapForm, { ...defaults, expenseCategoryId: salary })).text()).includes("Danh mục khoản chi không hợp lệ."));
  check("garbage mapping values rejected", clean(await (await confirm(batch1, mapForm, { ...defaults, dateFormat: "XYZ", headerRow: "-4", dateColumn: "999" })).text()).includes("Định dạng ngày không hợp lệ."));

  res = await confirm(batch1, mapForm, defaults);
  batch = await batchOf(batch1);
  check("confirm redirects to the result", res.status === 303 && res.headers.get("location") === `/imports/${batch1}`, `${res.status}`);
  check("batch records imported / skipped / failed rows", batch.status === "PROCESSED" && batch.importedCount === 4 && batch.skippedCount === 0 && batch.rowCount === 6, `${batch.importedCount}/${batch.skippedCount}/${batch.rowCount}`);
  const resultText = clean(await page(`/imports/${batch1}`, jarA));
  check("row errors are reported with row numbers", ["Dòng 8: Dòng có cả số tiền chi và số tiền thu.", "Dòng 9: Ngày không hợp lệ"].every((m) => resultText.includes(m)), batch.errorMessage);
  check("temp file is deleted after confirm", batch.tempFileKey === null && !existsSync(importFilePath(key1)));
  let rows = (await db.query(`select * from transactions where "importBatchId" = $1 order by date, amount`, [batch1])).rows;
  check("transactions carry type, amount, date, note and source",
    rows.map((r) => `${r.type}:${r.amount}:${r.date.getFullYear()}-${r.date.getMonth() + 1}-${r.date.getDate()}:${r.note}`).join(" | ") ===
      "EXPENSE:45000.00:2026-10-5:Cà phê, bánh | EXPENSE:45000.00:2026-10-5:Cà phê, bánh | INCOME:20000000.00:2026-10-6:Lương tháng 10 | EXPENSE:1250000.50:2026-10-7:Tiền điện" &&
      rows.every((r) => r.source === "IMPORT" && r.currency === "VND" && r.amountInDefaultCurrency === r.amount && r.categoryId),
    rows.map((r) => `${r.type}:${r.amount}:${r.note}`).join(" | "));
  check("two identical rows in one file are both kept", new Set(rows.map((r) => r.dedupeHash)).size === 4);
  check("balance moves by the imported total", (await balance(bank)) === "19659999.50", await balance(bank));
  body = clean(await page(`/imports/${batch1}`, jarA));
  check("result page shows the summary", body.includes("Đã nhập") && body.includes("Các dòng không đọc được") && body.includes("Hoàn tác lần nhập này"));
  check("imported rows appear in the transaction list", clean(await page(`/transactions?accountId=${bank}`, jarA)).includes("Lương tháng 10"));

  // ---------- Re-import same file: everything is a duplicate ----------
  const batch1b = await uploadOk({ bytes: PDF1, name: "sao-ke-thang-10.pdf" });
  html = await page(`/imports/${batch1b}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  await confirm(batch1b, mapForm, formDefaults(mapForm));
  batch = await batchOf(batch1b);
  check("re-importing the same file skips every row", batch.importedCount === 0 && batch.skippedCount === 4 && (await balance(bank)) === "19659999.50" && (await txCount(bank)) === 4, `${batch.importedCount}/${batch.skippedCount}`);

  // ---------- Signed column, comma decimals, ISO dates, overlap ----------
  const batch2 = await uploadOk({ bytes: PDF2, name: "export.PDF" });
  html = await page(`/imports/${batch2}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  defaults = formDefaults(mapForm);
  check("second format auto-detected (signed column, ISO dates, comma decimals)",
    defaults.headerRow === "1" && defaults.amountMode === "signed" && defaults.amountColumn === "2" && defaults.dateFormat === "YMD" && defaults.decimalSeparator === "," && defaults.descriptionColumn === "1", JSON.stringify(defaults));
  check("Vietnamese text in the PDF reads as written", clean(html).includes("Cà phê đô") && clean(html).includes("Phí"));
  await confirm(batch2, mapForm, defaults);
  batch = await batchOf(batch2);
  rows = (await db.query(`select * from transactions where "importBatchId" = $1 order by date`, [batch2])).rows;
  check("overlapping statement imports only the new rows", batch.importedCount === 2 && batch.skippedCount === 1 && rows.map((r) => `${r.type}:${r.amount}:${r.note}`).join(" | ") === "INCOME:150000.00:Cà phê đô | EXPENSE:1100.50:Phí", rows.map((r) => `${r.type}:${r.amount}:${r.note}`).join(" | "));
  check("balance after second import", (await balance(bank)) === "19808899.00", await balance(bank));

  // ---------- Excel into a foreign-currency account ----------
  const batch3 = await uploadOk({ bytes: await makeXlsx(), name: "sao-ke.xlsx" }, usd);
  html = await page(`/imports/${batch3}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  defaults = formDefaults(mapForm);
  check("xlsx preview shows date cells and detects columns", clean(html).includes("Excel chi") && defaults.dateColumn === "0" && defaults.amountColumn === "2" && defaults.descriptionColumn === "1", JSON.stringify(defaults));
  await confirm(batch3, mapForm, defaults);
  rows = (await db.query(`select * from transactions where "importBatchId" = $1 order by date`, [batch3])).rows;
  check("xlsx rows imported with native dates and numbers", rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}:${r.note}`).join(" | ") === "EXPENSE:20.50:11:Excel chi | INCOME:5.25:12:Excel thu", rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}`).join(" | "));
  const live = Number((await one(`select rate from exchange_rates where "baseCurrency" = 'USD' and "quoteCurrency" = 'VND' order by (date > '2026-10-11'::date), abs(date - '2026-10-11'::date) limit 1`)).rate);
  check("foreign-currency rows are converted at the stored market rate", rows.every((r) => r.currency === "USD" && Math.abs(Number(r.amountInDefaultCurrency) - Number(r.amount) * live) < 0.011) && (await balance(usd)) === "84.75", `${rows.map((r) => r.amountInDefaultCurrency).join()} @ ${live}`);

  // ---------- A PDF over several pages, its column names repeated on each ----------
  const longHeader = ["Ngày giao dịch", "Nội dung", "Số tiền"];
  const longRows = Array.from({ length: 45 }, (_, i) => [
    `${String((i % 28) + 1).padStart(2, "0")}/10/2026`,
    i % 5 === 0 ? `Mua sắm siêu thị\nchi nhánh ${i}` : `Giao dịch ${i}`,
    i % 4 === 0 ? `${(i + 1) * 1000}` : `-${(i + 1) * 1000}`,
  ]);
  const longId = await uploadOk({ bytes: await statementPdf([longHeader, ...longRows], { widths: [110, 220, 100], right: [2], perPage: 20, header: longHeader }), name: "nhieu-trang.pdf" }, pages);
  html = await page(`/imports/${longId}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  await confirm(longId, mapForm, formDefaults(mapForm));
  batch = await batchOf(longId);
  rows = (await db.query(`select note from transactions where "importBatchId" = $1 and note like 'Mua sắm%' order by note`, [longId])).rows;
  check("every row of a three-page PDF is imported, the repeated column names skipped",
    batch.importedCount === 45 && batch.errorMessage === null && batch.rowCount === 45 && rows.length === 9 && rows[0].note === "Mua sắm siêu thị chi nhánh 0",
    `${batch.importedCount}/${batch.rowCount} ${batch.errorMessage} ${rows[0]?.note}`);

  // ---------- The app's own statement PDF imports back ----------
  const exported = await get(`/transactions/statement?from=2026-10-01&to=2026-10-31&accountId=${usd}`, jarA);
  const exportedPdf = Buffer.from(await exported.arrayBuffer());
  check("setup: the statement of the Excel account downloads as a PDF", exported.status === 200 && exportedPdf.subarray(0, 5).toString() === "%PDF-", `${exported.status}`);
  const backId = await uploadOk({ bytes: exportedPdf, name: "sao-ke-tu-app.pdf" }, usd2);
  html = await page(`/imports/${backId}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  defaults = formDefaults(mapForm);
  // The label of the column each select picked, e.g. "E — Ghi nợ (USD) Debit".
  const picked = (name) => clean(mapForm.match(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`))?.[0].match(/<option[^>]*selected[^>]*>([^<]*)/)?.[1] ?? "");
  check("the statement's columns are found: dates, money out, money in, description",
    defaults.amountMode === "split" && picked("dateColumn").includes("Ngày giao dịch") && picked("debitColumn").includes("Ghi nợ") && picked("creditColumn").includes("Ghi có") && picked("descriptionColumn").includes("Diễn giải"),
    ["dateColumn", "debitColumn", "creditColumn", "descriptionColumn"].map(picked).join(" | "));
  await confirm(backId, mapForm, defaults);
  rows = (await db.query(`select * from transactions where "importBatchId" = $1 order by date`, [backId])).rows;
  check("its transactions come back with the same dates, amounts and notes",
    (await batchOf(backId)).importedCount === 2 && rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}`).join(" | ") === "EXPENSE:20.50:11 | INCOME:5.25:12" &&
      rows[0].note.endsWith("Excel chi") && rows[1].note.endsWith("Excel thu"),
    rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}:${r.note}`).join(" | "));

  // ---------- Isolation ----------
  html = await page(`/imports/${batch2}`, jarA);
  const rollbackForm = formWith(html, "Hoàn tác lần nhập này");
  await submit(`/imports/${batch2}`, rollbackForm, {}, jarB);
  check("other user cannot roll back the batch", (await batchOf(batch2)).status === "PROCESSED" && (await balance(bank)) === "19808899.00");
  check("other user's import list is empty", clean(await page("/imports", jarB)).includes("Chưa có lần nhập nào"));

  // ---------- Rollback ----------
  res = await submit(`/imports/${batch2}`, rollbackForm, {}, jarA);
  batch = await batchOf(batch2);
  check("rollback deletes the batch's transactions and restores the balance", batch.status === "ROLLED_BACK" && (await one(`select count(*)::int n from transactions where "importBatchId" = $1`, [batch2])).n === 0 && (await balance(bank)) === "19659999.50", await balance(bank));
  check("rolled-back page offers no second rollback", !clean(await page(`/imports/${batch2}`, jarA)).includes("Hoàn tác lần nhập này"));
  await submit(`/imports/${batch2}`, rollbackForm, {}, jarA);
  check("rolling back twice changes nothing", (await balance(bank)) === "19659999.50");

  const batch2b = await uploadOk({ bytes: PDF2, name: "export.pdf" });
  html = await page(`/imports/${batch2b}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  await confirm(batch2b, mapForm, formDefaults(mapForm));
  check("a rolled-back file can be imported again", (await batchOf(batch2b)).importedCount === 2 && (await balance(bank)) === "19808899.00", await balance(bank));

  // Edit one imported transaction through the app, then try to roll back its batch.
  const edited = (await db.query(`select * from transactions where "importBatchId" = $1 and note = 'Tiền điện'`, [batch1])).rows[0];
  html = await page(`/transactions/${edited.id}/edit`, jarA);
  res = await submit(`/transactions/${edited.id}/edit`, formWith(html, 'id="tx-amount"'), { type: "EXPENSE", accountId: bank, categoryId: edited.categoryId, amount: "1250000.50", date: "2026-10-07", note: "Tiền điện T10" }, jarA);
  html = await page(`/imports/${batch1}`, jarA);
  res = await submit(`/imports/${batch1}`, formWith(html, "Hoàn tác lần nhập này"), {}, jarA);
  check("rollback is refused once a transaction was edited by hand", clean(await res.text()).includes("đã được sửa tay") && (await batchOf(batch1)).status === "PROCESSED" && (await one(`select count(*)::int n from transactions where "importBatchId" = $1`, [batch1])).n === 4);

  // ---------- Double submit ----------
  const batch4 = await uploadOk({ bytes: PDF1, name: "song-song.pdf" }, spare);
  html = await page(`/imports/${batch4}`, jarA);
  mapForm = formWith(html, 'name="headerRow"');
  defaults = formDefaults(mapForm);
  await Promise.all(Array.from({ length: 5 }, () => confirm(batch4, mapForm, defaults)));
  check("five simultaneous confirms import the file once", (await txCount(spare)) === 4 && (await balance(spare)) === "18659999.50", `${await txCount(spare)} / ${await balance(spare)}`);

  // ---------- Delete an import with everything it created ----------
  const deleteForm = async (id, jar = jarA) => formWith(await page("/imports", jar), `value="${id}"`);
  let removeForm = await deleteForm(batch4);
  check("every import in the list has a delete button", removeForm.includes("Xóa lần nhập") && (await page(`/imports/${batch4}`, jarA)).includes("Xóa lần nhập này"));
  await submit("/imports", removeForm, {}, jarB);
  check("other user cannot delete the import", Boolean(await batchOf(batch4)) && (await txCount(spare)) === 4);
  res = await submit("/imports", removeForm, {}, jarA);
  check("deleting a processed import removes it, its transactions and their effect on the balance",
    res.status === 303 && res.headers.get("location") === "/imports" && !(await batchOf(batch4)) && (await txCount(spare)) === 0 && (await balance(spare)) === "0.00", `${res.status} ${await balance(spare)}`);
  check("the deleted import is gone from the list and its page", !clean(await page("/imports", jarA)).includes("song-song.pdf") && clean(await page(`/imports/${batch4}`, jarA)).includes("Không tìm thấy trang"));
  await submit("/imports", await deleteForm(batch1), {}, jarA);
  check("deleting also removes transactions that were edited by hand (which rollback refuses)",
    !(await batchOf(batch1)) && (await one(`select count(*)::int n from transactions where note = 'Tiền điện T10' and "userId" = $1`, [aId])).n === 0 && (await balance(bank)) === "1148899.50", await balance(bank));
  await submit("/imports", await deleteForm(batch2), {}, jarA);
  check("deleting a rolled-back import only removes the entry", !(await batchOf(batch2)) && (await balance(bank)) === "1148899.50");
  await submit("/imports", removeForm, {}, jarA);
  check("deleting twice changes nothing", (await balance(spare)) === "0.00" && (await balance(bank)) === "1148899.50");

  // ---------- Cancel + pending limit ----------
  const pendingIds = [];
  for (let i = 0; i < 5; i++) pendingIds.push(await uploadOk({ bytes: PDF2, name: `cho-${i}.pdf` }));
  check("sixth pending upload is refused", clean(await (await upload({ bytes: PDF2, name: "cho-6.pdf" })).text()).includes("lần nhập chưa hoàn tất"));
  const pendingKey = (await batchOf(pendingIds[0])).tempFileKey;
  html = await page(`/imports/${pendingIds[0]}`, jarA);
  const cancelForm = formWith(html, "Hủy lần nhập này");
  await submit(`/imports/${pendingIds[0]}`, cancelForm, { id: pendingIds[1] }, jarB);
  check("other user cannot cancel the batch (forged id)", Boolean(await batchOf(pendingIds[1])));
  res = await submit(`/imports/${pendingIds[0]}`, cancelForm, {}, jarA);
  check("cancel deletes the pending batch and its file", res.status === 303 && !(await batchOf(pendingIds[0])) && !existsSync(importFilePath(pendingKey)));
  const deletedKey = (await batchOf(pendingIds[1])).tempFileKey;
  await submit("/imports", await deleteForm(pendingIds[1]), {}, jarA);
  check("deleting a pending import removes its uploaded file too", !(await batchOf(pendingIds[1])) && !existsSync(importFilePath(deletedKey)));
  for (const id of pendingIds.slice(2)) {
    html = await page(`/imports/${id}`, jarA);
    await submit(`/imports/${id}`, formWith(html, "Hủy lần nhập này"), {}, jarA);
  }
  check("no pending batches or temp files remain", (await one(`select count(*)::int n from import_batches where "userId" = $1 and (status = 'PENDING' or "tempFileKey" is not null)`, [aId])).n === 0);

  // ---------- Abandoned uploads are removed after a day ----------
  mkdirSync(importFilePath(""), { recursive: true });
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  // The stale import is one left pending when CSV was still accepted: its file is cleaned up all the same.
  const staleKey = `${randomUUID()}.csv`;
  const orphanKey = `${randomUUID()}.pdf`;
  const freshOrphanKey = `${randomUUID()}.xlsx`;
  for (const key of [staleKey, orphanKey, freshOrphanKey]) writeFileSync(importFilePath(key), "%PDF-1.4\n");
  utimesSync(importFilePath(orphanKey), twoDaysAgo, twoDaysAgo);
  const staleId = (await one(
    `insert into import_batches (id,"userId","accountId","fileName",status,"tempFileKey","rowCount","createdAt","updatedAt")
     values (gen_random_uuid()::text,$1,$2,'bo-do.csv','PENDING',$3,2,$4,$4) returning id`, [aId, bank, staleKey, twoDaysAgo])).id;
  const recentId = await uploadOk({ bytes: PDF2, name: "moi.pdf" });
  let swept = false;
  for (let i = 0; i < 40 && !swept; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    swept = !(await batchOf(staleId)) && !existsSync(importFilePath(staleKey)) && !existsSync(importFilePath(orphanKey));
  }
  check("an import left pending for over a day is removed with its file", swept);
  check("an old statement file that no import refers to is removed", !existsSync(importFilePath(orphanKey)));
  check("recent imports and recent files are kept", Boolean(await batchOf(recentId)) && existsSync(importFilePath((await batchOf(recentId)).tempFileKey)) && existsSync(importFilePath(freshOrphanKey)));
  rmSync(importFilePath(freshOrphanKey), { force: true });
  await submit(`/imports/${recentId}`, formWith(await page(`/imports/${recentId}`, jarA), "Hủy lần nhập này"), {}, jarA);

  const drift = (await db.query(
    `select a.name from accounts a where a."userId" = $1 and a."currentBalance" <> a."initialBalance" + coalesce((
       select sum(case when t.type = 'INCOME' or t."transferDirection" = 'IN' then t.amount else -t.amount end)
       from transactions t where t."accountId" = a.id), 0)`, [aId])).rows;
  check("every balance equals opening balance plus its transactions", drift.length === 0, drift.map((d) => d.name).join());
} finally {
  await removeUsers([A, B]);
  await db.end();
}

report();
