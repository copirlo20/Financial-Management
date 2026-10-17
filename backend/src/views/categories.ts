import { prisma } from "@fm/database";
import { requireAdmin, requireUser } from "../auth/current-user";
import { idSchema } from "../validations/common";

// The user's own categories and the system ones, system first.
export async function categoriesView() {
  const user = await requireUser();
  return prisma.category.findMany({
    where: { OR: [{ userId: user.id }, { userId: null }] },
    orderBy: [{ userId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    select: { id: true, userId: true, parentId: true, name: true, type: true, icon: true, color: true },
  });
}
export type CategoriesView = Awaited<ReturnType<typeof categoriesView>>;

// One of the user's own categories, with the categories it could be moved under.
export async function categoryView(categoryId: string) {
  const user = await requireUser();
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return null;

  const category = await prisma.category.findFirst({
    where: { id: id.data, userId: user.id },
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
      parentId: true,
      _count: { select: { subcategories: true } },
    },
  });
  if (!category) return null;

  // Only one nesting level: a category that already has children cannot itself become a child.
  const hasChildren = category._count.subcategories > 0;
  const parents = hasChildren
    ? []
    : await prisma.category.findMany({
        where: {
          type: category.type,
          parentId: null,
          id: { not: category.id },
          OR: [{ userId: user.id }, { userId: null }],
        },
        orderBy: [{ userId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        select: { id: true, name: true, type: true },
      });

  return { category, hasChildren, parents };
}
export type CategoryView = NonNullable<Awaited<ReturnType<typeof categoryView>>>;

// System categories only: admins never read users' private categories.
export async function adminCategoriesView() {
  await requireAdmin();
  return prisma.category.findMany({
    where: { userId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, systemKey: true, name: true, type: true, icon: true, color: true },
  });
}
export type AdminCategoriesView = Awaited<ReturnType<typeof adminCategoriesView>>;

export async function adminCategoryView(categoryId: string) {
  await requireAdmin();
  const id = idSchema.safeParse(categoryId);
  if (!id.success) return null;

  return prisma.category.findFirst({
    where: { id: id.data, userId: null },
    select: { id: true, systemKey: true, name: true, type: true, icon: true, color: true },
  });
}
export type AdminCategoryView = NonNullable<Awaited<ReturnType<typeof adminCategoryView>>>;
