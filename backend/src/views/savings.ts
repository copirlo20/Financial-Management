import { type Prisma, prisma } from "@fm/database";
import { requireUser } from "../auth/current-user";
import { idSchema } from "../validations/common";

const HISTORY_LIMIT = 100;

// What the list and the goal page both show of a goal.
const GOAL_FIELDS = {
  id: true,
  name: true,
  targetAmount: true,
  currentAmount: true,
  currency: true,
  deadline: true,
  status: true,
} satisfies Prisma.SavingsGoalSelect;

export async function savingsView() {
  const user = await requireUser();
  return prisma.savingsGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: GOAL_FIELDS,
  });
}
export type SavingsView = Awaited<ReturnType<typeof savingsView>>;

// One goal with its latest contributions (and how many there are in all).
export async function savingsGoalView(goalId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(goalId);
  if (!id.success) return null;

  const goal = await prisma.savingsGoal.findFirst({
    where: { id: id.data, userId: user.id },
    select: {
      ...GOAL_FIELDS,
      _count: { select: { contributions: true } },
      contributions: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: HISTORY_LIMIT,
        select: { id: true, amount: true, date: true, note: true },
      },
    },
  });
  return goal && { ...goal, historyLimit: HISTORY_LIMIT };
}
export type SavingsGoalView = NonNullable<Awaited<ReturnType<typeof savingsGoalView>>>;
