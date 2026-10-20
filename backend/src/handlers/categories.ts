import { z } from "zod";
import type { CategoryType } from "@fm/database";
import { prisma } from "@fm/database";
import { formText, type FormState } from "@fm/shared/form-state";
import { requireUser } from "../auth/current-user";
import { sameName } from "../data/names";
import { redirect } from "../http/respond";
import { getI18n } from "../i18n";
import { MAX_CATEGORIES_PER_USER } from "../limits";
import { createCategorySchema, updateCategorySchema } from "../validations/category";
import { idSchema } from "../validations/common";

export type CategoryFormState = FormState<"name" | "type" | "icon" | "color" | "parentId" | "systemKey">;
export type DeleteCategoryState = { message: string } | undefined;

const NOT_FOUND_MESSAGE = "Không tìm thấy danh mục.";

// Checks the user's own categories and the shared system ones, since both appear in the same pickers.
async function isNameTaken(userId: string, type: CategoryType, name: string, exceptId?: string): Promise<boolean> {
  const where = { type, OR: [{ userId }, { userId: null }], ...sameName(name, exceptId) };
  return (await prisma.category.findFirst({ where, select: { id: true } })) !== null;
}

// A parent must be visible to the user (own or system), top-level (one nesting level only) and of the same type.
async function parentError(userId: string, parentId: string | null, type: CategoryType): Promise<string | null> {
  if (!parentId) return null;
  const parent = await prisma.category.findFirst({
    where: { id: parentId, parentId: null, OR: [{ userId }, { userId: null }] },
    select: { type: true },
  });
  if (!parent) return "Danh mục cha không hợp lệ.";
  if (parent.type !== type) return "Danh mục cha phải cùng nhóm thu/chi.";
  return null;
}

export async function createCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    type: formText(formData, "type"),
    icon: formText(formData, "icon"),
    color: formText(formData, "color"),
    parentId: formText(formData, "parentId"),
  };
  const parsed = createCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, type, icon, color, parentId } = parsed.data;
  if (await isNameTaken(user.id, type, name)) {
    return { errors: { name: ["Đã có danh mục cùng tên trong nhóm này."] }, values };
  }
  const invalidParent = await parentError(user.id, parentId, type);
  if (invalidParent) return { errors: { parentId: [invalidParent] }, values };

  if ((await prisma.category.count({ where: { userId: user.id } })) >= MAX_CATEGORIES_PER_USER) {
    return { message: (await getI18n()).t("Mỗi người dùng có tối đa {0} danh mục riêng.", MAX_CATEGORIES_PER_USER), values };
  }

  await prisma.category.create({ data: { userId: user.id, name, type, icon, color, parentId } });

  return { success: true };
}

export async function updateCategory(
  categoryId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requireUser();

  const values = {
    name: formText(formData, "name"),
    icon: formText(formData, "icon"),
    color: formText(formData, "color"),
    parentId: formText(formData, "parentId"),
  };
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = updateCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  // Scoping by userId also keeps system categories (userId NULL) read-only.
  const category = await prisma.category.findFirst({
    where: { id: id.data, userId: user.id },
    select: { type: true, _count: { select: { subcategories: true } } },
  });
  if (!category) return { message: NOT_FOUND_MESSAGE, values };

  const { name, icon, color, parentId } = parsed.data;
  if (await isNameTaken(user.id, category.type, name, id.data)) {
    return { errors: { name: ["Đã có danh mục cùng tên trong nhóm này."] }, values };
  }
  if (parentId && category._count.subcategories > 0) {
    return {
      errors: { parentId: ["Danh mục này đang có danh mục con nên không thể đặt làm danh mục con."] },
      values,
    };
  }
  const invalidParent =
    parentId === id.data ? "Danh mục cha không hợp lệ." : await parentError(user.id, parentId, category.type);
  if (invalidParent) return { errors: { parentId: [invalidParent] }, values };

  await prisma.category.updateMany({
    where: { id: id.data, userId: user.id },
    data: { name, icon, color, parentId },
  });

  redirect("/categories");
}

export async function deleteCategory(_prev: DeleteCategoryState, formData: FormData): Promise<DeleteCategoryState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: NOT_FOUND_MESSAGE };

  // Deleting would silently uncategorize transactions and cascade-delete budgets, so refuse while in use.
  // Subcategories are not a blocker: the foreign key promotes them to top-level.
  const deleted = await prisma.category.deleteMany({
    where: { id: id.data, userId: user.id, transactions: { none: {} }, budgets: { none: {} } },
  });
  if (deleted.count === 0) {
    const exists = await prisma.category.findFirst({
      where: { id: id.data, userId: user.id },
      select: { id: true },
    });
    if (exists) return { message: "Danh mục đang được dùng trong giao dịch hoặc ngân sách nên chưa thể xóa." };
  }

  return undefined;
}
