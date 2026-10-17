import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// One .env for the whole project, at the repository root. Prisma commands run from this folder
// (npm run db:migrate and friends do that for you).
if (existsSync("../.env")) {
  process.loadEnvFile("../.env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "prisma db execute --file prisma/seed.sql",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
