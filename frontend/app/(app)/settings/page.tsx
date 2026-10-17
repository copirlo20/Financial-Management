import type { Metadata } from "next";
import type { SettingsView } from "@fm/backend/views/overview";
import { RATE_PROVIDER } from "@fm/shared/rates";
import { logoutEverywhere } from "@/app/actions/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemeChooser } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiLoad } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";
import { PasswordForm } from "./password-form";
import { RefreshRatesButton } from "./refresh-rates-button";
import { SettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Cài đặt") };
}

export default async function SettingsPage() {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const { status, rates } = await apiLoad<SettingsView>("/settings");
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

  // Rates need more precision than money: 1 KRW is about 19.31 VND, which a currency format would round to 19.
  const rateFormat = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: value < 1 ? 6 : value < 1000 ? 4 : 2 }).format(value);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Cài đặt")}</h1>

      <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("Hồ sơ")}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              defaults={{ name: user.name, language: user.locale, defaultCurrency: user.defaultCurrency }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Giao diện")}</CardTitle>
            <CardDescription>{t("Chọn giao diện sáng, tối hoặc theo cài đặt của thiết bị. Lựa chọn được lưu trên thiết bị này.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeChooser />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Tỷ giá")}</CardTitle>
            <CardDescription>
              {status ? t("Cập nhật lúc {0}.", dateTime.format(status.fetchedAt)) : t("Chưa có tỷ giá nào được lưu.")}{" "}{t("Nguồn cập nhật mỗi ngày một lần.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <table className="w-full text-sm">
              <tbody>
                {rates.map(({ currency, rate }) => (
                  <tr key={currency} className="border-t first:border-t-0">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      1 {currency}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {rate ? `${rateFormat(rate.toNumber())} ${user.defaultCurrency}` : t("Chưa có tỷ giá")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <RefreshRatesButton />
            <p className="text-xs text-muted-foreground">{t("Tỷ giá từ")}{" "}
              <a href={RATE_PROVIDER.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {RATE_PROVIDER.name}
              </a>{t(". Chỉ để tham khảo, có thể khác tỷ giá ngân hàng của bạn.")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Bảo mật")}</CardTitle>
            <CardDescription>{t("Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác.")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <PasswordForm />
            <form action={logoutEverywhere} className="grid gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {t("Nghi có người khác đang dùng tài khoản? Kết thúc mọi phiên đăng nhập, kể cả trên thiết bị này.")}
              </p>
              <ConfirmButton
                variant="outline"
                className="justify-self-start text-destructive hover:text-destructive"
                confirmMessage={t("Đăng xuất khỏi mọi thiết bị?")}
                confirmDetail={t("Kể cả thiết bị này. Bạn sẽ phải đăng nhập lại trên mọi thiết bị.")}
                confirmLabel={t("Đăng xuất")}
                confirmIcon="logout"
                confirmTone="default"
              >
                {t("Đăng xuất khỏi mọi thiết bị")}
              </ConfirmButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
