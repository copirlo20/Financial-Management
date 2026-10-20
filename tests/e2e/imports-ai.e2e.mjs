import { existsSync } from "node:fs";
import { STAMP, check, report, clean, page, formWith, submit, registerUser, db, one, userId, formDefaults, statementPdf, statementXlsx, removeUsers, importFilePath, addAccount, systemCategory, hasTableRow } from "../harness.mjs";

// Importing with the AI assistant. The AI API is replaced by tests/mock-ai.mjs, which the
// runner starts and the app is pointed at; this suite queues the assistant's answers and reads back
// what the app sent. Run through tests/run-e2e.mjs.

const MOCK = process.env.E2E_AI_MOCK_URL;
// Which AI API the server under test talks to; the runner runs this suite once per provider.
const PROVIDER = process.env.E2E_AI_PROVIDER ?? "anthropic";
if (!MOCK) {
  console.log("SKIP imports-ai: needs the runner's own server, which is wired to the stand-in Claude API");
  process.exit(0);
}
const A = `e2e-ai-a-${STAMP}@example.com`;
const B = `e2e-ai-b-${STAMP}@example.com`;

// The value the server pre-selected in every select of a form, plus the header row input.
const queue = (answers) => fetch(`${MOCK}/__mock/queue`, { method: "POST", body: JSON.stringify(answers) });
const sent = async () => (await fetch(`${MOCK}/__mock/requests`)).json();

await db.connect();

const balance = async (id) => (await one(`select "currentBalance" b from accounts where id = $1`, [id])).b;
const batchOf = (id) => one(`select * from import_batches where id = $1`, [id]);
const txCount = async (accountId) => (await one(`select count(*)::int n from transactions where "accountId" = $1`, [accountId])).n;
const batchCount = async (uid) => (await one(`select count(*)::int n from import_batches where "userId" = $1`, [uid])).n;
const importedRows = async (batchId) =>
  (await db.query(`select t.*, c."systemKey" from transactions t join categories c on c.id = t."categoryId" where t."importBatchId" = $1 order by t.date, t.amount`, [batchId])).rows;

