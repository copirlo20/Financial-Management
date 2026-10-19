import type { Metadata } from "next";
import Link from "next/link";
import type { AccountsView } from "@fm/backend/views/accounts";
import { formatMoney } from "@fm/shared/currencies";
import { ACCOUNT_TYPE_LABELS } from "@fm/shared/labels";
import { archiveAccount, createAccount, restoreAccount } from "@/app/actions/accounts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { AccountForm } from "./account-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tài khoản") };
}

export default async function AccountsPage() {
  const { t, locale } = await getI18n();
  const user = await requireUser();

  const { accounts, totals, converted } = await apiLoad<AccountsView>("/accounts");
  const active = accounts.filter((account) => !account.archivedAt);
  const archived = accounts.filter((account) => account.archivedAt);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Tài khoản")}</h1>

      {totals.length > 0 && (
        <section aria-label={t("Tổng số dư")} className="flex flex-wrap gap-3">
          {totals.map((total) => (
            <div key={total.currency} className="rounded-lg border bg-card shadow-xs px-4 py-3">
              <p className="text-xs text-muted-foreground">{t("Tổng {0}", total.currency)}</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney(total.total.toString(), total.currency, locale)}
              </p>
            </div>
          ))}
          {converted && (
            <div className="rounded-lg border bg-card shadow-xs px-4 py-3">
              <p className="text-xs text-muted-foreground">{t("Tổng quy đổi sang {0}", user.defaultCurrency)}</p>
              <p className="text-lg font-semibold tabular-nums">
                ≈ {formatMoney(converted.total.toString(), user.defaultCurrency, locale)}
              </p>
              {converted.missing.length > 0 && (
                <p className="text-xs text-muted-foreground">{t("Chưa gồm {0} (chưa có tỷ giá)", converted.missing.join(", "))}</p>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] *:min-w-0">
        <section className="grid gap-3 *:min-w-0">
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">{t("Bạn chưa có tài khoản nào. Hãy thêm ví tiền mặt hoặc tài khoản ngân hàng đầu tiên.")}</p>
          ) : (
            <ul className="grid gap-3 *:min-w-0">
              {active.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card shadow-xs p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(ACCOUNT_TYPE_LABELS[account.type])} · {account.currency}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-2 font-semibold tabular-nums">
                      {formatMoney(account.currentBalance.toString(), account.currency, locale)}
                    </p>
                    <Link
                      href={`/accounts/${account.id}/edit`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >{t("Sửa")}</Link>
                    <form action={archiveAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <Button type="submit" variant="ghost" size="sm">{t("Lưu trữ")}</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {archived.length > 0 && (
            <details className="rounded-lg border bg-card shadow-xs p-4">
              <summary className="cursor-pointer py-1.5 text-sm font-medium">{t("Đã lưu trữ ({0})", archived.length)}
              </summary>
              <ul className="mt-3 grid gap-3">
                {archived.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 text-muted-foreground">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="text-sm tabular-nums">
                        {formatMoney(account.currentBalance.toString(), account.currency, locale)}
                      </p>
                    </div>
                    <form action={restoreAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <Button type="submit" variant="outline" size="sm">{t("Khôi phục")}</Button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t("Thêm tài khoản")}</CardTitle>
            <CardDescription>{t("Tiền mặt, ngân hàng, ví điện tử hoặc thẻ tín dụng.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountForm
              action={createAccount}
              mode="create"
              defaults={{ name: "", type: "CASH", currency: user.defaultCurrency, initialBalance: "0" }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
