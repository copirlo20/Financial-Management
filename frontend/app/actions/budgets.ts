"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { BudgetFormState } from "@fm/backend/handlers/budgets";
import { command, formCommand, idSegment } from "@/lib/api/client";

export type { BudgetFormState };

export async function createBudget(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  return formCommand("POST", "/budgets", formData);
}

export async function updateBudget(
  budgetId: string,
  _prev: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  return formCommand("PUT", `/budgets/${encodeURIComponent(budgetId)}`, formData);
}

export async function deleteBudget(formData: FormData): Promise<void> {
  await command("DELETE", `/budgets/${idSegment(formData)}`, formData);
}

export async function copyPreviousMonthBudgets(formData: FormData): Promise<void> {
  await command("POST", "/budgets/copy-previous", formData);
}
