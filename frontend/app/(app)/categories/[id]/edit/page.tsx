import type { Metadata } from "next";
import type { CategoryView } from "@fm/backend/views/categories";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "@fm/shared/category-icons";
import { updateCategory } from "@/app/actions/categories";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { CategoryForm } from "../../category-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa danh mục") };
}

export default async function EditCategoryPage({ params }: PageProps<"/categories/[id]/edit">) {
  const { t } = await getI18n();
  await requireUser();

  const data = await apiGet<CategoryView>(`/categories/${encodeURIComponent((await params).id)}`);
  if (!data) return <NotFoundMessage />;
  const { category, hasChildren, parents } = data;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa danh mục")}</CardTitle>
        {hasChildren && (
          <CardDescription>{t("Danh mục này đang có danh mục con nên luôn là danh mục gốc.")}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <CategoryForm
          action={updateCategory.bind(null, category.id)}
          mode="edit"
          cancelHref="/categories"
          parents={parents}
          defaults={{
            name: category.name,
            type: category.type,
            icon: category.icon ?? DEFAULT_CATEGORY_ICON,
            color: category.color ?? DEFAULT_CATEGORY_COLOR,
            parentId: category.parentId ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
