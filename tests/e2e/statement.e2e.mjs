import { pdfText } from "../pdf-text.mjs";
import { BASE, STAMP, check, report, clean, get, page, registerUser, db, one } from "../harness.mjs";

// The PDF account statement (/transactions/statement → backend GET /api/reports/statement): the figures for
// one account and for all accounts, what is left out of the period, the refusals and the per-hour limit.
// The PDF's text is read back with tests/pdf-text.mjs.

const A = `e2e-sta-${STAMP}@example.com`;
const B = `e2e-stb-${STAMP}@example.com`;
const C = `e2e-stc-${STAMP}@example.com`;
await db.connect();

// Downloads a statement. Returns the response and, for a PDF, its text (all pages, one piece per line).
async function statement(jar, query) {
  const res = await get(`/transactions/statement?${new URLSearchParams(query)}`, jar);
  const isPdf = (res.headers.get("content-type") ?? "").includes("application/pdf");
  const bytes = isPdf ? Buffer.from(await res.arrayBuffer()) : null;
  const pages = bytes ? pdfText(bytes) : [];
  return { res, bytes, pages, text: pages.join("\n") };
}
const refusal = (res) => (res.status === 303 ? new URL(res.headers.get("location"), BASE).searchParams.get("statementError") : null);

try {
  const jarA = await registerUser(A, "Statement Anh");
  const jarB = await registerUser(B, "Statement Bình");
  const jarC = await registerUser(C, "Statement Châu");
  const userId = async (email) => (await one(`select id from users where email = $1`, [email])).id;
  const [aId, bId] = [await userId(A), await userId(B)];
  const sys = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const [food, salary] = [await sys("food"), await sys("salary")];
  const addAccount = async (owner, name, currency, balance) =>
    (await one(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,$2,'CASH',$3,$4,$4,now()) returning id`, [owner, name, currency, balance])).id;
  const addTx = (owner, account, { type = "EXPENSE", category = food, amount, date, note = null, currency = "VND", converted = amount, group = null, direction = null }) =>
    db.query(
      `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,note,"transferGroupId","transferDirection","updatedAt")
       values (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,now())`,
      [owner, account, category, type, amount, currency, converted, date, note, group, direction]);

  const wallet = await addAccount(aId, "Ví chính", "VND", 1000000);
  const savings = await addAccount(aId, "Tiết kiệm", "VND", 0);
  const dollars = await addAccount(aId, "Đô la", "USD", 0);
  await addTx(aId, wallet, { amount: 100000, date: "2026-08-20", note: "Trước kỳ" });
  await addTx(aId, wallet, { type: "INCOME", category: salary, amount: 500000, date: "2026-09-05", note: "Lương tháng 9" });
  await addTx(aId, wallet, { amount: 200000, date: "2026-09-10", note: "Ăn trưa" });
  const group = crypto.randomUUID();
  await addTx(aId, wallet, { type: "TRANSFER", category: null, amount: 50000, date: "2026-09-15", group, direction: "OUT" });
  await addTx(aId, savings, { type: "TRANSFER", category: null, amount: 50000, date: "2026-09-15", group, direction: "IN" });
  await addTx(aId, dollars, { amount: 10, currency: "USD", converted: null, date: "2026-09-20", note: "Cà phê Mỹ" });
  await addTx(aId, wallet, { amount: 30000, date: "2026-10-05", note: "Sau kỳ" });
  const september = { from: "2026-09-01", to: "2026-09-30" };

  // ---------- The form ----------
  const html = await page("/transactions", jarA);
  const form = html.match(/<form[^>]*action="\/transactions\/statement"[^>]*>[\s\S]*?<\/form>/)?.[0] ?? "";
  check("the transactions page has the statement form: a GET form that downloads, with dates and accounts",
    /method="get"/.test(form) && /data-download/.test(form) && /name="from"/.test(form) && /name="to"/.test(form) && /name="accountId"/.test(form) &&
      clean(form).includes("Tất cả tài khoản (quy về VND)") && clean(form).includes("Ví chính (VND)") && clean(html).includes("Xuất sao kê PDF"));

  // ---------- One account ----------
  let st = await statement(jarA, { ...september, accountId: wallet });
  check("a statement downloads as a PDF attachment named after the period",
    st.res.status === 200 && st.bytes?.subarray(0, 5).toString() === "%PDF-" &&
      st.res.headers.get("content-disposition") === 'attachment; filename="sao-ke-2026-09-01_2026-09-30.pdf"' && st.res.headers.get("cache-control")?.includes("no-store"),
    `${st.res.status} ${st.res.headers.get("content-type")} ${st.res.headers.get("content-disposition")}`);
  check("its header names the holder, the period, the account and its currency",
    ["SAO KÊ TÀI KHOẢN", "Account Statement", "STATEMENT ANH", A, "01/09/2026 - 30/09/2026", "Ví chính", "VND"].every((part) => st.text.includes(part)), st.pages[0]?.slice(0, 400));
  const summary = st.text.split("\n");
  const after = (label) => summary[summary.indexOf(label) + 2];
  check("the summary: opening balance, debits, credits, closing balance and number of transactions",
    after("Số dư đầu kỳ (VND)") === "900,000" && st.text.includes("Total Debit in Period\n250,000") && st.text.includes("Total Credit in Period\n500,000") &&
      after("Số dư cuối kỳ (VND)") === "1,150,000" && st.text.includes("Transactions\n3"), summary.slice(20, 45).join(" | "));
  check("every transaction of the period is listed in date order with its debit or credit, original amount and description",
    st.text.includes("05/09/2026") && st.text.includes("500,000.00 VND") && st.text.indexOf("Lương - Lương tháng 9") < st.text.indexOf("Ăn uống - Ăn trưa") &&
      st.text.indexOf("Ăn uống - Ăn trưa") < st.text.indexOf("Chuyển đến Tiết kiệm") && /\n200,000\nĂn uống - Ăn trưa/.test(st.text));
  check("transactions outside the period or of other accounts are left out", !["Trước kỳ", "Sau kỳ", "Cà phê Mỹ", "Nhận từ"].some((part) => st.text.includes(part)));
  check("the totals and the end of the statement close it",
    st.text.includes("Total Debit in Period:\n250,000") && st.text.includes("Total Credit in Period:\n500,000") && st.text.includes("1,150,000 VND") &&
      st.text.includes("Kết Thúc Sao Kê") && st.text.includes("1/1"));

  // ---------- All accounts ----------
  st = await statement(jarA, september);
  check("all accounts: in the default currency, transfers on both sides, the account named on each line",
    st.res.status === 200 && st.text.includes("Tất cả tài khoản") && st.text.includes("Chuyển đến Tiết kiệm (Ví chính)") && st.text.includes("Nhận từ Ví chính (Tiết kiệm)") &&
      st.text.includes("Total Debit in Period:\n250,000") && st.text.includes("Total Credit in Period:\n550,000") && st.text.includes("1,200,000 VND") && st.text.includes("Transactions\n5"));
  check("a transaction without an exchange rate is listed but left out of the totals, and the statement says so",
    st.text.includes("10.00 USD") && st.text.includes("Ăn uống - Cà phê Mỹ (Đô la)") && st.text.includes("1 giao dịch chưa có tỷ giá"));

  // ---------- Refusals ----------
  check("signed out, the download goes to the login page", (await get(`/transactions/statement?${new URLSearchParams(september)}`)).status === 307);
  let res = (await statement(jarA, { from: "2026-09-30", to: "2026-09-01" })).res;
  check("a period that ends before it starts is refused and sent back to the form", refusal(res) === "invalid" && new URL(res.headers.get("location"), BASE).pathname === "/transactions", res.headers.get("location"));
  check("an impossible date is refused", refusal((await statement(jarA, { from: "2026-02-30", to: "2026-03-01" })).res) === "invalid");
  check("a period longer than 3 years is refused", refusal((await statement(jarA, { from: "2020-01-01", to: "2026-01-01" })).res) === "range");
  check("another user's account is refused as not found", refusal((await statement(jarB, { ...september, accountId: wallet })).res) === "account");
  check("an account id that is not an id is refused", refusal((await statement(jarA, { ...september, accountId: "../../etc" })).res) === "account");
  let body = clean(await page("/transactions?statementError=range", jarA));
  check("the form shows the reason it was sent back", body.includes("Mỗi sao kê tối đa 3 năm. Hãy chọn khoảng thời gian ngắn hơn."));
  body = clean(await page(`/transactions?statementError=${encodeURIComponent("<b>giả mạo</b>")}`, jarA));
  check("an unknown reason in the address is not shown", !body.includes("giả mạo"));

  // ---------- Other users, long statements ----------
  st = await statement(jarB, september);
  check("a user with nothing gets an empty statement, never someone else's figures",
    st.res.status === 200 && st.text.includes("Không có giao dịch nào trong kỳ này.") && st.text.includes("Transactions\n0") && !st.text.includes("Ví chính") && !st.text.includes("500,000"));
  const many = await addAccount(bId, "Nhiều dòng", "VND", 0);
  await db.query(
    `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,note,"updatedAt")
     select gen_random_uuid()::text,$1,$2,$3,'EXPENSE',1000+n,'VND',1000+n,date '2026-07-01' + (n % 28),'Dòng ' || n,now() from generate_series(1,60) n`,
    [bId, many, food]);
  st = await statement(jarB, { from: "2026-07-01", to: "2026-07-31", accountId: many });
  check("a long statement runs over several pages, each numbered, with the column heads repeated",
    st.pages.length >= 2 && st.pages.every((text, index) => text.includes(`${index + 1}/${st.pages.length}`)) && st.pages[1].includes("(tiếp theo)") &&
      st.pages[1].includes("Ngày giao dịch") && st.text.includes("Transactions\n60") && st.pages.at(-1).includes("Kết Thúc Sao Kê") && !st.pages[0].includes("Kết Thúc Sao Kê"),
    `${st.pages.length} pages`);
  await db.query(
    `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,"updatedAt")
     select gen_random_uuid()::text,$1,$2,$3,'EXPENSE',1,'VND',1,date '2025-01-01' + (n % 300),now() from generate_series(1,3001) n`,
    [bId, many, food]);
  check("more than 3,000 transactions in the period is refused", refusal((await statement(jarB, { from: "2025-01-01", to: "2025-12-31", accountId: many })).res) === "rows");

  // ---------- Per-hour limit ----------
  const statuses = [];
  for (let i = 0; i < 30; i++) statuses.push((await get(`/transactions/statement?${new URLSearchParams(september)}`, jarC)).status);
  check("30 statements an hour are allowed", statuses.every((status) => status === 200), statuses.filter((status) => status !== 200).join(","));
  check("the next one is refused for a while", refusal((await statement(jarC, september)).res) === "busy");
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B, C]]);
  await db.end();
}
report();
