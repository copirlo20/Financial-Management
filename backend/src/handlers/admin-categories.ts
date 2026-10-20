import { z } from "zod";
import { Prisma, prisma } from "@fm/database";
import type { CategoryType } from "@fm/database";
import { formText } from "@fm/shared/form-state";
import { requireAdmin } from "../auth/current-user";
import { sameName } from "../data/names";
import { redirect } from "../http/respond";
import { createSystemCategorySchema, updateSystemCategorySchema } from "../validations/category";
import { idSchema } from "../validations/common";
import type { CategoryFormState, DeleteCategoryState } from "./categories";

const NOT_FOUND_MESSAGE = "Không tìm thấy danh mục.";

async function isSystemNameTaken(type: CategoryType, name: string, exceptId?: string): Promise<boolean> {
  return (await prisma.category.findFirst({ where: { userId: null, type, ...sameName(name, exceptId) }, select: { id: true } })) !== null;
}

export async function createSystemCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();

  const values = {
    systemKey: formText(formData, "systemKey"),
    name: formText(formData, "name"),
    type: formText(formData, "type"),
    icon: formText(formData, "icon"),
    color: formText(formData, "color"),
  };
  const parsed = createSystemCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { systemKey, name, type, icon, color } = parsed.data;
  if (await isSystemNameTaken(type, name)) {
    return { errors: { name: ["Đã có danh mục mặc định cùng tên trong nhóm này."] }, values };
  }

  try {
    await prisma.category.create({ data: { systemKey, name, type, icon, color } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { systemKey: ["Mã này đã được dùng."] }, values };
    }
    throw error;
  }

  return { success: true };
}

export async function updateSystemCategory(
  categoryId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const values = {
    name: formText(formData, "name"),
    icon: formText(formData, "icon"),
    color: formText(formData, "color"),
  };
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return { message: NOT_FOUND_MESSAGE, values };

  const parsed = updateSystemCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  // userId: null keeps this action away from users' private categories.
  const category = await prisma.category.findFirst({
    where: { id: id.data, userId: null },
    select: { type: true },
  });
  if (!category) return { message: NOT_FOUND_MESSAGE, values };

  const { name, icon, color } = parsed.data;
  if (await isSystemNameTaken(category.type, name, id.data)) {
    return { errors: { name: ["Đã có danh mục mặc định cùng tên trong nhóm này."] }, values };
  }

  await prisma.category.updateMany({ where: { id: id.data, userId: null }, data: { name, icon, color } });

  redirect("/admin/categories");
}

export async function deleteSystemCategory(
  _prev: DeleteCategoryState,
  formData: FormData,
): Promise<DeleteCategoryState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: NOT_FOUND_MESSAGE };

  const deleted = await prisma.category.deleteMany({
    where: { id: id.data, userId: null, transactions: { none: {} }, budgets: { none: {} } },
  });
  if (deleted.count === 0) {
    const exists = await prisma.category.findFirst({ where: { id: id.data, userId: null }, select: { id: true } });
    if (exists) return { message: "Danh mục đang được người dùng sử dụng nên chưa thể xóa." };
  }

  return undefined;
}
