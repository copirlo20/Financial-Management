import { BASE, PASSWORD, check, report, decode, cookieHeader, get, db, sleep } from "../harness.mjs";

const EMAIL = `e2e-${Date.now()}@example.com`;
const NAME = "E2E Tester";

function setCookies(res) {
  const out = {};
  for (const header of res.headers.getSetCookie()) {
    const [pair, ...attrs] = header.split(";");
    const i = pair.indexOf("=");
    out[pair.slice(0, i).trim()] = { value: pair.slice(i + 1), attrs: attrs.map((a) => a.trim().toLowerCase()) };
  }
  return out;
}

function hiddenFields(html, formIndex = 0) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)][formIndex]?.[0] ?? "";
  const fields = [];
  for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = tag.match(/name="([^"]*)"/)?.[1];
    if (name) fields.push([decode(name), decode(tag.match(/value="([^"]*)"/)?.[1] ?? "")]);
  }
  return fields;
}

async function submit(path, html, data, jar = {}) {
  const body = new FormData();
  for (const [k, v] of hiddenFields(html)) body.append(k, v);
  for (const [k, v] of Object.entries(data)) body.append(k, v);
  return fetch(BASE + path, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { cookie: cookieHeader(jar), origin: BASE },
  });
}

const text = async (res) => decode(await res.text()).replace(/<!-- -->/g, "");

await db.connect();

