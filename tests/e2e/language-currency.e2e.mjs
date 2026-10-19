import { root, BASE, STAMP, check, report, decode, clean, readCookies, cookieHeader, get, page, formWith, submit, db, one, statementPdf } from "../harness.mjs";

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
// Everything a reader sees or a screen reader announces: text nodes plus label-like attributes.
const visible = (s) => {
  const c = clean(s);
  const attrs = [...c.matchAll(/(?:placeholder|aria-label|title|label|alt)="([^"]*)"/g)].map((m) => m[1]);
  return (c.replace(/<[^>]+>/g, " ") + " " + attrs.join(" ")).replaceAll("Ngôn ngữ / Language", "").replace("Tiếng Việt", ""); // language names stay in their own language
};
const vietnameseIn = (s) => [...new Set(visible(s).match(/[^\s|·()]*[À-ỹ][^\s|·()]*/g) ?? [])];
const text = async (res) => clean(await res.text());

await db.connect();

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const usdVnd = async (date = TODAY) => Number((await one(`select rate from exchange_rates where "baseCurrency" = 'USD' and "quoteCurrency" = 'VND' order by (date > $1::date), abs(date - $1::date) limit 1`, [date])).rate);
const near = (actual, expected, tolerance = 0.011) => Math.abs(Number(actual) - expected) <= tolerance;

