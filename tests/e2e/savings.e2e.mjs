import { createRequire } from "node:module";

// Run through tests/run-e2e.mjs, which sets the working directory to the project root.
const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const { Client } = createRequire(root + "package.json")("pg");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
const A = `e2e-a-${STAMP}@example.com`;
const B = `e2e-b-${STAMP}@example.com`;
let failures = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const clean = (s) => decode(s.replace(/<script[\s\S]*?<\/script>/g, "")).replace(/<!-- -->/g, "").replace(/\u00a0|\u202f/g, " ");
function readCookies(res, jar) {
  for (const header of res.headers.getSetCookie()) { const pair = header.split(";")[0]; const i = pair.indexOf("="); jar[pair.slice(0, i).trim()] = pair.slice(i + 1); }
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
  return readCookies(await submit("/register", formWith(html, 'name="confirmPassword"'), { name, email, password: "abc12345", confirmPassword: "abc12345" }, {}), {});
}
const text = async (res) => clean(await res.text());

const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
await db.connect();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const goalRow = (id) => one(`select * from savings_goals where id = $1`, [id]);
const contributions = async (goalId) => (await db.query(`select * from savings_contributions where "savingsGoalId" = $1 order by "createdAt"`, [goalId])).rows;

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const plusDays = (days) => new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

