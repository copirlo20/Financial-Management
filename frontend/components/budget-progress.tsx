import { Wallet } from "lucide-react";
import type { BudgetStatus } from "@fm/backend/data/budgets";
import { formatMoney } from "@fm/shared/currencies";
import type { Translate } from "@fm/shared/i18n/translate";
import { CategoryBadge } from "@/components/category-icon";
import { getI18n } from "@/lib/i18n/server";

const STATE_STYLES = {
  ok: { bar: "bg-primary", text: "text-muted-foreground" },
  near: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  over: { bar: "bg-destructive", text: "text-destructive" },
} as const;

function budgetStateLabel(budget: BudgetStatus, t: Translate, locale: string): string {
  if (budget.state === "over") {
    return t("Vượt hạn mức {0}", formatMoney(budget.spent.minus(budget.limit).toString(), budget.currency, locale));
  }
  const remaining = t("Còn {0}", formatMoney(budget.limit.minus(budget.spent).toString(), budget.currency, locale));
  return budget.state === "near" ? t("Sắp chạm hạn mức · {0}", remaining) : remaining;
}

export async function BudgetProgress({ budget, children }: { budget: BudgetStatus; children?: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const styles = STATE_STYLES[budget.state];
  const percent = Math.round(budget.percent);

  return (
    <div className="grid gap-2 rounded-lg border bg-card shadow-xs p-3 [&>*]:min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {budget.categoryId ? (
          <CategoryBadge icon={budget.icon} color={budget.color} />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wallet className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-medium">{budget.name}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatMoney(budget.spent.toString(), budget.currency, locale)} / {formatMoney(budget.limit.toString(), budget.currency, locale)}
          </p>
        </div>
        {children}
      </div>
      <div
        role="progressbar"
        aria-label={t("Đã dùng ngân sách {0}", budget.name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
        aria-valuetext={`${percent}%`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={`h-full ${styles.bar}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} />
      </div>
      <p className={`text-sm ${styles.text}`}>
        {percent}% · {budgetStateLabel(budget, t, locale)}
      </p>
    </div>
  );
}
