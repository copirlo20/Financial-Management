// End-to-end tests for the main user flows. They drive the real app over HTTP the way a browser without
// JavaScript would (forms, cookies, redirects) and check the result both on the page and in the database.
//
//   npm test                      build the frontend, start backend + frontend on spare ports, run every suite, stop them
//   npm test -- auth budgets      only suites whose file name contains one of these words
//   npm run test:dev              run against an already running server (default http://localhost:3000)
//   E2E_VERBOSE=1 npm test        print every check of every suite, not only the failed ones
//
// The app's AI assistant is pointed at a local stand-in for the AI APIs (tests/mock-ai.mjs), so no test
// calls the real ones. That needs the runner's own server: with --base the AI suites skip themselves.
// The runner starts the app twice: once using Claude, for every suite, and once using OpenAI, for the
// AI suites (AI_SUITES), which then run a second time against it.
//
// The suites write to the database in .env: they create users named e2e-*@example.com and delete them
// afterwards, and the currency suite forces an exchange-rate refresh. Run them against a development
// database only; the runner refuses a non-local DATABASE_URL unless E2E_ALLOW_REMOTE_DB=1 is set.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockAi } from "./mock-ai.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectRoot);
if (existsSync(".env")) process.loadEnvFile(".env");

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const externalBase = baseIndex >= 0 ? args[baseIndex + 1] : null;
const filters = args.filter((arg, index) => !arg.startsWith("--") && !(baseIndex >= 0 && index === baseIndex + 1));
const PORT = Number(process.env.E2E_PORT ?? 3101);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? PORT + 100);
const MOCK_AI_URL = `http://127.0.0.1:${Number(process.env.E2E_AI_MOCK_PORT ?? PORT + 60)}`;
// The second copy of the app, the one using OpenAI.
const OPENAI_PORT = PORT + 2;
const OPENAI_BACKEND_PORT = BACKEND_PORT + 2;
const AI_SUITES = ["chat", "imports-ai"];
const SUITE_TIMEOUT_MS = Number(process.env.E2E_SUITE_TIMEOUT_MS ?? 240_000);
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const frontendDir = path.join(projectRoot, "frontend");
const backendDir = path.join(projectRoot, "backend");

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

const databaseHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (!databaseHost) fail("DATABASE_URL is not set (expected in .env).");
if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost) && process.env.E2E_ALLOW_REMOTE_DB !== "1") {
  fail(`Refusing to run: DATABASE_URL points at "${databaseHost}", and these tests write to the database. Set E2E_ALLOW_REMOTE_DB=1 to override.`);
}

// A suite that has not finished by `timeoutMs` is killed and reported as failed, with what it printed so far.
function run(command, commandArgs, options = {}, timeoutMs = 0) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd: projectRoot, ...options });
    let output = "";
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs) : null;
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });
}

