import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import { isoDateToDate } from "@fm/shared/dates";
import { formText, type FormState } from "@fm/shared/form-state";
import { requireUser } from "../auth/current-user";
import { sameName } from "../data/names";
import { redirect } from "../http/respond";
import { getI18n } from "../i18n";
import { MAX_SAVINGS_GOALS_PER_USER } from "../limits";
import { idSchema } from "../validations/common";
import { contributionSchema, createGoalSchema, updateGoalSchema } from "../validations/savings";

export type GoalFormState = FormState<"name" | "targetAmount" | "currency" | "deadline">;
export type ContributionFormState = FormState<"direction" | "amount" | "date" | "note">;
export type DeleteContributionState = { message: string } | undefined;

type Tx = Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Không tìm thấy mục tiêu.";

async function isNameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
  return (await prisma.savingsGoal.findFirst({ where: { userId, ...sameName(name, exceptId) }, select: { id: true } })) !== null;
}

// One statement moves the cached total and re-derives COMPLETED / IN_PROGRESS from it, so concurrent
// contributions cannot lose an update, and the total can never go below zero. Returns false if refused.
async function shiftSavedAmount(
  db: Pick<Tx, "$executeRaw">,
  userId: string,
  goalId: string,
  delta: Prisma.Decimal,
  options: { allowArchived: boolean },
): Promise<boolean> {
  const updated = await db.$executeRaw`
    UPDATE "savings_goals"
    SET "currentAmount" = "currentAmount" + ${delta}::numeric,
        "status" = CASE
          WHEN "status" = 'ARCHIVED' THEN "status"
          WHEN "currentAmount" + ${delta}::numeric >= "targetAmount" THEN 'COMPLETED'::"SavingsGoalStatus"
          ELSE 'IN_PROGRESS'::"SavingsGoalStatus"
        END,
        "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE "id" = ${goalId} AND "userId" = ${userId}
      AND "currentAmount" + ${delta}::numeric >= 0
      AND (${options.allowArchived}::boolean OR "status" <> 'ARCHIVED')`;
  return updated > 0;
}

export async function createGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    targetAmount: formText(formData, "targetAmount"),
    currency: formText(formData, "currency"),
    deadline: formText(formData, "deadline"),
  };
  const parsed = createGoalSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { name, targetAmount, currency, deadline } = parsed.data;

  if (await isNameTaken(user.id, name)) {
    return { errors: { name: ["Bạn đã có mục tiêu với tên này."] }, values };
  }
  if ((await prisma.savingsGoal.count({ where: { userId: user.id } })) >= MAX_SAVINGS_GOALS_PER_USER) {
    return { message: (await getI18n()).t("Mỗi người dùng có tối đa {0} mục tiêu tiết kiệm.", MAX_SAVINGS_GOALS_PER_USER), values };
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name,
      targetAmount,
      currency,
      deadline: deadline ? isoDateToDate(deadline) : null,
    },
    select: { id: true },
  });

  redirect(`/savings/${goal.id}`);
}

export async function updateGoal(goalId: string, _prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    targetAmount: formText(formData, "targetAmount"),
    deadline: formText(formData, "deadline"),
  };
  const id = idSchema.safeParse(goalId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = updateGoalSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { name, targetAmount } = parsed.data;
  const deadline = parsed.data.deadline ? isoDateToDate(parsed.data.deadline) : null;

  if (await isNameTaken(user.id, name, id.data)) {
    return { errors: { name: ["Bạn đã có mục tiêu với tên này."] }, values };
  }

  // Changing the target can complete or reopen the goal, so the status is re-derived in the same statement.
  const updated = await prisma.$executeRaw`
    UPDATE "savings_goals"
    SET "name" = ${name},
        "targetAmount" = ${targetAmount}::numeric,
        "deadline" = ${deadline}::date,
        "status" = CASE
          WHEN "status" = 'ARCHIVED' THEN "status"
          WHEN "currentAmount" >= ${targetAmount}::numeric THEN 'COMPLETED'::"SavingsGoalStatus"
          ELSE 'IN_PROGRESS'::"SavingsGoalStatus"
        END,
        "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE "id" = ${id.data} AND "userId" = ${user.id}`;
  if (updated === 0) return { message: NOT_FOUND_MESSAGE, values };

  redirect(`/savings/${id.data}`);
}

