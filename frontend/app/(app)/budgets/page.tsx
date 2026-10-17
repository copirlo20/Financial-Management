import type { Metadata } from "next";
import Link from "next/link";
import type { BudgetsView } from "@fm/backend/views/budgets";
import { monthLabel } from "@fm/shared/months";
import { currentMonth, shiftMonth } from "@fm/shared/months";
import { copyPreviousMonthBudgets, createBudget, deleteBudget } from "@/app/actions/budgets";
import { BudgetProgress } from "@/components/budget-progress";
import { ConfirmButton } from "@/components/confirm-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { BudgetForm } from "./budget-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Ngân sách") };
}

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const { t } = await getI18n();
  const user = await requireUser();
  const { month, statuses, unconvertedCount, availableCategories, previousCount, nearLimitPercent } =
    await apiLoad<BudgetsView>("/budgets", { month: (await searchParams).month });
  const previousMonth = shiftMonth(month, -1);
  const alerts = statuses.filter((budget) => budget.state !== "ok");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Ngân sách {0}", monthLabel(month, t).toLowerCase())}</h1>
        <nav aria-label={t("Chọn tháng")} className="flex items-center gap-2">
          <Link href={`/budgets?month=${previousMonth}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← {monthLabel(previousMonth, t)}
          </Link>
          {month !== currentMonth() && (
            <Link href="/budgets" className={buttonVariants({ variant: "ghost", size: "sm" })}>{t("Tháng này")}</Link>
          )}
          <Link
            href={`/budgets?month=${shiftMonth(month, 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {monthLabel(shiftMonth(month, 1), t)} →
          </Link>
        </nav>
      </div>

      {alerts.length > 0 && (
        <p role="alert" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          {alerts.filter((budget) => budget.state === "over").length > 0 &&
            t("{0} ngân sách đã vượt hạn mức. ", alerts.filter((budget) => budget.state === "over").length)}
          {alerts.filter((budget) => budget.state === "near").length > 0 &&
            t("{0} ngân sách đã dùng từ {1}% trở lên.", alerts.filter((budget) => budget.state === "near").length, nearLimitPercent)}
        </p>
      )}
      {unconvertedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("{0} khoản chi ngoại tệ trong tháng chưa có tỷ giá quy đổi nên chưa được tính vào ngân sách.", unconvertedCount)}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
        <section className="grid gap-3 [&>*]:min-w-0">
          {statuses.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
              <p>{t("Chưa có ngân sách nào cho {0}.", monthLabel(month, t).toLowerCase())}</p>
              {previousCount > 0 && (
                <form action={copyPreviousMonthBudgets}>
                  <input type="hidden" name="month" value={month} />
                  <Button type="submit" variant="outline">{t("Sao chép {0} ngân sách từ {1}", previousCount, monthLabel(previousMonth, t).toLowerCase())}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 [&>*]:min-w-0">
              {statuses.map((budget) => (
                <li key={budget.id}>
                  <BudgetProgress budget={budget}>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/budgets/${budget.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >{t("Sửa")}</Link>
                      <form action={deleteBudget}>
                        <input type="hidden" name="id" value={budget.id} />
                        <ConfirmButton variant="ghost" size="sm" confirmMessage={t("Xóa ngân sách này?")} confirmLabel={t("Xóa")} confirmIcon="trash">{t("Xóa")}</ConfirmButton>
                      </form>
                    </div>
                  </BudgetProgress>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("Đặt ngân sách")}</CardTitle>
            <CardDescription>{t("Hạn mức chi cho {0}.", monthLabel(month, t).toLowerCase())}</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetForm
              action={createBudget}
              currency={user.defaultCurrency}
              create={{ month, categories: availableCategories }}
              defaults={{ categoryId: statuses.some((budget) => budget.categoryId === null) ? (availableCategories[0]?.id ?? "") : "", amountLimit: "" }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
