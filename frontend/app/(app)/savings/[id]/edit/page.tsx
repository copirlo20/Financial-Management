import type { Metadata } from "next";
import type { SavingsGoalView } from "@fm/backend/views/savings";
import { dateToIsoDate } from "@fm/shared/dates";
import { updateGoal } from "@/app/actions/savings";
import { NotFoundMessage } from "@/components/not-found-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { GoalForm } from "../../goal-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sửa mục tiêu") };
}

export default async function EditSavingsGoalPage({ params }: PageProps<"/savings/[id]/edit">) {
  const { t } = await getI18n();
  await requireUser();

  const goal = await apiGet<SavingsGoalView>(`/savings/${encodeURIComponent((await params).id)}`);
  if (!goal) return <NotFoundMessage />;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("Sửa mục tiêu")}</CardTitle>
      </CardHeader>
      <CardContent>
        <GoalForm
          action={updateGoal.bind(null, goal.id)}
          mode="edit"
          cancelHref={`/savings/${goal.id}`}
          defaults={{
            name: goal.name,
            targetAmount: goal.targetAmount.toString(),
            currency: goal.currency,
            deadline: goal.deadline ? dateToIsoDate(goal.deadline) : "",
          }}
        />
      </CardContent>
    </Card>
  );
}