try {
  // ================= Language =================
  let html = await page("/login");
  check("default language is Vietnamese", html.includes('<html lang="vi"') && clean(html).includes("Đăng nhập"));
  const guest = {};
  let res = await submit("/login", formWith(html, 'name="language"'), { language: "en" }, guest);
  readCookies(res, guest);
  check("language switch sets a cookie while signed out", guest.locale === "en");
  html = await page("/login", guest);
  check("login page renders in English with lang=en", html.includes('<html lang="en"') && clean(html).includes("Sign in") && clean(html).includes("No account yet?") && vietnameseIn(html).length === 0, vietnameseIn(html).join(" "));
  check("browser tab title is translated", /<title>Sign in/.test(html), html.match(/<title>[^<]*/)?.[0]);
  res = await submit("/login", formWith(html, 'name="language"'), { language: "xx" }, guest);
  check("unsupported language value is ignored", !res.headers.getSetCookie().some((c) => c.startsWith("locale=")));

  html = await page("/register", guest);
  const registerForm = formWith(html, 'name="confirmPassword"');
  let body = await text(await submit("/register", registerForm, { name: "Alex", email: A, password: "short", confirmPassword: "other" }, guest));
  check("validation messages are translated", body.includes("Password must be at least 8 characters.") && body.includes("Passwords do not match.") && vietnameseIn(body).length === 0, vietnameseIn(body).join(" "));
  const jarA = readCookies(await submit("/register", registerForm, { name: "Alex", email: A, password: "abc12345", confirmPassword: "abc12345" }, guest), { ...guest });
  const aId = (await one(`select id from users where email = $1`, [A])).id;
  check("language chosen before sign-up is saved to the profile", (await one(`select locale from users where id = $1`, [aId])).locale === "en");

  // Seed data with ASCII-only user text so any Vietnamese left on a page is an untranslated UI string.
  const sys = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const [food, salary] = [await sys("food"), await sys("salary")];
  const addAccount = async (uid, name, currency, balance) =>
    (await one(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,$2,'BANK',$3,$4,$4,now()) returning id`, [uid, name, currency, balance])).id;
  const wallet = await addAccount(aId, "Main", "VND", 5000000);
  const dollars = await addAccount(aId, "Dollars", "USD", 300);
  await addAccount(aId, "Old one", "VND", 0).then((id) => db.query(`update accounts set "archivedAt" = now() where id = $1`, [id]));

  html = await page("/transactions", jarA);
  const txForm = formWith(html, 'id="tx-amount"');
  const createTx = (data) => submit("/transactions", txForm, { type: "EXPENSE", accountId: wallet, categoryId: food, amount: "1", date: TODAY, note: "", ...data }, jarA);
  await createTx({ amount: "260000", note: "Lunch" });
  await createTx({ type: "INCOME", categoryId: salary, amount: "9000000", note: "Pay" });
  await createTx({ accountId: dollars, amount: "12.5", note: "Book" });
  await submit("/transactions", formWith(html, 'name="toAmount"'), { fromAccountId: wallet, toAccountId: dollars, amount: "520000", toAmount: "20", date: TODAY, note: "FX" }, jarA);
  const month = TODAY.slice(0, 7);
  html = await page("/budgets", jarA);
  await submit("/budgets", formWith(html, 'name="amountLimit"'), { month, categoryId: food, amountLimit: "300000" }, jarA);
  await submit("/budgets", formWith(html, 'name="amountLimit"'), { month, categoryId: "", amountLimit: "1000000" }, jarA);
  html = await page("/savings", jarA);
  res = await submit("/savings", formWith(html, 'name="targetAmount"'), { name: "Trip", targetAmount: "2000000", currency: "VND", deadline: TODAY.replace(/^\d{4}/, (y) => String(Number(y) + 1)) }, jarA);
  const goalPath = res.headers.get("location");
  html = await page(goalPath, jarA);
  await submit(goalPath, formWith(html, 'name="direction"'), { direction: "deposit", amount: "500000", date: TODAY, note: "First" }, jarA);
  html = await page("/categories", jarA);
  await submit("/categories", formWith(html, 'name="color"'), { name: "Coffee", type: "EXPENSE", icon: "coffee", color: "#aa5500", parentId: food }, jarA);
  const customCategory = (await one(`select id from categories where "userId" = $1`, [aId])).id;
  html = await page("/imports", jarA);
  const statement = await statementPdf([["Date", "Description", "Amount"], ["2026-10-01", "Card payment", "-45000"], ["2026-13-01", "Junk", "5"]], { right: [2] });
  const up = new FormData();
  for (const [tag] of formWith(html, 'name="file"').matchAll(/<input[^>]*type="hidden"[^>]*>/g)) up.append(decode(tag.match(/name="([^"]*)"/)[1]), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  up.append("accountId", wallet); up.append("file", new Blob([statement]), "statement.pdf");
  res = await fetch(BASE + "/imports", { method: "POST", body: up, redirect: "manual", headers: { cookie: cookieHeader(jarA), origin: BASE } });
  const pendingImport = res.headers.get("location");
  const pendingHtml = await page(pendingImport, jarA);
  // A second upload that gets confirmed, to cover the result page too.
  const up2 = new FormData();
  for (const [tag] of formWith(html, 'name="file"').matchAll(/<input[^>]*type="hidden"[^>]*>/g)) up2.append(decode(tag.match(/name="([^"]*)"/)[1]), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  up2.append("accountId", wallet); up2.append("file", new Blob([statement]), "statement-2.pdf");
  res = await fetch(BASE + "/imports", { method: "POST", body: up2, redirect: "manual", headers: { cookie: cookieHeader(jarA), origin: BASE } });
  const doneImport = res.headers.get("location");
  html = await page(doneImport, jarA);
  const mapForm = formWith(html, 'name="headerRow"');
  const defaults = {};
  for (const [select] of mapForm.matchAll(/<select[\s\S]*?<\/select>/g)) defaults[select.match(/name="([^"]*)"/)[1]] = decode((select.match(/<option[^>]*value="([^"]*)"[^>]*selected/) ?? select.match(/<option[^>]*value="([^"]*)"/))[1]);
  defaults.headerRow = "1";
  await submit(doneImport, mapForm, defaults, jarA);
  const tx = (await one(`select id from transactions where "userId" = $1 and note = 'Lunch'`, [aId])).id;
  const budget = (await one(`select id from budgets where "userId" = $1 and "categoryId" is not null`, [aId])).id;
  const goalId = goalPath.split("/").pop();

  const pages = ["/dashboard", `/dashboard?month=2026-01`, "/transactions", `/transactions/${tx}/edit`, "/accounts", `/accounts/${wallet}/edit`, "/categories", `/categories/${customCategory}/edit`, "/budgets", `/budgets/${budget}/edit`, "/budgets?month=2031-05", "/savings", goalPath, `/savings/${goalId}/edit`, "/imports", pendingImport, doneImport, "/settings"];
  const leftovers = [];
  for (const path of pages) {
    const pageHtml = await page(path, jarA);
    const found = vietnameseIn(pageHtml);
    if (found.length) leftovers.push(`${path}: ${found.slice(0, 8).join(" ")}`);
  }
  check(`no Vietnamese text left on ${pages.length} pages in English`, leftovers.length === 0, leftovers.join(" || "));
  check("pending import page is covered and in English", clean(pendingHtml).includes("Map columns") && clean(pendingHtml).includes("Confirm and import"));
  const errorEn = clean(await page(doneImport, jarA));
  const errorVi = clean(await page(doneImport, { ...jarA, locale: "vi" }));
  check("import row errors follow the reader's language, not the language at import time",
    errorEn.includes("Row 3: The date is invalid or does not match the chosen format.") && errorVi.includes("Dòng 3: Ngày không hợp lệ hoặc không đúng định dạng đã chọn.") && !errorVi.includes("Row 3"));

  body = clean(await page("/accounts", jarA));
  check("money and labels use English formatting", body.includes("Bank account · VND") && /₫\s?13,175,000/.test(body) && body.includes("Total converted to VND"), body.match(/₫[\d,]+/g)?.slice(0, 4).join(" "));
  // Dates read dd/mm/yyyy whatever the language, and the fields take them as typed.
  const todayText = TODAY.split("-").reverse().join("/");
  html = await page("/transactions", jarA);
  const dateField = html.match(/<input[^>]*id="tx-date"[^>]*>/)?.[0] ?? "";
  check("in English too, dates read dd/mm/yyyy in lists and in date fields",
    clean(html).includes(`${todayText} · `) && dateField.includes(`value="${todayText}"`) && dateField.includes('placeholder="dd/mm/yyyy"'), dateField);
  const tomorrow = new Date(`${TODAY}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowText = tomorrow.toISOString().slice(0, 10).split("-").reverse().join("/");
  const filtered = clean(await page(`/transactions?from=${encodeURIComponent(todayText)}&to=${encodeURIComponent(todayText)}`, jarA));
  const later = clean(await page(`/transactions?from=${encodeURIComponent(tomorrowText)}`, jarA));
  check("a filter typed as dd/mm/yyyy is understood", filtered.includes("Lunch") && !later.includes("Lunch"));

  body = clean(await page("/categories", jarA));
  check("system category names are translated, custom ones are left alone", body.includes("Food & drink") && body.includes("Salary") && body.includes(">Coffee<") && body.includes("Default"));
  body = clean(await page("/dashboard", jarA));
  check("dashboard figures and budget alerts are in English", body.includes("Hello, Alex") && body.includes("Spending by category") && body.includes("Earned more than spent") && /Over the limit by ₫/.test(body), body.match(/Over the limit[^<]*/)?.[0]);
  html = await page("/accounts", jarA);
  body = await text(await submit("/accounts", formWith(html, 'name="initialBalance"'), { name: "main", type: "CASH", currency: "VND", initialBalance: "0" }, jarA));
  check("server-side error messages are translated", body.includes("You already have an account with this name."));
  body = await text(await submit("/accounts", formWith(html, 'name="initialBalance"'), { name: "", type: "CASH", currency: "VND", initialBalance: "x" }, jarA));
  check("field validation is translated in forms", body.includes("Please enter an account name.") && body.includes("Invalid balance."));

  // Language follows the account to a new device, and can be changed back in settings.
  html = await page("/login");
  res = await submit("/login", formWith(html, 'name="password"'), { email: A, password: "abc12345" }, {});
  check("signing in on a fresh browser restores the saved language", res.headers.getSetCookie().some((c) => c.startsWith("locale=en")));
  html = await page("/settings", jarA);
  const settingsForm = formWith(html, 'name="defaultCurrency"');
  res = await submit("/settings", settingsForm, { name: "Alex Nguyen", language: "vi", defaultCurrency: "VND" }, jarA);
  readCookies(res, jarA);
  let user = await one(`select name, locale, "defaultCurrency" from users where id = $1`, [aId]);
  check("settings save name and language", user.name === "Alex Nguyen" && user.locale === "vi" && jarA.locale === "vi" && clean(await page("/dashboard", jarA)).includes("Xin chào, Alex Nguyen"));
  body = await text(await submit("/settings", settingsForm, { name: "", language: "fr", defaultCurrency: "XXX" }, jarA));
  check("settings validate every field", ["Vui lòng nhập họ tên.", "Ngôn ngữ không được hỗ trợ.", "Loại tiền tệ không được hỗ trợ."].every((m) => body.includes(m)));

  // ================= Exchange rates =================
  const stored = (await db.query(`select "quoteCurrency" c from exchange_rates where "baseCurrency" = 'USD' and date >= current_date - 3`)).rows.map((r) => r.c);
  check("market rates are stored for every supported currency", ["VND", "EUR", "JPY", "GBP", "AUD", "SGD", "KRW", "CNY", "THB"].every((c) => stored.includes(c)), stored.join());
  const rate = await usdVnd();
  check("stored USD/VND rate is plausible", rate > 20000 && rate < 35000, String(rate));
  body = clean(await page("/settings", jarA));
  check("settings show the rate table, update time and source", body.includes("Cập nhật lúc") && body.includes("1 USD") && body.includes("ExchangeRate-API") && body.includes("exchangerate-api.com"));

  let book = await one(`select * from transactions where "userId" = $1 and note = 'Book'`, [aId]);
  check("foreign-currency transaction is converted at the stored rate", near(book.amountInDefaultCurrency, 12.5 * rate) && near(book.exchangeRateUsed, rate, 0.000001), `${book.amountInDefaultCurrency} @ ${book.exchangeRateUsed}`);
  const balances = (await db.query(`select currency, sum("currentBalance")::text s from accounts where "userId" = $1 and "archivedAt" is null group by currency`, [aId])).rows;
  const expectedTotal = Number(balances.find((b) => b.currency === "VND").s) + Number(balances.find((b) => b.currency === "USD").s) * rate;
  body = clean(await page("/dashboard", jarA));
  const shown = Number((body.match(/Tổng quy đổi sang VND<\/p><p[^>]*>≈ ([\d.]+) ₫/)?.[1] ?? "").replace(/\./g, ""));
  check("dashboard shows total assets converted to the default currency", near(shown, expectedTotal, 1), `${shown} vs ${expectedTotal.toFixed(0)}`);

  // Backfill: a transaction recorded with no rate gets converted on the next successful refresh.
  await db.query(`update transactions set "amountInDefaultCurrency" = null, "exchangeRateUsed" = null where id = $1`, [book.id]);
  await db.query(`update exchange_rates set "createdAt" = now() - interval '2 days' where "baseCurrency" = 'USD'`);
  await page("/settings", jarA);
  const fetchedAgo = Number((await one(`select extract(epoch from (now() at time zone 'utc') - max("createdAt")) s from exchange_rates`)).s);
  book = await one(`select * from transactions where id = $1`, [book.id]);
  check("stale rates are re-fetched from the provider when a page needs them", fetchedAgo < 120, `${fetchedAgo.toFixed(0)}s ago`);
  check("unconverted transactions are filled in after a refresh", near(book.amountInDefaultCurrency, 12.5 * (await usdVnd())), String(book.amountInDefaultCurrency));
  html = await page("/settings", jarA);
  body = await text(await submit("/settings", formWith(html, "Cập nhật tỷ giá ngay"), {}, jarA));
  check("manual refresh is rate-limited instead of hammering the provider", body.includes("Tỷ giá vừa được cập nhật trong 10 phút qua."));

  // ================= Changing the default currency =================
  const jarB = readCookies(await submit("/register", formWith(await page("/register"), 'name="confirmPassword"'), { name: "Bo", email: B, password: "abc12345", confirmPassword: "abc12345" }, {}), {});
  const bId = (await one(`select id from users where email = $1`, [B])).id;
  const bWallet = await addAccount(bId, "B wallet", "VND", 0);
  await db.query(`insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency","exchangeRateUsed",date,"updatedAt") values (gen_random_uuid()::text,$1,$2,$3,'EXPENSE',70000,'VND',70000,1,$4::date,now())`, [bId, bWallet, food, TODAY]);
  const before = (await db.query(`select id, "updatedAt" from transactions where "userId" = $1`, [aId])).rows;
  const liveRate = await usdVnd();

  html = await page("/settings", jarA);
  body = await text(await submit("/settings", formWith(html, 'name="defaultCurrency"'), { name: "Alex Nguyen", language: "vi", defaultCurrency: "USD" }, jarA));
  user = await one(`select "defaultCurrency" c from users where id = $1`, [aId]);
  check("default currency changes", user.c === "USD" && body.includes("Đã lưu cài đặt."));
  const lunch = await one(`select * from transactions where "userId" = $1 and note = 'Lunch'`, [aId]);
  book = await one(`select * from transactions where id = $1`, [book.id]);
  check("every snapshot is re-expressed in the new currency", near(lunch.amountInDefaultCurrency, 260000 / liveRate) && near(Number(lunch.exchangeRateUsed) * liveRate, 1, 0.0001) && book.amountInDefaultCurrency === "12.50" && Number(book.exchangeRateUsed) === 1, `${lunch.amountInDefaultCurrency} @ ${lunch.exchangeRateUsed}`);
  const after = (await db.query(`select id, "updatedAt" from transactions where "userId" = $1`, [aId])).rows;
  check("re-conversion does not mark transactions as edited", before.every((b) => after.find((a) => a.id === b.id).updatedAt.getTime() === b.updatedAt.getTime()));
  const budgets = (await db.query(`select "amountLimit", currency from budgets where "userId" = $1 order by "amountLimit"`, [aId])).rows;
  check("budget limits are converted to the new currency", budgets.every((b) => b.currency === "USD") && near(budgets[0].amountLimit, 300000 / liveRate) && near(budgets[1].amountLimit, 1000000 / liveRate), budgets.map((b) => `${b.amountLimit} ${b.currency}`).join());
  const other = await one(`select "amountInDefaultCurrency" a from transactions where "userId" = $1`, [bId]);
  check("another user's data is untouched", other.a === "70000.00" && (await one(`select "defaultCurrency" c from users where id = $1`, [bId])).c === "VND");
  body = clean(await page("/dashboard", jarA));
  check("dashboard now reports in the new currency", body.includes("quy về USD") && body.includes("Tổng quy đổi sang USD") && /US\$/.test(body));
  body = clean(await page("/budgets", jarA));
  check("budget page uses the converted limits", body.includes("Hạn mức (USD)") && /US\$ \/ [\d.,]+ US\$/.test(body), body.match(/[\d.,]+ US\$ \/ [\d.,]+ US\$/)?.[0]);
  await createTx({ amount: "520000", note: "After switch" });
  const afterSwitch = await one(`select * from transactions where "userId" = $1 and note = 'After switch'`, [aId]);
  check("new transactions snapshot into the new default currency", near(afterSwitch.amountInDefaultCurrency, 520000 / liveRate), String(afterSwitch.amountInDefaultCurrency));

  html = await page("/settings", jarA);
  await submit("/settings", formWith(html, 'name="defaultCurrency"'), { name: "Alex Nguyen", language: "vi", defaultCurrency: "VND" }, jarA);
  const back = await one(`select * from transactions where id = $1`, [lunch.id]);
  check("switching back restores same-currency amounts exactly", back.amountInDefaultCurrency === "260000.00" && Number(back.exchangeRateUsed) === 1);
  check("signed-out /settings redirects to login", (await get("/settings")).status === 307);

  // ================= Admin: manual exchange rates =================
  check("non-admin gets 404 on the rate admin page", (await get("/admin/exchange-rates", jarA)).status === 404);
  check("non-admin nav has no rate admin link", !(await page("/dashboard", jarA)).replace(/<script[\s\S]*?<\/script>/g, "").includes("/admin/exchange-rates"));
  await db.query(`update users set role = 'ADMIN' where id = $1`, [bId]);
  html = await page("/admin/exchange-rates", jarB);
  body = clean(html);
  check("admin sees latest rates, all automatic", body.includes("Tỷ giá mới nhất") && body.includes("Chưa có tỷ giá nhập tay nào") && (body.match(/>Tự động</g) ?? []).length === 9 && html.includes('href="/admin/exchange-rates"'));
  const rateForm = formWith(html, 'name="quoteCurrency"');
  const setRate = (data, jar = jarB) => submit("/admin/exchange-rates", rateForm, { quoteCurrency: "THB", date: "2001-02-03", rate: "31.5", ...data }, jar);
  body = await text(await setRate({ quoteCurrency: "USD", date: "nope", rate: "0" }));
  check("manual rate form validates every field", ["Loại tiền tệ không được hỗ trợ.", "Ngày không hợp lệ.", "Tỷ giá phải lớn hơn 0."].every((m) => body.includes(m)));
  check("non-numeric rate rejected", (await text(await setRate({ rate: "abc" }))).includes("Tỷ giá không hợp lệ."));
  res = await setRate({}, jarA);
  check("non-admin cannot run the admin rate action", res.status === 404 && !(await one(`select 1 from exchange_rates where date = '2001-02-03'`)), String(res.status));

  body = await text(await setRate({}));
  let manualRow = await one(`select * from exchange_rates where "quoteCurrency" = 'THB' and date = '2001-02-03'`);
  check("admin saves a manual rate for a past date", manualRow?.isManual === true && manualRow.rate === "31.500000" && body.includes("Tỷ giá nhập tay") && body.includes("31,5 THB"));

  // A manual rate on the provider's own date must survive the next automatic update.
  const providerDate = (await one(`select to_char(max(date), 'YYYY-MM-DD') d from exchange_rates where "isManual" = false`)).d;
  const realThb = (await one(`select rate from exchange_rates where "quoteCurrency" = 'THB' and date = $1::date`, [providerDate])).rate;
  await setRate({ date: providerDate, rate: "99.123456" });
  await db.query(`update exchange_rates set "createdAt" = now() - interval '2 days' where "isManual" = false`);
  html = await page("/admin/exchange-rates", jarB);
  manualRow = await one(`select * from exchange_rates where "quoteCurrency" = 'THB' and date = $1::date`, [providerDate]);
  const refreshed = Number((await one(`select extract(epoch from (now() at time zone 'utc') - max("createdAt")) s from exchange_rates where "isManual" = false`)).s);
  check("automatic update refreshes other currencies but keeps the manual rate", refreshed < 120 && manualRow.rate === "99.123456" && manualRow.isManual === true && clean(html).includes(">Nhập tay<"), `${refreshed.toFixed(0)}s, THB=${manualRow.rate}`);

  await submit("/admin/exchange-rates", formWith(html, `value="${manualRow.id}"`), {}, jarA);
  check("non-admin cannot delete a manual rate", Boolean(await one(`select 1 from exchange_rates where id = $1`, [manualRow.id])));
  await submit("/admin/exchange-rates", formWith(html, `value="${manualRow.id}"`), {}, jarB);
  await db.query(`update exchange_rates set "createdAt" = now() - interval '2 days' where "isManual" = false`);
  await page("/admin/exchange-rates", jarB);
  const restored = await one(`select * from exchange_rates where "quoteCurrency" = 'THB' and date = $1::date`, [providerDate]);
  check("deleting the manual rate lets the automatic rate come back", restored?.isManual === false && restored.rate === realThb, `${restored?.rate} vs ${realThb}`);
  html = await page("/admin/exchange-rates", { ...jarB, locale: "en" });
  check("rate admin page is fully translated", clean(html).includes("Manage exchange rates") && clean(html).includes("Latest rates") && vietnameseIn(html).length === 0, vietnameseIn(html).join(" "));
} finally {
  const leftovers = (await db.query(`select b."tempFileKey" k from import_batches b join users u on u.id = b."userId" where u.email = any($1) and b."tempFileKey" is not null`, [[A, B]])).rows;
  const { rmSync } = await import("node:fs");
  for (const { k } of leftovers) rmSync(`${root}backend/storage/imports/${k}`, { force: true });
  await db.query(`delete from users where email = any($1)`, [[A, B]]);
  await db.query(`delete from exchange_rates where "isManual" = true and "quoteCurrency" = 'THB' and (rate = 31.5 or rate = 99.123456)`);
  await db.end();
}
report();
