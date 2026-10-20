import type Decimal from "decimal.js";
import { formatMoney } from "@fm/shared/currencies";
import { isoDateToDate, todayIsoDate } from "@fm/shared/dates";
import type { Translate } from "@fm/shared/i18n/translate";
import type { SavingsGoalStatus } from "@fm/shared/labels";

export type GoalNumbers = {
  targetAmount: Decimal;
  currentAmount: Decimal;
  currency: string;
  deadline: Date | null;
  status: SavingsGoalStatus;
};

export function goalProgress(goal: GoalNumbers, t: Translate, locale: string) {
  const percent = goal.currentAmount.div(goal.targetAmount).mul(100).toNumber();
  const remaining = goal.targetAmount.minus(goal.currentAmount);
  const reached = remaining.lessThanOrEqualTo(0);

  let deadlineNote: string | null = null;
  if (goal.deadline && !reached && goal.status === "IN_PROGRESS") {
    const days = Math.round((goal.deadline.getTime() - isoDateToDate(todayIsoDate()).getTime()) / 86_400_000);
    if (days < 0) {
      deadlineNote = t("Đã quá hạn {0} ngày", -days);
    } else {
      // Whole months left, counting the current one, so the suggestion never understates what is needed.
      const months = Math.max(1, Math.ceil(days / 30));
      const perMonth = remaining.div(months).toDecimalPlaces(2, 0);
      deadlineNote = t("Còn {0} ngày · cần khoảng {1} mỗi tháng", days, formatMoney(perMonth.toString(), goal.currency, locale));
    }
  }

  return { percent, remaining, reached, deadlineNote };
}
