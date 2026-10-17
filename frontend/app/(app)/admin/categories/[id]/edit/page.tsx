import type { Metadata } from "next";
import type { AdminCategoryView } from "@fm/backend/views/categories";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "@fm/shared/category-icons";
import { updateSystemCategory } from "@/app/actions/admin-categories";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireAdmin } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { CategoryForm } from "../../../../categories/category-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa danh mục mặc định") };
}

export default async function EditSystemCategoryPage({ params }: PageProps<"/admin/categories/[id]/edit">) {
  const { t } = await getI18n();
  await requireAdmin();

  const category = await apiGet<AdminCategoryView>(`/admin/categories/${encodeURIComponent((await params).id)}`);
  if (!category) return <NotFoundMessage />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa danh mục mặc định")}</CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryForm
          action={updateSystemCategory.bind(null, category.id)}
          mode="edit"
          withSystemKey
          cancelHref="/admin/categories"
          defaults={{
            systemKey: category.systemKey ?? "",
            name: category.name,
            type: category.type,
            icon: category.icon ?? DEFAULT_CATEGORY_ICON,
            color: category.color ?? DEFAULT_CATEGORY_COLOR,
          }}
        />
      </CardContent>
    </Card>
  );
}
