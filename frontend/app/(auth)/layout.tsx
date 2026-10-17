import { BellRing, ChartNoAxesCombined, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getI18n } from "@/lib/i18n/server";

// Sign-in and sign-up: the form on one side and, on wide screens, a brand panel on the other.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const points = [
    { icon: ChartNoAxesCombined, text: t("Theo dõi thu chi và số dư của mọi tài khoản") },
    { icon: BellRing, text: t("Đặt ngân sách và được nhắc khi sắp vượt hạn mức") },
    { icon: Sparkles, text: t("Nhập sao kê ngân hàng với trợ lý AI") },
  ];

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-white lg:flex">
        <span aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5" />
        <Brand onBrand className="relative" />
        <div className="relative grid gap-8">
          <p className="max-w-md text-3xl leading-tight font-bold text-balance">
            {t("Quản lý tài chính cá nhân.")}
          </p>
          <ul className="grid gap-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© Financial Management</p>
      </aside>

      <main className="flex flex-col items-center justify-center gap-6 p-4 py-10 sm:p-8">
        <Brand className="lg:hidden" />
        {children}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}
