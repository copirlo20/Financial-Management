import { Prisma, prisma } from "@fm/database";
import { monthStart, shiftMonth } from "@fm/shared/months";
import { getI18n } from "../i18n";

const MAX_CATEGORY_BARS = 7;
const zero = new Prisma.Decimal(0);

// All figures use each transaction's snapshot in the user's default currency. Transfers are neither income
// nor spending. Transactions with no snapshot (no exchange rate yet) are excluded and counted separately.
export async function getMonthReport(userId: string, month: string) {
  const { t } = await getI18n();
  const inMonth = {
    userId,
    type: { in: ["EXPENSE", "INCOME"] as ("EXPENSE" | "INCOME")[] },
    date: { gte: monthStart(month), lt: monthStart(shiftMonth(month, 1)) },
  };

  const [byTypeAndCategory, unconvertedCount, categories, balances] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type", "categoryId"],
      where: inMonth,
      _sum: { amountInDefaultCurrency: true },
    }),
    prisma.transaction.count({ where: { ...inMonth, amountInDefaultCurrency: null } }),
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.account.groupBy({
      by: ["currency"],
      where: { userId, archivedAt: null },
      _sum: { currentBalance: true },
      orderBy: { currency: "asc" },
    }),
  ]);

  let income = zero;
  let expense = zero;
  // Subcategory spending is rolled up into its parent so the chart has one bar per top-level category.
  const byId = new Map(categories.map((category) => [category.id, category]));
  const expenseByParent = new Map<string, { name: string; total: Prisma.Decimal }>();
  for (const row of byTypeAndCategory) {
    const total = row._sum.amountInDefaultCurrency ?? zero;
    if (row.type === "INCOME") {
      income = income.plus(total);
      continue;
    }
    expense = expense.plus(total);
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    const parent = category?.parentId ? (byId.get(category.parentId) ?? category) : category;
    const key = parent?.id ?? "uncategorized";
    const entry = expenseByParent.get(key) ?? { name: parent ? t(parent.name) : t("Chưa phân loại"), total: zero };
    entry.total = entry.total.plus(total);
    expenseByParent.set(key, entry);
  }

  const sorted = [...expenseByParent.values()]
    .filter((entry) => entry.total.greaterThan(0))
    .sort((a, b) => b.total.comparedTo(a.total));
  const expenseByCategory = sorted.slice(0, MAX_CATEGORY_BARS);
  const rest = sorted.slice(MAX_CATEGORY_BARS);
  if (rest.length > 0) {
    expenseByCategory.push({
      name: t("Khác ({0} danh mục)", rest.length),
      total: rest.reduce((sum, entry) => sum.plus(entry.total), zero),
    });
  }

  return {
    income,
    expense,
    net: income.minus(expense),
    expenseByCategory,
    unconvertedCount,
    balances: balances.map((row) => ({ currency: row.currency, total: row._sum.currentBalance ?? zero })),
  };
}

export type TrendPoint = { month: string; income: Prisma.Decimal; expense: Prisma.Decimal };

// Income and expense per month for the `months` months ending at `endMonth`, oldest first, gaps filled with zero.
export async function getMonthlyTrend(userId: string, endMonth: string, months: number): Promise<TrendPoint[]> {
  const firstMonth = shiftMonth(endMonth, -(months - 1));
  const rows = await prisma.$queryRaw<{ month: string; type: string; total: Prisma.Decimal }[]>`
    SELECT to_char("date", 'YYYY-MM') AS "month", "type"::text AS "type",
           COALESCE(SUM("amountInDefaultCurrency"), 0) AS "total"
    FROM "transactions"
    WHERE "userId" = ${userId}
      AND "type" IN ('EXPENSE', 'INCOME')
      AND "date" >= ${`${firstMonth}-01`}::date
      AND "date" < ${`${shiftMonth(endMonth, 1)}-01`}::date
    GROUP BY 1, 2`;

  return Array.from({ length: months }, (_, index) => {
    const month = shiftMonth(firstMonth, index);
    const total = (type: string) =>
      new Prisma.Decimal(rows.find((row) => row.month === month && row.type === type)?.total ?? 0);
    return { month, income: total("INCOME"), expense: total("EXPENSE") };
  });
}
