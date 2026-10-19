import { STAMP, check, report, clean, get, page, formWith, submit, registerUser, db, one, userId } from "../harness.mjs";

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
const RATE_DATE = "2001-01-01";

await db.connect();

async function addAccount(uid, name, currency, balance) {
  return (await one(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt")
     values (gen_random_uuid()::text,$1,$2,'CASH',$3,$4,$4,now()) returning id`, [uid, name, currency, balance])).id;
}
const balance = async (id) => (await one(`select "currentBalance" b from accounts where id = $1`, [id])).b;
const nearestRate = async (date) => Number((await one(`select rate from exchange_rates where "baseCurrency" = 'USD' and "quoteCurrency" = 'VND' order by (date > $1::date), abs(date - $1::date) limit 1`, [date])).rate);
const sameMoney = (actual, expected) => Math.abs(Number(actual) - expected) < 0.011;
const txByNote = (uid, note) => one(`select * from transactions where "userId" = $1 and note = $2`, [uid, note]);

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = await userId(A);
  const bId = await userId(B);
  const food = (await one(`select id from categories where "systemKey" = 'food'`)).id;
  const salary = (await one(`select id from categories where "systemKey" = 'salary'`)).id;

  check("signed-out /transactions redirects to login", (await get("/transactions")).status === 307);
  let body = clean(await page("/transactions", jarB));
  check("user without accounts is told to add one", body.includes("Chưa có tài khoản") && !body.includes('id="tx-amount"'));

  const wallet = await addAccount(aId, "Ví", "VND", 1000000);
  const bank = await addAccount(aId, "Bank", "VND", 5000000);
  const usd = await addAccount(aId, "Đô", "USD", 100);
  const privateCat = (await one(
    `insert into categories (id,"userId",name,type,"updatedAt") values (gen_random_uuid()::text,$1,'Riêng A','EXPENSE',now()) returning id`, [aId])).id;
  const bWallet = await addAccount(bId, "Ví B", "VND", 1000);

  let html = await page("/transactions", jarA);
  body = clean(html);
  check("empty list, nav link and both forms shown", body.includes("Chưa có giao dịch nào.") && html.includes('href="/transactions"') && html.includes('name="toAmount"'));
  const txForm = () => formWith(html, 'id="tx-amount"');
  const tfForm = () => formWith(html, 'name="toAmount"');
  const createTx = (data, jar = jarA) =>
    submit("/transactions", txForm(), { type: "EXPENSE", accountId: wallet, categoryId: food, amount: "1", date: "2026-10-10", note: "", ...data }, jar);
  const transfer = (data, jar = jarA) =>
    submit("/transactions", tfForm(), { fromAccountId: wallet, toAccountId: bank, amount: "1", toAmount: "", date: "2026-10-11", note: "", ...data }, jar);

  // ---------- Validation ----------
  for (const [amount, message] of [["0", "Số tiền phải lớn hơn 0."], ["-5", "Số tiền không hợp lệ."], ["abc", "Số tiền không hợp lệ."], ["1.234", "Số tiền không hợp lệ."], ["", "Vui lòng nhập số tiền."]]) {
    check(`amount "${amount}" rejected`, clean(await (await createTx({ amount })).text()).includes(message));
  }
  check("invalid date rejected", clean(await (await createTx({ date: "2026-13-40" })).text()).includes("Ngày không hợp lệ."));
  check("malformed account rejected", clean(await (await createTx({ accountId: "x" })).text()).includes("Vui lòng chọn tài khoản."));
  check("category of the other type rejected", clean(await (await createTx({ categoryId: salary })).text()).includes("không cùng loại với giao dịch"));
  check("invalid type rejected", clean(await (await createTx({ type: "TRANSFER" })).text()).includes("Loại giao dịch không hợp lệ."));
  check("nothing was created by rejected submits", (await one(`select count(*)::int n from transactions where "userId" = $1`, [aId])).n === 0 && (await balance(wallet)) === "1000000.00");

  // ---------- Create ----------
  let res = await createTx({ amount: "50000", note: "Phở" });
  body = clean(await res.text());
  let pho = await txByNote(aId, "Phở");
  check("expense created with snapshot in default currency", pho?.amount === "50000.00" && pho?.currency === "VND" && pho?.amountInDefaultCurrency === "50000.00" && Number(pho?.exchangeRateUsed) === 1);
  check("expense lowers the account balance", (await balance(wallet)) === "950000.00", await balance(wallet));
  check("expense is listed", body.includes("−50.000 ₫") && body.includes("Ăn uống") && body.includes("10/10/2026 · Ví · Phở"));

  await createTx({ type: "INCOME", accountId: bank, categoryId: salary, amount: "2000000", note: "Lương T10" });
  check("income raises the account balance", (await balance(bank)) === "7000000.00", await balance(bank));

  await createTx({ accountId: usd, amount: "10.50", note: "USD no rate" });
  let row = await txByNote(aId, "USD no rate");
  let live = await nearestRate("2026-10-10");
  check("foreign-currency amount is converted at the stored market rate", row?.currency === "USD" && sameMoney(row?.amountInDefaultCurrency, 10.5 * live) && Number(row?.exchangeRateUsed) === live && (await balance(usd)) === "89.50", `${row?.amountInDefaultCurrency} @ ${row?.exchangeRateUsed}`);

  await db.query(`insert into exchange_rates (id,"baseCurrency","quoteCurrency",rate,date) values (gen_random_uuid()::text,'USD','VND',25000,$1)`, [RATE_DATE]);
  await createTx({ accountId: usd, amount: "2", note: "USD direct" });
  row = await txByNote(aId, "USD direct");
  check("a rate on or before the transaction date wins over a later one", row?.amountInDefaultCurrency === "50000.00" && Number(row?.exchangeRateUsed) === 25000, `${row?.amountInDefaultCurrency}`);
  await db.query(`delete from exchange_rates where date = $1`, [RATE_DATE]);
  await createTx({ accountId: usd, amount: "2", note: "USD inverse" });
  row = await txByNote(aId, "USD inverse");
  live = await nearestRate("2026-10-10");
  check("without an earlier rate, the nearest later rate is used", sameMoney(row?.amountInDefaultCurrency, 2 * live) && Number(row?.exchangeRateUsed) === live, `${row?.amountInDefaultCurrency}`);
  await db.query(`delete from exchange_rates where date = $1`, [RATE_DATE]);

  // ---------- Isolation ----------
  html = await page("/transactions", jarB);
  check("other user cannot post to someone else's account", clean(await (await createTx({ accountId: wallet, amount: "999" }, jarB)).text()).includes("Tài khoản không tồn tại"));
  check("other user cannot use someone else's category", clean(await (await createTx({ accountId: bWallet, categoryId: privateCat }, jarB)).text()).includes("Danh mục không tồn tại"));
  check("other user cannot transfer out of someone else's account", clean(await (await transferOrSkip()).text()).includes("Tài khoản không tồn tại"));
  async function transferOrSkip() {
    // B needs two accounts for the transfer form to render.
    await addAccount(bId, "Ví B2", "VND", 0);
    html = await page("/transactions", jarB);
    return transfer({ fromAccountId: wallet, toAccountId: bWallet, amount: "500" }, jarB);
  }
  check("other user's list does not show the transaction", !clean(html).includes("Phở"));
  check("other user sees not-found on edit page, not the transaction", clean(await (await get(`/transactions/${pho.id}/edit`, jarB)).text()).includes("Không tìm thấy trang") && !(await (await get(`/transactions/${pho.id}/edit`, jarB)).text()).includes('value="Phở"'));
  await createTx({ amount: "7", note: "của B", accountId: bWallet }, jarB);
  html = await page("/transactions", jarB);
  const bTx = await txByNote(bId, "của B");
  await submit("/transactions", formWith(html, `value="${bTx.id}"`), { id: pho.id }, jarB);
  check("other user cannot delete the transaction (forged id)", Boolean(await txByNote(aId, "Phở")) && (await balance(wallet)) === "950000.00");

  // ---------- Edit ----------
  let edit = await page(`/transactions/${pho.id}/edit`, jarA);
  check("edit page prefilled", edit.includes('value="50000"') && edit.includes('value="2026-10-10"') && edit.includes('value="Phở"'));
  const editForm = formWith(edit, 'id="tx-amount"');
  const editTx = (data) => submit(`/transactions/${pho.id}/edit`, editForm, { type: "EXPENSE", accountId: wallet, categoryId: food, amount: "50000", date: "2026-10-10", note: "Phở", ...data }, jarA);

  res = await editTx({ amount: "80000", accountId: bank });
  check("edit moves the amount between accounts", res.status === 303 && (await balance(wallet)) === "1000000.00" && (await balance(bank)) === "6920000.00", `${await balance(wallet)} / ${await balance(bank)}`);
  res = await editTx({ type: "INCOME", categoryId: salary, amount: "80000", accountId: bank, date: "2026-10-12" });
  pho = await txByNote(aId, "Phở");
  check("edit can flip expense to income", (await balance(bank)) === "7080000.00" && pho.type === "INCOME" && pho.categoryId === salary, await balance(bank));
  check("edit rejects mismatched category", clean(await (await editTx({ type: "EXPENSE", categoryId: salary, accountId: bank })).text()).includes("không cùng loại") && (await balance(bank)) === "7080000.00");
  check("edit rejects someone else's account", clean(await (await editTx({ accountId: bWallet })).text()).includes("Tài khoản không tồn tại"));
  await db.query(`update accounts set "archivedAt" = now() where id = $1`, [wallet]);
  check("edit cannot move a transaction onto an archived account", clean(await (await editTx({ accountId: wallet })).text()).includes("đã được lưu trữ") && (await balance(wallet)) === "1000000.00");
  check("create rejects an archived account", clean(await (await (html = await page("/transactions", jarA), createTx({ amount: "5" }))).text()).includes("đã được lưu trữ"));
  await db.query(`update accounts set "archivedAt" = null where id = $1`, [wallet]);
  await editTx({ accountId: wallet, amount: "50000" });
  check("edit back to original restores balances", (await balance(wallet)) === "950000.00" && (await balance(bank)) === "7000000.00");

  // ---------- Transfers ----------
  html = await page("/transactions", jarA);
  check("transfer to the same account rejected", clean(await (await transfer({ toAccountId: wallet })).text()).includes("Tài khoản đích phải khác tài khoản nguồn."));
  check("cross-currency transfer needs received amount", clean(await (await transfer({ toAccountId: usd, amount: "250000" })).text()).includes("vui lòng nhập số tiền nhận (USD)"));
  check("same-currency transfer rejects a different received amount", clean(await (await transfer({ amount: "100", toAmount: "90" })).text()).includes("số tiền nhận phải bằng số tiền chuyển"));

  res = await transfer({ amount: "300000", note: "Gửi tiết kiệm" });
  body = clean(await res.text());
  let legs = (await db.query(`select * from transactions where "userId" = $1 and note = 'Gửi tiết kiệm' order by "transferDirection"`, [aId])).rows;
  check("transfer creates a linked OUT/IN pair", legs.length === 2 && legs[0].transferGroupId === legs[1].transferGroupId && legs.map((l) => `${l.transferDirection}:${l.accountId === wallet ? "wallet" : "bank"}`).sort().join() === "IN:bank,OUT:wallet" && legs.every((l) => l.type === "TRANSFER" && l.categoryId === null));
  check("transfer moves the balance", (await balance(wallet)) === "650000.00" && (await balance(bank)) === "7300000.00", `${await balance(wallet)} / ${await balance(bank)}`);
  check("both sides are labelled in the list", body.includes("Chuyển đến Bank") && body.includes("Nhận từ Ví") && body.includes("+300.000 ₫"));

  await transfer({ toAccountId: usd, amount: "250000", toAmount: "10", note: "Đổi đô" });
  check("cross-currency transfer uses both amounts", (await balance(wallet)) === "400000.00" && (await balance(usd)) === "95.50", `${await balance(wallet)} / ${await balance(usd)}`);
  check("transfer rows have no edit page", clean(await (await get(`/transactions/${legs[0].id}/edit`, jarA)).text()).includes("Không tìm thấy trang"));

  html = await page("/transactions", jarA);
  const inLeg = legs.find((l) => l.transferDirection === "IN");
  await submit("/transactions", formWith(html, `value="${inLeg.id}"`), {}, jarA);
  check("deleting one side removes both and restores balances",
    (await one(`select count(*)::int n from transactions where "transferGroupId" = $1`, [inLeg.transferGroupId])).n === 0 && (await balance(wallet)) === "700000.00" && (await balance(bank)) === "7000000.00");

  // ---------- Concurrency ----------
  html = await page("/transactions", jarA);
  await Promise.all(Array.from({ length: 8 }, (_, i) => createTx({ amount: "1000", note: `song song ${i}` })));
  check("parallel creates each hit the balance exactly once", (await balance(wallet)) === "692000.00", await balance(wallet));
  html = await page("/transactions", jarA);
  const victim = await txByNote(aId, "song song 0");
  const victimForm = formWith(html, `value="${victim.id}"`);
  await Promise.all(Array.from({ length: 6 }, () => submit("/transactions", victimForm, {}, jarA)));
  check("parallel deletes of one transaction refund it only once", (await balance(wallet)) === "693000.00" && !(await txByNote(aId, "song song 0")), await balance(wallet));

  // ---------- Delete + invariant ----------
  html = await page("/transactions", jarA);
  await submit("/transactions", formWith(html, `value="${pho.id}"`), {}, jarA);
  check("deleting an expense refunds the account", !(await txByNote(aId, "Phở")) && (await balance(wallet)) === "743000.00", await balance(wallet));

  const drift = (await db.query(
    `select a.name from accounts a where a."userId" = $1 and a."currentBalance" <> a."initialBalance" + coalesce((
       select sum(case when t.type = 'INCOME' or t."transferDirection" = 'IN' then t.amount else -t.amount end)
       from transactions t where t."accountId" = a.id), 0)`, [aId])).rows;
  check("every balance equals opening balance plus its transactions", drift.length === 0, drift.map((d) => d.name).join());

  // ---------- Filters & pagination ----------
  await db.query(
    `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,note,"updatedAt")
     select gen_random_uuid()::text,$1,$2,$3,'EXPENSE',1,'VND',1,date '2026-09-01' + g,'bulk ' || g,now() from generate_series(1,25) g`, [aId, bank, food]);
  body = clean(await page("/transactions", jarA));
  const total = (await one(`select count(*)::int n from transactions where "userId" = $1`, [aId])).n;
  check("list is paginated", body.includes(`Trang 1/2 · ${total} giao dịch`) && body.includes("Trang sau") && (body.match(/<li class="flex flex-wrap items-center gap-x-3/g) ?? []).length === 20);
  body = clean(await page("/transactions?page=2", jarA));
  check("second page shows the rest", body.includes("Trang 2/2") && body.includes("Trang trước") && (body.match(/<li class="flex flex-wrap items-center gap-x-3/g) ?? []).length === total - 20);
  body = clean(await page("/transactions?type=INCOME", jarA));
  check("type filter", body.includes("Lương T10") && !body.includes("bulk") && !body.includes("Đổi đô") && body.includes("Xóa lọc"));
  body = clean(await page(`/transactions?accountId=${usd}`, jarA));
  check("account filter", body.includes("USD direct") && body.includes("Nhận từ Ví") && !body.includes("Lương T10"));
  body = clean(await page(`/transactions?categoryId=${salary}`, jarA));
  check("category filter", body.includes("Lương T10") && !body.includes("USD direct"));
  body = clean(await page("/transactions?from=2026-09-02&to=2026-09-03", jarA));
  check("date range filter", body.includes("bulk 1<") && body.includes("bulk 2<") && !body.includes("bulk 3<") && !body.includes("Lương T10") && !body.includes("Trang 1/"));
  res = await get(`/transactions?accountId=xx&type=HACK&from=nope&page=-3&categoryId=${bWallet}`, jarA);
  check("garbage filters are ignored, not errors", res.status === 200);
  body = clean(await page(`/transactions?accountId=${wallet}`, jarB));
  check("filtering by someone else's account shows nothing of theirs", !body.includes("song song") && !body.includes("Đổi đô"));
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B]]);
  await db.query(`delete from exchange_rates where date = $1`, [RATE_DATE]);
  await db.end();
}

report();