try {
  const jarA = await registerUser(A, "User A");
  const jarB = await registerUser(B, "User B");
  const aId = (await one(`select id from users where email = $1`, [A])).id;
  const bId = (await one(`select id from users where email = $1`, [B])).id;

  check("signed-out /savings redirects to login", (await get("/savings")).status === 307);
  let html = await page("/savings", jarA);
  check("empty state, nav link and create form", clean(html).includes("Chưa có mục tiêu nào") && html.includes('href="/savings"') && html.includes('name="targetAmount"'));
  const goalForm = () => formWith(html, 'name="targetAmount"');
  const createGoal = (data, jar = jarA) => submit("/savings", goalForm(), { name: "Quỹ khẩn cấp", targetAmount: "10000000", currency: "VND", deadline: "", ...data }, jar);

  // ---------- Goal validation ----------
  let body = await text(await createGoal({ name: " ", targetAmount: "0", currency: "XXX", deadline: "2026-02-30" }));
  check("goal form validates every field", ["Vui lòng nhập tên mục tiêu.", "Số tiền phải lớn hơn 0.", "Loại tiền tệ không được hỗ trợ.", "Ngày không hợp lệ."].every((m) => body.includes(m)));

  // ---------- Create ----------
  let res = await createGoal({ deadline: plusDays(60) });
  const goalId = res.headers.get("location")?.split("/").pop();
  let goal = await goalRow(goalId);
  check("goal created and redirects to its page", res.status === 303 && goal?.userId === aId && goal.status === "IN_PROGRESS" && goal.currentAmount === "0.00" && goal.targetAmount === "10000000.00", `${res.status} ${res.headers.get("location")}`);
  check("duplicate goal name rejected (case-insensitive)", (await text(await createGoal({ name: "quỹ KHẨN cấp" }))).includes("Bạn đã có mục tiêu với tên này."));

  const detail = `/savings/${goalId}`;
  html = await page(detail, jarA);
  body = clean(html);
  check("detail shows progress and monthly suggestion", body.includes("0 ₫ / 10.000.000 ₫") && body.includes("0% · Còn thiếu 10.000.000 ₫") && body.includes("Còn 60 ngày · cần khoảng 5.000.000 ₫ mỗi tháng") && body.includes("Chưa có khoản nào"));
  const contributionForm = formWith(html, 'name="direction"');
  const contribute = (data, jar = jarA) => submit(detail, contributionForm, { direction: "deposit", amount: "1", date: TODAY, note: "", ...data }, jar);

  // ---------- Contribution validation ----------
  check("zero contribution rejected", (await text(await contribute({ amount: "0" }))).includes("Số tiền phải lớn hơn 0."));
  check("negative contribution rejected", (await text(await contribute({ amount: "-5" }))).includes("Số tiền không hợp lệ."));
  check("invalid date rejected", (await text(await contribute({ date: "nope" }))).includes("Ngày không hợp lệ."));
  check("invalid direction rejected", (await text(await contribute({ direction: "steal" }))).includes("Loại không hợp lệ."));
  check("rejected submits record nothing", (await contributions(goalId)).length === 0 && (await goalRow(goalId)).currentAmount === "0.00");

  // ---------- Deposits, withdrawals, completion ----------
  body = await text(await contribute({ amount: "4000000", note: "Lương tháng này" }));
  check("deposit raises the saved amount", (await goalRow(goalId)).currentAmount === "4000000.00" && body.includes("40% · Còn thiếu 6.000.000 ₫") && body.includes("+4.000.000 ₫") && body.includes("Lương tháng này"));
  body = await text(await contribute({ direction: "withdraw", amount: "5000000" }));
  check("cannot withdraw more than saved", body.includes("Không thể rút nhiều hơn số tiền đã tiết kiệm.") && (await goalRow(goalId)).currentAmount === "4000000.00" && (await contributions(goalId)).length === 1);
  body = await text(await contribute({ direction: "withdraw", amount: "1000000" }));
  let rows = await contributions(goalId);
  check("withdrawal lowers the saved amount", (await goalRow(goalId)).currentAmount === "3000000.00" && rows[1].amount === "-1000000.00" && body.includes("−1.000.000 ₫") && body.includes("Rút ra"));
  body = await text(await contribute({ amount: "7000000" }));
  goal = await goalRow(goalId);
  check("reaching the target marks the goal completed", goal.currentAmount === "10000000.00" && goal.status === "COMPLETED" && body.includes("100% · Đã đạt mục tiêu"));

  rows = await contributions(goalId);
  html = await page(detail, jarA);
  body = await text(await submit(detail, formWith(html, `value="${rows[0].id}"`), {}, jarA));
  goal = await goalRow(goalId);
  check("deleting a deposit reopens the goal", goal.currentAmount === "6000000.00" && goal.status === "IN_PROGRESS" && body.includes("60% · Còn thiếu 4.000.000 ₫"));
  html = await page(detail, jarA);
  body = await text(await submit(detail, formWith(html, `value="${rows[2].id}"`), {}, jarA));
  check("deleting a deposit that was later withdrawn is refused", body.includes("Không xóa được") && (await goalRow(goalId)).currentAmount === "6000000.00" && (await contributions(goalId)).length === 2);

  // ---------- Concurrency ----------
  await Promise.all(Array.from({ length: 10 }, (_, i) => contribute({ amount: "100000", note: `song song ${i}` })));
  check("ten simultaneous deposits all count", (await goalRow(goalId)).currentAmount === "7000000.00" && (await contributions(goalId)).length === 12, (await goalRow(goalId)).currentAmount);
  html = await page(detail, jarA);
  const victim = (await contributions(goalId)).find((row) => row.note === "song song 0");
  const victimForm = formWith(html, `value="${victim.id}"`);
  await Promise.all(Array.from({ length: 5 }, () => submit(detail, victimForm, {}, jarA)));
  check("five simultaneous deletes of one contribution subtract it once", (await goalRow(goalId)).currentAmount === "6900000.00");
  const sum = (await one(`select coalesce(sum(amount), 0)::text s from savings_contributions where "savingsGoalId" = $1`, [goalId])).s;
  check("saved amount equals the sum of contributions", Number(sum) === 6900000, sum);

  // ---------- Edit ----------
  let edit = await page(`${detail}/edit`, jarA);
  check("edit page prefilled", edit.includes('value="10000000"') && edit.includes(`value="${plusDays(60)}"`));
  const editForm = formWith(edit, 'name="targetAmount"');
  res = await submit(`${detail}/edit`, editForm, { name: "Quỹ dự phòng", targetAmount: "5000000", currency: "USD", deadline: "" }, jarA);
  goal = await goalRow(goalId);
  check("edit updates name, target and clears deadline; currency stays", res.status === 303 && res.headers.get("location") === detail && goal.name === "Quỹ dự phòng" && goal.targetAmount === "5000000.00" && goal.deadline === null && goal.currency === "VND", `${res.status}`);
  check("lowering the target below the saved amount completes the goal", goal.status === "COMPLETED");
  await submit(`${detail}/edit`, editForm, { name: "Quỹ dự phòng", targetAmount: "20000000", deadline: plusDays(-3) }, jarA);
  check("raising the target reopens the goal and a past deadline shows as overdue", (await goalRow(goalId)).status === "IN_PROGRESS" && clean(await page(detail, jarA)).includes("Đã quá hạn 3 ngày"));

  // ---------- Archive / restore ----------
  html = await page(detail, jarA);
  await submit(detail, formWith(html, ">Lưu trữ<"), {}, jarA);
  check("archive sets the status", (await goalRow(goalId)).status === "ARCHIVED");
  const before = (await contributions(goalId)).length;
  await contribute({ amount: "5" });
  check("archived goal refuses contributions (stale form)", (await goalRow(goalId)).currentAmount === "6900000.00" && (await contributions(goalId)).length === before);
  html = await page(detail, jarA);
  body = clean(html);
  check("archived goal page hides the form; list files it under archived", !html.includes('name="direction"') && body.includes("Khôi phục") && clean(await page("/savings", jarA)).includes("Đã lưu trữ (1)"));
  await submit(detail, formWith(html, ">Khôi phục<"), {}, jarA);
  check("restore re-derives the status", (await goalRow(goalId)).status === "IN_PROGRESS");

  // ---------- Isolation ----------
  check("other user sees not-found on goal page and edit page", clean(await (await get(detail, jarB)).text()).includes("Không tìm thấy trang") && clean(await (await get(`${detail}/edit`, jarB)).text()).includes("Không tìm thấy trang") && !clean(await (await get(detail, jarB)).text()).includes("Quỹ dự phòng"));
  check("other user's list does not show the goal", !clean(await page("/savings", jarB)).includes("Quỹ dự phòng"));
  html = await page("/savings", jarB);
  res = await createGoal({ name: "Của B" }, jarB);
  const bDetail = res.headers.get("location");
  html = await page(bDetail, jarB);
  await submit(bDetail, formWith(html, 'name="direction"'), { direction: "deposit", amount: "9", date: TODAY, note: "" }, jarB);
  html = await page(bDetail, jarB);
  const bContribution = (await contributions(bDetail.split("/").pop()))[0];
  const target = (await contributions(goalId))[0];
  body = await text(await submit(bDetail, formWith(html, `value="${bContribution.id}"`), { id: target.id }, jarB));
  check("other user cannot delete a contribution (forged id)", (await contributions(goalId)).some((row) => row.id === target.id) && (await goalRow(goalId)).currentAmount === "6900000.00");
  await submit(bDetail, formWith(html, ">Lưu trữ<"), { id: goalId }, jarB);
  await submit(bDetail, formWith(html, "Xóa mục tiêu"), { id: goalId }, jarB);
  goal = await goalRow(goalId);
  check("other user cannot archive or delete the goal (forged id)", goal?.status === "IN_PROGRESS");

  // ---------- Limit ----------
  await db.query(
    `insert into savings_goals (id,"userId",name,"targetAmount",currency,"updatedAt")
     select gen_random_uuid()::text,$1,'Goal ' || g,1,'VND',now() from generate_series(1,49) g`, [aId]);
  html = await page("/savings", jarA);
  check("51st goal rejected", (await text(await createGoal({ name: "Thứ 51" }))).includes("tối đa 50 mục tiêu"));

  // ---------- Delete ----------
  html = await page(detail, jarA);
  res = await submit(detail, formWith(html, "Xóa mục tiêu"), {}, jarA);
  check("deleting a goal removes it and its history", res.status === 303 && res.headers.get("location") === "/savings" && !(await goalRow(goalId)) && (await contributions(goalId)).length === 0);
  check("accounts are untouched by savings goals", (await one(`select count(*)::int n from transactions where "userId" = any($1)`, [[aId, bId]])).n === 0);
} finally {
  await db.query(`delete from users where email = any($1)`, [[A, B]]);
  await db.end();
}
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
