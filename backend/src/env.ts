import { existsSync } from "node:fs";
import path from "node:path";

// One .env for the whole project, at the repository root. Imported first by server.ts so that the
// variables are there before any other module (the database client, the token secret) reads them.
const file = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(file)) process.loadEnvFile(file);
