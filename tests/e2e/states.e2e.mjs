import { BASE, check, report, decode, clean, get, db } from "../harness.mjs";
// Empty states for a brand-new user, and not-found pages.

const EMAIL = `e2e-states-${Date.now()}@example.com`;

await db.connect();

try {
  const register = await (await get("/register")).text();
  const form = register.match(/<form[\s\S]*?<\/form>/)[0];
  const body = new FormData();
  for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) body.append(decode(tag.match(/name="([^"]*)"/)[1]), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  for (const [k, v] of Object.entries({ name: "Mới", email: EMAIL, password: "abc12345", confirmPassword: "abc12345" })) body.append(k, v);
  const response = await fetch(BASE + "/register", { method: "POST", body, redirect: "manual", headers: { origin: BASE } });
  const jar = {};
  for (const header of response.headers.getSetCookie()) { const pair = header.split(";")[0]; jar[pair.slice(0, pair.indexOf("="))] = pair.slice(pair.indexOf("=") + 1); }

  // ---------- Empty states: every list page explains itself and offers a next step ----------
  const empty = {
    "/dashboard": ["Chưa có khoản chi nào trong tháng này.", "Bạn chưa có tài khoản nào.", "Bạn chưa đặt ngân sách nào cho tháng này."],
    "/accounts": ["Bạn chưa có tài khoản nào. Hãy thêm ví tiền mặt hoặc tài khoản ngân hàng đầu tiên.", "Thêm tài khoản"],
    "/transactions": ["Chưa có giao dịch nào.", "Bạn cần ít nhất một tài khoản để ghi giao dịch."],
    "/budgets": ["Chưa có ngân sách nào cho", "Đặt ngân sách"],
    "/savings": ["Chưa có mục tiêu nào.", "Tạo mục tiêu"],
    "/imports": ["Chưa có lần nhập nào.", "Thêm tài khoản trước"],
  };
  for (const [path, texts] of Object.entries(empty)) {
    const res = await get(path, jar);
    const text = clean(await res.text());
    const missing = texts.filter((t) => !text.includes(t));
    check(`${path} renders its empty state for a new user`, res.status === 200 && missing.length === 0, missing.join(" | "));
  }
  check("categories page is never empty: default categories are there from the start", clean(await (await get("/categories", jar)).text()).includes("Ăn uống"));

  // ---------- Not found ----------
  // Pages for a single record render the message themselves, so it is in the HTML even without JavaScript.
  const unknownId = crypto.randomUUID();
  for (const path of [`/accounts/${unknownId}/edit`, `/categories/${unknownId}/edit`, `/transactions/${unknownId}/edit`, `/budgets/${unknownId}/edit`, `/savings/${unknownId}`, `/savings/${unknownId}/edit`, `/imports/${unknownId}`, "/accounts/not-a-uuid/edit"]) {
    const page = await (await get(path, jar)).text();
    check(`${path} shows not-found in the HTML, with navigation and a way back`, clean(page).includes("Không tìm thấy trang") && page.includes('href="/transactions"') && page.includes('href="/dashboard"'));
  }
  const english = clean(await (await get(`/accounts/${unknownId}/edit`, { ...jar, locale: "en" })).text());
  check("record not-found message is translated", english.includes("Page not found") && english.includes("Back to overview"));
  let res = await get("/khong-co-trang-nay", jar);
  let html = await res.text();
  check("unknown route shows a not-found message with a way back", res.status === 404 && clean(html).includes("Không tìm thấy trang") && html.includes('href="/dashboard"'), String(res.status));
  res = await get("/khong-co-trang-nay", { ...jar, locale: "en" });
  check("not-found page is translated", clean(await res.text()).includes("Page not found"));
  res = await get("/khong-co-trang-nay");
  check("signed-out visitors are sent to login instead of seeing a 404", res.status === 307 && (res.headers.get("location") ?? "").includes("/login"));
} finally {
  await db.query(`delete from users where email = $1`, [EMAIL]);
  await db.end();
}
report();
