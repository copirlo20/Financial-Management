import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { root, check, report, decode, readCookies, cookieHeader, db, sleep } from "./harness.mjs";

// What the frontend does while the backend restarts (a code change in development, a deploy in production):
// calls wait for it to come back instead of failing, and nobody is signed out because of it.
// The suite starts a second pair of servers of its own, so that stopping and starting the backend does not
// disturb the other suites; it therefore needs the runner's servers (and their build).

if (!process.env.E2E_AI_MOCK_URL) {
  console.log("SKIP backend-restart: needs the runner's own servers, which build and start the frontend");
  process.exit(0);
}

const basePort = Number(new URL(process.env.E2E_BASE_URL).port || 80);
const FRONT = basePort + 30;
const BACK = basePort + 130;
const front = `http://localhost:${FRONT}`;
const backHealth = `http://127.0.0.1:${BACK}/api/health`;
const EMAIL = `e2e-restart-${Date.now()}@example.com`;

const children = new Set();
function startBackend() {
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: root + "backend",
    stdio: "ignore",
    env: { ...process.env, PORT: String(BACK), RATE_LIMIT_PREFIX: "e2e:", AUTH_LIMIT_PER_IP: "100000", REGISTER_LIMIT_PER_IP: "100000", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" },
  });
  children.add(child);
  return child;
}
function startFrontend() {
  const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(FRONT)], {
    cwd: root + "frontend",
    stdio: "ignore",
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${BACK}` },
  });
  children.add(child);
  return child;
}
async function waitUntil(test, what, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    if (await test().catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const backendUp = async () => (await fetch(backHealth)).ok;
const backendDown = async () => fetch(backHealth).then(() => false, () => true);
async function stopBackend(child) {
  child.kill();
  children.delete(child);
  await waitUntil(backendDown, "the backend to stop");
}

await db.connect();

try {
  let backend = startBackend();
  startFrontend();
  await waitUntil(backendUp, "the backend");
  await waitUntil(async () => (await fetch(`${front}/login`)).status < 500, "the frontend");

  // A signed-in person: the cookies of a real registration.
  const form = async (pathname, fields) => {
    const html = await (await fetch(front + pathname)).text();
    const tag = html.match(/<form[\s\S]*?<\/form>/)[0];
    const body = new FormData();
    for (const [input] of tag.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) body.append(decode(input.match(/name="([^"]*)"/)[1]), decode(input.match(/value="([^"]*)"/)?.[1] ?? ""));
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    return fetch(front + pathname, { method: "POST", body, redirect: "manual", headers: { origin: front } });
  };
  const registered = await form("/register", { name: "Khởi Động Lại", email: EMAIL, password: "abc12345", confirmPassword: "abc12345" });
  const jar = readCookies(registered);
  check("setup: registering signs the person in", Boolean(jar.access_token && jar.refresh_token), `${registered.status}`);
  // The access token is replaced by one that is no use, as if it had expired: the next page has to refresh it.
  const expired = { ...jar, access_token: "expired" };

  // ---------- A form submitted while the backend is down ----------
  await stopBackend(backend);
  setTimeout(() => { backend = startBackend(); }, 1500);
  const started = Date.now();
  const login = await form("/login", { email: `nobody-${Date.now()}@example.com`, password: "wrong-password-1" });
  const text = await login.text();
  check("a form sent while the backend is restarting waits and is answered normally, not with an error",
    login.status === 200 && text.includes("Email hoặc mật khẩu không đúng."), `${login.status} after ${Date.now() - started} ms`);
  await waitUntil(backendUp, "the backend again");

  // ---------- A page opened with an expired access token while the backend is down ----------
  await stopBackend(backend);
  setTimeout(() => { backend = startBackend(); }, 1500);
  const page = await fetch(`${front}/dashboard`, { redirect: "manual", headers: { cookie: cookieHeader(expired) } });
  const renewed = readCookies(page);
  check("a page opened while the backend restarts renews the session once it is back, and shows the page",
    page.status === 200 && Boolean(renewed.access_token) && renewed.access_token !== "expired" && !page.headers.get("location"),
    `${page.status} ${page.headers.get("location") ?? ""}`);
  await waitUntil(backendUp, "the backend once more");

  // ---------- A page opened with a valid session while the backend is down ----------
  // Here the proxy has nothing to renew, so the page's own reads meet the closed port. Next.js hands a
  // repeated GET of the same URL the first (failed) promise during a render, so this only passes if the
  // retries really go out again.
  const signedIn = { ...jar, ...renewed };
  await stopBackend(backend);
  setTimeout(() => { backend = startBackend(); }, 1500);
  const reading = Date.now();
  const read = await fetch(`${front}/dashboard`, { redirect: "manual", headers: { cookie: cookieHeader(signedIn) } });
  const readHtml = await read.text();
  check("a page whose data is read while the backend restarts waits for it and shows the page, not an error",
    read.status === 200 && !readHtml.includes("Backend not reachable") && readHtml.includes("<main"),
    `${read.status} after ${Date.now() - reading} ms`);
  await waitUntil(backendUp, "the backend after the page");

  // ---------- The backend stays down ----------
  await stopBackend(backend);
  const down = await fetch(`${front}/dashboard`, { redirect: "manual", headers: { cookie: cookieHeader(expired) }, signal: AbortSignal.timeout(60_000) });
  const cleared = down.headers.getSetCookie().filter((cookie) => /^(access_token|refresh_token)=;|max-age=0/i.test(cookie));
  check("with the backend down for good the person is not signed out: no cookie is cleared", cleared.length === 0, cleared.join(" | "));
  check("and is not sent to the sign-in page", !(down.status >= 300 && down.status < 400 && (down.headers.get("location") ?? "").includes("/login")), `${down.status} ${down.headers.get("location") ?? ""}`);

  // ---------- A form sent while the backend stays down ----------
  const unreachable = await form("/login", { email: `nobody-${Date.now()}@example.com`, password: "wrong-password-1" });
  const unreachableHtml = await unreachable.text();
  check("a form sent while the backend stays down says so on the form, keeping what was typed, instead of an error page",
    unreachable.status === 200 && unreachableHtml.includes("Không kết nối được máy chủ nên chưa có gì thay đổi.") && unreachableHtml.includes("nobody-"),
    `${unreachable.status}`);
  check("and the password typed is not sent back to the page", !unreachableHtml.includes("wrong-password-1"));

  // ---------- A change whose connection is cut on its way ----------
  // Something listens on the backend's port but cuts every connection, as a backend killed mid-request does.
  let cuts = 0;
  const cutter = net.createServer((socket) => {
    socket.once("data", () => {
      cuts++;
      socket.resetAndDestroy();
    });
  });
  await new Promise((resolve) => cutter.listen(BACK, "127.0.0.1", resolve));
  try {
    const cut = await form("/login", { email: `nobody-${Date.now()}@example.com`, password: "wrong-password-1" });
    const cutHtml = await cut.text();
    check("a change cut off on its way says it may or may not have been made, instead of an error page",
      cut.status === 200 && cutHtml.includes("Mất kết nối tới máy chủ khi đang lưu."), `${cut.status}`);
    check("and it is not sent again, as it may already have been made", cuts === 1, `${cuts} attempts reached the port`);
  } finally {
    await new Promise((resolve) => cutter.close(resolve));
  }
} finally {
  for (const child of children) child.kill();
  await db.query(`delete from users where email = $1`, [EMAIL]).catch(() => {});
  await db.end().catch(() => {});
}
report();
