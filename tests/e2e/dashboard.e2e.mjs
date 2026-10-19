import { STAMP, check, report, clean, get, page, registerUser, db, one } from "../harness.mjs";

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
// Visible text only, tags collapsed to " | " so table cells can be matched in order.
const cells = (s) => clean(s).replace(/<[^>]+>/g, "|").replace(/\|+/g, " | ");
await db.connect();

const M = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()).slice(0, 7);
const shift = (month, delta) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7); };
const label = (month) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = (await one(`select id from users where email = $1`, [A])).id;
  const sys = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const [food, salary, transport] = [await sys("food"), await sys("salary"), await sys("transport")];
  const addCategory = async (name, parentId = null) =>
    (await one(`insert into categories (id,"userId",name,type,"parentId","updatedAt") values (gen_random_uuid()::text,$1,$2,'EXPENSE',$3,now()) returning id`, [aId, name, parentId])).id;
  const coffee = await addCategory("Cà phê", food);
  const addAccount = async (name, currency, balance) =>
    (await one(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,$2,'CASH',$3,$4,$4,now()) returning id`, [aId, name, currency, balance])).id;
  const wallet = await addAccount("Ví", "VND", 2500000);
  const usd = await addAccount("Đô", "USD", 120.5);
  const addTx = (categoryId, amount, date, { type = "EXPENSE", account = wallet, currency = "VND", converted = amount, group = null, direction = null } = {}) =>
    db.query(
      `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,"transferGroupId","transferDirection","updatedAt")
       values (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,now())`,
      [aId, account, categoryId, type, amount, currency, converted, date, group, direction]);

  // Empty dashboard first (user B has nothing).
  check("signed-out /dashboard redirects to login", (await get("/dashboard")).status === 307);
  let body = clean(await page("/dashboard", jarB));
  check("empty dashboard shows zeros and empty states", body.includes("Chưa có khoản chi nào trong tháng này.") && body.includes("Chưa có giao dịch nào trong khoảng thời gian này.") && body.includes("Bạn chưa có tài khoản nào.") && (cells(body).match(/\| 0 ₫ \|/g) ?? []).length === 3);

  // Current month.
  await addTx(salary, 20000000, `${M}-03`, { type: "INCOME" });
  await addTx(food, 3000000, `${M}-01`);
  await addTx(coffee, 500000, `${M}-04`);
  await addTx(transport, 1500000, `${M}-05`);
  await addTx(food, 40, `${M}-06`, { account: usd, currency: "USD", converted: null });
  const group = crypto.randomUUID();
  await addTx(null, 700000, `${M}-07`, { type: "TRANSFER", group, direction: "OUT" });
  await addTx(null, 700000, `${M}-07`, { type: "TRANSFER", group, direction: "IN", account: usd });
  // Earlier months.
  await addTx(salary, 18000000, `${shift(M, -1)}-10`, { type: "INCOME" });
  await addTx(food, 12000000, `${shift(M, -1)}-11`);
  await addTx(transport, 1000000, `${shift(M, -5)}-15`);
  await addTx(food, 9999999, `${shift(M, -6)}-28`);
  for (let i = 1; i <= 9; i++) await addTx(await addCategory(`Mục ${i}`), i * 100000, `${shift(M, -2)}-0${i}`);

  let html = await page("/dashboard", jarA);
  body = clean(html);
  let row = cells(html);
  check("stat tiles: income, expense, net for the month", row.includes("Thu nhập | 20.000.000 ₫") && row.includes("Chi tiêu | 5.000.000 ₫") && row.includes("Chênh lệch thu − chi | 15.000.000 ₫ | Thu nhiều hơn chi"), row.match(/Thu nhập \|[^|]*\|[^|]*\|[^|]*/)?.[0]);
  check("transfers and unconverted foreign expenses are excluded, and disclosed", body.includes("1 giao dịch ngoại tệ trong tháng chưa có tỷ giá"));
  check("current balances per currency", row.includes("Tổng USD | 120,50 US$") && row.includes("Tổng VND | 2.500.000 ₫"), row.match(/Tổng USD \|[^|]*/)?.[0]);
  check("category table rolls subcategories into the parent, sorted, with shares", row.includes("Ăn uống | 3.500.000 ₫ | 70% | Di chuyển | 1.500.000 ₫ | 30%") && !/Cà phê \| [^|]* \| \d+%/.test(row));
  const trendRow = (month, income, expense, net) => `${label(month)} | ${income} | ${expense} | ${net}`;
  check("trend table covers six months, oldest first, gaps as zero",
    row.includes([trendRow(shift(M, -5), "0 ₫", "1.000.000 ₫", "-1.000.000 ₫"), trendRow(shift(M, -4), "0 ₫", "0 ₫", "0 ₫"), trendRow(shift(M, -3), "0 ₫", "0 ₫", "0 ₫"), trendRow(shift(M, -2), "0 ₫", "4.500.000 ₫", "-4.500.000 ₫"), trendRow(shift(M, -1), "18.000.000 ₫", "12.000.000 ₫", "6.000.000 ₫"), trendRow(M, "20.000.000 ₫", "5.000.000 ₫", "15.000.000 ₫")].join(" | ")));
  check("month outside the six-month window is not included", !body.includes("9.999.999"));
  check("charts are present in the server-rendered page", (html.match(/data-slot="chart"/g) ?? []).length === 2, `chart containers: ${(html.match(/data-slot="chart"/g) ?? []).length}, svg bars: ${(html.match(/recharts-bar-rectangle/g) ?? []).length}`);

  // Previous month.
  html = await page(`/dashboard?month=${shift(M, -1)}`, jarA);
  row = cells(html);
  check("previous month has its own figures and a way back", row.includes("Thu nhập | 18.000.000 ₫") && row.includes("Chi tiêu | 12.000.000 ₫") && row.includes("Ăn uống | 12.000.000 ₫ | 100%") && html.includes(">Tháng này<") && html.includes(`/dashboard?month=${M}`));
  check("current month has no 'next month' link", !(await page("/dashboard", jarA)).includes(`/dashboard?month=${shift(M, 1)}`));

  // Many categories fold into "Khác".
  row = cells(await page(`/dashboard?month=${shift(M, -2)}`, jarA));
  check("more than seven categories fold the smallest into 'Khác'", row.includes("Mục 9 | 900.000 ₫ | 20%") && row.includes("Mục 3 | 300.000 ₫ | 7% | Khác (2 danh mục) | 300.000 ₫ | 7%") && !row.includes("Mục 1 |"));

  // Deficit month.
  row = cells(await page(`/dashboard?month=${shift(M, -5)}`, jarA));
  check("deficit month is labelled", row.includes("Chênh lệch thu − chi | -1.000.000 ₫ | Chi nhiều hơn thu"));

  check("garbage month falls back to the current month", cells(await page("/dashboard?month=13-2026", jarA)).includes("Thu nhập | 20.000.000 ₫"));
  check("another user sees none of these figures", !clean(await page("/dashboard", jarB)).includes("20.000.000"));
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B]]);
  await db.end();
}
report();
