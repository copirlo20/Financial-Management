import { prisma } from "@fm/database";
import { currentMonth, monthStart, shiftMonth } from "@fm/shared/months";
import { requireUser } from "../auth/current-user";
import { NEAR_LIMIT_PERCENT, getBudgetStatuses } from "../data/budgets";
import { getTransactionOptions } from "../data/transaction-options";
import { monthSchema } from "../validations/budget";
import { idSchema } from "../validations/common";

export async function budgetsView(query: { month?: unknown }) {
  const user = await requireUser();
  const month = monthSchema.catch(currentMonth()).parse(query.month);

  const [{ statuses, unconvertedCount }, { categoryOptions }, previousCount] = await Promise.all([
    getBudgetStatuses(user.id, month),
    getTransactionOptions(user.id),
    prisma.budget.count({ where: { userId: user.id, periodStart: monthStart(shiftMonth(month, -1)) } }),
  ]);
  // A category gets one budget per month, so the ones already budgeted are not offered again.
  const used = new Set(statuses.map((budget) => budget.categoryId));
  const availableCategories = categoryOptions
    .filter((category) => category.type === "EXPENSE" && !used.has(category.id))
    .map(({ id, label }) => ({ id, label }));

  return { month, statuses, unconvertedCount, availableCategories, previousCount, nearLimitPercent: NEAR_LIMIT_PERCENT };
}
export type BudgetsView = Awaited<ReturnType<typeof budgetsView>>;

export async function budgetView(budgetId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(budgetId);
  if (!id.success) return null;

  return prisma.budget.findFirst({
    where: { id: id.data, userId: user.id },
    select: {
      id: true,
      amountLimit: true,
      currency: true,
      periodStart: true,
      category: { select: { name: true } },
    },
  });
}
export type BudgetView = NonNullable<Awaited<ReturnType<typeof budgetView>>>;
