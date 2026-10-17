import { createRequire } from "node:module";

// Run through tests/run-e2e.mjs, which sets the working directory to the project root.
const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const { Client } = createRequire(root + "package.json")("pg");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
const ADM = `e2e-adm-${STAMP}@example.com`;
const KEY = `e2e_pets_${STAMP}`;
const PASSWORD = "abc12345";
let failures = 0;

function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const clean = (s) => decode(s.replace(/<script[\s\S]*?<\/script>/g, "")).replace(/<!-- -->/g, "").replace(/\u00a0|\u202f/g, " ");

function readCookies(res, jar) {
  for (const header of res.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    const i = pair.indexOf("=");
    jar[pair.slice(0, i).trim()] = pair.slice(i + 1);
  }
  return jar;
}
const cookieHeader = (jar) => Object.entries(jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ");
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
  for (const [k, v] of Object.entries(data)) body.append(k, v);
  return fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie: cookieHeader(jar), origin: BASE } });
}

async function registerUser(email, name) {
  const html = await page("/register");
  const res = await submit("/register", formWith(html, 'name="confirmPassword"'), { name, email, password: PASSWORD, confirmPassword: PASSWORD }, {});
  return readCookies(res, {});
}

const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
await db.connect();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const userId = async (email) => (await one(`select id from users where email = $1`, [email])).id;
const category = (email, name) =>
  one(`select c.* from categories c join users u on u.id = c."userId" where u.email = $1 and c.name = $2`, [email, name]);
