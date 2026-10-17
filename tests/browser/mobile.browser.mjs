// The app on a phone: touch input, small screens, and data that stresses the layout (long unbroken names,
// huge amounts, wide statement files). Uses a real headless Edge/Chrome with phone emulation.
import { createRequire } from "node:module";
import path from "node:path";
import { findBrowser, launch } from "./cdp.mjs";

// Run through tests/run-e2e.mjs, which sets the working directory to the project root.
const root = process.cwd().split("\\").join("/") + "/";
process.loadEnvFile(root + ".env");
const { Client } = createRequire(root + "package.json")("pg");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STAMP = Date.now();
// A long address with no breaking points: the profile card has to cope with it.
const EMAIL = `e2e-mobile-${"a".repeat(55)}-${STAMP}@example.com`;
const shots = process.env.E2E_SCREENSHOTS;
let failures = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
}

if (!findBrowser()) {
  console.log("SKIP mobile tests: no Edge or Chrome found (set E2E_BROWSER to its path).");
  process.exit(0);
}

const db = new Client({ connectionString: (() => { const u = new URL(process.env.DATABASE_URL); u.search = ""; return u.toString(); })() });
await db.connect();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const text = `document.body.innerText`;
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
// 60 characters with no spaces: nothing can wrap, so any layout that assumes short names breaks.
const UNBROKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let browser;

