import { STAMP, check, report, clean, get, page, formWith, submit, registerUser, db, one, userId } from "../harness.mjs";

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
await db.connect();

// Same "current month" the app uses.
const M = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()).slice(0, 7);
const shift = (month, delta) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7); };
const PREV = shift(M, -1);
const NEXT = shift(M, 1);
const lastDay = (month) => { const d = new Date(`${shift(month, 1)}-01T00:00:00Z`); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const budgetCount = async (uid, month) => (await one(`select count(*)::int n from budgets where "userId" = $1 and "periodStart" = $2::date`, [uid, `${month}-01`])).n;

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = await userId(A);
  const bId = await userId(B);
  const sys = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const [food, salary, transport] = [await sys("food"), await sys("salary"), await sys("transport")];
  const addCategory = async (uid, name, parentId = null) =>
    (await one(`insert into categories (id,"userId",name,type,"parentId","updatedAt") values (gen_random_uuid()::text,$1,$2,'EXPENSE',$3,now()) returning id`, [uid, name, parentId])).id;
  const coffee = await addCategory(aId, "Cà phê", food);
  const bPrivate = await addCategory(bId, "Riêng B");
  const addAccount = async (name, currency) =>
    (await one(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,$2,'CASH',$3,0,0,now()) returning id`, [aId, name, currency])).id;
  const wallet = await addAccount("Ví", "VND");
  const usd = await addAccount("Đô", "USD");
  const addTx = (categoryId, amount, date, { type = "EXPENSE", account = wallet, currency = "VND", converted = amount, group = null, direction = null } = {}) =>
    db.query(
      `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,"transferGroupId","transferDirection","updatedAt")
       values (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,now())`,
      [aId, account, categoryId, type, amount, currency, converted, date, group, direction]);

  check("signed-out /budgets redirects to login", (await get("/budgets")).status === 307);
  let html = await page("/budgets", jarA);
  let body = clean(html);
  check("empty state, nav link and month navigation", body.includes("Chưa có ngân sách nào") && html.includes('href="/budgets"') && html.includes(`/budgets?month=${PREV}`) && html.includes(`/budgets?month=${NEXT}`));
  const form = () => formWith(html, 'name="amountLimit"');
  const create = (data, jar = jarA) => submit("/budgets", form(), { month: M, categoryId: food, amountLimit: "1000000", ...data }, jar);
  const text = async (res) => clean(await res.text());

  // ---------- Validation ----------
  check("zero limit rejected", (await text(await create({ amountLimit: "0" }))).includes("Số tiền phải lớn hơn 0."));
  check("missing limit rejected", (await text(await create({ amountLimit: "" }))).includes("Vui lòng nhập hạn mức."));
  check("invalid month rejected", (await text(await create({ month: "2026-13" }))).includes("Tháng không hợp lệ."));
  check("malformed category rejected", (await text(await create({ categoryId: "abc" }))).includes("Danh mục không hợp lệ."));
  check("income category rejected", (await text(await create({ categoryId: salary }))).includes("Chỉ đặt được ngân sách cho danh mục khoản chi"));
  check("another user's category rejected", (await text(await create({ categoryId: bPrivate }))).includes("Chỉ đặt được ngân sách cho danh mục khoản chi"));
  check("rejected submits create nothing", (await budgetCount(aId, M)) === 0);

  // ---------- Create ----------
  await create({});
  let row = await one(`select * from budgets where "userId" = $1 and "categoryId" = $2`, [aId, food]);
  check("category budget stored for the first day of the month in the default currency", row?.amountLimit === "1000000.00" && row?.currency === "VND" && row?.periodStart.getDate() === 1);
  check("duplicate category budget rejected", (await text(await create({ amountLimit: "5" }))).includes("Tháng này đã có ngân sách cho mục này."));
  await create({ categoryId: "", amountLimit: "5000000" });
  check("overall budget created", (await budgetCount(aId, M)) === 2);
  check("duplicate overall budget rejected", (await text(await create({ categoryId: "", amountLimit: "7" }))).includes("Tháng này đã có ngân sách cho mục này."));
  await Promise.all(Array.from({ length: 4 }, () => create({ categoryId: transport, amountLimit: "300000" })));
  await Promise.all(Array.from({ length: 4 }, () => create({ month: shift(M, 5), categoryId: "", amountLimit: "1" })));
  check("simultaneous creates produce one budget each", (await one(`select count(*)::int n from budgets where "userId" = $1 and "categoryId" = $2`, [aId, transport])).n === 1 && (await budgetCount(aId, shift(M, 5))) === 1);

  // ---------- Spending and warnings ----------
  await addTx(food, 500000, `${M}-05`);
  body = clean(await page("/budgets", jarA));
  check("spent / limit / remaining shown", body.includes("500.000 ₫ / 1.000.000 ₫") && body.includes("50% · Còn 500.000 ₫"));
  check("no warning below 80%", !body.includes("đã dùng từ 80%") && !body.includes("đã vượt hạn mức"));

  await addTx(coffee, 350000, `${M}-01`);
  body = clean(await page("/budgets", jarA));
  check("subcategory spending counts toward the parent budget; near-limit warning at 85%", body.includes("850.000 ₫ / 1.000.000 ₫") && body.includes("85% · Sắp chạm hạn mức · Còn 150.000 ₫") && body.includes("1 ngân sách đã dùng từ 80% trở lên."));

  await addTx(food, 200000, lastDay(M));
  // None of these may count: other months, income, transfers, unconverted foreign currency.
  await addTx(food, 9000000, lastDay(PREV));
  await addTx(food, 9000000, `${NEXT}-01`);
  await addTx(salary, 99000000, `${M}-10`, { type: "INCOME" });
  const group = crypto.randomUUID();
  await addTx(null, 700000, `${M}-11`, { type: "TRANSFER", group, direction: "OUT" });
  await addTx(null, 700000, `${M}-11`, { type: "TRANSFER", group, direction: "IN", account: usd });
  await addTx(food, 40, `${M}-12`, { account: usd, currency: "USD", converted: null });
  body = clean(await page("/budgets", jarA));
  check("over-limit warning with the excess amount", body.includes("1.050.000 ₫ / 1.000.000 ₫") && body.includes("105% · Vượt hạn mức 50.000 ₫") && body.includes("1 ngân sách đã vượt hạn mức."));
  check("overall budget counts only this month's converted expenses", body.includes("1.050.000 ₫ / 5.000.000 ₫") && body.includes("21% · Còn 3.950.000 ₫"));
  check("unconverted foreign expenses are disclosed, not silently dropped", body.includes("1 khoản chi ngoại tệ trong tháng chưa có tỷ giá"));
  check("category without spending shows 0%", body.includes(">0 ₫ / 300.000 ₫"));

  html = await page("/budgets", jarA);
  await create({ categoryId: coffee, amountLimit: "300000" });
  body = clean(await page("/budgets", jarA));
  check("subcategory budget counts only the subcategory", body.includes("350.000 ₫ / 300.000 ₫") && body.includes("2 ngân sách đã vượt hạn mức."));

  // ---------- Dashboard ----------
  body = clean(await page("/dashboard", jarA));
  check("dashboard lists budgets needing attention", body.includes("Cảnh báo ngân sách tháng này") && body.includes("105% · Vượt hạn mức 50.000 ₫") && body.includes("Cà phê") && !body.includes(">0 ₫ / 300.000 ₫"));
  check("dashboard for a user without budgets", clean(await page("/dashboard", jarB)).includes("Bạn chưa đặt ngân sách nào cho tháng này."));

  // ---------- Edit ----------
  let edit = await page(`/budgets/${row.id}/edit`, jarA);
  check("edit page prefilled", edit.includes('value="1000000"') && clean(edit).includes("Ăn uống"));
  let res = await submit(`/budgets/${row.id}/edit`, formWith(edit, 'name="amountLimit"'), { amountLimit: "2000000", month: NEXT, categoryId: transport }, jarA);
  const after = await one(`select * from budgets where id = $1`, [row.id]);
  check("edit changes only the limit and returns to that month", res.status === 303 && res.headers.get("location") === `/budgets?month=${M}` && after.amountLimit === "2000000.00" && after.categoryId === food && after.periodStart.getTime() === row.periodStart.getTime(), `${res.status} ${res.headers.get("location")}`);
  check("raising the limit clears the warning", clean(await page("/budgets", jarA)).includes("53% · Còn 950.000 ₫"));
  check("edit rejects invalid limit", (await text(await submit(`/budgets/${row.id}/edit`, formWith(edit, 'name="amountLimit"'), { amountLimit: "-1" }, jarA))).includes("Số tiền không hợp lệ."));

  // ---------- Isolation ----------
  check("other user sees not-found on edit page", clean(await (await get(`/budgets/${row.id}/edit`, jarB)).text()).includes("Không tìm thấy trang"));
  check("other user's budget page shows none of it", clean(await page("/budgets", jarB)).includes("Chưa có ngân sách nào"));
  html = await page("/budgets", jarB);
  await create({ categoryId: food, amountLimit: "1" }, jarB);
  const bBudget = await one(`select id from budgets where "userId" = $1`, [bId]);
  html = await page("/budgets", jarB);
  await submit("/budgets", formWith(html, `value="${bBudget.id}"`), { id: row.id }, jarB);
  check("other user cannot delete the budget (forged id)", Boolean(await one(`select 1 from budgets where id = $1`, [row.id])));

  // ---------- Other months, copy ----------
  html = await page(`/budgets?month=${NEXT}`, jarA);
  body = clean(html);
  check("next month starts empty and offers to copy", body.includes("Chưa có ngân sách nào") && body.includes("Sao chép 4 ngân sách"));
  const copyForm = formWith(html, "Sao chép");
  await Promise.all([submit(`/budgets?month=${NEXT}`, copyForm, {}, jarA), submit(`/budgets?month=${NEXT}`, copyForm, {}, jarA)]);
  const copied = (await db.query(`select "categoryId", "amountLimit" from budgets where "userId" = $1 and "periodStart" = $2::date order by "amountLimit"`, [aId, `${NEXT}-01`])).rows;
  check("copy duplicates last month's budgets exactly once", copied.map((r) => r.amountLimit).join() === "300000.00,300000.00,2000000.00,5000000.00" && copied.filter((r) => r.categoryId === null).length === 1, copied.map((r) => r.amountLimit).join());
  check("copied month shows its own spending", clean(await page(`/budgets?month=${NEXT}`, jarA)).includes("9.000.000 ₫ / 2.000.000 ₫"));
  await submit(`/budgets?month=${NEXT}`, copyForm, {}, jarB);
  check("copy only reads the caller's own budgets", (await budgetCount(bId, NEXT)) === 1);
  res = await get("/budgets?month=garbage", jarA);
  check("garbage month falls back to the current month", res.status === 200 && clean(await res.text()).includes("1.050.000 ₫ / 2.000.000 ₫"));

  // ---------- Delete ----------
  html = await page("/budgets", jarA);
  res = await submit("/budgets", formWith(html, `value="${row.id}"`), {}, jarA);
  check("delete removes the budget", !(await one(`select 1 from budgets where id = $1`, [row.id])) && !clean(await res.text()).includes("/ 2.000.000 ₫"));
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B]]);
  await db.end();
}
report();
