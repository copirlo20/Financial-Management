import { prisma } from "@fm/database";
import { todayIsoDate } from "@fm/shared/dates";
import { RATE_BASE } from "@fm/shared/rates";
import { requireAdmin } from "../auth/current-user";
import { refreshRates } from "../exchange";

const MANUAL_LIMIT = 100;

export async function adminExchangeRatesView() {
  await requireAdmin();
  await refreshRates();

  const [latest, manual] = await Promise.all([
    // Newest stored rate per currency, whichever way it got there.
    prisma.exchangeRate.findMany({
      where: { baseCurrency: RATE_BASE },
      orderBy: [{ quoteCurrency: "asc" }, { date: "desc" }],
      distinct: ["quoteCurrency"],
      select: { id: true, quoteCurrency: true, rate: true, date: true, isManual: true },
    }),
    prisma.exchangeRate.findMany({
      where: { baseCurrency: RATE_BASE, isManual: true },
      orderBy: [{ date: "desc" }, { quoteCurrency: "asc" }],
      take: MANUAL_LIMIT,
      select: { id: true, quoteCurrency: true, rate: true, date: true },
    }),
  ]);
  return { latest, manual, today: todayIsoDate() };
}
export type AdminExchangeRatesView = Awaited<ReturnType<typeof adminExchangeRatesView>>;