export async function archiveGoal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.savingsGoal.updateMany({
    where: { id: id.data, userId: user.id },
    data: { status: "ARCHIVED" },
  });
}

export async function restoreGoal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.$executeRaw`
    UPDATE "savings_goals"
    SET "status" = CASE WHEN "currentAmount" >= "targetAmount"
          THEN 'COMPLETED'::"SavingsGoalStatus" ELSE 'IN_PROGRESS'::"SavingsGoalStatus" END,
        "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE "id" = ${id.data} AND "userId" = ${user.id} AND "status" = 'ARCHIVED'`;
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  // Contributions go with the goal (foreign key cascade).
  await prisma.savingsGoal.deleteMany({ where: { id: id.data, userId: user.id } });
  redirect("/savings");
}

export async function addContribution(
  goalId: string,
  _prev: ContributionFormState,
  formData: FormData,
): Promise<ContributionFormState> {
  const user = await requireUser();

  const values = {
    direction: formText(formData, "direction"),
    amount: formText(formData, "amount"),
    date: formText(formData, "date"),
    note: formText(formData, "note"),
  };
  const id = idSchema.safeParse(goalId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = contributionSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { direction, note } = parsed.data;
  // Withdrawals are stored as negative contributions.
  const amount = new Prisma.Decimal(direction === "withdraw" ? `-${parsed.data.amount}` : parsed.data.amount);

  const saved = await prisma.$transaction(async (tx) => {
    if (!(await shiftSavedAmount(tx, user.id, id.data, amount, { allowArchived: false }))) return false;
    await tx.savingsContribution.create({
      data: { savingsGoalId: id.data, amount, date: isoDateToDate(parsed.data.date), note },
    });
    return true;
  });
  if (!saved) {
    const goal = await prisma.savingsGoal.findFirst({
      where: { id: id.data, userId: user.id },
      select: { status: true },
    });
    if (!goal) return { message: NOT_FOUND_MESSAGE, values };
    if (goal.status === "ARCHIVED") return { message: "Mục tiêu đã được lưu trữ. Hãy khôi phục trước khi ghi thêm.", values };
    return { errors: { amount: ["Không thể rút nhiều hơn số tiền đã tiết kiệm."] }, values };
  }

  return { success: true };
}

class RefusedError extends Error {}

export async function deleteContribution(
  _prev: DeleteContributionState,
  formData: FormData,
): Promise<DeleteContributionState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: "Không tìm thấy khoản này." };

  const contribution = await prisma.savingsContribution.findFirst({
    where: { id: id.data, savingsGoal: { userId: user.id } },
    select: { id: true, amount: true, savingsGoalId: true },
  });
  if (!contribution) return { message: "Không tìm thấy khoản này." };

  try {
    await prisma.$transaction(async (tx) => {
      // Deleting first means a second, concurrent delete finds nothing and leaves the total alone.
      const deleted = await tx.savingsContribution.deleteMany({ where: { id: contribution.id } });
      if (deleted.count === 0) return;
      const shifted = await shiftSavedAmount(tx, user.id, contribution.savingsGoalId, contribution.amount.neg(), {
        allowArchived: true,
      });
      if (!shifted) throw new RefusedError();
    });
  } catch (error) {
    if (error instanceof RefusedError) {
      return { message: "Không xóa được: số tiền này đã được rút ra ở các lần sau. Hãy xóa lần rút trước." };
    }
    throw error;
  }

  return undefined;
}