// ---------- Fixture files ----------
// Column names the built-in guesser does not know: only the assistant can make sense of this file.
const ODD_ROWS = [
  ["Bao cao tai khoan"],
  ["Thoi diem", "Chi tiet", "Bien dong"],
  ["05/10/2026", "GRAB chuyen di", "-45,000"],
  ["06/10/2026", "Luong thang 10", "20,000,000"],
  ["07/10/2026", "GRAB chuyen di", "-30,000"],
  ["08/10/2026", null, "-10,000"],
];
const ODD_XLSX = await statementXlsx(ODD_ROWS);
const KNOWN_XLSX = await statementXlsx([["Ngày", "Nội dung", "Số tiền"], ["05/10/2026", "Tiền điện", -120000], ["06/10/2026", "Thưởng", 500000]]);
// A PDF with text: the code can rebuild its table, and the assistant gets the file itself.
const PDF = await statementPdf([["Ngày", "Nội dung", "Số tiền"], ["09/10/2026", "GRAB", "-45,000"]], { right: [2] });
// A file pdf.js cannot open, as with some scans: only the assistant may read it, and nothing else can stand in
// when it fails. The mock assistant does not read either.
const UNREADABLE_PDF = Buffer.from("%PDF-1.4\n% stand-in statement\n%%EOF\n", "latin1");

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = await userId(A);
  const bId = await userId(B);
  const bank = await addAccount(aId, "Bank", "VND", 1000000);
  const bank2 = await addAccount(aId, "Bank 2", "VND", 0);
  const transport = await systemCategory("transport");
  const food = await systemCategory("food");
  const salary = await systemCategory("salary");
  const otherExpense = await systemCategory("other_expense");
  const otherIncome = await systemCategory("other_income");
  const foreign = (await one(
    `insert into categories (id,"userId",name,type,"updatedAt") values (gen_random_uuid()::text,$1,'Riêng của B','EXPENSE',now()) returning id`, [bId])).id;

  const upload = async (file, extra = { useAi: "on" }, jar = jarA) =>
    submit("/imports", formWith(await page("/imports", jar), 'name="file"'), { accountId: bank, file, ...extra }, jar);
  const uploadOk = async (file, extra) => {
    const res = await upload(file, extra);
    const location = res.headers.get("location") ?? "";
    if (res.status !== 303 || !location.startsWith("/imports/")) throw new Error(`upload failed: ${res.status} ${clean(await res.text()).match(/role="alert"[^>]*>([^<]*)/)?.[1]}`);
    return location.split("/").pop();
  };
  const uploadError = async (file, extra) => clean(await (await upload(file, extra)).text());
  const cancel = async (id) => submit(`/imports/${id}`, formWith(await page(`/imports/${id}`, jarA), "Hủy lần nhập này"), {}, jarA);

  let html = await page("/imports", jarA);
  check("upload form offers the assistant and accepts PDF", html.includes('name="useAi"') && html.includes('accept=".pdf,.xlsx"') && clean(html).includes(PROVIDER === "openai" ? "Dùng trợ lý AI (GPT)" : "Dùng trợ lý AI (Claude)") && clean(html).includes(PROVIDER === "openai" ? "gửi tới OpenAI" : "gửi tới Anthropic"));

  // ---------- Spreadsheet: the assistant reads every row ----------
  const tx = (row, date, type, amount, description, category = null) => ({ row, date, type, amount, description, category });
  await queue([
    {
      output: {
        transactions: [
          tx(3, "2026-10-05", "EXPENSE", "45000", "GRAB chuyen di", { $category: "Di chuyển" }),
          tx(4, "2026-10-06", "INCOME", "20000000", "Luong thang 10", { $category: "Lương" }),
          tx(5, "2026-10-07", "EXPENSE", "30000", "GRAB chuyen di", { $category: "Di chuyển" }),
          tx(6, "2026-10-08", "EXPENSE", "10000", ""),
          tx(3, "2026-10-05", "EXPENSE", "999", "same row twice"),
          tx(99, "2026-10-05", "EXPENSE", "999", "row that is not in the file"),
          tx(null, "2026-10-05", "EXPENSE", "999", "no row"),
        ],
      },
    },
  ]);
  const batch1 = await uploadOk({ bytes: ODD_XLSX, name: "la.xlsx" });
  let requests = await sent();
  let batch = await batchOf(batch1);
  const tableCall = requests[0]?.messages[0].content ?? "";
  check("one streamed call carries the key, a model and a JSON schema", requests.length === 1 && requests[0].provider === PROVIDER && requests[0].stream === true && requests[0].apiKey === "e2e-test-key" && Boolean(requests[0].model) && requests[0].output_config?.format?.type === "json_schema", `${requests.length}`);
  check("the call sends every row of the file, the user's categories and the account currency",
    ODD_ROWS.length === 6 && [1, 2, 3, 4, 5, 6].every((n) => tableCall.includes(`row ${n}: [`)) &&
      tableCall.includes('row 2: ["Thoi diem","Chi tiet","Bien dong"]') && tableCall.includes('row 6: ["08/10/2026",null,"-10,000"]') &&
      /\d+ \| EXPENSE \| Di chuyển/.test(tableCall) && /\d+ \| INCOME \| Lương/.test(tableCall) && !tableCall.includes("Riêng của B") && tableCall.includes("Account currency: VND") && !tableCall.includes("Top of the file"),
    tableCall.slice(-300));
  check("the extracted rows are stored on the pending batch; the file is not kept",
    batch.status === "PENDING" && batch.aiAnalysis?.kind === "document" && batch.aiAnalysis.rows.length === 4 && batch.rowCount === 4 && batch.tempFileKey === null &&
      batch.aiAnalysis.categories["3"] === transport && batch.aiAnalysis.categories["5"] === transport && batch.aiAnalysis.categories["4"] === salary && !("6" in batch.aiAnalysis.categories),
    JSON.stringify(batch.aiAnalysis));
  check("nothing is imported before confirmation", (await txCount(bank)) === 0 && (await balance(bank)) === "1000000.00");

  html = await page(`/imports/${batch1}`, jarA);
  let docForm1 = formWith(html, 'id="doc-expenseCategoryId"');
  let defaults = formDefaults(docForm1);
  check("review page lists the rows without a column-mapping step", clean(html).includes("Trợ lý AI đọc được 4 giao dịch") && clean(html).includes("GRAB chuyen di") && !html.includes('name="headerRow"'));
  check("each row has a category select showing the suggestion",
    defaults["rowCategory-3"] === transport && defaults["rowCategory-4"] === salary && defaults["rowCategory-5"] === transport && defaults["rowCategory-6"] === "",
    JSON.stringify(defaults));
  const row4Select = docForm1.match(/<select[^>]*name="rowCategory-4"[\s\S]*?<\/select>/)?.[0] ?? "";
  check("a row's select only offers categories of its type", row4Select.includes(otherIncome) && !row4Select.includes(transport));
  check("other user cannot see the analysed batch", clean(await page(`/imports/${batch1}`, jarB)).includes("Không tìm thấy trang"));

  // Row 3: nothing submitted -> suggestion. Row 4: a category of the wrong type -> default. Row 5: emptied -> default.
  const confirm = (id, form, data, jar = jarA) => submit(`/imports/${id}`, form, data, jar);
  const categoryDefaults = { expenseCategoryId: otherExpense, incomeCategoryId: otherIncome };
  let res = await confirm(batch1, docForm1, { expenseCategoryId: salary, incomeCategoryId: otherIncome, "rowCategory-5": food });
  html = await res.text();
  check("a failed confirm keeps the row picks", clean(html).includes("Danh mục khoản chi không hợp lệ.") && formDefaults(formWith(html, 'id="doc-expenseCategoryId"'))["rowCategory-5"] === food);
  res = await confirm(batch1, docForm1, { ...categoryDefaults, "rowCategory-4": transport, "rowCategory-5": "", "rowCategory-6": foreign });
  batch = await batchOf(batch1);
  check("confirm imports the rows and clears the stored analysis", res.status === 303 && batch.status === "PROCESSED" && batch.importedCount === 4 && batch.aiAnalysis === null, `${res.status} ${batch.status} ${batch.importedCount}`);
  let rows = await importedRows(batch1);
  check("row categories: suggestion, default for a wrong-type pick, default for an emptied pick, default for a foreign category",
    rows.map((r) => `${r.note ?? "-"}:${r.amount}:${r.systemKey}`).join(" | ") ===
      "GRAB chuyen di:45000.00:transport | Luong thang 10:20000000.00:other_income | GRAB chuyen di:30000.00:other_expense | -:10000.00:other_expense",
    rows.map((r) => `${r.note ?? "-"}:${r.amount}:${r.systemKey}`).join(" | "));
  check("balance moves by the imported total", (await balance(bank)) === "20915000.00", await balance(bank));

  // ---------- A long spreadsheet is read in several parts ----------
  const LONG_ROWS = 319;
  const day = (i) => String((i % 28) + 1).padStart(2, "0");
  const LONG_XLSX = await statementXlsx([["Thoi diem", "Chi tiet", "Bien dong"], ...Array.from({ length: LONG_ROWS }, (_, i) => [`${day(i)}/10/2026`, `GD so ${i + 1}`, (i % 2 ? 1 : -1) * (1000 + i)])]);
  await queue([{ readRows: true }, { readRows: true }, { readRows: true }]);
  const batchLong = await uploadOk({ bytes: LONG_XLSX, name: "dai.xlsx" }, { useAi: "on", accountId: bank2 });
  requests = await sent();
  const parts = requests.map((r) => r.messages[0].content);
  const rowsRead = parts.flatMap((part) => [...part.split("Rows to read:\n")[1].matchAll(/^row (\d+): /gm)].map((m) => Number(m[1]))).sort((a, b) => a - b);
  check("320 rows go out as 3 parts, each row to read exactly once", requests.length === 3 && rowsRead.length === 320 && rowsRead.every((n, i) => n === i + 1), `${requests.length} parts, ${rowsRead.length} rows`);
  check("later parts repeat the top of the file for its headers", parts.filter((part) => part.includes('Top of the file:\nrow 1: ["Thoi diem","Chi tiet","Bien dong"]')).length === 2);
  batch = await batchOf(batchLong);
  check("rows from all parts are put together in file order", batch.aiAnalysis.rows.length === LONG_ROWS && batch.aiAnalysis.rows.every((r, i) => r.rowNumber === i + 2));
  html = await page(`/imports/${batchLong}`, jarA);
  check("the review lists the first 100 rows and says the rest follow", (html.match(/name="rowCategory-/g) ?? []).length === 100 && clean(html).includes("Đang hiện 100 trong 319 giao dịch"));
  await confirm(batchLong, formWith(html, 'id="doc-expenseCategoryId"'), categoryDefaults);
  const expected = Array.from({ length: LONG_ROWS }, (_, i) => (i % 2 ? 1 : -1) * (1000 + i)).reduce((a, b) => a + b, 0);
  check("every row of the long file is imported", (await txCount(bank2)) === LONG_ROWS && Number(await balance(bank2)) === expected, `${await txCount(bank2)} / ${await balance(bank2)} vs ${expected}`);

  // ---------- Opting out ----------
  await queue([]);
  const batch2 = await uploadOk({ bytes: KNOWN_XLSX, name: "tu-ghep.xlsx" }, {});
  html = await page(`/imports/${batch2}`, jarA);
  check("without the assistant nothing is sent and the columns are mapped by hand as before",
    (await sent()).length === 0 && (await batchOf(batch2)).aiAnalysis === null && existsSync(importFilePath((await batchOf(batch2)).tempFileKey)) && html.includes('name="headerRow"') && !html.includes("rowCategory-"));
  await cancel(batch2);

  // ---------- Assistant unavailable or wrong: fall back to mapping by hand ----------
  const fallsBack = async (label, answers, file = KNOWN_XLSX, name = "ai-loi.xlsx") => {
    await queue(answers);
    const id = await uploadOk({ bytes: file, name });
    const stored = await batchOf(id);
    const body = await page(`/imports/${id}`, jarA);
    const guessed = formDefaults(formWith(body, 'name="headerRow"'));
    check(label, stored.aiAnalysis?.kind === "table" && stored.aiAnalysis.failed === true && existsSync(importFilePath(stored.tempFileKey)) && clean(body).includes("Trợ lý AI không đọc được file này") && guessed.dateColumn === "0",
      JSON.stringify(stored.aiAnalysis));
    const requestCount = (await sent()).length;
    await cancel(id);
    return requestCount;
  };
  await fallsBack("a failing assistant leaves the file to be mapped by hand, with a notice", []);
  await fallsBack("an answer with no transactions does the same", [{ output: { transactions: [] } }]);
  await fallsBack("an answer cut off by the length limit does the same", [{ text: '{"transactions":[{"row":2,"da', stopReason: "max_tokens" }]);
  await fallsBack("one failing part fails the whole file rather than importing some of it", [{ readRows: true }, { status: 400 }, { readRows: true }], LONG_XLSX);
  const hugeXlsx = await statementXlsx([["Ngày", "Nội dung", "Số tiền"], ...Array.from({ length: 3000 }, (_, i) => ["05/10/2026", `GD ${i}`, -(i + 1)])]);
  check("a file over the assistant's row limit is not sent at all", (await fallsBack("a file over the assistant's row limit is mapped by hand", [], hugeXlsx)) === 0);
  check("a PDF the assistant fails on is mapped by hand from its text", (await fallsBack("a PDF the assistant fails on is mapped by hand", [], PDF, "ai-loi.pdf")) === 1);

  // ---------- PDF only the assistant can read ----------
  const before = await batchCount(aId);
  await queue([]);
  check("a .pdf that is not a PDF is rejected without asking the assistant", (await uploadError({ bytes: Buffer.from("hello"), name: "gia.pdf" })).includes("đúng định dạng PDF") && (await sent()).length === 0);
  check("without the assistant, a PDF the code cannot read is refused", (await uploadError({ bytes: UNREADABLE_PDF, name: "sao-ke.pdf" }, {})).includes("đúng định dạng PDF"));
  await queue([{ status: 401 }]);
  check("a rejected API key is reported without details", (await uploadError({ bytes: UNREADABLE_PDF, name: "sao-ke.pdf" })).includes("Khóa API của trợ lý AI không hợp lệ"));
  await queue([{ output: { transactions: [] } }]);
  check("a PDF without transactions is reported", (await uploadError({ bytes: UNREADABLE_PDF, name: "sao-ke.pdf" })).includes("không tìm thấy giao dịch nào"));
  await queue([{ text: '{"transactions":[{"date":"2026-10-05","type":"EXPE', stopReason: "max_tokens" }]);
  check("an answer cut off by the length limit asks for smaller files", (await uploadError({ bytes: UNREADABLE_PDF, name: "sao-ke.pdf" })).includes("quá nhiều giao dịch"));
  await queue([{ text: "not json at all" }]);
  check("an unreadable answer is reported", (await uploadError({ bytes: UNREADABLE_PDF, name: "sao-ke.pdf" })).includes("Trợ lý AI không phân tích được file này"));
  check("failed PDF uploads leave no batch", (await batchCount(aId)) === before);

  // ---------- PDF read by the assistant ----------

  await queue([
    {
      output: {
        transactions: [
          tx(null, "2026-10-09", "EXPENSE", "45000", "GRAB  *TRIP\n123", { $category: "Di chuyển" }),
          tx(null, "2026-10-10", "INCOME", "20000000.00", "LUONG T10"),
          tx(null, "10/11/2026", "EXPENSE", "1000", "ngày sai"),
          tx(null, "2026-10-11", "EXPENSE", "", "không đọc được số"),
          tx(null, "2026-10-12", "EXPENSE", "1250000.50", "DIEN LUC", { $category: "Lương" }),
        ],
      },
    },
  ]);
  const batch6 = await uploadOk({ bytes: PDF, name: "sao-ke-t10.pdf" });
  requests = await sent();
  batch = await batchOf(batch6);
  const blocks = requests[0]?.messages[0].content ?? [];
  check("the PDF is sent as a document, streamed, with the categories and the account currency",
    requests.length === 1 && requests[0].stream === true && blocks[0]?.type === "document" && blocks[0].source.media_type === "application/pdf" &&
      Buffer.from(blocks[0].source.data, "base64").equals(PDF) && blocks[1].text.includes("Account currency: VND") && /\d+ \| EXPENSE \| Di chuyển/.test(blocks[1].text));
  check("the PDF itself is not stored; the extracted rows are",
    batch.status === "PENDING" && batch.tempFileKey === null && batch.rowCount === 5 && batch.aiAnalysis.kind === "document" && batch.aiAnalysis.rows.length === 3 && batch.aiAnalysis.errors.length === 2,
    JSON.stringify(batch.aiAnalysis).slice(0, 300));
  check("nothing is imported from a PDF before confirmation", (await txCount(bank)) === 4);

  html = await page(`/imports/${batch6}`, jarA);
  let body = clean(html);
  const docForm = formWith(html, 'id="doc-expenseCategoryId"');
  defaults = formDefaults(docForm);
  check("review page lists the extracted rows, the unreadable ones, and a warning to check them",
    body.includes("Trợ lý AI đọc được 3 giao dịch") && body.includes("GRAB *TRIP 123") && body.includes("DIEN LUC") && body.includes("AI có thể đọc nhầm") &&
      hasTableRow(html, ["Dòng", "Lý do", "Ngày", "Số tiền", "Diễn giải"]) &&
      hasTableRow(html, ["3", "Ngày không hợp lệ hoặc không đúng định dạng đã chọn.", "10/11/2026", "1000", "ngày sai"]) &&
      hasTableRow(html, ["4", "Thiếu số tiền hoặc số tiền bằng 0.", "2026-10-11", "không đọc được số"]));
  check("PDF rows show the suggestion; a wrong-type suggestion is dropped",
    defaults["rowCategory-1"] === transport && defaults["rowCategory-2"] === "" && defaults["rowCategory-5"] === "" && defaults.expenseCategoryId === otherExpense && defaults.incomeCategoryId === otherIncome,
    JSON.stringify(defaults));
  check("other user cannot see or confirm the PDF batch", clean(await page(`/imports/${batch6}`, jarB)).includes("Không tìm thấy trang") &&
    (await confirm(batch6, docForm, { expenseCategoryId: otherExpense, incomeCategoryId: otherIncome }, jarB)).status !== 303 && (await batchOf(batch6)).status === "PENDING");
  check("PDF confirm rejects a default category of the wrong type",
    clean(await (await confirm(batch6, docForm, { expenseCategoryId: salary, incomeCategoryId: otherIncome })).text()).includes("Danh mục khoản chi không hợp lệ."));

  res = await confirm(batch6, docForm, { expenseCategoryId: otherExpense, incomeCategoryId: otherIncome, "rowCategory-2": salary, "rowCategory-5": food });
  batch = await batchOf(batch6);
  rows = await importedRows(batch6);
  check("PDF confirm imports the valid rows once", res.status === 303 && batch.status === "PROCESSED" && batch.importedCount === 3 && batch.rowCount === 5 && batch.aiAnalysis === null, `${res.status} ${batch.importedCount}/${batch.rowCount}`);
  check("PDF rows carry amount, date, note, type and the chosen categories",
    rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}:${r.note}:${r.systemKey}`).join(" | ") ===
      "EXPENSE:45000.00:9:GRAB *TRIP 123:transport | INCOME:20000000.00:10:LUONG T10:salary | EXPENSE:1250000.50:12:DIEN LUC:food" && rows.every((r) => r.source === "IMPORT"),
    rows.map((r) => `${r.type}:${r.amount}:${r.date.getDate()}:${r.note}:${r.systemKey}`).join(" | "));
  check("balance after the PDF import", (await balance(bank)) === "39619999.50", await balance(bank));
  html = await page(`/imports/${batch6}`, jarA);
  check("result page reports the rows the assistant could not read, with what it read in them",
    hasTableRow(html, ["3", "Ngày không hợp lệ hoặc không đúng định dạng đã chọn.", "10/11/2026", "1000", "ngày sai"]) && clean(html).includes("Hoàn tác lần nhập này"));
  await confirm(batch6, docForm, { expenseCategoryId: otherExpense, incomeCategoryId: otherIncome });
  check("confirming a PDF batch twice imports nothing more", (await txCount(bank)) === 7 && (await balance(bank)) === "39619999.50");

  html = await page(`/imports/${batch6}`, jarA);
  await submit(`/imports/${batch6}`, formWith(html, "Hoàn tác lần nhập này"), {}, jarA);
  check("a PDF import can be rolled back", (await batchOf(batch6)).status === "ROLLED_BACK" && (await balance(bank)) === "20915000.00" && (await txCount(bank)) === 4, await balance(bank));

  const drift = (await db.query(
    `select a.name from accounts a where a."userId" = $1 and a."currentBalance" <> a."initialBalance" + coalesce((
       select sum(case when t.type = 'INCOME' then t.amount else -t.amount end) from transactions t where t."accountId" = a.id), 0)`, [aId])).rows;
  check("every balance equals opening balance plus its transactions", drift.length === 0);
  check("no pending batches or temp files remain", (await one(`select count(*)::int n from import_batches where "userId" = $1 and (status = 'PENDING' or "tempFileKey" is not null)`, [aId])).n === 0);

  // ---------- Daily token budget ----------
  await queue([{ output: { transactions: [tx(null, "2026-10-20", "EXPENSE", "1000", "đắt", null)] }, usage: { input_tokens: 250000, output_tokens: 1000 } }]);
  const expensive = await uploadOk({ bytes: PDF, name: "dat.pdf" });
  check("a read that uses up the user's daily budget still completes", Boolean(expensive) && (await sent()).length === 1);
  await cancel(expensive);
  await queue([{ output: { transactions: [] } }]);
  check("the next PDF is refused before reaching the model", (await uploadError({ bytes: UNREADABLE_PDF, name: "dat-nua.pdf" })).includes("hết hạn mức hôm nay") && (await sent()).length === 0);
  await queue([]);
  const fallback = await uploadOk({ bytes: KNOWN_XLSX, name: "het-han-muc.xlsx" });
  const stored = await batchOf(fallback);
  check("a spreadsheet then falls back to mapping by hand", stored.aiAnalysis?.kind === "table" && stored.aiAnalysis.failed === true && (await sent()).length === 0, JSON.stringify(stored.aiAnalysis));
  await cancel(fallback);
} finally {
  await removeUsers([A, B]);
  await db.end();
  await queue([]);
}

report();
