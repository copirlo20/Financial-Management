// Starts the two servers of the app together and stops both when either stops or on Ctrl+C.
//
//   npm run dev               backend with reload on change (port 4000) + Next.js dev server (port 3000)
//   npm start                 backend + the built frontend (run "npm run build" first)
//   node scripts/dev.mjs --backend   the backend alone, with reload on change
//
// PORT moves the frontend, BACKEND_PORT the backend. The frontend finds the backend through BACKEND_URL,
// which is set here to match.
//
// In development this script reloads the backend itself rather than through "node --watch". On Windows
// node --watch also restarts when a file is merely read: reading updates the file's last-access time (at
// most hourly, while NTFS keeps that time), which the file watcher reports as a change. The backend then
// restarted out of nowhere, in the middle of a request: when it first loaded a module (pdf.js's worker on
// the first PDF), or when another program (an editor, Gradle, the Capacitor CLI) read a file it uses. Here
// a change only counts when a file's modification time or size differs from before.
//
// A crash while the backend was serving restarts it at once (a few times a minute at most); a crash while
// starting (an error in the code) waits for the fix to be saved.
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, statSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lanAddresses } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");
const backendOnly = process.argv.includes("--backend");
const frontendPort = process.env.PORT ?? "3000";
const backendPort = process.env.BACKEND_PORT ?? "4000";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

// More crashes than this within a minute means it would only crash again: stop restarting it.
const MAX_RESTARTS_PER_MINUTE = 3;
// The backend's own code, the code it shares with the frontend, the generated database client, and .env.
const BACKEND_SOURCES = ["backend/src", "shared/src", "database/src", ".env"].map((source) => path.join(root, source));
// Saving a file often comes as several events; one restart is enough.
const RELOAD_DELAY_MS = 200;

const servers = [
  {
    name: "backend",
    cwd: path.join(root, "backend"),
    args: ["--import", "tsx", "src/server.ts"],
    env: { PORT: backendPort },
    ready: /^Backend listening on /,
    reload: !production,
  },
  ...(backendOnly
    ? []
    : [
        {
          name: "frontend",
          cwd: path.join(root, "frontend"),
          args: [nextBin, production ? "start" : "dev", "-p", frontendPort],
          env: { BACKEND_URL: `http://127.0.0.1:${backendPort}` },
        },
      ]),
];

let stopping = false;

function start(server) {
  const child = spawn(process.execPath, server.args, {
    cwd: server.cwd,
    env: { ...process.env, ...server.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.child = child;
  server.serving = false;
  // Each line is prefixed with the server it came from.
  for (const stream of [child.stdout, child.stderr]) {
    let pending = "";
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        console.log(`[${server.name}] ${line}`);
        if (server.child === child) watchLine(server, line);
      }
    });
  }
  child.on("exit", (code) => {
    // A child replaced by a reload is expected to go.
    if (stopping || server.child !== child) return;
    if (server.reload) {
      crashed(server, code);
      return;
    }
    console.log(`[${server.name}] stopped (exit code ${code ?? "none"}); stopping the other server too.`);
    stop(code ?? 1);
  });
}

// The addresses another device on the same network can open. Next.js prints just one "Network" address,
// often a virtual adapter's (VMware, Hyper-V, WSL) that no phone can reach, so the real ones are listed.
function printNetworkAddresses() {
  const addresses = lanAddresses().map((address) => `http://${address}:${frontendPort}`);
  if (addresses.length === 0) return;
  console.log(`[dev] From another device on the same network: ${addresses.join("  ")}`);
}

function watchLine(server, line) {
  if (server.name === "frontend" && !server.announced && /Ready in/.test(line)) {
    server.announced = true;
    printNetworkAddresses();
  }
  if (server.ready?.test(line)) server.serving = true;
}

function crashed(server, code) {
  server.child = null;
  if (!server.serving) {
    console.log(`[dev] The ${server.name} failed to start (exit code ${code ?? "none"}): fix the error above and save the file, it restarts by itself.`);
    return;
  }
  const now = Date.now();
  server.crashes = (server.crashes ?? []).filter((time) => now - time < 60_000);
  server.crashes.push(now);
  if (server.crashes.length > MAX_RESTARTS_PER_MINUTE) {
    console.log(
      `[dev] The ${server.name} crashed ${server.crashes.length} times in a minute; not restarting it again. ` +
        `Fix the error above and save a file to restart it, or restart "npm run dev".`,
    );
    return;
  }
  console.log(`[dev] The ${server.name} crashed (see the error above); restarting it.`);
  start(server);
}

function reload(server, file) {
  console.log(`[dev] ${path.relative(root, file)} changed; restarting the ${server.name}.`);
  if (server.child) kill(server.child);
  start(server);
}

// ---------- Watching the backend's sources ----------
// Modification time and size of every watched file. An event for a file whose pair is unchanged (it was
// only read, or its attributes changed) is not a change.
const signatures = new Map();
const signature = (file) => {
  try {
    const stats = statSync(file);
    return stats.isFile() ? `${stats.mtimeMs}:${stats.size}` : null;
  } catch {
    return null;
  }
};
function record(source) {
  let stats;
  try {
    stats = statSync(source);
  } catch {
    return;
  }
  if (stats.isFile()) {
    signatures.set(source, signature(source));
    return;
  }
  for (const entry of readdirSync(source, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      signatures.set(file, signature(file));
    }
  }
}
// True when the file was created, changed or deleted since it was last seen.
function changed(file) {
  const now = signature(file);
  const before = signatures.has(file) ? signatures.get(file) : null;
  if (now === before) return false;
  if (now === null) signatures.delete(file);
  else signatures.set(file, now);
  return true;
}

function watchSources(server) {
  let timer;
  let trigger;
  const schedule = (file) => {
    if (!changed(file)) return;
    trigger = file;
    clearTimeout(timer);
    timer = setTimeout(() => reload(server, trigger), RELOAD_DELAY_MS);
  };
  for (const source of BACKEND_SOURCES) {
    record(source);
    let isDirectory;
    try {
      isDirectory = statSync(source).isDirectory();
    } catch {
      continue;
    }
    if (isDirectory) {
      watch(source, { recursive: true }, (_event, name) => name && schedule(path.join(source, name)));
    } else {
      // A file is watched through its folder, since editors often save by replacing it.
      watch(path.dirname(source), (_event, name) => name === path.basename(source) && schedule(source));
    }
  }
}

function kill(child) {
  if (child.exitCode !== null || !child.pid) return;
  // On Windows a plain kill leaves the servers' own child processes running and holding the ports.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function stop(exitCode) {
  stopping = true;
  for (const server of servers) if (server.child) kill(server.child);
  process.exit(exitCode);
}

for (const server of servers) {
  start(server);
  if (server.reload) watchSources(server);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
