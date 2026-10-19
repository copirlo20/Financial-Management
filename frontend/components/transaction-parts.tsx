import { ArrowLeftRight } from "lucide-react";
import { cn } from "cn";
import { formatMoney } from "@fm/shared/currencies";
import { formatDate } from "@fm/shared/dates";
import { CategoryBadge } from "@/components/category-icon";

// The pieces of a transaction row, the same wherever transactions are listed (dashboard, transactions page).

type TransactionRow = {
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  transferDirection: "IN" | "OUT" | null;
  amount: { toString(): string };
  currency: string;
  date: Date;
  note: string | null;
  account: { name: string };
  category: { icon: string | null; color: string | null } | null;
};

// Money coming in: income, or the receiving side of a transfer.
function isInflow(row: Pick<TransactionRow, "type" | "transferDirection">): boolean {
  return row.type === "INCOME" || (row.type === "TRANSFER" && row.transferDirection === "IN");
}

// A transfer's arrows, otherwise the category's own icon and colour.
export function TransactionIcon({ row }: { row: TransactionRow }) {
  if (row.type === "TRANSFER") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ArrowLeftRight className="size-4" aria-hidden />
      </span>
    );
  }
  return <CategoryBadge icon={row.category?.icon ?? null} color={row.category?.color ?? null} />;
}

// The second line: date · account · note.
export function TransactionDetails({ row }: { row: TransactionRow }) {
  return (
    <p className="truncate text-sm text-muted-foreground">
      {formatDate(row.date)} · {row.account.name}
      {row.note ? ` · ${row.note}` : ""}
    </p>
  );
}

// The amount with its direction: "+" in green for money in, "−" for money out.
export function TransactionAmount({ row, locale, className }: { row: TransactionRow; locale: string; className?: string }) {
  const inflow = isInflow(row);
  return (
    <p className={cn("font-semibold tabular-nums", inflow && "text-emerald-600 dark:text-emerald-400", className)}>
      {inflow ? "+" : "−"}
      {formatMoney(row.amount.toString(), row.currency, locale)}
    </p>
  );
}
