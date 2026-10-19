import type { Metadata } from "next";
import type { AdminExchangeRatesView } from "@fm/backend/views/exchange-rates";
import { formatDate } from "@fm/shared/dates";
import { QUOTE_CURRENCIES } from "@fm/shared/rates";
import { RATE_BASE } from "@fm/shared/rates";
import { deleteManualRate } from "@/app/actions/admin-exchange-rates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireAdmin } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { RateForm } from "./rate-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Quản trị tỷ giá") };
}

export default async function AdminExchangeRatesPage() {
  const { t, locale } = await getI18n();
  await requireAdmin();
  const { latest, manual, today } = await apiLoad<AdminExchangeRatesView>("/admin/exchange-rates");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{t("Quản trị tỷ giá")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Mọi tỷ giá được lưu theo dạng 1 {0} = bao nhiêu đơn vị tiền kia. Dùng chung cho mọi người dùng.", RATE_BASE)}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem] *:min-w-0">
        <div className="grid gap-6">
          <section className="grid gap-3 *:min-w-0">
            <h2 className="text-lg font-medium">{t("Tỷ giá mới nhất")}</h2>
            <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1.5 font-normal">{t("Tiền tệ")}</th>
                  <th scope="col" className="py-1.5 text-right font-normal">{t("1 {0} =", RATE_BASE)}</th>
                  <th scope="col" className="py-1.5 text-right font-normal">{t("Ngày")}</th>
                  <th scope="col" className="py-1.5 text-right font-normal">{t("Nguồn")}</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((row) => (
                  <tr key={row.id} className="border-t">
                    <th scope="row" className="py-1.5 text-left font-normal">{row.quoteCurrency}</th>
                    <td className="py-1.5 text-right tabular-nums">{number.format(row.rate.toNumber())}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatDate(row.date)}</td>
                    <td className="py-1.5 text-right">{row.isManual ? t("Nhập tay") : t("Tự động")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          <section className="grid gap-3 *:min-w-0">
            <h2 className="text-lg font-medium">{t("Tỷ giá nhập tay")}</h2>
            {manual.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">
                {t("Chưa có tỷ giá nhập tay nào. Mọi tỷ giá đang lấy tự động từ nguồn.")}
              </p>
            ) : (
              <ul className="grid gap-2 *:min-w-0">
                {manual.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card shadow-xs p-3">
                    <p className="tabular-nums">
                      {t("{0} · 1 {1} = {2} {3}", formatDate(row.date), RATE_BASE, number.format(row.rate.toNumber()), row.quoteCurrency)}
                    </p>
                    <form action={deleteManualRate}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t("Xóa")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("Nhập tỷ giá")}</CardTitle>
            <CardDescription>{t("Dùng khi nguồn tự động lỗi hoặc cần tỷ giá cho một ngày trong quá khứ.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RateForm currencies={[...QUOTE_CURRENCIES]} baseCurrency={RATE_BASE} today={today} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
