import type { Metadata } from "next";
import Link from "next/link";
import type { CategoriesView } from "@fm/backend/views/categories";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "@fm/shared/category-icons";
import { CATEGORY_TYPE_LABELS } from "@fm/shared/labels";
import { createCategory, deleteCategory } from "@/app/actions/categories";
import { CategoryBadge } from "@/components/category-icon";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { CategoryForm } from "./category-form";
import { DeleteCategoryButton } from "./delete-category-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Danh mục") };
}

type CategoryRow = {
  id: string;
  userId: string | null;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
};

async function CategoryItem({ category }: { category: CategoryRow }) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <CategoryBadge icon={category.icon} color={category.color} />
      <p className="min-w-0 flex-1 truncate font-medium">{t(category.name)}</p>
      {category.userId ? (
        <>
          <Link
            href={`/categories/${category.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >{t("Sửa")}</Link>
          <DeleteCategoryButton action={deleteCategory} id={category.id} name={t(category.name)} />
        </>
      ) : (
        <span className="text-xs text-muted-foreground">{t("Mặc định")}</span>
      )}
    </div>
  );
}

export default async function CategoriesPage() {
  const { t } = await getI18n();
  await requireUser();

  const categories = await apiLoad<CategoriesView>("/categories");
  const roots = categories.filter((category) => !category.parentId);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Danh mục")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] *:min-w-0">
        <div className="grid gap-6">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <section key={type} className="grid gap-3 *:min-w-0">
              <h2 className="text-lg font-medium">{t(CATEGORY_TYPE_LABELS[type])}</h2>
              <ul className="grid items-start gap-2 sm:grid-cols-2 *:min-w-0">
                {roots
                  .filter((category) => category.type === type)
                  .map((category) => {
                    const children = categories.filter((child) => child.parentId === category.id);
                    return (
                      <li key={category.id} className="rounded-lg border bg-card shadow-xs p-3">
                        <CategoryItem category={category} />
                        {children.length > 0 && (
                          <ul className="mt-3 grid gap-3 border-l pl-4" aria-label={t("Danh mục con của {0}", t(category.name))}>
                            {children.map((child) => (
                              <li key={child.id}>
                                <CategoryItem category={child} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("Thêm danh mục")}</CardTitle>
            <CardDescription>{t("Danh mục riêng của bạn, bên cạnh các danh mục mặc định.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm
              action={createCategory}
              mode="create"
              cancelHref="/categories"
              parents={roots.map(({ id, name, type }) => ({ id, name, type }))}
              defaults={{
                name: "",
                type: "EXPENSE",
                icon: DEFAULT_CATEGORY_ICON,
                color: DEFAULT_CATEGORY_COLOR,
                parentId: "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
