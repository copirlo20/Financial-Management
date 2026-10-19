import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { TransactionsView } from "@fm/backend/views/transactions";
import { formatMoney } from "@fm/shared/currencies";
import { isStatementError } from "@fm/shared/reports";
import { formatDate, todayIsoDate } from "@fm/shared/dates";
import { createTransaction, deleteTransaction } from "@/app/actions/transactions";
import { CategoryBadge } from "@/components/category-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { DateInput } from "@/components/date-input";
import { NativeSelect } from "@/components/native-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { TransactionForm } from "./transaction-form";
import { StatementForm } from "./statement-form";
import { TransferForm } from "./transfer-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Giao dịch") };
}

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const query = await searchParams;
  const { filter, pageSize, accounts, categoryOptions, total, transactions, transferSides } =
    await apiLoad<TransactionsView>("/transactions", query);
  // Set by the statement download when the server refused it.
  const statementError = isStatementError(query.statementError) ? query.statementError : null;
  const counterpart = (groupId: string | null, direction: "OUT" | "IN" | null) =>
    transferSides.find((side) => side.transferGroupId === groupId && side.transferDirection !== direction)?.account
      .name ?? "?";

  const activeAccounts = accounts
    .filter((account) => !account.archivedAt)
    .map(({ id, name, currency }) => ({ id, name, currency }));
  const today = todayIsoDate();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilter = Boolean(filter.accountId || filter.categoryId || filter.type || filter.from || filter.to);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const key of ["accountId", "categoryId", "type", "from", "to"] as const) {
      if (filter[key]) params.set(key, filter[key]);
    }
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/transactions?${query}` : "/transactions";
  };

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Giao dịch")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
        <section className="grid gap-4 [&>*]:min-w-0">
          <details open={hasFilter} className="rounded-lg border bg-card shadow-xs p-4">
            <summary className="cursor-pointer py-1.5 text-sm font-medium">{t("Bộ lọc")}</summary>
            {/* next/form: filtering is a client-side navigation (a plain GET form reloads the whole page, and so
                does going Back to it). Without JavaScript it still works as an ordinary GET form. The key gives
                the fields their starting values again when the filter in the address changes (Back, "Xóa lọc"). */}
            <Form key={JSON.stringify(filter)} action="/transactions" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            <div className="grid gap-1.5">
              <Label htmlFor="f-account">{t("Tài khoản")}</Label>
              <NativeSelect id="f-account" name="accountId" defaultValue={filter.accountId ?? ""}>
                <option value="">{t("Tất cả")}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.archivedAt ? t(" (đã lưu trữ)") : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-category">{t("Danh mục")}</Label>
              <NativeSelect id="f-category" name="categoryId" defaultValue={filter.categoryId ?? ""}>
                <option value="">{t("Tất cả")}</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-type">{t("Loại")}</Label>
              <NativeSelect id="f-type" name="type" defaultValue={filter.type ?? ""}>
                <option value="">{t("Tất cả")}</option>
                <option value="EXPENSE">{t("Khoản chi")}</option>
                <option value="INCOME">{t("Khoản thu")}</option>
                <option value="TRANSFER">{t("Chuyển khoản")}</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-from">{t("Từ ngày")}</Label>
              <DateInput id="f-from" name="from" defaultValue={filter.from ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-to">{t("Đến ngày")}</Label>
              <DateInput id="f-to" name="to" defaultValue={filter.to ?? ""} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="outline">{t("Lọc")}</Button>
              {hasFilter && (
                <Link href="/transactions" className={buttonVariants({ variant: "ghost" })}>{t("Xóa lọc")}</Link>
              )}
            </div>
          </Form>
          </details>

          {transactions.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
              {hasFilter ? t("Không có giao dịch nào khớp bộ lọc.") : t("Chưa có giao dịch nào.")}
            </p>
          ) : (
            <ul className="grid gap-2 [&>*]:min-w-0">
              {transactions.map((row) => {
                const isTransfer = row.type === "TRANSFER";
                const inflow = row.type === "INCOME" || (isTransfer && row.transferDirection === "IN");
                const title = isTransfer
                  ? row.transferDirection === "OUT"
                    ? t("Chuyển đến {0}", counterpart(row.transferGroupId, "OUT"))
                    : t("Nhận từ {0}", counterpart(row.transferGroupId, "IN"))
                  : (row.category ? t(row.category.name) : t("Chưa phân loại"));
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card shadow-xs p-3">
                    {isTransfer ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ArrowLeftRight className="size-4" aria-hidden />
                      </span>
                    ) : (
                      <CategoryBadge icon={row.category?.icon ?? null} color={row.category?.color ?? null} />
                    )}
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate font-medium">{title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatDate(row.date)} · {row.account.name}
                        {row.note ? ` · ${row.note}` : ""}
                      </p>
                    </div>
                    <p className={`font-semibold tabular-nums ${inflow ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                      {inflow ? "+" : "−"}
                      {formatMoney(row.amount.toString(), row.currency, locale)}
                    </p>
                    <div className="flex items-center gap-1">
                      {!isTransfer && (
                        <Link
                          href={`/transactions/${row.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >{t("Sửa")}</Link>
                      )}
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={row.id} />
                        <ConfirmButton variant="ghost" size="sm" confirmMessage={t("Xóa giao dịch này?")} confirmLabel={t("Xóa")} confirmIcon="trash">{t("Xóa")}</ConfirmButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav aria-label={t("Phân trang")} className="flex items-center justify-between gap-3 text-sm">
              {filter.page > 1 ? (
                <Link href={pageHref(filter.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("Trang trước")}</Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">{t("Trang {0}/{1} · {2} giao dịch", filter.page, totalPages, total)}</span>
              {filter.page < totalPages ? (
                <Link href={pageHref(filter.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("Trang sau")}</Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>

        {activeAccounts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("Chưa có tài khoản")}</CardTitle>
              <CardDescription>{t("Bạn cần ít nhất một tài khoản để ghi giao dịch.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/accounts" className={buttonVariants()}>{t("Thêm tài khoản")}</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("Thêm giao dịch")}</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionForm
                  action={createTransaction}
                  mode="create"
                  accounts={activeAccounts}
                  categories={categoryOptions}
                  defaults={{
                    type: "EXPENSE",
                    accountId: activeAccounts[0].id,
                    categoryId: categoryOptions.find((category) => category.type === "EXPENSE")?.id ?? "",
                    amount: "",
                    date: today,
                    note: "",
                  }}
                />
              </CardContent>
            </Card>

            {activeAccounts.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("Chuyển khoản")}</CardTitle>
                  <CardDescription>{t("Chuyển tiền giữa hai tài khoản của bạn.")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TransferForm
                    accounts={activeAccounts}
                    defaults={{
                      fromAccountId: activeAccounts[0].id,
                      toAccountId: activeAccounts[1].id,
                      date: today,
                    }}
                  />
                </CardContent>
              </Card>
            )}

            <Card id="statement">
              <CardHeader>
                <CardTitle>{t("Xuất sao kê PDF")}</CardTitle>
                <CardDescription>
                  {t("Sao kê theo mẫu ngân hàng: số dư đầu kỳ, ghi nợ, ghi có và từng giao dịch trong khoảng thời gian bạn chọn.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatementForm
                  accounts={accounts.map(({ id, name, currency, archivedAt }) => ({ id, name, currency, archived: Boolean(archivedAt) }))}
                  defaultCurrency={user.defaultCurrency}
                  defaults={{ from: `${today.slice(0, 8)}01`, to: today }}
                  error={statementError}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
