"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { ManualRateFormState } from "@fm/backend/handlers/admin-exchange-rates";
import { command, idSegment } from "@/lib/api/client";

export async function setManualRate(_prev: ManualRateFormState, formData: FormData): Promise<ManualRateFormState> {
  return command("POST", "/admin/exchange-rates", formData);
}

export async function deleteManualRate(formData: FormData): Promise<void> {
  await command("DELETE", `/admin/exchange-rates/${idSegment(formData)}`, formData);
}
