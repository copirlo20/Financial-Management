import type { Metadata } from "next";
import Link from "next/link";
import type { SavingsGoalView } from "@fm/backend/views/savings";
import { formatMoney } from "@fm/shared/currencies";
import { formatDate, todayIsoDate } from "@fm/shared/dates";
import { addContribution, archiveGoal, deleteGoal, restoreGoal } from "@/app/actions/savings";
import { ConfirmButton } from "@/components/confirm-button";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { NotFoundMessage } from "@/components/not-found-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { GoalProgress } from "../goal-progress";
import { ContributionForm } from "./contribution-form";
import { DeleteContributionButton } from "./delete-contribution-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Mục tiêu tiết kiệm") };
}

export default async function SavingsGoalPage({ params }: PageProps<"/savings/[id]">) {
  const { t, locale } = await getI18n();
  await requireUser();

  const goal = await apiGet<SavingsGoalView>(`/savings/${encodeURIComponent((await params).id)}`);
  if (!goal) return <NotFoundMessage />;
  const archived = goal.status === "ARCHIVED";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/savings" className="text-sm text-muted-foreground underline-offset-4 hover:underline">{t("← Mục tiêu tiết kiệm")}</Link>
          <h1 className="truncate text-2xl font-semibold">{goal.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/savings/${goal.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("Sửa")}</Link>
          <form action={archived ? restoreGoal : archiveGoal}>
            <input type="hidden" name="id" value={goal.id} />
            <Button type="submit" variant="outline" size="sm">
              {archived ? t("Khôi phục") : t("Lưu trữ")}
            </Button>
          </form>
          <form action={deleteGoal}>
      <FormNavigationMarker />
            <input type="hidden" name="id" value={goal.id} />
            <ConfirmButton
              variant="ghost"
              size="sm"
              confirmMessage={t("Xóa mục tiêu này?")}
              confirmSubject={goal.name}
              confirmDetail={t("Toàn bộ lịch sử gửi/rút của mục tiêu cũng bị xóa. Thao tác này không thể hoàn tác.")}
              confirmLabel={t("Xóa")}
              confirmIcon="trash"
            >{t("Xóa mục tiêu")}</ConfirmButton>
          </form>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-xs p-4">
        <GoalProgress goal={goal} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
        <section className="grid gap-3 [&>*]:min-w-0">
          <h2 className="text-lg font-medium">{t("Lịch sử nạp và rút")}</h2>
          {goal.contributions.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">{t("Chưa có khoản nào. Ghi nhận lần nạp đầu tiên của bạn.")}</p>
          ) : (
            <ul className="grid gap-2 [&>*]:min-w-0">
              {goal.contributions.map((contribution) => {
                const deposit = contribution.amount.isPositive();
                return (
                  <li
                    key={contribution.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card shadow-xs p-3"
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-medium">{deposit ? t("Nạp thêm") : t("Rút ra")}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatDate(contribution.date, locale)}
                        {contribution.note ? ` · ${contribution.note}` : ""}
                      </p>
                    </div>
                    <p className={`font-semibold tabular-nums ${deposit ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                      {deposit ? "+" : "−"}
                      {formatMoney(contribution.amount.abs().toString(), goal.currency, locale)}
                    </p>
                    <DeleteContributionButton id={contribution.id} />
                  </li>
                );
              })}
            </ul>
          )}
          {goal._count.contributions > goal.historyLimit && (
            <p className="text-sm text-muted-foreground">{t("Đang hiện {0} khoản gần nhất trong tổng số {1}.", goal.historyLimit, goal._count.contributions)}
            </p>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("Ghi nhận nạp / rút")}</CardTitle>
            {archived && <CardDescription>{t("Mục tiêu đã lưu trữ. Khôi phục để ghi thêm.")}</CardDescription>}
          </CardHeader>
          {!archived && (
            <CardContent>
              <ContributionForm
                action={addContribution.bind(null, goal.id)}
                currency={goal.currency}
                today={todayIsoDate()}
              />
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
