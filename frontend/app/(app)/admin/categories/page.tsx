import type { Metadata } from "next";
import Link from "next/link";
import type { AdminCategoriesView } from "@fm/backend/views/categories";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "@fm/shared/category-icons";
import { CATEGORY_TYPE_LABELS } from "@fm/shared/labels";
import { createSystemCategory, deleteSystemCategory } from "@/app/actions/admin-categories";
import { CategoryBadge } from "@/components/category-icon";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireAdmin } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { CategoryForm } from "../../categories/category-form";
import { DeleteCategoryButton } from "../../categories/delete-category-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Danh mục mặc định") };
}

export default async function AdminCategoriesPage() {
  const { t } = await getI18n();
  await requireAdmin();

  const categories = await apiLoad<AdminCategoriesView>("/admin/categories");

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{t("Danh mục mặc định")}</h1>
        <p className="text-sm text-muted-foreground">{t("Dùng chung cho mọi người dùng. Thay đổi có hiệu lực ngay.")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
        <div className="grid gap-6">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <section key={type} className="grid gap-3 [&>*]:min-w-0">
              <h2 className="text-lg font-medium">{t(CATEGORY_TYPE_LABELS[type])}</h2>
              <ul className="grid items-start gap-2 sm:grid-cols-2 [&>*]:min-w-0">
                {categories
                  .filter((category) => category.type === type)
                  .map((category) => (
                    <li
                      key={category.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card shadow-xs p-3"
                    >
                      <CategoryBadge icon={category.icon} color={category.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t(category.name)}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{category.systemKey}</p>
                      </div>
                      <Link
                        href={`/admin/categories/${category.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >{t("Sửa")}</Link>
                      <DeleteCategoryButton action={deleteSystemCategory} id={category.id} name={t(category.name)} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("Thêm danh mục mặc định")}</CardTitle>
            <CardDescription>{t("Mọi người dùng sẽ thấy danh mục này.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm
              action={createSystemCategory}
              mode="create"
              withSystemKey
              cancelHref="/admin/categories"
              defaults={{
                systemKey: "",
                name: "",
                type: "EXPENSE",
                icon: DEFAULT_CATEGORY_ICON,
                color: DEFAULT_CATEGORY_COLOR,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
