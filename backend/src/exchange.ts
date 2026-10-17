import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { RATE_BASE } from "@fm/shared/rates";
import { HOUR_MS, MINUTE_MS } from "./time";

const BASE = RATE_BASE;

// Free tier of ExchangeRate-API: no key, refreshed once a day, attribution required (shown on /settings).
// For intraday rates, swap this URL/parser for a paid provider; nothing else depends on it.
const PROVIDER_URL = "https://open.er-api.com/v6/latest/USD";

// The provider publishes daily, so asking more often than this only returns the same numbers.
const REFRESH_INTERVAL_MS = 6 * HOUR_MS;
const MANUAL_REFRESH_INTERVAL_MS = 10 * MINUTE_MS;
const FETCH_TIMEOUT_MS = 5000;

type Db = Pick<Prisma.TransactionClient, "$queryRaw">;
type Writer = Pick<Prisma.TransactionClient, "$executeRaw">;

export type Conversion = {
  amountInDefaultCurrency: Prisma.Decimal | null;
  exchangeRateUsed: Prisma.Decimal | null;
};

const responseSchema = z.object({
  result: z.literal("success"),
  base_code: z.literal(BASE),
  time_last_update_unix: z.number(),
  rates: z.record(z.string(), z.number().positive()),
});

// USD rate of a currency for a given day: the latest rate on or before that day, otherwise the earliest
// one after it (transactions older than our first stored rate still get an approximate conversion).
async function usdRate(db: Db, currency: string, date: Date): Promise<Prisma.Decimal | null> {
  if (currency === BASE) return new Prisma.Decimal(1);
  const day = date.toISOString().slice(0, 10);
  const rows = await db.$queryRaw<{ rate: Prisma.Decimal }[]>`
    SELECT "rate" FROM "exchange_rates"
    WHERE "baseCurrency" = ${BASE} AND "quoteCurrency" = ${currency}
    ORDER BY ("date" > ${day}::date), abs("date" - ${day}::date)
    LIMIT 1`;
  return rows[0]?.rate ?? null;
}

// How many units of `to` one unit of `from` is worth on that day; null when a rate is missing.
export async function exchangeRate(db: Db, from: string, to: string, date: Date): Promise<Prisma.Decimal | null> {
  if (from === to) return new Prisma.Decimal(1);
  const [fromRate, toRate] = await Promise.all([usdRate(db, from, date), usdRate(db, to, date)]);
  if (!fromRate || !toRate || fromRate.isZero()) return null;
  return toRate.div(fromRate);
}

// Snapshot of an amount in the user's default currency. Nulls (never a wrong number) when no rate is known.
export async function convertToDefaultCurrency(
  db: Db,
  amount: Prisma.Decimal,
  currency: string,
  defaultCurrency: string,
  date: Date,
): Promise<Conversion> {
  const rate = await exchangeRate(db, currency, defaultCurrency, date);
  if (!rate) return { amountInDefaultCurrency: null, exchangeRateUsed: null };
  return {
    amountInDefaultCurrency: currency === defaultCurrency ? amount : amount.mul(rate).toDecimalPlaces(2),
    exchangeRateUsed: rate.toDecimalPlaces(12),
  };
}