async function waitForServer(url, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// The backend started here counts sign-ins, sign-ups and AI use under this prefix (RATE_LIMIT_PREFIX), so
// the run's counters can be removed afterwards instead of holding limits against the developer using the
// app right after (all suites sign in from this one machine).
const COUNTER_PREFIX = "e2e:";

async function forgetTestCounters() {
  const { Client } = createRequire(path.join(projectRoot, "package.json"))("pg");
  const url = new URL(process.env.DATABASE_URL);
  url.search = "";
  const db = new Client({ connectionString: url.toString() });
  try {
    await db.connect();
    await db.query(`delete from rate_limits where key like $1`, [`${COUNTER_PREFIX}%`]);
  } catch (error) {
    console.log(`(could not remove the test run's counters: ${error.message})`);
  } finally {
    await db.end().catch(() => {});
  }
}

// tests/e2e: plain HTTP, as a browser without JavaScript. tests/browser: a real headless Edge/Chrome,
// for behaviour that needs JavaScript; that suite skips itself when no browser is installed.
const suites = ["e2e", "browser"]
  .flatMap((folder) =>
    readdirSync(path.join(projectRoot, "tests", folder))
      .filter((file) => file.endsWith(`.${folder}.mjs`))
      .map((file) => path.join("tests", folder, file)),
  )
  .filter((file) => filters.length === 0 || filters.some((filter) => path.basename(file).includes(filter)))
  .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
if (suites.length === 0) fail("No test suites match.");

let frontend = null;
let backend = null;
let openAiFrontend = null;
let openAiBackend = null;
let mockAi = null;
let base = externalBase;
let openAiBase = null;
let exitCode = 1;
try {
  if (!base) {
    console.log("Building the frontend...");
    const build = await run(process.execPath, [nextBin, "build"], { cwd: frontendDir });
    if (build.code !== 0) fail(`Build failed:\n${build.output.slice(-3000)}`);
    base = `http://localhost:${PORT}`;
    const backendUrl = `http://127.0.0.1:${BACKEND_PORT}`;
    mockAi = await startMockAi(Number(new URL(MOCK_AI_URL).port));
    // The keys and endpoints override whatever .env holds, so no real AI API is reached from a test run.
    const aiSettings = {
      anthropic: { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "e2e-test-key", ANTHROPIC_BASE_URL: MOCK_AI_URL, OPENAI_API_KEY: "", OPENAI_BASE_URL: "" },
      openai: { AI_PROVIDER: "openai", OPENAI_API_KEY: "e2e-test-key", OPENAI_BASE_URL: `${MOCK_AI_URL}/v1`, OPENAI_REASONING_EFFORT: "", ANTHROPIC_API_KEY: "", ANTHROPIC_BASE_URL: "" },
    };
    const startBackend = (port, provider) => spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
      cwd: backendDir,
      stdio: "ignore",
      env: {
        ...process.env,
        PORT: String(port),
        ...aiSettings[provider],
        // Every suite signs up and signs in from this one machine; the per-address limits would stop them.
        // The per-e-mail limit, which is not affected, is tested in the auth suite.
        AUTH_LIMIT_PER_IP: "100000",
        REGISTER_LIMIT_PER_IP: "100000",
        RATE_LIMIT_PREFIX: COUNTER_PREFIX,
        // Housekeeping (removing abandoned uploads) every 2 s instead of every hour, so its test is quick.
        MAINTENANCE_INTERVAL_MS: "2000",
      },
    });
    const startFrontend = (port, backendPort) => spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
      cwd: frontendDir,
      stdio: "ignore",
      env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` },
    });
    backend = startBackend(BACKEND_PORT, "anthropic");
    frontend = startFrontend(PORT, BACKEND_PORT);
    if (suites.some((suite) => AI_SUITES.some((name) => path.basename(suite).startsWith(`${name}.`)))) {
      openAiBackend = startBackend(OPENAI_BACKEND_PORT, "openai");
      openAiFrontend = startFrontend(OPENAI_PORT, OPENAI_BACKEND_PORT);
      openAiBase = `http://localhost:${OPENAI_PORT}`;
    }
    if (!(await waitForServer(`${backendUrl}/api/health`))) fail(`The backend did not start at ${backendUrl}.`);
    if (openAiBase) {
      if (!(await waitForServer(`http://127.0.0.1:${OPENAI_BACKEND_PORT}/api/health`))) fail("The OpenAI backend did not start.");
      if (!(await waitForServer(`${openAiBase}/login`))) fail(`No server answered at ${openAiBase}.`);
    }
  }
  if (!(await waitForServer(`${base}/login`))) fail(`No server answered at ${base}.`);
  console.log(`Running ${suites.length} suite(s) against ${base}\n`);

  let passed = 0;
  let failed = 0;
  const runs = suites.map((suite) => ({ suite, base, provider: "anthropic" }));
  if (openAiBase) {
    for (const suite of suites) {
      if (AI_SUITES.some((name) => path.basename(suite).startsWith(`${name}.`))) runs.push({ suite, base: openAiBase, provider: "openai" });
    }
  }
  for (const { suite, base: suiteBase, provider } of runs) {
    const started = Date.now();
    const env = { ...process.env, E2E_BASE_URL: suiteBase, E2E_AI_PROVIDER: provider, ...(mockAi ? { E2E_AI_MOCK_URL: MOCK_AI_URL } : {}) };
    const result = await run(process.execPath, [suite], { env }, SUITE_TIMEOUT_MS);
    const lines = result.output.split(/\r?\n/);
    const ok = lines.filter((line) => line.startsWith("PASS")).length;
    const bad = lines.filter((line) => line.startsWith("FAIL"));
    passed += ok;
    failed += bad.length;
    const skipped = lines.find((line) => line.startsWith("SKIP"));
    if (skipped) console.log(`- ${skipped}`);
    const crashed = (result.code !== 0 && bad.length === 0) || result.timedOut;
    if (crashed) failed += 1;
    console.log(`${bad.length || crashed ? "✗" : "✓"} ${(path.basename(suite).replace(/\.(e2e|browser)\.mjs$/, "") + (provider === "openai" ? " (openai)" : "")).padEnd(27)} ${String(ok).padStart(3)} passed${bad.length ? `, ${bad.length} failed` : ""}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    if (process.env.E2E_VERBOSE) console.log(result.output);
    else for (const line of bad) console.log(`    ${line.slice(0, 400)}`);
    if (crashed) {
      const reason = result.timedOut ? `suite killed after ${SUITE_TIMEOUT_MS / 1000}s without finishing` : "suite crashed";
      console.log(`    ${reason}; last output:`);
      console.log(result.output.split(/\r?\n/).slice(-12).join("\n"));
    }
  }
  console.log(`\n${passed} checks passed, ${failed} failed.`);
  exitCode = failed === 0 ? 0 : 1;
} finally {
  frontend?.kill();
  backend?.kill();
  openAiFrontend?.kill();
  openAiBackend?.kill();
  mockAi?.close();
  if (backend) await forgetTestCounters();
}
process.exit(exitCode);
