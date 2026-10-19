import { ArrowDownLeft, ArrowUpRight, FileUp, PieChart, PiggyBank, Plus, Scale, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { DashboardView } from "@fm/backend/views/overview";
import { formatMoney } from "@fm/shared/currencies";
import { monthLabel, shiftMonth } from "@fm/shared/months";
import { BudgetProgress } from "@/components/budget-progress";
import { ChartTable } from "@/components/chart-table";
import { TransactionAmount, TransactionDetails, TransactionIcon } from "@/components/transaction-parts";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { CategoryChart, TrendChart } from "./charts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tổng quan") };
}

const MONTH_LINK = "rounded-full bg-white/15 px-3 py-1.5 whitespace-nowrap transition-colors hover:bg-white/25";
const SHORTCUTS = [
  { href: "/transactions", label: "Thêm giao dịch", icon: Plus },
  { href: "/imports", label: "Nhập sao kê", icon: FileUp },
  { href: "/budgets", label: "Ngân sách", icon: PieChart },
  { href: "/savings", label: "Tiết kiệm", icon: PiggyBank },
];

// A figure on the balance card.
function StatTile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="flex items-center gap-2 text-sm text-white/80">
        <span className="flex size-6 items-center justify-center rounded-full bg-white/15">
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold wrap-break-word tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-sm text-white/75">{note}</p>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const { month, thisMonth, trendMonths, report, trend, statuses, recent, converted } = await apiLoad<DashboardView>(
    "/dashboard",
    { month: (await searchParams).month },
  );
  const currency = user.defaultCurrency;
  const money = (amount: { toString(): string }) => formatMoney(amount.toString(), currency, locale);

  const alerts = statuses.filter((budget) => budget.state !== "ok");
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const hasTrend = trend.some((point) => !point.income.isZero() || !point.expense.isZero());
  const shortMonth = (value: string) => t("T{0}/{1}", Number(value.slice(5)), value.slice(2, 4));

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-lg shadow-primary/20 sm:p-7">
        <span aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-white/5" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{t("Xin chào, {0}", user.name)}</h1>
            <p className="text-sm text-white/75">{t("Tổng quan {0} · quy về {1}", monthLabel(month, t).toLowerCase(), currency)}</p>
          </div>
          <nav aria-label={t("Chọn tháng")} className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Link href={`/dashboard?month=${shiftMonth(month, -1)}`} className={MONTH_LINK}>
              ← {monthLabel(shiftMonth(month, -1), t)}
            </Link>
            {month !== thisMonth && (
              <>
                <Link href="/dashboard" className={MONTH_LINK}>{t("Tháng này")}</Link>
                <Link href={`/dashboard?month=${shiftMonth(month, 1)}`} className={MONTH_LINK}>
                  {monthLabel(shiftMonth(month, 1), t)} →
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="relative mt-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="balances" className="text-sm font-medium text-white/75">{t("Số dư hiện tại")}</h2>
            <Link href="/accounts" className="rounded-full text-xs font-medium text-white/90 underline underline-offset-4 hover:text-white">
              {t("Xem tài khoản")}
            </Link>
          </div>
          {report.balances.length === 0 ? (
            <p className="mt-1 text-white/90">{t("Bạn chưa có tài khoản nào.")}</p>
          ) : (
            <div aria-labelledby="balances" role="group" className="mt-1 flex flex-wrap gap-x-8 gap-y-3">
              {report.balances.map((balance) => (
                <div key={balance.currency} className="min-w-0">
                  <p className="text-xs text-white/70">{t("Tổng {0}", balance.currency)}</p>
                  <p className="text-2xl font-bold tabular-nums wrap-anywhere sm:text-3xl">
                    {formatMoney(balance.total.toString(), balance.currency, locale)}
                  </p>
                </div>
              ))}
              {converted && (
                <div className="min-w-0">
                  <p className="text-xs text-white/70">{t("Tổng quy đổi sang {0}", currency)}</p>
                  <p className="text-2xl font-bold tabular-nums wrap-anywhere sm:text-3xl">
                    ≈ {formatMoney(converted.total.toString(), currency, locale)}
                  </p>
                  {converted.missing.length > 0 && (
                    <p className="text-xs text-white/70">{t("Chưa gồm {0} (chưa có tỷ giá)", converted.missing.join(", "))}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div role="group" aria-label={t("Số liệu chính")} className="relative mt-6 grid gap-3 sm:grid-cols-3 *:min-w-0">
          <StatTile icon={ArrowDownLeft} label={t("Thu nhập")} value={money(report.income)} />
          <StatTile icon={ArrowUpRight} label={t("Chi tiêu")} value={money(report.expense)} />
          <StatTile
            icon={Scale}
            label={t("Chênh lệch thu − chi")}
            value={money(report.net)}
            note={report.net.isNegative() ? t("Chi nhiều hơn thu") : report.net.isZero() ? undefined : t("Thu nhiều hơn chi")}
          />
        </div>
      </section>
      {report.unconvertedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("{0} giao dịch ngoại tệ trong tháng chưa có tỷ giá quy đổi nên chưa được tính vào các số liệu trên.", report.unconvertedCount)}</p>
      )}

      <nav aria-label={t("Lối tắt")} className="grid grid-cols-4 gap-2 sm:gap-3 *:min-w-0">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-1 py-3 text-center text-xs font-medium shadow-xs transition-colors hover:border-primary/40 hover:bg-accent sm:text-sm"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="wrap-anywhere">{t(label)}</span>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-2 *:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("Chi tiêu theo danh mục")}</CardTitle>
            <CardDescription>{t("{0}, danh mục con được gộp vào danh mục cha.", monthLabel(month, t))}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {report.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Chưa có khoản chi nào trong tháng này.")}</p>
            ) : (
              <>
                <CategoryChart
                  currency={currency}
                  data={report.expenseByCategory.map((entry) => ({
                    name: entry.name,
                    total: entry.total.toNumber(),
                    label: compact.format(entry.total.toNumber()),
                  }))}
                />
                <ChartTable
                  summary={t("Xem dạng bảng")}
                  columns={[t("Danh mục"), t("Đã chi"), t("Tỷ trọng")]}
                  rows={report.expenseByCategory.map((entry) => ({
                    key: entry.name,
                    cells: [entry.name, money(entry.total), `${Math.round(entry.total.div(report.expense).mul(100).toNumber())}%`],
                  }))}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Thu và chi {0} tháng gần nhất", trendMonths)}</CardTitle>
            <CardDescription>{t("Từ {0} đến {1}.", monthLabel(trend[0].month, t).toLowerCase(), monthLabel(month, t).toLowerCase())}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!hasTrend ? (
              <p className="text-sm text-muted-foreground">{t("Chưa có giao dịch nào trong khoảng thời gian này.")}</p>
            ) : (
              <>
                <TrendChart
                  currency={currency}
                  data={trend.map((point) => ({
                    label: shortMonth(point.month),
                    income: point.income.toNumber(),
                    expense: point.expense.toNumber(),
                  }))}
                />
                <ChartTable
                  summary={t("Xem dạng bảng")}
                  columns={[t("Tháng"), t("Thu nhập"), t("Chi tiêu"), t("Chênh lệch")]}
                  rows={trend.map((point) => ({
                    key: point.month,
                    cells: [monthLabel(point.month, t), money(point.income), money(point.expense), money(point.income.minus(point.expense))],
                  }))}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Giao dịch gần đây")}</CardTitle>
          <CardAction>
            <Link href="/transactions" className={buttonVariants({ variant: "outline", size: "sm" })}>{t("Xem tất cả")}</Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Chưa có giao dịch nào.")}</p>
          ) : (
            <ul className="grid divide-y *:min-w-0">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <TransactionIcon row={row} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.type === "TRANSFER" ? t("Chuyển khoản") : row.category ? t(row.category.name) : t("Chưa phân loại")}
                    </p>
                    <TransactionDetails row={row} />
                  </div>
                  <TransactionAmount row={row} locale={locale} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="budget-alerts" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="budget-alerts" className="text-lg font-medium">{t("Cảnh báo ngân sách {0}", month === thisMonth ? t("tháng này") : monthLabel(month, t).toLowerCase())}
          </h2>
          <Link href={`/budgets?month=${month}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("Xem ngân sách")}</Link>
        </div>
        {alerts.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            {alerts.map((budget) => (
              <li key={budget.id}>
                <BudgetProgress budget={budget} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {statuses.length === 0
              ? t("Bạn chưa đặt ngân sách nào cho tháng này.")
              : t("Cả {0} ngân sách đều đang trong hạn mức.", statuses.length)}
          </p>
        )}
      </section>
    </>
  );
}
