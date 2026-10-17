"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { CategoryFormState, DeleteCategoryState } from "@fm/backend/handlers/categories";
import { command, idSegment } from "@/lib/api/client";

export async function createSystemCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  return command("POST", "/admin/categories", formData);
}

export async function updateSystemCategory(
  categoryId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  return command("PUT", `/admin/categories/${encodeURIComponent(categoryId)}`, formData);
}

export async function deleteSystemCategory(
  _prev: DeleteCategoryState,
  formData: FormData,
): Promise<DeleteCategoryState> {
  return command("DELETE", `/admin/categories/${idSegment(formData)}`, formData);
}
