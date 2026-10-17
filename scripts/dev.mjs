// Starts the two servers of the app together and stops both when either stops or on Ctrl+C.
//
//   npm run dev     backend with reload on change (port 4000) + Next.js dev server (port 3000)
//   npm start       backend + the built frontend (run "npm run build" first)
//
// PORT moves the frontend, BACKEND_PORT the backend. The frontend finds the backend through BACKEND_URL,
// which is set here to match.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");
const frontendPort = process.env.PORT ?? "3000";
const backendPort = process.env.BACKEND_PORT ?? "4000";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const servers = [
  {
    name: "backend",
    cwd: path.join(root, "backend"),
    args: [...(production ? [] : ["--watch"]), "--import", "tsx", "src/server.ts"],
    env: { PORT: backendPort },
  },
  {
    name: "frontend",
    cwd: path.join(root, "frontend"),
    args: [nextBin, production ? "start" : "dev", "-p", frontendPort],
    env: { BACKEND_URL: `http://127.0.0.1:${backendPort}` },
  },
];

let stopping = false;
const children = servers.map(({ name, cwd, args, env }) => {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  // Each line is prefixed with the server it came from.
  for (const stream of [child.stdout, child.stderr]) {
    let pending = "";
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) console.log(`[${name}] ${line}`);
    });
  }
  child.on("exit", (code) => {
    if (stopping) return;
    console.log(`[${name}] stopped (exit code ${code ?? "none"}); stopping the other server too.`);
    stop(code ?? 1);
  });
  return child;
});

function stop(exitCode) {
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    // On Windows a plain kill leaves the servers' own child processes running and holding the ports.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
