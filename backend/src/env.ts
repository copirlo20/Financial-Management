import { existsSync } from "node:fs";
import path from "node:path";

// One .env for the whole project, at the repository root. Imported first by server.ts so that the
// variables are there before any other module (the database client, the token secret) reads them.
const file = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(file)) process.loadEnvFile(file);

// A whole number above zero from the environment (a limit, an interval), or the fallback when it is
// missing or anything else.
export function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
