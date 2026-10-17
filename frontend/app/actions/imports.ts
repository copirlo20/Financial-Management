"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type {
  DocumentFormState,
  MappingFormState,
  RollbackState,
  UploadFormState,
} from "@fm/backend/handlers/imports";
import { command, formCommand, formUpload, idSegment } from "@/lib/api/client";

export type { DocumentFormState, MappingFormState, RollbackState, UploadFormState };

export async function uploadImport(_prev: UploadFormState, formData: FormData): Promise<UploadFormState> {
  const file = formData.get("file");
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return formUpload("/imports", file instanceof File ? file : null, { accountId: text("accountId"), useAi: text("useAi") }, formData);
}

export async function confirmImport(
  batchId: string,
  _prev: MappingFormState,
  formData: FormData,
): Promise<MappingFormState> {
  return formCommand("POST", `/imports/${encodeURIComponent(batchId)}/confirm`, formData);
}

export async function confirmDocumentImport(
  batchId: string,
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  return formCommand("POST", `/imports/${encodeURIComponent(batchId)}/confirm-document`, formData);
}

export async function cancelImport(formData: FormData): Promise<void> {
  await command("POST", `/imports/${idSegment(formData)}/cancel`, formData);
}

export async function deleteImport(_prev: RollbackState, formData: FormData): Promise<RollbackState> {
  return formCommand("DELETE", `/imports/${idSegment(formData)}`, formData);
}

export async function rollbackImport(_prev: RollbackState, formData: FormData): Promise<RollbackState> {
  return formCommand("POST", `/imports/${idSegment(formData)}/rollback`, formData);
}
