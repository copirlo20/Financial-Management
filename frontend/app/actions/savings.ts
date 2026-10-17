"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type {
  ContributionFormState,
  DeleteContributionState,
  GoalFormState,
} from "@fm/backend/handlers/savings";
import { command, idSegment } from "@/lib/api/client";

export type { ContributionFormState, DeleteContributionState, GoalFormState };

export async function createGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  return command("POST", "/savings", formData);
}

export async function updateGoal(goalId: string, _prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  return command("PUT", `/savings/${encodeURIComponent(goalId)}`, formData);
}

export async function archiveGoal(formData: FormData): Promise<void> {
  await command("POST", `/savings/${idSegment(formData)}/archive`, formData);
}

export async function restoreGoal(formData: FormData): Promise<void> {
  await command("POST", `/savings/${idSegment(formData)}/restore`, formData);
}

export async function deleteGoal(formData: FormData): Promise<void> {
  await command("DELETE", `/savings/${idSegment(formData)}`, formData);
}

export async function addContribution(
  goalId: string,
  _prev: ContributionFormState,
  formData: FormData,
): Promise<ContributionFormState> {
  return command("POST", `/savings/${encodeURIComponent(goalId)}/contributions`, formData);
}

export async function deleteContribution(
  _prev: DeleteContributionState,
  formData: FormData,
): Promise<DeleteContributionState> {
  return command("DELETE", `/savings/contributions/${idSegment(formData)}`, formData);
}
