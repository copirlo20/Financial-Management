import { STAMP, check, report, clean, get, page, formWith, submit, registerUser, db, one, removeUsers } from "../harness.mjs";

const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;

await db.connect();

const account = (email, name) =>
  one(`select a.* from accounts a join users u on u.id = a."userId" where u.email = $1 and a.name = $2`, [email, name]);
const category = (email, name) =>
  one(`select c.* from categories c join users u on u.id = c."userId" where u.email = $1 and c.name = $2`, [email, name]);

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  check("both users registered", Boolean(jarA.access_token && jarB.access_token));

  // ---------- Accounts ----------
  let res = await get("/accounts");
  check("signed-out /accounts redirects to login", res.status === 307 && res.headers.get("location")?.includes("/login?next=%2Faccounts"));

  let html = await page("/accounts", jarA);
  check("accounts page shows empty state and nav", clean(html).includes("Bạn chưa có tài khoản nào") && html.includes('href="/categories"'));
  const createForm = () => formWith(html, 'name="initialBalance"');

  res = await submit("/accounts", createForm(), { name: "  ", type: "HACK", currency: "XXX", initialBalance: "abc" }, jarA);
  let body = clean(await res.text());
  check("create account validates every field",
    ["Vui lòng nhập tên tài khoản.", "Loại tài khoản không hợp lệ.", "Loại tiền tệ không được hỗ trợ.", "Số dư không hợp lệ."].every((m) => body.includes(m)));

  res = await submit("/accounts", createForm(), { name: "Ví tiền mặt", type: "CASH", currency: "VND", initialBalance: "1500000" }, jarA);
  body = clean(await res.text());
  check("created account is listed with formatted balance", res.status === 200 && body.includes("Ví tiền mặt") && body.includes("1.500.000 ₫"), String(res.status));
  let acc = await account(A, "Ví tiền mặt");
  check("new account currentBalance equals initialBalance", acc?.currentBalance === "1500000.00" && acc?.initialBalance === "1500000.00", `${acc?.currentBalance}`);

  res = await submit("/accounts", createForm(), { name: "ví TIỀN mặt", type: "BANK", currency: "VND", initialBalance: "0" }, jarA);
  check("duplicate account name rejected (case-insensitive)", clean(await res.text()).includes("Bạn đã có tài khoản với tên này."));

  res = await submit("/accounts", createForm(), { name: "Thẻ tín dụng", type: "CREDIT_CARD", currency: "USD", initialBalance: "-120.50" }, jarA);
  body = clean(await res.text());
  const card = await account(A, "Thẻ tín dụng");
  check("negative decimal balance stored exactly", card?.currentBalance === "-120.50", `${card?.currentBalance}`);
  check("totals are grouped per currency", body.includes("Tổng VND") && body.includes("Tổng USD"));

  // Edit: simulate 100,000 already spent, then raise opening balance by 500,000
  await db.query(`update accounts set "currentBalance" = 1400000 where id = $1`, [acc.id]);
  html = await page(`/accounts/${acc.id}/edit`, jarA);
  check("edit page prefilled", html.includes('value="Ví tiền mặt"') && html.includes('value="1500000"'));
  res = await submit(`/accounts/${acc.id}/edit`, formWith(html, 'name="initialBalance"'), { name: "Ví chính", type: "BANK", currency: "USD", initialBalance: "2000000" }, jarA);
  check("edit redirects to list", res.status === 303 && res.headers.get("location") === "/accounts", `${res.status} ${res.headers.get("location")}`);
  acc = await one(`select * from accounts where id = $1`, [acc.id]);
  check("edit updates name and type", acc.name === "Ví chính" && acc.type === "BANK");
  check("edit shifts currentBalance by the opening-balance delta", acc.initialBalance === "2000000.00" && acc.currentBalance === "1900000.00", `${acc.initialBalance} / ${acc.currentBalance}`);
  check("edit cannot change currency", acc.currency === "VND", acc.currency);

  res = await submit(`/accounts/${acc.id}/edit`, formWith(html, 'name="initialBalance"'), { name: "Thẻ tín dụng", type: "BANK", initialBalance: "1" }, jarA);
  check("edit rejects name of another account", clean(await res.text()).includes("Bạn đã có tài khoản với tên này."));

  // Isolation
  res = await get(`/accounts/${acc.id}/edit`, jarB);
  check("other user sees not-found on edit page, not the account", !clean(await res.text()).includes("Ví chính") && clean(await (await get(`/accounts/${acc.id}/edit`, jarB)).text()).includes("Không tìm thấy trang"));
  check("other user's list does not show the account", !clean(await page("/accounts", jarB)).includes("Ví chính"));
  html = await page("/accounts", jarB);
  await submit("/accounts", formWith(html, 'name="initialBalance"'), { name: "Ví B", type: "CASH", currency: "VND", initialBalance: "10" }, jarB);
  const accB = await account(B, "Ví B");
  html = await page("/accounts", jarB);
  await submit("/accounts", formWith(html, `value="${accB.id}"`), { id: acc.id }, jarB);
  acc = await one(`select * from accounts where id = $1`, [acc.id]);
  check("other user cannot archive the account (forged id)", acc.archivedAt === null);

  // Archive / restore
  html = await page("/accounts", jarA);
  res = await submit("/accounts", formWith(html, `value="${acc.id}"`), {}, jarA);
  body = clean(await res.text());
  check("archive moves account to archived section", body.includes("Đã lưu trữ (1)") && !body.includes("Tổng VND"));
  res = await submit("/accounts", formWith(body, `value="${acc.id}"`), {}, jarA);
  body = clean(await res.text());
  check("restore brings account back", !body.includes("Đã lưu trữ (") && body.includes("Tổng VND") && body.includes("1.900.000 ₫"));

  // ---------- Categories ----------
  html = await page("/categories", jarA);
  body = clean(html);
  check("categories page lists system categories as read-only", body.includes("Ăn uống") && body.includes("Lương") && (body.match(/Mặc định/g) ?? []).length === 18 && !body.includes("/edit"));
  const catForm = () => formWith(html, 'name="color"');

  res = await submit("/categories", catForm(), { name: "", type: "X", icon: "hack", color: "red" }, jarA);
  body = clean(await res.text());
  check("create category validates every field",
    ["Vui lòng nhập tên danh mục.", "Loại danh mục không hợp lệ.", "Biểu tượng không hợp lệ.", "Màu không hợp lệ."].every((m) => body.includes(m)));

  res = await submit("/categories", catForm(), { name: "ăn UỐNG", type: "EXPENSE", icon: "coffee", color: "#AA5500" }, jarA);
  check("category name clashing with a system one rejected", clean(await res.text()).includes("Đã có danh mục cùng tên trong nhóm này."));

  res = await submit("/categories", catForm(), { name: "Cà phê", type: "EXPENSE", icon: "coffee", color: "#AA5500" }, jarA);
  body = clean(await res.text());
  let cat = await category(A, "Cà phê");
  check("custom category created and listed", body.includes("Cà phê") && cat?.icon === "coffee" && cat?.color === "#AA5500" && cat?.systemKey === null);
  check("other user does not see it", !clean(await page("/categories", jarB)).includes(">Cà phê<") && body.includes(">Cà phê<"));

  html = await page(`/categories/${cat.id}/edit`, jarA);
  res = await submit(`/categories/${cat.id}/edit`, formWith(html, 'name="color"'), { name: "Cafe", type: "INCOME", icon: "utensils", color: "#112233" }, jarA);
  cat = await one(`select * from categories where id = $1`, [cat.id]);
  check("edit category updates fields and redirects", res.status === 303 && cat.name === "Cafe" && cat.icon === "utensils" && cat.color === "#112233", String(res.status));
  check("edit cannot change category type", cat.type === "EXPENSE", cat.type);

  const system = await one(`select id from categories where "systemKey" = 'food'`);
  check("system category has no edit page", clean(await (await get(`/categories/${system.id}/edit`, jarA)).text()).includes("Không tìm thấy trang"));
  check("other user sees not-found on category edit page", clean(await (await get(`/categories/${cat.id}/edit`, jarB)).text()).includes("Không tìm thấy trang"));

  // Forged deletes from user B
  html = await page("/categories", jarB);
  await submit("/categories", formWith(html, 'name="color"'), { name: "Của B", type: "INCOME", icon: "tag", color: "#000000" }, jarB);
  const catB = await category(B, "Của B");
  html = await page("/categories", jarB);
  const deleteFormB = formWith(html, `value="${catB.id}"`);
  await submit("/categories", deleteFormB, { id: cat.id }, jarB);
  await submit("/categories", deleteFormB, { id: system.id }, jarB);
  check("other user cannot delete the category (forged id)", Boolean(await one(`select 1 from categories where id = $1`, [cat.id])));
  check("system categories cannot be deleted (forged id)", (await one(`select count(*)::int n from categories where "userId" is null`)).n === 18);

  // In-use guard
  await db.query(
    `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,"updatedAt")
     values (gen_random_uuid()::text,$1,$2,$3,'EXPENSE',50000,'VND',50000,current_date,now())`,
    [acc.userId, acc.id, cat.id],
  );
  html = await page("/categories", jarA);
  res = await submit("/categories", formWith(html, `value="${cat.id}"`), {}, jarA);
  check("category in use cannot be deleted", clean(await res.text()).includes("Danh mục đang được dùng") && Boolean(await one(`select 1 from categories where id = $1`, [cat.id])));
  await db.query(`delete from transactions where "categoryId" = $1`, [cat.id]);
  html = await page("/categories", jarA);
  res = await submit("/categories", formWith(html, `value="${cat.id}"`), {}, jarA);
  check("unused category is deleted", !(await one(`select 1 from categories where id = $1`, [cat.id])) && !clean(await res.text()).includes("Cafe"));

  check("dashboard still renders inside new layout", clean(await page("/dashboard", jarA)).includes("Xin chào, User A"));
} finally {
  await removeUsers([A, B]);
  await db.end();
}

report();
