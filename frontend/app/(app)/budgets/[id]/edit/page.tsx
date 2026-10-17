import type { Metadata } from "next";
import type { BudgetView } from "@fm/backend/views/budgets";
import { dateToIsoDate } from "@fm/shared/dates";
import { monthLabel } from "@fm/shared/months";
import { updateBudget } from "@/app/actions/budgets";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { BudgetForm } from "../../budget-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa ngân sách") };
}

export default async function EditBudgetPage({ params }: PageProps<"/budgets/[id]/edit">) {
  const { t } = await getI18n();
  await requireUser();

  const budget = await apiGet<BudgetView>(`/budgets/${encodeURIComponent((await params).id)}`);
  if (!budget) return <NotFoundMessage />;

  const month = dateToIsoDate(budget.periodStart).slice(0, 7);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa ngân sách")}</CardTitle>
        <CardDescription>
          {t("{0} · {1}", budget.category ? t(budget.category.name) : t("Tổng chi tiêu"), monthLabel(month, t).toLowerCase())}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BudgetForm
          action={updateBudget.bind(null, budget.id)}
          currency={budget.currency}
          defaults={{ amountLimit: budget.amountLimit.toString() }}
          cancelHref={`/budgets?month=${month}`}
        />
      </CardContent>
    </Card>
  );
}
