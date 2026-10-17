// Minimal driver for an installed Chromium browser (Edge or Chrome) over the DevTools protocol.
// No dependencies: Node's built-in WebSocket and fetch are enough for what these tests need.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.E2E_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];

export function findBrowser() {
  return CANDIDATES.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Windows marks every window as covered when the screen is locked or the display is off, and Edge then
// treats even a headless page as hidden. A hidden page draws no frames and may be frozen: taps are never
// acknowledged and page loads stall. These switches keep the page active whatever the desktop is doing.
const KEEP_PAGE_ACTIVE = [
  "--disable-features=CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
];

export async function launch({ width = 1280, height = 900, mobile = false } = {}) {
  const executable = findBrowser();
  if (!executable) throw new Error("No Edge or Chrome found (set E2E_BROWSER to its path).");
  const profile = mkdtempSync(path.join(tmpdir(), "e2e-browser-"));
  const port = 9300 + Math.floor(Math.random() * 600);
  const child = spawn(
    executable,
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--hide-scrollbars", ...KEEP_PAGE_ACTIVE, `--window-size=${width},${height}`, "about:blank"],
    { stdio: "ignore" },
  );

  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((entry) => entry.type === "page");
    } catch {
      // browser not listening yet
    }
  }
  if (!target) {
    child.kill();
    throw new Error("The browser did not start.");
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let nextId = 0;
  const waiting = new Map();
  const pageErrors = [];
  const dialogs = [];
  let dialogAnswer = true;

  // A call the browser never answers (a dialog left open, a crashed tab) must fail the test, not hang it.
  const send = (method, params = {}, timeout = 20_000) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(new Error(`The browser did not answer ${method} within ${timeout / 1000}s`));
      }, timeout);
      waiting.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    if (message.method === "Page.javascriptDialogOpening") {
      dialogs.push(message.params.message);
      send("Page.handleJavaScriptDialog", { accept: dialogAnswer }).catch(() => {});
    }
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  let viewport = { width, height, mobile };
  async function applyViewport() {
    await send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1 });
    await send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: 5 });
  }
  await applyViewport();

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async function waitFor(expression, { timeout = 10_000, message } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const value = await evaluate(expression);
        if (value) return value;
      } catch {
        // the page may be mid-navigation; try again
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for: ${message ?? expression}`);
  }

  return {
    send,
    evaluate,
    waitFor,
    sleep,
    pageErrors,
    dialogs,
    // Whether the next confirm()/alert() is accepted or dismissed.
    answerDialogs(accept) {
      dialogAnswer = accept;
    },
    async setCookies(baseUrl, cookies) {
      for (const cookie of cookies) await send("Network.setCookie", { ...cookie, url: baseUrl });
    },
    // Loads a page and waits until React has taken over every interactive element on it. Acting earlier
    // would submit forms the old-fashioned way (full page load), which is not what these tests are about.
    async goto(url) {
      // Generous: right after a build the machine can be busy enough that the first page takes a while.
      await send("Page.navigate", { url }, 60_000);
      await waitFor(
        `document.readyState === "complete" && [...document.querySelectorAll("form, button, input:not([type=hidden]), select, summary, a[href]")].every((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")))`,
        { timeout: 20_000, message: `page to load and hydrate: ${url}` },
      );
    },
    async slowNetwork(latencyMs) {
      await send("Network.emulateNetworkConditions", { offline: false, latency: latencyMs, downloadThroughput: -1, uploadThroughput: -1 });
    },
    // Changes the screen size (and whether it behaves like a touch phone) for the pages loaded next.
    async setViewport(next) {
      viewport = { ...viewport, ...next };
      await applyViewport();
    },
    // A finger tap on the first visible element matching `selector` (optionally the one whose text contains `text`).
    async tap(selector, { text } = {}) {
      const pick = text === undefined ? "matches[0]" : `matches.find((m) => m.innerText.includes(${JSON.stringify(text)}))`;
      const point = await evaluate(`(() => {
        // Only what is laid out: the page holds both the desktop and the phone navigation, one of them hidden.
        const matches = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((m) => m.getClientRects().length > 0);
        const el = ${pick};
        if (!el) return null;
        el.scrollIntoView({ block: "center", inline: "center" });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      })()`);
      if (!point) throw new Error(`Nothing to tap: ${selector}${text ? ` containing "${text}"` : ""}`);
      await send("Page.bringToFront");
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },
    // Replaces the content of an input the way typing on a keyboard does.
    async type(selector, value) {
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); return true; })()`);
      await send("Input.insertText", { text: value });
    },
    async hover(selector) {
      const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
    },
    async screenshot(file) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(shot.data, "base64"));
    },
    async close() {
      try {
        socket.close();
      } catch {
        // already closed
      }
      child.kill();
      await sleep(400);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // the browser may still hold a lock for a moment; the OS temp folder gets cleaned eventually
      }
    },
  };
}