try {
  // ---------- Account and data ----------
  const registerPage = await (await fetch(BASE + "/register")).text();
  const registerForm = registerPage.match(/<form[\s\S]*?<\/form>/)[0];
  const registerBody = new FormData();
  for (const [tag] of registerForm.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) registerBody.append(decode(tag.match(/name="([^"]*)"/)[1]), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  for (const [k, v] of Object.entries({ name: "Nguyễn Văn An", email: EMAIL, password: "abc12345", confirmPassword: "abc12345" })) registerBody.append(k, v);
  const registered = await fetch(BASE + "/register", { method: "POST", body: registerBody, redirect: "manual", headers: { origin: BASE } });
  const cookies = registered.headers.getSetCookie().map((c) => c.split(";")[0]).map((pair) => ({ name: pair.slice(0, pair.indexOf("=")), value: pair.slice(pair.indexOf("=") + 1), httpOnly: true }));
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const userId = (await one(`select id from users where email = $1`, [EMAIL])).id;
  await db.query(`update users set role = 'ADMIN' where id = $1`, [userId]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const month = today.slice(0, 7);
  const sys = async (key) => (await one(`select id from categories where "systemKey" = $1`, [key])).id;
  const [food, salary] = [await sys("food"), await sys("salary")];
  const insert = async (sql, params) => (await one(sql, params)).id;
  const accountA = await insert(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,$2,'BANK','VND',0,9999999999999.99,now()) returning id`, [userId, UNBROKEN]);
  const accountB = await insert(`insert into accounts (id,"userId",name,type,currency,"initialBalance","currentBalance","updatedAt") values (gen_random_uuid()::text,$1,'Quỹ USD','CASH','USD',0,1250.5,now()) returning id`, [userId]);
  const customCategory = await insert(`insert into categories (id,"userId",name,type,icon,color,"updatedAt") values (gen_random_uuid()::text,$1,$2,'EXPENSE','tag','#aa5500',now()) returning id`, [userId, UNBROKEN.slice(0, 40)]);
  const tx = (categoryId, type, amount, note, account = accountA, currency = "VND", extra = {}) =>
    insert(`insert into transactions (id,"userId","accountId","categoryId",type,amount,currency,"amountInDefaultCurrency","exchangeRateUsed",date,note,"transferGroupId","transferDirection","updatedAt")
            values (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,1,$8::date,$9,$10,$11,now()) returning id`,
      [userId, account, categoryId, type, amount, currency, extra.converted ?? amount, today, note, extra.group ?? null, extra.direction ?? null]);
  const expenseId = await tx(customCategory, "EXPENSE", 9999999999, UNBROKEN + UNBROKEN.slice(0, 50));
  await tx(food, "EXPENSE", 450000, "Ăn trưa");
  await tx(salary, "INCOME", 25000000, "Lương");
  const group = crypto.randomUUID();
  await tx(null, "TRANSFER", 1000000, "Chuyển ví", accountA, "VND", { group, direction: "OUT" });
  await tx(null, "TRANSFER", 38.6, "Chuyển ví", accountB, "USD", { group, direction: "IN", converted: 1000000 });
  const budgetId = await insert(`insert into budgets (id,"userId","categoryId","amountLimit",currency,"periodStart","updatedAt") values (gen_random_uuid()::text,$1,$2,9999999999999.99,'VND',$3::date,now()) returning id`, [userId, customCategory, `${month}-01`]);
  await db.query(`insert into budgets (id,"userId","categoryId","amountLimit",currency,"periodStart","updatedAt") values (gen_random_uuid()::text,$1,$2,500000,'VND',$3::date,now())`, [userId, food, `${month}-01`]);
  const goalId = await insert(`insert into savings_goals (id,"userId",name,"targetAmount","currentAmount",currency,deadline,"updatedAt") values (gen_random_uuid()::text,$1,$2,9999999999999,7777777777777.77,'VND',$3::date,now()) returning id`, [userId, UNBROKEN, `${Number(today.slice(0, 4)) + 1}-06-30`]);
  await db.query(`insert into savings_contributions (id,"savingsGoalId",amount,date,note) values (gen_random_uuid()::text,$1,7777777777777.77,$2::date,$3)`, [goalId, today, UNBROKEN + UNBROKEN]);
  const doneImportId = await insert(
    `insert into import_batches (id,"userId","accountId","fileName",status,"rowCount","importedCount","skippedCount","errorMessage","updatedAt")
     values (gen_random_uuid()::text,$1,$2,$3,'PROCESSED',30,20,4,$4,now()) returning id`,
    [userId, accountA, UNBROKEN + UNBROKEN + UNBROKEN + ".csv", JSON.stringify({ rows: Array.from({ length: 6 }, (_, i) => ({ row: i + 3, message: "Ngày không hợp lệ hoặc không đúng định dạng đã chọn." })), more: 0 })]);

  // A statement with many wide columns, uploaded through the real form.
  const importsPage = await (await fetch(BASE + "/imports", { headers: { cookie: cookieHeader } })).text();
  const uploadForm = [...importsPage.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes('name="file"'));
  const upload = new FormData();
  for (const [tag] of uploadForm.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) upload.append(decode(tag.match(/name="([^"]*)"/)[1]), decode(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  upload.append("accountId", accountA);
  const wide = ["Ngày giao dịch,Diễn giải,Số tiền,Số dư sau giao dịch,Mã tham chiếu,Chi nhánh thực hiện,Kênh giao dịch,Ghi chú thêm", ...Array.from({ length: 6 }, (_, i) => `0${i + 1}/10/2026,Thanh toán hóa đơn điện nước tháng này cho khách hàng ${i},-${(i + 1) * 100000},${12000000 - i * 100000},FT26${280000 + i}XYZ,Chi nhánh Hà Nội - Phòng giao dịch Đống Đa,Internet Banking,Ghi chú dài để kiểm tra bảng xem trước`)].join("\n");
  upload.append("file", new Blob([wide]), "sao-ke-rong.csv");
  const uploaded = await fetch(BASE + "/imports", { method: "POST", body: upload, redirect: "manual", headers: { cookie: cookieHeader, origin: BASE } });
  const pendingImportId = uploaded.headers.get("location").split("/").pop();
  const systemCategoryId = food;

  const pages = [
    "/dashboard", "/transactions", `/transactions?type=EXPENSE`, `/transactions/${expenseId}/edit`, "/accounts", `/accounts/${accountA}/edit`,
    "/categories", `/categories/${customCategory}/edit`, "/budgets", `/budgets/${budgetId}/edit`, "/savings", `/savings/${goalId}`, `/savings/${goalId}/edit`,
    "/imports", `/imports/${pendingImportId}`, `/imports/${doneImportId}`, "/settings", "/admin/categories", `/admin/categories/${systemCategoryId}/edit`, "/admin/exchange-rates",
  ];

  // ---------- Browser, as a phone ----------
  browser = await launch({ width: 360, height: 740, mobile: true });
  await browser.setCookies(BASE, cookies);
  const setLocale = (locale) => browser.setCookies(BASE, [{ name: "locale", value: locale }]);
  const shoot = async (name) => { if (shots) await browser.screenshot(path.join(shots, `${name}.png`)); };
  await setLocale("vi");

  const overflowProbe = `(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true; } return false; };
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed") continue;
      if ((r.right > vw + 0.5 || r.left < -0.5) && !clipped(el)) offenders.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 30) + " right=" + Math.round(r.right) + " “" + (el.innerText || "").slice(0, 24).replace(/\\s+/g, " ") + "”");
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 3) };
  })()`;

  async function auditLayout(label, viewport, locale) {
    await browser.setViewport(viewport);
    await setLocale(locale);
    const problems = [];
    for (const page of pages) {
      await browser.goto(BASE + page);
      const result = await browser.evaluate(overflowProbe);
      if (shots && viewport.width === 360 && ["/transactions", "/budgets", "/savings", "/imports"].includes(page.split("?")[0].replace(/\/[0-9a-f-]{36}.*/, ""))) {
        await browser.sleep(300);
        await shoot(`mobile-${page.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, "id").replace(/\W+/g, "-").replace(/^-/, "")}`);
      }
      if (result.scrollWidth > result.vw || result.offenders.length) problems.push(`${page.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "{id}")}: scroll ${result.scrollWidth}/${result.vw}${result.offenders.length ? " ← " + result.offenders.join(" ; ") : ""}`);
    }
    check(`no sideways scrolling or clipped content on ${pages.length} pages — ${label}`, problems.length === 0, problems.join(" || "));
  }

  await auditLayout("360×740 portrait, Vietnamese", { width: 360, height: 740 }, "vi");
  await auditLayout("320×640 small phone, English", { width: 320, height: 640 }, "en");
  await auditLayout("740×360 landscape, Vietnamese", { width: 740, height: 360 }, "vi");

  // ---------- Page basics ----------
  await browser.setViewport({ width: 360, height: 740 });
  await setLocale("vi");
  await browser.goto(BASE + "/dashboard");
  check("pages declare a device-width viewport", /width=device-width/.test(await browser.evaluate(`document.querySelector('meta[name="viewport"]')?.content ?? ""`)));
  // On a phone the menu is a bar fixed to the bottom; the less used sections open from its "Thêm" button.
  const onScreen = (selector) => browser.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => { const r = el.getBoundingClientRect(); return { label: el.innerText.trim(), shown: r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }).filter((item) => item.label)`);
  const bar = (await onScreen('nav[aria-label="Điều hướng chính"] a, nav[aria-label="Điều hướng chính"] button')).filter((item) => item.shown);
  check("the bottom bar shows its five tabs on screen at 360px", bar.map((item) => item.label).join() === "Tổng quan,Giao dịch,Ngân sách,Tiết kiệm,Thêm", bar.map((item) => item.label).join());
  check("the desktop sidebar is not shown on a phone", await browser.evaluate(`getComputedStyle(document.querySelector("aside")).display === "none"`));
  await browser.tap('nav[aria-label="Điều hướng chính"] button');
  await browser.waitFor(`Boolean(document.querySelector("#more-menu"))`, { message: "the Thêm sheet to open" });
  const more = await onScreen("#more-menu a");
  check("the Thêm sheet lists the other sections (and the admin ones) on screen", more.length === 6 && more.every((item) => item.shown), more.map((item) => `${item.label}:${item.shown}`).join());
  await shoot("mobile-more-menu");
  await browser.tap("#more-menu a", { text: "Cài đặt" });
  await browser.waitFor(`location.pathname === "/settings"`, { message: "tap on the menu to navigate" });
  check("tapping a menu item opens the page and closes the sheet", (await browser.evaluate(text)).includes("Tiền tệ mặc định") && !(await browser.evaluate(`Boolean(document.querySelector("#more-menu"))`)));
  await browser.goto(BASE + "/dashboard");
  await shoot("mobile-dashboard");
  // No taller viewport for this picture: changing the screen size in the middle of the run made later taps
  // hang in headless Edge (the browser stopped acknowledging touch events), which only showed up when
  // screenshots were on.
  if (shots) {
    await browser.goto(BASE + "/transactions");
    await shoot("mobile-transactions-list");
  }

  for (const page of ["/dashboard", "/transactions", "/accounts", "/budgets", "/savings", "/settings"]) {
    await browser.goto(BASE + page);
    const small = await browser.evaluate(`(() => [...document.querySelectorAll('button, nav a, summary, a[class*="inline-flex"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 24 || r.width < 24); }).map((el) => el.innerText.trim().slice(0, 20) + " " + Math.round(el.getBoundingClientRect().width) + "×" + Math.round(el.getBoundingClientRect().height)).slice(0, 4))()`);
    check(`touch targets are at least 24×24 px on ${page}`, small.length === 0, small.join(" | "));
    const tiny = await browser.evaluate(`(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=color]):not([type=file]), select, textarea')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length)()`);
    check(`form fields use at least 16px text on ${page} (phones zoom in on smaller ones)`, tiny === 0, `${tiny} smaller`);
  }

  // ---------- Using it with a finger ----------
  await browser.goto(BASE + "/dashboard");
  await browser.waitFor(`document.querySelectorAll(".recharts-bar-rectangle").length >= 4`, { message: "chart bars" });
  let tooltip = "";
  for (let attempt = 0; attempt < 5 && !tooltip; attempt++) {
    await browser.sleep(attempt === 0 ? 1800 : 500);
    await browser.tap(".recharts-bar-rectangle");
    await browser.sleep(400);
    tooltip = (await browser.evaluate(`(() => { const t = document.querySelector(".recharts-tooltip-wrapper"); return t && getComputedStyle(t).visibility === "visible" && t.innerText.trim(); })()`)) || "";
  }
  check("tapping a chart bar shows its exact amount", /₫/.test(tooltip), tooltip.replace(/\s+/g, " "));
  await shoot("mobile-chart-tap");

  await browser.goto(BASE + "/transactions");
  check("the filter form starts collapsed so the list is visible first", (await browser.evaluate(`document.querySelector("details").open`)) === false && (await browser.evaluate(`document.querySelector("ul li").getBoundingClientRect().top < 560`)));
  await browser.tap("summary", { text: "Bộ lọc" });
  await browser.waitFor(`document.querySelector("details").open`, { message: "filter to open" });
  await browser.evaluate(`document.querySelector("#f-type").value = "TRANSFER"`);
  await browser.tap("details button", { text: "Lọc" });
  await browser.waitFor(`location.search.includes("type=TRANSFER")`, { message: "filter to apply" });
  await browser.waitFor(`document.querySelector("details")?.open && document.body.innerText.includes("Chuyển đến Quỹ USD")`, { message: "filtered list" });
  check("filtering by touch works and keeps the filter open", !(await browser.evaluate(text)).includes("Ăn trưa"));
  await shoot("mobile-transactions-filtered");

  await browser.goto(BASE + "/transactions");
  await browser.type("#tx-amount", "75000");
  await browser.type("#tx-note", "Mua bằng điện thoại");
  await browser.tap("button", { text: "Thêm giao dịch" });
  await browser.waitFor(`document.body.innerText.includes("Đã thêm giao dịch.") && document.body.innerText.includes("Mua bằng điện thoại")`, { message: "new transaction to appear" });
  const added = await one(`select amount::text a, type from transactions where "userId" = $1 and note = 'Mua bằng điện thoại'`, [userId]);
  check("adding a transaction with the on-screen keyboard works end to end", added?.a === "75000.00" && added.type === "EXPENSE");

  await browser.evaluate(`(() => { const row = [...document.querySelectorAll("li")].find((li) => li.innerText.includes("Mua bằng điện thoại")); row.dataset.target = "delete"; return true; })()`);
  await browser.tap('li[data-target="delete"] form button');
  await browser.waitFor(`Boolean(document.querySelector('[data-testid="confirm-dialog"]'))`, { message: "confirmation modal on the phone" });
  // Measured once it has slid up into place.
  await browser.sleep(500);
  const modal = await browser.evaluate(`(() => {
    const m = document.querySelector('[data-testid="confirm-dialog"]');
    const r = m.getBoundingClientRect();
    const buttons = [...m.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().width));
    return { title: m.querySelector("h2")?.innerText, sheet: Math.abs(r.bottom - innerHeight) <= 1 && r.left === 0 && r.right === innerWidth && r.top >= 0,
             stacked: buttons.length === 2 && buttons.every((w) => w >= r.width - 56), icon: Boolean(m.querySelector('[data-slot="alert-dialog-icon"] svg')) };
  })()`);
  await browser.sleep(300);
  await shoot("mobile-confirm-modal");
  await browser.tap('[data-testid="confirm-dialog"] button', { text: "Xóa" });
  await browser.waitFor(`!document.body.innerText.includes("Mua bằng điện thoại")`, { message: "deleted row to disappear" });
  check("deleting by tap asks first in a sheet along the bottom edge, with an icon and full-width buttons, then removes it",
    modal.title === "Xóa giao dịch này?" && modal.sheet && modal.stacked && modal.icon && !(await one(`select 1 from transactions where "userId" = $1 and note = 'Mua bằng điện thoại'`, [userId])), JSON.stringify(modal));

  // ---------- Chat assistant on a phone ----------
  const MOCK = process.env.E2E_AI_MOCK_URL;
  if (MOCK) {
    await fetch(`${MOCK}/__mock/queue`, { method: "POST", body: JSON.stringify([{ text: "Ngân sách Ăn uống đã dùng 88%, sắp chạm hạn mức. " + UNBROKEN + UNBROKEN }]) });
    await browser.goto(BASE + "/dashboard");
    const button = await browser.evaluate(`(() => { const b = document.querySelector('[data-testid="chat-open"]').getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Điều hướng chính"]:not(aside nav)').getBoundingClientRect(); return { onScreen: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, aboveBar: b.bottom <= bar.top }; })()`);
    check("the assistant button sits on screen above the bottom bar", button.onScreen && button.aboveBar, JSON.stringify(button));
    await browser.tap('[data-testid="chat-open"]');
    await browser.waitFor(`Boolean(document.querySelector('[data-testid="chat-panel"]'))`, { message: "chat panel to open" });
    await browser.tap('[data-testid="chat-panel"] li button');
    await browser.waitFor(`document.querySelector('[data-testid="chat-panel"] [data-role="assistant"]')?.innerText.includes("88%")`, { message: "the answer" });
    const fit = await browser.evaluate(`(() => { const p = document.querySelector('[data-testid="chat-panel"]'); const r = p.getBoundingClientRect(); const list = p.querySelector('[aria-live]'); return { full: r.left === 0 && r.top === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight, sideways: list.scrollWidth > list.clientWidth, page: document.documentElement.scrollWidth > innerWidth, field: parseFloat(getComputedStyle(p.querySelector("textarea")).fontSize) }; })()`);
    check("on a phone the chat fills the screen, wraps long text and keeps a 16px input", fit.full && !fit.sideways && !fit.page && fit.field >= 16, JSON.stringify(fit));
    await shoot("mobile-chat");
    await browser.tap('[data-testid="chat-close"]');
    await browser.waitFor(`!document.querySelector('[data-testid="chat-panel"]')`, { message: "chat panel to close" });
  }

  await browser.tap('button[name="language"][value="en"]');
  await browser.waitFor(`document.querySelector('nav[aria-label="Main navigation"]:not(aside nav)')?.innerText.includes("Overview")`, { message: "English menu" });
  check("switching language by tap works", (await browser.evaluate(`document.documentElement.lang`)) === "en");
  await shoot("mobile-english");

  const unexpected = browser.pageErrors.filter((error) => !/digest/i.test(error));
  check("no JavaScript errors while using the app on the phone", unexpected.length === 0, unexpected.slice(0, 3).join(" | "));
} catch (error) {
  console.log(`FAIL mobile suite aborted — ${error.message}`);
  failures++;
  // What the page was doing when the suite gave up: an answer here means the page is alive and only the
  // step that timed out was stuck; no answer means the page itself is hung.
  for (const probe of ["location.pathname", "document.visibilityState", "document.activeElement?.tagName", "Boolean(document.querySelector('#more-menu'))"]) {
    const answer = await Promise.race([browser?.evaluate(probe).catch((e) => `error: ${e.message}`), new Promise((resolve) => setTimeout(() => resolve("no answer in 4s"), 4000))]);
    console.log(`  at abort: ${probe} = ${answer}`);
  }
} finally {
  await browser?.close();
  const leftovers = (await db.query(`select b."tempFileKey" k from import_batches b join users u on u.id = b."userId" where u.email = $1 and b."tempFileKey" is not null`, [EMAIL])).rows;
  const { rmSync } = await import("node:fs");
  for (const { k } of leftovers) rmSync(`${root}backend/storage/imports/${k}`, { force: true });
  await db.query(`delete from users where email = $1`, [EMAIL]);
  await db.end();
}
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
