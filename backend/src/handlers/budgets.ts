import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import { dateToIsoDate } from "@fm/shared/dates";
import { formText, type FormState } from "@fm/shared/form-state";
import { monthStart, shiftMonth } from "@fm/shared/months";
import { requireUser } from "../auth/current-user";
import { redirect } from "../http/respond";
import { createBudgetSchema, monthSchema, updateBudgetSchema } from "../validations/budget";
import { idSchema } from "../validations/common";

export type BudgetFormState = FormState<"month" | "categoryId" | "amountLimit">;

const NOT_FOUND_MESSAGE = "Không tìm thấy ngân sách.";

export async function createBudget(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const user = await requireUser();

  const values = {
    month: formText(formData, "month"),
    categoryId: formText(formData, "categoryId"),
    amountLimit: formText(formData, "amountLimit"),
  };
  const parsed = createBudgetSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { month, categoryId, amountLimit } = parsed.data;
  const periodStart = monthStart(month);

  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, type: "EXPENSE", OR: [{ userId: user.id }, { userId: null }] },
      select: { id: true },
    });
    if (!category) return { errors: { categoryId: ["Chỉ đặt được ngân sách cho danh mục khoản chi của bạn."] }, values };
  }

  const duplicateError = { errors: { categoryId: ["Tháng này đã có ngân sách cho mục này."] }, values };
  // The overall budget's uniqueness lives in a partial index Prisma cannot see, so check it explicitly too.
  const existing = await prisma.budget.findFirst({
    where: { userId: user.id, categoryId, periodStart },
    select: { id: true },
  });
  if (existing) return duplicateError;

  try {
    await prisma.budget.create({
      data: { userId: user.id, categoryId, amountLimit, currency: user.defaultCurrency, periodStart },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return duplicateError;
    throw error;
  }

  return { success: true };
}

export async function updateBudget(
  budgetId: string,
  _prev: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const user = await requireUser();

  const values = { amountLimit: formText(formData, "amountLimit") };
  const id = idSchema.safeParse(budgetId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = updateBudgetSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const budget = await prisma.budget.findFirst({
    where: { id: id.data, userId: user.id },
    select: { periodStart: true },
  });
  if (!budget) return { message: NOT_FOUND_MESSAGE, values };

  await prisma.budget.updateMany({
    where: { id: id.data, userId: user.id },
    data: { amountLimit: parsed.data.amountLimit },
  });

  redirect(`/budgets?month=${dateToIsoDate(budget.periodStart).slice(0, 7)}`);
}

export async function deleteBudget(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  await prisma.budget.deleteMany({ where: { id: id.data, userId: user.id } });
}

// Copies last month's budgets into the given month, leaving any budget that already exists there untouched.
export async function copyPreviousMonthBudgets(formData: FormData): Promise<void> {
  const user = await requireUser();
  const month = monthSchema.safeParse(formData.get("month"));
  if (!month.success) return;

  const previous = await prisma.budget.findMany({
    where: { userId: user.id, periodStart: monthStart(shiftMonth(month.data, -1)) },
    select: { categoryId: true, amountLimit: true, currency: true },
  });
  if (previous.length > 0) {
    const periodStart = monthStart(month.data);
    await prisma.budget.createMany({
      data: previous.map((budget) => ({ ...budget, userId: user.id, periodStart })),
      skipDuplicates: true,
    });
  }
}
