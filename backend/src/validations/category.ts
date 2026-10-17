import { z } from "zod";
import { CategoryType } from "@fm/database";
import { CATEGORY_ICON_NAMES } from "@fm/shared/category-icons";

const fields = {
  name: z
    .string({ error: "Vui lòng nhập tên danh mục." })
    .trim()
    .min(1, { error: "Vui lòng nhập tên danh mục." })
    .max(40, { error: "Tên danh mục tối đa 40 ký tự." }),
  type: z.enum(CategoryType, { error: "Loại danh mục không hợp lệ." }),
  icon: z.enum(CATEGORY_ICON_NAMES, { error: "Biểu tượng không hợp lệ." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Màu không hợp lệ." }),
};

// Empty string means "no parent" (top-level category).
const parentIdField = z
  .string()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    error: "Danh mục cha không hợp lệ.",
  })
  .transform((value) => value || null);

export const createCategorySchema = z.object({ ...fields, parentId: parentIdField });

// Type is fixed after creation: flipping it would turn recorded expenses into income.
export const updateCategorySchema = createCategorySchema.omit({ type: true });

export const createSystemCategorySchema = z.object({
  ...fields,
  systemKey: z
    .string({ error: "Vui lòng nhập mã danh mục." })
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, {
      error: "Mã gồm 2–40 ký tự: chữ thường, số, dấu gạch dưới; bắt đầu bằng chữ cái.",
    }),
});

// The key is what translations and seeds refer to, so it never changes after creation.
export const updateSystemCategorySchema = z.object({
  name: fields.name,
  icon: fields.icon,
  color: fields.color,
});
