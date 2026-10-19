import type { Metadata } from "next";
import Link from "next/link";
import type { SavingsView } from "@fm/backend/views/savings";
import { createGoal } from "@/app/actions/savings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { GoalForm } from "./goal-form";
import { GoalProgress } from "./goal-progress";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Mục tiêu tiết kiệm") };
}

export default async function SavingsPage() {
  const { t } = await getI18n();
  const user = await requireUser();

  const goals = await apiLoad<SavingsView>("/savings");
  const active = goals.filter((goal) => goal.status !== "ARCHIVED");
  const archived = goals.filter((goal) => goal.status === "ARCHIVED");

  const goalList = (items: typeof goals) => (
    <ul className="grid gap-3 sm:grid-cols-2 *:min-w-0">
      {items.map((goal) => (
        <li key={goal.id} className="grid gap-3 rounded-lg border bg-card shadow-xs p-4">
          <Link href={`/savings/${goal.id}`} className="truncate font-medium underline-offset-4 hover:underline">
            {goal.name}
          </Link>
          <GoalProgress goal={goal} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Mục tiêu tiết kiệm")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] *:min-w-0">
        <section className="grid gap-4 *:min-w-0">
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">{t("Chưa có mục tiêu nào. Đặt một mục tiêu để theo dõi số tiền bạn để dành.")}</p>
          ) : (
            goalList(active)
          )}
          {archived.length > 0 && (
            <details className="rounded-lg border bg-card shadow-xs p-4">
              <summary className="cursor-pointer py-1.5 text-sm font-medium">{t("Đã lưu trữ ({0})", archived.length)}</summary>
              <div className="mt-3">{goalList(archived)}</div>
            </details>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("Thêm mục tiêu")}</CardTitle>
            <CardDescription>{t("Mục tiêu chỉ để theo dõi số tiền để dành, không làm thay đổi số dư các tài khoản.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <GoalForm
              action={createGoal}
              mode="create"
              defaults={{ name: "", targetAmount: "", currency: user.defaultCurrency, deadline: "" }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
