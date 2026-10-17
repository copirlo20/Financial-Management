import type Decimal from "decimal.js";
import { formatMoney } from "@fm/shared/currencies";
import { formatDate } from "@fm/shared/dates";
import { GOAL_STATUS_LABELS, type SavingsGoalStatus } from "@fm/shared/labels";
import { getI18n } from "@/lib/i18n/server";
import { goalProgress } from "@/lib/savings";

type Props = {
  goal: {
    name: string;
    targetAmount: Decimal;
    currentAmount: Decimal;
    currency: string;
    deadline: Date | null;
    status: SavingsGoalStatus;
  };
};

export async function GoalProgress({ goal }: Props) {
  const { t, locale } = await getI18n();
  const { percent, remaining, reached, deadlineNote } = goalProgress(goal, t, locale);
  const rounded = Math.floor(percent);

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground tabular-nums">
        {formatMoney(goal.currentAmount.toString(), goal.currency, locale)} /{" "}
        {formatMoney(goal.targetAmount.toString(), goal.currency, locale)}
      </p>
      <div
        role="progressbar"
        aria-label={t("Tiến độ mục tiêu {0}", goal.name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(rounded, 100)}
        aria-valuetext={`${rounded}%`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full ${reached ? "bg-emerald-600 dark:bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className={`text-sm ${reached ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
        {rounded}% ·{" "}
        {reached
          ? t(GOAL_STATUS_LABELS.COMPLETED)
          : t("Còn thiếu {0}", formatMoney(remaining.toString(), goal.currency, locale))}
        {goal.status === "ARCHIVED" && ` · ${t(GOAL_STATUS_LABELS.ARCHIVED)}`}
      </p>
      {goal.deadline && (
        <p className="text-sm text-muted-foreground">{t("Hạn chót {0}", formatDate(goal.deadline, locale))}
          {deadlineNote && ` · ${deadlineNote}`}
        </p>
      )}
    </div>
  );
}
