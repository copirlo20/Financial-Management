"use server";

// Server Actions are the forms' entry points. Each one only passes the submitted form on to the
// backend route that does the work (validation, permission checks and the change itself live there).
import type { CategoryFormState, DeleteCategoryState } from "@fm/backend/handlers/categories";
import { formCommand, idSegment } from "@/lib/api/client";

export type { CategoryFormState, DeleteCategoryState };

export async function createCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  return formCommand("POST", "/categories", formData);
}

export async function updateCategory(
  categoryId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  return formCommand("PUT", `/categories/${encodeURIComponent(categoryId)}`, formData);
}

export async function deleteCategory(_prev: DeleteCategoryState, formData: FormData): Promise<DeleteCategoryState> {
  return formCommand("DELETE", `/categories/${idSegment(formData)}`, formData);
}