try {
  // 1. Protected route without session
  let res = await get("/dashboard");
  check("signed-out /dashboard redirects to login", res.status === 307 && res.headers.get("location")?.includes("/login?next=%2Fdashboard"), `${res.status} ${res.headers.get("location")}`);

  // 2. Register validation error
  let page = await (await get("/register")).text();
  check("register form has Server Action hidden fields", hiddenFields(page).some(([k]) => k.startsWith("$ACTION")));
  res = await submit("/register", page, { name: NAME, email: EMAIL, password: PASSWORD, confirmPassword: "different1" });
  let body = await text(res);
  check("register rejects mismatched confirmation", res.status === 200 && body.includes("Mật khẩu nhập lại không khớp."), String(res.status));
  check("register keeps typed email after error", body.includes(`value="${EMAIL}"`));

  res = await submit("/register", page, { name: NAME, email: EMAIL, password: "short", confirmPassword: "short" });
  body = await text(res);
  check("register enforces password policy", body.includes("Mật khẩu phải có ít nhất 8 ký tự.") && body.includes("chữ số"));

  // 3. Register success
  res = await submit("/register", page, { name: NAME, email: EMAIL.toUpperCase(), password: PASSWORD, confirmPassword: PASSWORD });
  let cookies = setCookies(res);
  check("register redirects to dashboard", res.status === 303 && res.headers.get("location") === "/dashboard", `${res.status} ${res.headers.get("location")}`);
  check("register sets httpOnly lax cookies", ["access_token", "refresh_token"].every((n) => cookies[n]?.attrs.includes("httponly") && cookies[n]?.attrs.includes("samesite=lax")));
  const first = { access_token: cookies.access_token?.value, refresh_token: cookies.refresh_token?.value };

  const row = (await db.query(`select email, "passwordHash" from users where email = $1`, [EMAIL])).rows[0];
  check("email stored lowercased", row?.email === EMAIL);
  check("password stored as scrypt hash", row?.passwordHash.startsWith("scrypt$32768$8$1$") && !row.passwordHash.includes(PASSWORD));
  const tokenRows = (await db.query(`select "tokenHash" from refresh_tokens rt join users u on u.id = rt."userId" where u.email = $1`, [EMAIL])).rows;
  check("refresh token stored only as hash", tokenRows.length === 1 && tokenRows[0].tokenHash !== first.refresh_token);

  // 4. Authenticated access
  res = await get("/dashboard", first);
  body = await text(res);
  check("dashboard renders for signed-in user", res.status === 200 && body.includes(`Xin chào, ${NAME}`), String(res.status));
  res = await get("/login", first);
  check("signed-in /login redirects to dashboard", res.status === 307 && res.headers.get("location") === "/dashboard", `${res.status} ${res.headers.get("location")}`);

  // 5. Duplicate email
  page = await (await get("/register")).text();
  res = await submit("/register", page, { name: NAME, email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD });
  check("register rejects duplicate email", (await text(res)).includes("Email này đã được đăng ký."));

  // 6. Expired access token -> proxy rotates refresh token and the same request renders signed in
  res = await get("/dashboard", { refresh_token: first.refresh_token });
  cookies = setCookies(res);
  body = await text(res);
  check("proxy refreshes and page renders in same request", res.status === 200 && body.includes(`Xin chào, ${NAME}`), String(res.status));
  check("rotation issues new refresh token", Boolean(cookies.refresh_token?.value) && cookies.refresh_token.value !== first.refresh_token);
  const rotated = { refresh_token: cookies.refresh_token?.value };

  // 7. Same old token again within grace window (parallel requests) is tolerated
  res = await get("/dashboard", { refresh_token: first.refresh_token });
  check("old token accepted within grace window", res.status === 200, String(res.status));

  // 8. Replay after grace window -> treated as theft, all tokens revoked
  await sleep(11_000);
  res = await get("/dashboard", { refresh_token: first.refresh_token });
  cookies = setCookies(res);
  check("replayed token rejected after grace window", res.status === 307 && res.headers.get("location")?.startsWith("/login"), `${res.status}`);
  check("rejected refresh clears auth cookies", cookies.refresh_token?.value === "" && cookies.access_token?.value === "");
  res = await get("/dashboard", rotated);
  check("replay revokes the user's other tokens too", res.status === 307, String(res.status));

  // 9. Login failures
  page = await (await get("/login")).text();
  res = await submit("/login", page, { email: EMAIL, password: "wrongpass1" });
  check("login rejects wrong password", (await text(res)).includes("Email hoặc mật khẩu không đúng."));
  res = await submit("/login", page, { email: `nobody-${Date.now()}@example.com`, password: PASSWORD });
  check("login gives same message for unknown email", (await text(res)).includes("Email hoặc mật khẩu không đúng."));

  // 10. Login honours safe ?next=
  page = await (await get("/login?next=%2Fdashboard%3Fx%3D1")).text();
  res = await submit("/login?next=%2Fdashboard%3Fx%3D1", page, { email: EMAIL, password: PASSWORD });
  check("login redirects to safe next path", res.status === 303 && res.headers.get("location") === "/dashboard?x=1", `${res.status} ${res.headers.get("location")}`);

  // 11. Open redirect attempt
  // Browsers drop tabs and line breaks inside URLs, so "/<tab>/evil.example" would become "//evil.example".
  for (const evil of ["//evil.example", "/\\evil.example", "https://evil.example", "/\t/evil.example", "/\n/evil.example", "/\r\n/evil.example", "javascript:alert(1)", " /evil"]) {
    const q = `/login?next=${encodeURIComponent(evil)}`;
    page = await (await get(q)).text();
    res = await submit(q, page, { email: EMAIL, password: PASSWORD });
    check(`login ignores unsafe next ${JSON.stringify(evil)}`, res.headers.get("location") === "/dashboard", res.headers.get("location"));
  }
  cookies = setCookies(res);
  const session = { access_token: cookies.access_token?.value, refresh_token: cookies.refresh_token?.value };

  // 12. Logout
  page = await (await get("/dashboard", session)).text();
  page = page.slice(page.indexOf("</form>") + 7); // skip the language switcher; the next form is sign-out
  res = await submit("/dashboard", page, {}, session);
  cookies = setCookies(res);
  check("logout redirects to login", res.status === 303 && res.headers.get("location") === "/login", `${res.status} ${res.headers.get("location")}`);
  check("logout clears cookies", cookies.access_token?.value === "" && cookies.refresh_token?.value === "");
  res = await get("/dashboard", { refresh_token: session.refresh_token });
  check("logged-out refresh token no longer works", res.status === 307, String(res.status));

  // 13. Disabled account
  page = await (await get("/login")).text();
  res = await submit("/login", page, { email: EMAIL, password: PASSWORD });
  cookies = setCookies(res);
  const live = { access_token: cookies.access_token?.value, refresh_token: cookies.refresh_token?.value };
  await db.query(`update users set status = 'DISABLED' where email = $1`, [EMAIL]);
  res = await get("/dashboard", { access_token: live.access_token });
  check("disabled user with valid JWT is bounced from dashboard", res.status === 307 && res.headers.get("location") === "/login", `${res.status} ${res.headers.get("location")}`);
  res = await get("/login", { access_token: live.access_token });
  check("disabled user sees login form (no redirect loop)", res.status === 200, String(res.status));
  res = await get("/dashboard", { refresh_token: live.refresh_token });
  check("disabled user cannot refresh", res.status === 307, String(res.status));
  page = await (await get("/login")).text();
  res = await submit("/login", page, { email: EMAIL, password: PASSWORD });
  check("disabled user cannot log in", (await text(res)).includes("Tài khoản đã bị khóa."));

  // 14. Password guessing: five wrong passwords lock the e-mail for the rest of the 15-minute window
  const GUESSED = `e2e-guess-${Date.now()}@example.com`;
  page = await (await get("/register")).text();
  await submit("/register", page, { name: "Guess Target", email: GUESSED, password: PASSWORD, confirmPassword: PASSWORD });
  page = await (await get("/login")).text();
  const wrong = [];
  for (let i = 0; i < 5; i++) wrong.push(await text(await submit("/login", page, { email: GUESSED, password: `wrongpass${i}` })));
  check("the first five wrong passwords get the usual message", wrong.every((body) => body.includes("Email hoặc mật khẩu không đúng.")));
  res = await submit("/login", page, { email: GUESSED, password: PASSWORD });
  check("after five wrong passwords even the right one is refused for a while", res.status === 200 && (await text(res)).includes("Đăng nhập tạm khóa vì nhập sai quá nhiều lần") && !setCookies(res).access_token?.value);
  res = await submit("/login", page, { email: GUESSED.toUpperCase(), password: PASSWORD });
  check("the lock does not depend on letter case", (await text(res)).includes("Đăng nhập tạm khóa"));
  const NOBODY = `e2e-nobody-${Date.now()}@example.com`;
  for (let i = 0; i < 5; i++) await submit("/login", page, { email: NOBODY, password: `wrongpass${i}` });
  res = await submit("/login", page, { email: NOBODY, password: PASSWORD });
  check("an unknown e-mail locks the same way, so the lock reveals nothing", (await text(res)).includes("Đăng nhập tạm khóa"));
  res = await submit("/login", page, { email: EMAIL.replace("e2e-", "e2e-other-"), password: PASSWORD });
  check("other e-mails are not affected", (await text(res)).includes("Email hoặc mật khẩu không đúng."));

  // 15. Sessions: signing out ends the access token too; password change and "sign out everywhere"
  const SESSIONS = `e2e-session-${Date.now()}@example.com`;
  page = await (await get("/register")).text();
  await submit("/register", page, { name: "Session User", email: SESSIONS, password: PASSWORD, confirmPassword: PASSWORD });
  const signIn = async (password = PASSWORD) => {
    const form = await (await get("/login")).text();
    const response = await submit("/login", form, { email: SESSIONS, password });
    const set = setCookies(response);
    return { status: response.status, jar: { access_token: set.access_token?.value, refresh_token: set.refresh_token?.value } };
  };
  const formOf = (html, marker) => [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
  const submitForm = async (path, marker, data, jar) => {
    const form = formOf(await (await get(path, jar)).text(), marker);
    const body = new FormData();
    for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = decode(tag.match(/name="([^"]*)"/)?.[1] ?? "");
      if (name) body.append(name, decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
    }
    for (const [k, v] of Object.entries(data)) body.append(k, v);
    return fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie: cookieHeader(jar), origin: BASE } });
  };
  const opens = async (jar) => (await get("/dashboard", jar)).status === 200;
  const accessOnly = (jar) => ({ access_token: jar.access_token });

  const laptop = (await signIn()).jar;
  const phone = (await signIn()).jar;
  check("two sign-ins give two working sessions", (await opens(laptop)) && (await opens(phone)));
  await submitForm("/dashboard", "Đăng xuất", {}, laptop);
  check("after signing out, that session's access token is refused at once", !(await opens(accessOnly(laptop))), "still opens");
  check("…and its refresh token too", !(await opens({ refresh_token: laptop.refresh_token })));
  check("the other session is not affected", await opens(phone));

  const tablet = (await signIn()).jar;
  const passwordForm = "name=\"currentPassword\"";
  const change = async (data, jar = phone) => text(await submitForm("/settings", passwordForm, data, jar));
  check("a wrong current password is refused", (await change({ currentPassword: "wrongpass9", newPassword: "newpass456", confirmPassword: "newpass456" })).includes("Mật khẩu hiện tại không đúng."));
  check("the new password has to be typed twice the same", (await change({ currentPassword: PASSWORD, newPassword: "newpass456", confirmPassword: "newpass457" })).includes("Mật khẩu nhập lại không khớp."));
  check("the new password must differ and follow the rules", (await change({ currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD })).includes("Mật khẩu mới phải khác mật khẩu hiện tại.") && (await change({ currentPassword: PASSWORD, newPassword: "short1", confirmPassword: "short1" })).includes("Mật khẩu phải có ít nhất 8 ký tự."));
  const changed = await change({ currentPassword: PASSWORD, newPassword: "newpass456", confirmPassword: "newpass456" });
  check("the password is changed", changed.includes("Đã đổi mật khẩu."));
  check("the session that changed it stays signed in", await opens(phone));
  check("every other session is signed out", !(await opens(accessOnly(tablet))) && !(await opens({ refresh_token: tablet.refresh_token })));
  check("the old password no longer signs in, the new one does", (await signIn(PASSWORD)).status !== 303 && (await signIn("newpass456")).status === 303);
  check("the password is never sent back to the page", !changed.includes("newpass456"));

  const desk = (await signIn("newpass456")).jar;
  const res2 = await submitForm("/settings", "Đăng xuất khỏi mọi thiết bị", {}, desk);
  check("signing out everywhere goes to the sign-in page and clears this browser's cookies", res2.status === 303 && res2.headers.get("location") === "/login" && setCookies(res2).access_token?.value === "");
  check("…and ends every session of the user", !(await opens(accessOnly(desk))) && !(await opens(accessOnly(phone))) && !(await opens({ refresh_token: phone.refresh_token })));
  check("signing in again works afterwards", (await signIn("newpass456")).status === 303);
} finally {
  await db.query(`delete from users where email = $1 or email like 'e2e-guess-%' or email like 'e2e-session-%'`, [EMAIL]);
  await db.query(`delete from rate_limits where key like '%login:fail:e2e-%'`);
  await db.end();
}

report();
