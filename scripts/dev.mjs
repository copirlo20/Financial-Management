// Starts the two servers of the app together and stops both when either stops or on Ctrl+C.
//
//   npm run dev     backend with reload on change (port 4000) + Next.js dev server (port 3000)
//   npm start       backend + the built frontend (run "npm run build" first)
//
// PORT moves the frontend, BACKEND_PORT the backend. The frontend finds the backend through BACKEND_URL,
// which is set here to match.
//
// In development the backend runs under "node --watch". When it crashes, node --watch keeps waiting for a
// file change instead of exiting, so the port stays closed while everything looks alive and every page fails
// with "connect ECONNREFUSED". This script watches for that: a crash while the backend was serving is
// restarted at once (a few times a minute at most), a crash while starting (an error in the code) waits for
// the fix to be saved, as node --watch does.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");
const frontendPort = process.env.PORT ?? "3000";
const backendPort = process.env.BACKEND_PORT ?? "4000";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

// More crashes than this within a minute means it would only crash again: stop restarting it.
const MAX_RESTARTS_PER_MINUTE = 3;

const servers = [
  {
    name: "backend",
    cwd: path.join(root, "backend"),
    args: [...(production ? [] : ["--watch"]), "--import", "tsx", "src/server.ts"],
    env: { PORT: backendPort },
    ready: /^Backend listening on /,
    superviseWatch: !production,
  },
  {
    name: "frontend",
    cwd: path.join(root, "frontend"),
    args: [nextBin, production ? "start" : "dev", "-p", frontendPort],
    env: { BACKEND_URL: `http://127.0.0.1:${backendPort}` },
  },
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
    // A child replaced by a restart is expected to go.
    if (stopping || server.child !== child) return;
    console.log(`[${server.name}] stopped (exit code ${code ?? "none"}); stopping the other server too.`);
    stop(code ?? 1);
  });
}

function watchLine(server, line) {
  if (server.ready?.test(line)) server.serving = true;
  if (!server.superviseWatch) return;
  // node --watch prints these two itself.
  if (line.startsWith("Restarting ")) server.serving = false;
  if (line.startsWith("Failed running ")) crashed(server);
}

function crashed(server) {
  if (!server.serving) {
    console.log(`[dev] The ${server.name} failed to start: fix the error above and save the file, it restarts by itself.`);
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
  kill(server.child);
  start(server);
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

for (const server of servers) start(server);

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
