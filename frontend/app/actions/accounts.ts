"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { AccountFormState } from "@fm/backend/handlers/accounts";
import { command, idSegment } from "@/lib/api/client";

export type { AccountFormState };

export async function createAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  return command("POST", "/accounts", formData);
}

export async function updateAccount(
  accountId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return command("PUT", `/accounts/${encodeURIComponent(accountId)}`, formData);
}

export async function archiveAccount(formData: FormData): Promise<void> {
  await command("POST", `/accounts/${idSegment(formData)}/archive`, formData);
}

export async function restoreAccount(formData: FormData): Promise<void> {
  await command("POST", `/accounts/${idSegment(formData)}/restore`, formData);
}