// Re-derives transaction snapshots with the same date rule as usdRate(), in one statement.
// onlyMissing: fill in rows that had no rate when they were recorded. Otherwise: redo all of a user's rows
// (after their default currency changed). updatedAt is deliberately left alone: this is not a user edit.
export async function recomputeConversions(
  db: Writer,
  options: { userId?: string; onlyMissing: boolean },
): Promise<number> {
  const userFilter = options.userId ? Prisma.sql`AND t."userId" = ${options.userId}` : Prisma.empty;
  const missingFilter = options.onlyMissing ? Prisma.sql`AND t."amountInDefaultCurrency" IS NULL` : Prisma.empty;
  const nearestRate = (currency: Prisma.Sql) => Prisma.sql`
    CASE WHEN ${currency} = ${BASE} THEN 1 ELSE (
      SELECT e."rate" FROM "exchange_rates" e
      WHERE e."baseCurrency" = ${BASE} AND e."quoteCurrency" = ${currency}
      ORDER BY (e."date" > t."date"), abs(e."date" - t."date") LIMIT 1) END`;

  return db.$executeRaw`
    UPDATE "transactions" target
    SET "amountInDefaultCurrency" = CASE WHEN c."same" THEN c."amount" ELSE round(c."amount" * c."rate", 2) END,
        "exchangeRateUsed" = CASE WHEN c."same" THEN 1 ELSE round(c."rate", 12) END
    FROM (
      SELECT t."id", t."amount", t."currency" = u."defaultCurrency" AS "same",
             (${nearestRate(Prisma.sql`u."defaultCurrency"`)}) / NULLIF((${nearestRate(Prisma.sql`t."currency"`)}), 0) AS "rate"
      FROM "transactions" t
      JOIN "users" u ON u."id" = t."userId"
      WHERE TRUE ${userFilter} ${missingFilter}
    ) c
    WHERE target."id" = c."id" AND (c."same" OR c."rate" IS NOT NULL)`;
}

export async function getRatesStatus() {
  const latest = await prisma.exchangeRate.findFirst({
    where: { baseCurrency: BASE, isManual: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true, createdAt: true },
  });
  return latest ? { rateDate: latest.date, fetchedAt: latest.createdAt } : null;
}

let inFlight: Promise<RefreshResult> | null = null;
export type RefreshResult = "updated" | "fresh" | "failed";

async function doRefresh(minIntervalMs: number): Promise<RefreshResult> {
  const status = await getRatesStatus();
  if (status && Date.now() - status.fetchedAt.getTime() < minIntervalMs) return "fresh";

  let payload: z.infer<typeof responseSchema>;
  try {
    const response = await fetch(PROVIDER_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return "failed";
    payload = responseSchema.parse(await response.json());
  } catch {
    // Provider down, slow, or changed its format: keep using the rates already stored.
    return "failed";
  }

  const date = new Date(`${new Date(payload.time_last_update_unix * 1000).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const now = new Date();
  const quotes = SUPPORTED_CURRENCIES.filter((currency) => currency !== BASE && payload.rates[currency]);
  await prisma.$transaction(async (tx) => {
    // A rate an admin entered by hand for this day stays as entered.
    const manual = await tx.exchangeRate.findMany({
      where: { baseCurrency: BASE, date, isManual: true },
      select: { quoteCurrency: true },
    });
    const kept = new Set(manual.map((row) => row.quoteCurrency));
    for (const quoteCurrency of quotes) {
      if (kept.has(quoteCurrency)) continue;
      const rate = new Prisma.Decimal(payload.rates[quoteCurrency]).toDecimalPlaces(6);
      await tx.exchangeRate.upsert({
        where: { baseCurrency_quoteCurrency_date: { baseCurrency: BASE, quoteCurrency, date } },
        create: { baseCurrency: BASE, quoteCurrency, date, rate, createdAt: now },
        update: { rate, createdAt: now },
      });
    }
    // Transactions recorded while no rate existed can be converted now.
    await recomputeConversions(tx, { onlyMissing: true });
  });
  return "updated";
}

// Called wherever rates are about to be used. Cheap when rates are recent; never throws.
export async function refreshRates(options: { manual?: boolean } = {}): Promise<RefreshResult> {
  inFlight ??= doRefresh(options.manual ? MANUAL_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS)
    .catch((): RefreshResult => "failed")
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

// Sum of account balances expressed in one currency at the latest known rates.
export async function convertBalances(
  balances: { currency: string; total: Prisma.Decimal }[],
  targetCurrency: string,
): Promise<{ total: Prisma.Decimal; missing: string[] }> {
  let total = new Prisma.Decimal(0);
  const missing: string[] = [];
  const today = new Date();
  for (const balance of balances) {
    const rate = await exchangeRate(prisma, balance.currency, targetCurrency, today);
    if (rate) total = total.plus(balance.total.mul(rate));
    else missing.push(balance.currency);
  }
  return { total: total.toDecimalPlaces(2), missing };
}
