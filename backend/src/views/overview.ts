import { prisma } from "@fm/database";
import { SUPPORTED_CURRENCIES } from "@fm/shared/currencies";
import { currentMonth } from "@fm/shared/months";
import { aiProvider } from "../ai/client";
import { requireUser } from "../auth/current-user";
import { getBudgetStatuses } from "../data/budgets";
import { getMonthReport, getMonthlyTrend } from "../data/reports";
import { convertBalances, exchangeRate, getRatesStatus, refreshRates } from "../exchange";
import { monthSchema } from "../validations/budget";

const TREND_MONTHS = 6;
const RECENT_TRANSACTIONS = 5;

// Who is signed in, and which optional features this server has switched on.
export async function sessionView() {
  const user = await requireUser();
  return { user, aiProvider: aiProvider() };
}
export type SessionView = Awaited<ReturnType<typeof sessionView>>;

export async function dashboardView(query: { month?: unknown }) {
  const user = await requireUser();
  const thisMonth = currentMonth();
  const month = monthSchema.catch(thisMonth).parse(query.month);
  const currency = user.defaultCurrency;

  const [report, trend, { statuses }, recent] = await Promise.all([
    getMonthReport(user.id, month),
    getMonthlyTrend(user.id, month, TREND_MONTHS),
    getBudgetStatuses(user.id, month),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: RECENT_TRANSACTIONS,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        date: true,
        note: true,
        transferDirection: true,
        category: { select: { name: true, icon: true, color: true } },
        account: { select: { name: true } },
      },
    }),
  ]);
  // Only worth a combined figure when there is something to combine.
  const converted = report.balances.some((balance) => balance.currency !== currency)
    ? (await refreshRates(), await convertBalances(report.balances, currency))
    : null;

  return { month, thisMonth, trendMonths: TREND_MONTHS, report, trend, statuses, recent, converted };
}
export type DashboardView = Awaited<ReturnType<typeof dashboardView>>;

export async function settingsView() {
  const user = await requireUser();
  await refreshRates();

  const today = new Date();
  const [status, rates] = await Promise.all([
    getRatesStatus(),
    Promise.all(
      SUPPORTED_CURRENCIES.filter((currency) => currency !== user.defaultCurrency).map(async (currency) => ({
        currency,
        rate: await exchangeRate(prisma, currency, user.defaultCurrency, today),
      })),
    ),
  ]);
  return { status, rates };
}
export type SettingsView = Awaited<ReturnType<typeof settingsView>>;
