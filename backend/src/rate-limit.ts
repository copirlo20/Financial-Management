import { prisma } from "@fm/database";

// Counters per key and fixed time window, kept in the database so they survive restarts and are shared
// by every backend process. A window starts at a multiple of its length since the epoch.

// RATE_LIMIT_PREFIX keeps one deployment's counters apart from another's in the same database; the test
// runner uses it to remove everything its run counted.
const PREFIX = process.env.RATE_LIMIT_PREFIX ?? "";

function windowStart(windowMs: number, now = Date.now()): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

// Adds `amount` to the counter of the current window and returns the new total.
export async function hit(key: string, windowMs: number, amount = 1): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    INSERT INTO "rate_limits" ("key", "windowStart", "count")
    VALUES (${PREFIX + key}, ${windowStart(windowMs)}, ${BigInt(amount)})
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "rate_limits"."count" + EXCLUDED."count"
    RETURNING "count"`;
  return Number(rows[0].count);
}

// The counter of the current window, without changing it.
export async function used(key: string, windowMs: number): Promise<number> {
  const row = await prisma.rateLimit.findUnique({
    where: { key_windowStart: { key: PREFIX + key, windowStart: windowStart(windowMs) } },
    select: { count: true },
  });
  return Number(row?.count ?? 0);
}

// Whole minutes until the current window ends (at least 1), for "try again in N minutes".
export function minutesLeft(windowMs: number): number {
  const end = windowStart(windowMs).getTime() + windowMs;
  return Math.max(1, Math.ceil((end - Date.now()) / 60_000));
}

// Counters only matter inside their window; the longest window in use is one day.
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
  });
  return count;
}