const byId = (id) => one(`select * from categories where id = $1`, [id]);

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const jarAdm = await registerUser(ADM, "Admin");
  await db.query(`update users set role = 'ADMIN' where email = $1`, [ADM]);
  const food = await one(`select id from categories where "systemKey" = 'food'`);
  const salary = await one(`select id from categories where "systemKey" = 'salary'`);

  // ---------- Subcategories ----------
  let html = await page("/categories", jarA);
  const catForm = () => formWith(html, 'name="color"');
  const create = (data, jar = jarA) =>
    submit("/categories", catForm(), { type: "EXPENSE", icon: "tag", color: "#123456", parentId: "", ...data }, jar);
  check("create form offers system categories as parents", catForm().includes(`value="${food.id}"`) && catForm().includes("Không có (danh mục gốc)"));

  let res = await create({ name: "Cà phê", parentId: food.id });
  let body = clean(await res.text());
  let coffee = await category(A, "Cà phê");
  check("subcategory created under a system category", coffee?.parentId === food.id);
  check("subcategory is listed nested under its parent", body.includes('aria-label="Danh mục con của Ăn uống"'));

  res = await create({ name: "Sai nhóm", parentId: salary.id });
  check("parent of the other type rejected", clean(await res.text()).includes("Danh mục cha phải cùng nhóm thu/chi."));
  res = await create({ name: "Cha lạ", parentId: crypto.randomUUID() });
  check("unknown parent rejected", clean(await res.text()).includes("Danh mục cha không hợp lệ."));
  res = await create({ name: "Cha rác", parentId: "abc" });
  check("malformed parent id rejected", clean(await res.text()).includes("Danh mục cha không hợp lệ."));
  res = await create({ name: "Cháu", parentId: coffee.id });
  check("nesting deeper than one level rejected", clean(await res.text()).includes("Danh mục cha không hợp lệ."));
  check("none of the rejected categories were created",
    (await one(`select count(*)::int n from categories where "userId" = $1`, [await userId(A)])).n === 1);

  await create({ name: "Thú cưng" });
  const pets = await category(A, "Thú cưng");
  await create({ name: "Thức ăn mèo", parentId: pets.id });
  const catFood = await category(A, "Thức ăn mèo");
  check("subcategory created under own category", catFood?.parentId === pets.id);

  html = await page("/categories", jarB);
  res = await create({ name: "Của B", parentId: pets.id }, jarB);
  check("another user's category cannot be used as parent", clean(await res.text()).includes("Danh mục cha không hợp lệ.") && !(await category(B, "Của B")));

  let edit = await page(`/categories/${pets.id}/edit`, jarA);
  check("category with children has no parent picker", !edit.includes('name="parentId"') && clean(edit).includes("luôn là danh mục gốc"));
  res = await submit(`/categories/${pets.id}/edit`, formWith(edit, 'name="color"'), { name: "Thú cưng", icon: "paw-print", color: "#123456", parentId: food.id }, jarA);
  check("category with children cannot become a child (forged)", clean(await res.text()).includes("đang có danh mục con") && (await byId(pets.id)).parentId === null);

  edit = await page(`/categories/${coffee.id}/edit`, jarA);
  const editForm = formWith(edit, 'name="color"');
  check("edit form preselects current parent and hides other type", new RegExp(`value="${food.id}"[^>]*selected`).test(editForm) && !editForm.includes(salary.id) && !editForm.includes(`value="${coffee.id}"`));
  res = await submit(`/categories/${coffee.id}/edit`, editForm, { name: "Cà phê", icon: "coffee", color: "#123456", parentId: coffee.id }, jarA);
  check("category cannot be its own parent (forged)", clean(await res.text()).includes("Danh mục cha không hợp lệ."));
  res = await submit(`/categories/${coffee.id}/edit`, editForm, { name: "Cà phê", icon: "coffee", color: "#123456", parentId: pets.id }, jarA);
  check("subcategory moved to another parent", res.status === 303 && (await byId(coffee.id)).parentId === pets.id, String(res.status));
  res = await submit(`/categories/${coffee.id}/edit`, editForm, { name: "Cà phê", icon: "coffee", color: "#123456", parentId: "" }, jarA);
  check("subcategory promoted to top level", res.status === 303 && (await byId(coffee.id)).parentId === null);

  html = await page("/categories", jarA);
  await submit("/categories", formWith(html, `value="${pets.id}"`), {}, jarA);
  check("deleting a parent promotes its children", !(await byId(pets.id)) && (await byId(catFood.id))?.parentId === null);

  // ---------- Limits ----------
  const bId = await userId(B);
  await db.query(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt")
     select gen_random_uuid()::text, $1, 'Acc ' || g, 'CASH', 'VND', 0, 0, now() from generate_series(1, 50) g`, [bId]);
  html = await page("/accounts", jarB);
  res = await submit("/accounts", formWith(html, 'name="initialBalance"'), { name: "Thứ 51", type: "CASH", currency: "VND", initialBalance: "0" }, jarB);
  check("51st account rejected", clean(await res.text()).includes("tối đa 50 tài khoản") && (await one(`select count(*)::int n from accounts where "userId" = $1`, [bId])).n === 50);

  await db.query(
    `insert into categories (id,"userId",name,type,"updatedAt")
     select gen_random_uuid()::text, $1, 'Cat ' || g, 'EXPENSE', now() from generate_series(1, 200) g`, [bId]);
  html = await page("/categories", jarB);
  res = await create({ name: "Thứ 201" }, jarB);
  check("201st category rejected", clean(await res.text()).includes("tối đa 200 danh mục") && (await one(`select count(*)::int n from categories where "userId" = $1`, [bId])).n === 200);

  // ---------- Admin ----------
  check("non-admin gets 404 on admin page", (await get("/admin/categories", jarA)).status === 404);
  check("signed-out admin page redirects to login", (await get("/admin/categories")).status === 307);
  check("non-admin nav has no admin link", !(await page("/dashboard", jarA)).replace(/<script[\s\S]*?<\/script>/g, "").includes("/admin/categories"));

  res = await get("/admin/categories", jarAdm);
  html = await res.text();
  body = clean(html);
  check("admin sees system categories with keys", res.status === 200 && body.includes(">food<") && body.includes(">salary<") && !body.includes("Cà phê<"));
  check("admin nav has admin link", body.includes('href="/admin/categories"'));
  const adminForm = () => formWith(html, 'name="systemKey"');
  const adminCreate = (data, jar = jarAdm) =>
    submit("/admin/categories", adminForm(), { type: "EXPENSE", icon: "paw-print", color: "#228855", ...data }, jar);

  res = await adminCreate({ systemKey: KEY, name: "Thú nuôi E2E" }, jarA);
  check("non-admin cannot run the admin create action", res.status === 404 && !(await one(`select 1 from categories where "systemKey" = $1`, [KEY])), String(res.status));

  res = await adminCreate({ systemKey: "Bad Key", name: "X E2E" });
  check("invalid system key rejected", clean(await res.text()).includes("Mã gồm 2–40 ký tự"));
  res = await adminCreate({ systemKey: "food", name: "Trùng mã E2E" });
  check("duplicate system key rejected", clean(await res.text()).includes("Mã này đã được dùng."));
  res = await adminCreate({ systemKey: KEY, name: "ăn UỐNG" });
  check("duplicate system name rejected", clean(await res.text()).includes("Đã có danh mục mặc định cùng tên"));

  res = await adminCreate({ systemKey: KEY, name: "Thú nuôi E2E" });
  let sys = await one(`select * from categories where "systemKey" = $1`, [KEY]);
  check("admin creates a system category", res.status === 200 && sys?.userId === null && sys?.icon === "paw-print");
  body = clean(await page("/categories", jarA));
  check("users see the new system category as default", body.includes("Thú nuôi E2E") && !body.includes(`/categories/${sys.id}/edit`));

  edit = await page(`/admin/categories/${sys.id}/edit`, jarAdm);
  res = await submit(`/admin/categories/${sys.id}/edit`, formWith(edit, 'name="color"'), { systemKey: "hacked", type: "INCOME", name: "Vật nuôi E2E", icon: "paw-print", color: "#000000" }, jarAdm);
  sys = await byId(sys.id);
  check("admin edits name/color; key and type stay fixed", res.status === 303 && sys.name === "Vật nuôi E2E" && sys.color === "#000000" && sys.systemKey === KEY && sys.type === "EXPENSE", String(res.status));

  check("admin edit page shows not-found for a user's private category", clean(await (await get(`/admin/categories/${coffee.id}/edit`, jarAdm)).text()).includes("Không tìm thấy trang"));
  check("non-admin gets 404 on admin edit page", (await get(`/admin/categories/${sys.id}/edit`, jarA)).status === 404);

  html = await page("/admin/categories", jarAdm);
  const sysDelete = formWith(html, `value="${sys.id}"`);
  await submit("/admin/categories", sysDelete, { id: coffee.id }, jarAdm);
  check("admin delete cannot touch a user's private category (forged id)", Boolean(await byId(coffee.id)));

  const aId = await userId(A);
  await db.query(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values ('e2e-acc-${STAMP}',$1,'Ví','CASH','VND',0,0,now())`, [aId]);
  await db.query(
    `insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency",date,"updatedAt")
     values (gen_random_uuid()::text,$1,'e2e-acc-${STAMP}',$2,'EXPENSE',1,'VND',1,current_date,now())`, [aId, sys.id]);
  res = await submit("/admin/categories", sysDelete, {}, jarAdm);
  check("system category in use cannot be deleted", clean(await res.text()).includes("đang được người dùng sử dụng") && Boolean(await byId(sys.id)));
  await db.query(`delete from transactions where "categoryId" = $1`, [sys.id]);
  await submit("/admin/categories", sysDelete, {}, jarAdm);
  check("unused system category deleted by admin", !(await byId(sys.id)));
  check("the 18 seeded system categories are intact", (await one(`select count(*)::int n from categories where "userId" is null`)).n === 18);
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B, ADM]]);
  await db.query(`delete from categories where "systemKey" like 'e2e\\_%'`);
  await db.end();
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
