"use client";

import { cn } from "cn";
import {
  ArrowLeftRight,
  Coins,
  Ellipsis,
  FileUp,
  LayoutDashboard,
  PieChart,
  PiggyBank,
  Settings,
  ShieldCheck,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

type NavLink = { href: string; label: string; icon: LucideIcon };

// The four sections people open daily; on a phone they are the bottom bar, the rest sits behind "Thêm".
const MAIN_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/transactions", label: "Giao dịch", icon: ArrowLeftRight },
  { href: "/budgets", label: "Ngân sách", icon: PieChart },
  { href: "/savings", label: "Tiết kiệm", icon: PiggyBank },
];
const MORE_LINKS: NavLink[] = [
  { href: "/imports", label: "Nhập sao kê", icon: FileUp },
  { href: "/accounts", label: "Tài khoản", icon: Wallet },
  { href: "/categories", label: "Danh mục", icon: Tags },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];
const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/categories", label: "Quản trị danh mục", icon: ShieldCheck },
  { href: "/admin/exchange-rates", label: "Quản trị tỷ giá", icon: Coins },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Dims and pulses the clicked link until its page has loaded. A route-level loading.tsx is deliberately not
// used: it starts streaming with status 200 before the page knows whether the record exists, which turned
// every "not found" into a 200.
function PendingLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-busy={pending || undefined} className={cn(className, pending && "animate-pulse opacity-60")}>
      {children}
    </span>
  );
}

// Desktop: the full menu down the left side.
// isAdmin only decides whether the links are shown; the admin pages enforce access themselves.
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const item = ({ href, label, icon: Icon }: NavLink) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className={cn("size-5 shrink-0", active && "text-primary")} aria-hidden />
        <PendingLabel className="truncate">{t(label)}</PendingLabel>
      </Link>
    );
  };

  return (
    <nav aria-label={t("Điều hướng chính")} className="grid gap-1">
      {[...MAIN_LINKS, ...MORE_LINKS].map(item)}
      {isAdmin && (
        <>
          <p className="mt-4 px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("Quản trị")}</p>
          {ADMIN_LINKS.map(item)}
        </>
      )}
    </nav>
  );
}

// Phone and tablet: a bar fixed to the bottom of the screen, as in banking apps.
// Layers: assistant button (30) < the "Thêm" sheet (35) < this bar (40) < the open chat panel (50).
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  // The sheet remembers the page it was opened on, so it closes by itself once a link has navigated.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const moreOpen = openOn === pathname;
  const moreLinks = isAdmin ? [...MORE_LINKS, ...ADMIN_LINKS] : MORE_LINKS;
  const inMore = moreLinks.some(({ href }) => isActive(pathname, href));
  const tab = "flex min-w-0 flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors";

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[35] lg:hidden">
          <button
            type="button"
            aria-label={t("Đóng")}
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setOpenOn(null)}
          />
          <nav
            id="more-menu"
            aria-label={t("Mục khác")}
            className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] grid grid-cols-3 gap-2 rounded-2xl border bg-card p-3 shadow-xl"
          >
            {moreLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-2 rounded-xl p-3 text-center text-xs font-medium",
                    active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <PendingLabel className="wrap-anywhere">{t(label)}</PendingLabel>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <nav
        aria-label={t("Điều hướng chính")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MAIN_LINKS.map(({ href, label, icon: Icon }) => {
          const active = !moreOpen && isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(tab, active ? "text-primary" : "text-muted-foreground")}
            >
              <Icon className="size-5" aria-hidden />
              <PendingLabel className="max-w-full truncate">{t(label)}</PendingLabel>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="more-menu"
          className={cn(tab, moreOpen || inMore ? "text-primary" : "text-muted-foreground")}
          onClick={() => setOpenOn(moreOpen ? null : pathname)}
        >
          <Ellipsis className="size-5" aria-hidden />
          <span className="max-w-full truncate">{t("Thêm")}</span>
        </button>
      </nav>
    </>
  );
}
