import { Prisma, prisma } from "@fm/database";
import { monthStart, shiftMonth } from "@fm/shared/months";
import { getI18n } from "../i18n";

export const NEAR_LIMIT_PERCENT = 80;

export type BudgetState = "ok" | "near" | "over";
export type BudgetStatus = {
  id: string;
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  limit: Prisma.Decimal;
  spent: Prisma.Decimal;
  percent: number;
  state: BudgetState;
};

// Spending is measured with each transaction's snapshot in the user's default currency. Transactions that
// could not be converted (no exchange rate yet) are left out and reported via unconvertedCount.
export async function getBudgetStatuses(userId: string, month: string) {
  const { t } = await getI18n();
  const start = monthStart(month);
  const expensesInMonth = {
    userId,
    type: "EXPENSE" as const,
    date: { gte: start, lt: monthStart(shiftMonth(month, 1)) },
  };

  const [budgets, spending, unconvertedCount, children] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, periodStart: start },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        categoryId: true,
        amountLimit: true,
        currency: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: expensesInMonth,
      _sum: { amountInDefaultCurrency: true },
    }),
    prisma.transaction.count({ where: { ...expensesInMonth, amountInDefaultCurrency: null } }),
    prisma.category.findMany({
      where: { parentId: { not: null }, OR: [{ userId }, { userId: null }] },
      select: { id: true, parentId: true },
    }),
  ]);

  const zero = new Prisma.Decimal(0);
  const spentByCategory = new Map(
    spending.map((row) => [row.categoryId, row._sum.amountInDefaultCurrency ?? zero] as const),
  );
  const totalSpent = spending.reduce((sum, row) => sum.plus(row._sum.amountInDefaultCurrency ?? zero), zero);

  const statuses: BudgetStatus[] = budgets.map((budget) => {
    // A budget on a parent category also covers its subcategories.
    const spent = budget.categoryId
      ? children
          .filter((child) => child.parentId === budget.categoryId)
          .reduce((sum, child) => sum.plus(spentByCategory.get(child.id) ?? zero), spentByCategory.get(budget.categoryId) ?? zero)
      : totalSpent;
    const percent = spent.div(budget.amountLimit).mul(100).toNumber();
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      name: budget.category ? t(budget.category.name) : t("Tổng chi tiêu"),
      icon: budget.category?.icon ?? null,
      color: budget.category?.color ?? null,
      currency: budget.currency,
      limit: budget.amountLimit,
      spent,
      percent,
      state: percent > 100 ? "over" : percent >= NEAR_LIMIT_PERCENT ? "near" : "ok",
    };
  });

  return { statuses, unconvertedCount };
}
