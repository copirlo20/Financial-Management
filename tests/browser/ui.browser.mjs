// Behaviour that only exists with JavaScript running: charts, confirmation dialogs, in-place form
// updates, the navigation skeleton, and the error boundary. Uses a real headless browser.
import path from "node:path";
import { BASE, STAMP, browserCookies, check, db, one, registerUser, report } from "../harness.mjs";
import { findBrowser, launch } from "./cdp.mjs";

const EMAIL = `e2e-browser-${STAMP}@example.com`;
// Set E2E_SCREENSHOTS to a folder to keep a picture of each state for a human to look at.
const shots = process.env.E2E_SCREENSHOTS;

if (!findBrowser()) {
  console.log("SKIP browser tests: no Edge or Chrome found (set E2E_BROWSER to its path).");
  process.exit(0);
}

await db.connect();
const text = `document.body.innerText`;
const location_ok = (pathname) => pathname.endsWith("/edit");
let browser;

try {
  // Sign up through the real form to get session cookies.
  const cookies = browserCookies(await registerUser(EMAIL, "Trình Duyệt"));
  const userId = (await one(`select id from users where email = $1`, [EMAIL])).id;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const category = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const accountId = (await one(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,'Ví chính','CASH','VND',2000000,1550000,now()) returning id`, [userId])).id;
  const addExpense = async (key, amount, note) =>
    db.query(`insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency","exchangeRateUsed",date,note,"updatedAt") values (gen_random_uuid()::text,$1,$2,$3,'EXPENSE',$4,'VND',$4,1,$5::date,$6,now())`,
      [userId, accountId, await category(key), amount, today, note]);
  await addExpense("food", 300000, "Ăn trưa");
  await addExpense("transport", 100000, "Xe buýt");
  await addExpense("shopping", 50000, "Xóa tôi");

  browser = await launch();
  await browser.setCookies(BASE, cookies);
  // Every Content Security Policy violation on any page is recorded; the suite expects none.
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline')));",
  });
  const cspViolations = [];
  const collectCsp = async () => cspViolations.push(...((await browser.evaluate("window.__csp ?? []").catch(() => [])) ?? []));
  const plainGoto = browser.goto;
  browser.goto = async (url) => {
    await collectCsp();
    await plainGoto(url);
  };
  const shoot = async (name) => { if (shots) await browser.screenshot(path.join(shots, `${name}.png`)); };

  // ---------- Charts ----------
  await browser.goto(BASE + "/dashboard");
  const bars = await browser.waitFor(`document.querySelectorAll(".recharts-bar-rectangle").length`, { message: "chart bars" });
  check("dashboard charts draw bars in the browser", bars >= 4, `${bars} bars`);
  // Bars animate in for about 1.5s; hovering one mid-animation can miss it, so wait and retry.
  const readTooltip = `(() => { const t = document.querySelector(".recharts-tooltip-wrapper"); return t && getComputedStyle(t).visibility === "visible" && t.innerText.trim(); })()`;
  let tooltip = "";
  for (let attempt = 0; attempt < 6 && !tooltip; attempt++) {
    await browser.sleep(attempt === 0 ? 1800 : 500);
    await browser.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
    await browser.hover(".recharts-bar-rectangle");
    await browser.sleep(400);
    tooltip = (await browser.evaluate(readTooltip)) || "";
  }
  check("hovering a bar shows a tooltip with the exact amount", /₫/.test(tooltip) && /Đã chi|Thu nhập|Chi tiêu/.test(tooltip), tooltip.replace(/\s+/g, " "));
  await shoot("chart-tooltip");

  // ---------- Confirmation before deleting ----------
  await browser.goto(BASE + "/transactions");
  await browser.evaluate(`window.__stay = "same page"`);
  const clickDelete = `(() => { const row = [...document.querySelectorAll("li")].find((li) => li.innerText.includes("Xóa tôi")); row.querySelector("form button[type=submit]").click(); return true; })()`;
  const modal = `document.querySelector('[data-testid="confirm-dialog"]')`;
  const modalButton = (label) => `[...${modal}.querySelectorAll("button")].find((b) => b.innerText.trim() === ${JSON.stringify(label)})`;
  const nativeDialogs = browser.dialogs.length;
  await browser.evaluate(clickDelete);
  const asked = await browser.waitFor(`(() => { const m = ${modal}; return m && { role: m.getAttribute("role"), title: m.querySelector("h2")?.innerText, text: m.innerText, focused: document.activeElement?.innerText?.trim() }; })()`, { message: "confirmation modal" });
  check("delete asks for confirmation in a modal, not a browser popup",
    asked.role === "alertdialog" && asked.title === "Xóa giao dịch này?" && asked.text.includes("Thao tác này không thể hoàn tác.") && asked.text.includes("Hủy") && asked.text.includes("Xóa") && browser.dialogs.length === nativeDialogs,
    JSON.stringify(asked));
  check("the modal starts on Cancel, so Enter does not delete by accident", asked.focused === "Hủy", asked.focused);
  await browser.sleep(300);
  await shoot("confirm-modal");
  const layout = await browser.evaluate(`(() => {
    const m = ${modal}; const r = m.getBoundingClientRect();
    const icon = m.querySelector('[data-slot="alert-dialog-icon"]');
    return { centred: Math.abs(r.left + r.width / 2 - innerWidth / 2) <= 2 && Math.abs(r.top + r.height / 2 - innerHeight / 2) <= 2, width: Math.round(r.width), icon: Boolean(icon?.querySelector("svg")),
             beside: icon ? icon.getBoundingClientRect().right <= m.querySelector("h2").getBoundingClientRect().left : false };
  })()`);
  check("on a computer the modal is a card in the middle with its icon beside the text", layout.centred && layout.icon && layout.beside && layout.width <= 448, JSON.stringify(layout));
  await browser.evaluate(`${modalButton("Hủy")}.click()`);
  await browser.waitFor(`!${modal}`, { message: "modal to close on Cancel" });
  check("cancelling deletes nothing", Boolean(await one(`select 1 from transactions where "userId" = $1 and note = 'Xóa tôi'`, [userId])) && (await browser.evaluate(text)).includes("Xóa tôi"));
  await browser.evaluate(clickDelete);
  await browser.waitFor(`Boolean(${modal})`, { message: "modal again" });
  await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await browser.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await browser.waitFor(`!${modal}`, { message: "modal to close on Escape" });
  check("Escape closes the modal and deletes nothing", Boolean(await one(`select 1 from transactions where "userId" = $1 and note = 'Xóa tôi'`, [userId])));
  await browser.evaluate(clickDelete);
  await browser.waitFor(`Boolean(${modal})`, { message: "modal once more" });
  await browser.evaluate(`${modalButton("Xóa")}.click()`);
  await browser.waitFor(`!${text}.includes("Xóa tôi")`, { message: "deleted row to disappear" });
  check("accepting deletes the transaction and refunds the account", !(await one(`select 1 from transactions where "userId" = $1 and note = 'Xóa tôi'`, [userId])) && (await one(`select "currentBalance" b from accounts where id = $1`, [accountId])).b === "1600000.00");
  check("the list updates in place, without a full page reload", (await browser.evaluate(`window.__stay`)) === "same page");

  // ---------- Forms update in place ----------
  await browser.goto(BASE + "/accounts");
  await browser.evaluate(`window.__stay = "same page"`);
  const fillAccount = (name) => `(() => { document.querySelector("#name").value = ${JSON.stringify(name)}; document.querySelector("#initialBalance").value = "500000"; document.querySelector("#initialBalance").closest("form").querySelector("button[type=submit]").click(); return true; })()`;
  await browser.evaluate(fillAccount("Tiết kiệm"));
  await browser.waitFor(`${text}.includes("Đã tạo tài khoản.") && ${text}.includes("Tiết kiệm")`, { message: "new account to appear" });
  check("creating an account shows it and a success message without reloading", (await browser.evaluate(`window.__stay`)) === "same page");
  check("the form is cleared after a successful save", (await browser.evaluate(`document.querySelector("#name").value`)) === "");
  await browser.evaluate(fillAccount("tiết KIỆM"));
  await browser.waitFor(`${text}.includes("Bạn đã có tài khoản với tên này.")`, { message: "duplicate-name error" });
  check("a rejected save shows the error and keeps what was typed", (await browser.evaluate(`document.querySelector("#name").value`)) === "tiết KIỆM" && (await browser.evaluate(`document.querySelector("#name").getAttribute("aria-invalid")`)) === "true");

  // ---------- Language switch ----------
  await browser.evaluate(`document.querySelector('button[name="language"][value="en"]').click()`);
  await browser.waitFor(`document.querySelector("nav").innerText.includes("Overview")`, { message: "English navigation" });
  check("switching language re-renders the page in place", (await browser.evaluate(`window.__stay`)) === "same page" && (await browser.evaluate(text)).includes("Add account") && (await browser.evaluate(`document.documentElement.lang`)) === "en");
  await browser.evaluate(`document.querySelector('button[name="language"][value="vi"]').click()`);
  await browser.waitFor(`document.querySelector("nav").innerText.includes("Tổng quan")`, { message: "Vietnamese navigation" });

  // ---------- Navigation skeleton ----------
  await browser.slowNetwork(1500);
  await browser.evaluate(`document.querySelector('nav a[href="/budgets"]').click()`);
  const overlay = await browser.waitFor(`(() => { const o = document.querySelector('[data-testid="navigation-pending"]'); return o && { busy: o.getAttribute("aria-busy"), label: o.innerText.trim(), link: Boolean(document.querySelector('nav a[href="/budgets"] [aria-busy="true"]')) }; })()`, { timeout: 4000, message: "navigation skeleton" });
  check("a slow navigation shows the loading skeleton and marks the clicked link", overlay.busy === "true" && overlay.label === "Đang tải..." && overlay.link, JSON.stringify(overlay));
  await shoot("navigation-skeleton");
  await browser.waitFor(`location.pathname === "/budgets" && !document.querySelector('[data-testid="navigation-pending"]') && document.querySelector("h1").innerText.includes("Ngân sách")`, { message: "budgets page to replace the skeleton" });
  check("the skeleton is removed once the page arrives", true);
  await browser.slowNetwork(0);

  // ---------- Skeleton for a form that redirects ----------
  const savingsId = (await one(`select id from accounts where "userId" = $1 and name = 'Tiết kiệm'`, [userId])).id;
  await browser.goto(`${BASE}/accounts/${savingsId}/edit`);
  await browser.slowNetwork(1200);
  await browser.type("#name", "Tiết kiệm mới");
  await browser.evaluate(`document.querySelector("#name").closest("form").querySelector("button[type=submit]").click()`);
  const formOverlay = await browser.waitFor(`(() => { const o = document.querySelector('[data-testid="navigation-pending"]'); return o && o.getAttribute("aria-busy"); })()`, { timeout: 4000, message: "skeleton while the form saves" });
  check("a form that ends in a redirect shows the loading skeleton while it saves", formOverlay === "true");
  await browser.waitFor(`location.pathname === "/accounts" && !document.querySelector('[data-testid="navigation-pending"]') && document.body.innerText.includes("Tiết kiệm mới")`, { message: "accounts page after saving" });
  check("the skeleton gives way to the new page and the change is saved", (await one(`select name from accounts where id = $1`, [savingsId])).name === "Tiết kiệm mới");
  await browser.slowNetwork(0);

  await browser.goto(`${BASE}/accounts/${savingsId}/edit`);
  await browser.slowNetwork(1200);
  await browser.type("#name", "Ví chính");
  await browser.evaluate(`document.querySelector("#name").closest("form").querySelector("button[type=submit]").click()`);
  await browser.waitFor(`Boolean(document.querySelector('[data-testid="navigation-pending"]'))`, { timeout: 4000, message: "skeleton while a slow form is checked" });
  await browser.waitFor(`document.body.innerText.includes("Bạn đã có tài khoản với tên này.") && !document.querySelector('[data-testid="navigation-pending"]')`, { message: "validation error to replace the skeleton" });
  check("a rejected form removes the skeleton, stays on the page and keeps what was typed", location_ok(await browser.evaluate(`location.pathname`)) && (await browser.evaluate(`document.querySelector("#name").value`)) === "Ví chính");
  await browser.slowNetwork(0);

  // ---------- Filtering, Back and Forward ----------
  await browser.goto(BASE + "/transactions");
  await browser.evaluate(`window.__samePage = true`);
  await browser.evaluate(`(() => { document.querySelector("details").open = true; document.querySelector("#f-type").value = "INCOME"; [...document.querySelectorAll("details button[type=submit]")].find((b) => b.innerText.trim() === "Lọc").click(); return true; })()`);
  await browser.waitFor(`location.search.includes("type=INCOME") && !${text}.includes("Ăn trưa")`, { message: "filtered list" });
  check("filtering is a navigation inside the app, not a page reload", await browser.evaluate(`window.__samePage === true`));
  await browser.evaluate(`history.back()`);
  await browser.waitFor(`location.search === "" && ${text}.includes("Ăn trưa")`, { message: "list without the filter" });
  check("Back from a filtered list returns without reloading, and the filter form shows no filter",
    (await browser.evaluate(`window.__samePage === true`)) && (await browser.evaluate(`document.querySelector("#f-type").value`)) === "");

  const statementForm = `document.querySelector('form[action="/transactions/statement"]')`;
  // Dates are typed as a person does, digits only: the field puts the slashes in.
  await browser.type("#st-from", "30092026");
  await browser.type("#st-to", "01092026");
  const typed = await browser.evaluate(`[document.querySelector("#st-from").value, document.querySelector("#st-to").value]`);
  check("a date field reads dd/mm/yyyy and adds the slashes while digits are typed", typed[0] === "30/09/2026" && typed[1] === "01/09/2026", typed.join(" "));
  await browser.evaluate(`(() => { ${statementForm}.querySelector("button[type=submit]").click(); return true; })()`);
  check("a statement period that ends before it starts is caught in the form", (await browser.evaluate(`${statementForm}.querySelector('[role="alert"]')?.innerText ?? ""`)).includes("ngày bắt đầu phải trước"));
  await browser.type("#st-from", "01/09/2026");
  await browser.evaluate(`(() => { ${statementForm}.querySelector("button[type=submit]").click(); return true; })()`);
  await browser.sleep(700);
  check("downloading a statement keeps the page, without the loading skeleton",
    await browser.evaluate(`location.pathname === "/transactions" && window.__samePage === true && !document.querySelector('[data-testid="navigation-pending"]') && !${statementForm}.querySelector('[role="alert"]')`));

  const onPage = (pathname, heading) => `location.pathname === "${pathname}" && document.querySelector("h1").innerText.includes("${heading}") && !document.querySelector('[data-testid="navigation-pending"]')`;
  await browser.evaluate(`document.querySelector('aside nav a[href="/budgets"]').click()`);
  await browser.waitFor(onPage("/budgets", "Ngân sách"), { message: "budgets page" });
  await browser.evaluate(`document.querySelector('aside nav a[href="/accounts"]').click()`);
  await browser.waitFor(onPage("/accounts", "Tài khoản"), { message: "accounts page" });
  // Saving a change makes the router drop the pages it holds (they may show old figures), so going Back
  // has to load the budgets page again.
  await browser.evaluate(fillAccount("Ví quay lại"));
  await browser.waitFor(`${text}.includes("Ví quay lại")`, { message: "account saved" });
  await browser.slowNetwork(1200);
  await browser.evaluate(`history.back()`);
  const backOverlay = await browser.waitFor(`Boolean(document.querySelector('[data-testid="navigation-pending"]')) && document.querySelector("h1").innerText.includes("Tài khoản")`, { timeout: 4000, message: "skeleton during a slow Back" }).catch(() => false);
  check("Back to a page that has to be loaded again shows the loading skeleton", backOverlay === true);
  await browser.waitFor(onPage("/budgets", "Ngân sách"), { message: "budgets page after Back" });
  check("the skeleton gives way to that page once it arrives", true);
  await browser.slowNetwork(0);
  await browser.evaluate(`history.forward()`);
  await browser.waitFor(`location.pathname === "/accounts" && document.querySelector("h1").innerText.includes("Tài khoản")`, { timeout: 2000, message: "accounts page after Forward" });
  await browser.sleep(400);
  check("Forward to a page the router still holds shows it at once, without a skeleton", !(await browser.evaluate(`Boolean(document.querySelector('[data-testid="navigation-pending"]'))`)));

  // ---------- Dark mode ----------
  const pageBackground = `getComputedStyle(document.body).backgroundColor`;
  // Until a choice is made the app follows the device, so the device is pinned to light first (the machine
  // running the tests may itself be set to dark).
  await browser.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await browser.goto(BASE + "/dashboard");
  const lightBackground = await browser.evaluate(pageBackground);
  await browser.evaluate(`document.querySelector('aside [data-testid="theme-toggle"]').click()`);
  await browser.waitFor(`document.documentElement.classList.contains("dark")`, { message: "dark class on <html>" });
  const darkBackground = await browser.evaluate(pageBackground);
  check("the toggle switches to the dark palette at once and remembers the choice",
    darkBackground !== lightBackground && (await browser.evaluate(`document.cookie.includes("theme=dark") && getComputedStyle(document.documentElement).colorScheme === "dark"`)),
    `${lightBackground} → ${darkBackground}`);
  await browser.goto(BASE + "/transactions");
  check("the next page comes from the server already dark", (await browser.evaluate(`document.documentElement.classList.contains("dark")`)) && (await browser.evaluate(pageBackground)) === darkBackground);
  // A select and the list it opens must both have a solid dark background, never white.
  const selectColours = await browser.evaluate(`(() => {
    const s = document.querySelector("select"); if (!s) return null;
    // Computed colours may come back as oklch(); a canvas pixel gives plain RGBA whatever the notation.
    const px = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const lum = (c) => { px.clearRect(0, 0, 1, 1); px.fillStyle = "#000"; px.fillStyle = c; px.fillRect(0, 0, 1, 1); const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data; return { r, g, b, a: Math.round((a / 255) * 100) / 100 }; };
    const field = lum(getComputedStyle(s).backgroundColor), option = lum(getComputedStyle(s.options[0]).backgroundColor);
    return { field, option, scheme: getComputedStyle(s).colorScheme };
  })()`);
  const solidDark = (c) => c && c.a === 1 && c.r + c.g + c.b < 300;
  check("in dark mode selects and their option lists have a solid dark background", selectColours && solidDark(selectColours.field) && solidDark(selectColours.option) && selectColours.scheme === "dark", JSON.stringify(selectColours));
  await browser.goto(BASE + "/settings");
  const chooseTheme = (label) => browser.evaluate(`[...document.querySelectorAll('[role="radio"]')].find((b) => b.innerText.trim() === ${JSON.stringify(label)}).click()`);
  await chooseTheme("Theo thiết bị");
  await browser.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await browser.sleep(150);
  const followsDark = (await browser.evaluate(pageBackground)) === darkBackground;
  await browser.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await browser.sleep(150);
  check("\"Theo thiết bị\" follows the device's light or dark setting", followsDark && (await browser.evaluate(pageBackground)) === lightBackground && (await browser.evaluate(`document.cookie.includes("theme=system")`)));
  await chooseTheme("Sáng");
  await browser.send("Emulation.setEmulatedMedia", { features: [] });

  // ---------- Not found ----------
  await browser.goto(`${BASE}/accounts/${crypto.randomUUID()}/edit`);
  check("a missing record shows the not-found message with navigation", (await browser.evaluate(text)).includes("Không tìm thấy trang") && (await browser.evaluate(`Boolean(document.querySelector('nav a[href="/accounts"]'))`)));

  // ---------- Error boundary ----------
  // An account with an impossible currency code makes the accounts page throw while rendering.
  const brokenId = (await one(
    `insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,'Hỏng','CASH','ZZ',0,0,now()) returning id`, [userId])).id;
  await browser.send("Page.navigate", { url: BASE + "/accounts" });
  await browser.waitFor(`${text}.includes("Đã xảy ra lỗi")`, { message: "error page" });
  const errorText = await browser.evaluate(text);
  check("a failing page shows the error screen with a retry button", errorText.includes("Thử lại") && errorText.includes("Về trang tổng quan") && (await browser.evaluate(`Boolean(document.querySelector('nav a[href="/dashboard"]'))`)));
  check("the error screen shows a reference code but no internal details", /Mã lỗi: \S+/.test(errorText) && !/RangeError|Invalid currency|prisma|at \w+ \(/i.test(errorText), errorText.match(/Mã lỗi: \S+/)?.[0]);
  await shoot("error-page");
  await db.query(`delete from accounts where id = $1`, [brokenId]);
  await browser.evaluate(`[...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Thử lại").click()`);
  await browser.waitFor(`!${text}.includes("Đã xảy ra lỗi") && ${text}.includes("Ví chính")`, { message: "page to recover after retry" });
  check("retry recovers once the cause is fixed", true);

  // ---------- Chat assistant (the Claude API is the runner's stand-in) ----------
  const MOCK = process.env.E2E_AI_MOCK_URL;
  if (MOCK) {
    const panel = `document.querySelector('[data-testid="chat-panel"]')`;
    await fetch(`${MOCK}/__mock/queue`, { method: "POST", body: JSON.stringify([{ text: "Bạn đã chi 450.000 ₫ trong tháng này.", delayMs: 700 }]) });
    await browser.goto(BASE + "/dashboard");
    await browser.evaluate(`document.querySelector('[data-testid="chat-open"]').click()`);
    await browser.waitFor(`Boolean(${panel})`, { message: "chat panel to open" });
    const opened = await browser.evaluate(`${panel}.innerText`);
    check("the assistant opens with a greeting, suggestions and a note about what is sent", ["Xin chào, Trình Duyệt", "Tháng này tôi đã chi bao nhiêu?", "gửi tới Anthropic"].every((part) => opened.includes(part)), opened.slice(0, 120));
    await shoot("chat-empty");
    await browser.type(`[data-testid="chat-panel"] textarea`, "Tháng này tôi chi bao nhiêu?");
    await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await browser.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    const waiting = await browser.waitFor(`(() => { const p = ${panel}; return p.querySelector('[data-role="assistant"] [role="status"]') && { question: p.querySelector('[data-role="user"]').innerText, draft: p.querySelector("textarea").value }; })()`, { message: "typing indicator" });
    check("Enter sends the question, clears the box and shows that an answer is coming", waiting.question === "Tháng này tôi chi bao nhiêu?" && waiting.draft === "", JSON.stringify(waiting));
    await browser.waitFor(`${panel}.querySelector('[data-role="assistant"]').innerText.includes("450.000")`, { message: "the answer" });
    check("the answer replaces the indicator", !(await browser.evaluate(`Boolean(${panel}.querySelector('[role="status"]'))`)));
    await shoot("chat-answer");
    await browser.evaluate(`document.querySelector('aside nav a[href="/budgets"]').click()`);
    await browser.waitFor(`location.pathname === "/budgets" && document.querySelector("h1").innerText.includes("Ngân sách")`, { message: "budgets page" });
    check("the conversation stays open while moving between pages", (await browser.evaluate(`${panel}?.innerText ?? ""`)).includes("450.000"));
    await fetch(`${MOCK}/__mock/queue`, { method: "POST", body: JSON.stringify([{ status: 400 }]) });
    await browser.type(`[data-testid="chat-panel"] textarea`, "Câu nữa");
    await browser.evaluate(`${panel}.querySelector('button[type="submit"]').click()`);
    await browser.waitFor(`Boolean(${panel}.querySelector('[role="alert"]'))`, { message: "chat error" });
    check("a failed answer shows an error and leaves no empty bubble", (await browser.evaluate(`${panel}.querySelector('[role="alert"]').innerText`)).includes("không trả lời được") && (await browser.evaluate(`${panel}.querySelectorAll('[data-role="assistant"]').length`)) === 1);
    await browser.evaluate(`document.querySelector('[data-testid="chat-close"]').click()`);
    check("closing brings the round button back", await browser.evaluate(`!${panel} && Boolean(document.querySelector('[data-testid="chat-open"]'))`));
  }

  const unexpected = browser.pageErrors.filter((error) => !/Invalid currency|RangeError|digest/i.test(error));
  check("no unexpected JavaScript errors in the browser", unexpected.length === 0, unexpected.slice(0, 3).join(" | "));

  // ---------- Security headers ----------
  await collectCsp();
  check("no page broke its Content Security Policy (scripts carry the nonce)", cspViolations.length === 0, cspViolations.slice(0, 3).join(" | "));
  const signedOut = await fetch(BASE + "/login");
  const signedIn = await fetch(BASE + "/dashboard", { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  for (const [label, response] of [["sign-in page", signedOut], ["dashboard", signedIn]]) {
    const csp = response.headers.get("content-security-policy") ?? "";
    check(`${label}: CSP forbids framing and inline scripts without the nonce`, /frame-ancestors 'none'/.test(csp) && /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), csp);
    check(`${label}: anti-framing, no-sniff and referrer headers, no X-Powered-By`, response.headers.get("x-frame-options") === "DENY" && response.headers.get("x-content-type-options") === "nosniff" && response.headers.get("referrer-policy") === "strict-origin-when-cross-origin" && !response.headers.get("x-powered-by"));
  }
  const nonces = new Set();
  for (let i = 0; i < 3; i++) nonces.add((await fetch(BASE + "/login")).headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1]);
  check("every page gets a new nonce", nonces.size === 3);
  const html = await signedOut.text();
  const scripts = [...html.matchAll(/<script[\s>][^>]*>/g)].map((m) => m[0]);
  check("every script tag on the page carries the nonce", scripts.length > 0 && scripts.every((tag) => / nonce="[^"]+"/.test(tag)), scripts.find((tag) => !/ nonce=/.test(tag)));
} catch (error) {
  check("browser suite aborted", false, error.message);
  // What the page and the server were doing when the suite gave up, to tell a stuck browser from a stuck server.
  for (const probe of ["location.href", "document.readyState", "document.visibilityState"]) {
    const answer = await Promise.race([browser?.evaluate(probe).catch((e) => `error: ${e.message}`), new Promise((resolve) => setTimeout(() => resolve("no answer in 4s"), 4000))]);
    console.log(`  at abort: ${probe} = ${answer}`);
  }
  const started = Date.now();
  const server = await fetch(BASE + "/login", { signal: AbortSignal.timeout(8000) }).then((r) => r.status, (e) => `error: ${e.message}`);
  console.log(`  at abort: server answered /login with ${server} in ${Date.now() - started}ms`);
} finally {
  await browser?.close();
  await db.query(`delete from users where email = $1`, [EMAIL]);
  await db.end();
}
report();
