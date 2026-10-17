"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { TransactionFormState, TransferFormState } from "@fm/backend/handlers/transactions";
import { command, idSegment } from "@/lib/api/client";

export type { TransactionFormState, TransferFormState };

export async function createTransaction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  return command("POST", "/transactions", formData);
}

export async function updateTransaction(
  transactionId: string,
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  return command("PUT", `/transactions/${encodeURIComponent(transactionId)}`, formData);
}

export async function createTransfer(_prev: TransferFormState, formData: FormData): Promise<TransferFormState> {
  return command("POST", "/transfers", formData);
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  await command("DELETE", `/transactions/${idSegment(formData)}`, formData);
}
