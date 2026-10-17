import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { ChatWidget } from "@/components/chat-widget";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, SidebarNav } from "@/components/nav-links";
import { NavigationPending } from "@/components/navigation-pending";
import { Button } from "@/components/ui/button";
import { aiProvider, getCurrentUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/server";

// Navigation chrome only. Access control lives in each page and Server Action via requireUser()/requireAdmin().
// Desktop: sidebar on the left. Smaller screens: a slim top bar and a bottom tab bar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const provider = user ? await aiProvider() : null;

  return (
    <div className="flex flex-1 flex-col lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-6 border-r bg-sidebar px-4 py-5 lg:flex">
        <Brand className="px-2" />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <SidebarNav isAdmin={isAdmin} />
        </div>
        <div className="grid gap-3 border-t pt-4">
          {user && (
            <div className="flex min-w-0 items-center gap-3 px-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary uppercase">
                {user.name.trim().charAt(0) || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut />
                {t("Đăng xuất")}
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-card/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand className="min-w-0" />
        <div className="flex shrink-0 items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label={t("Đăng xuất")} className="text-muted-foreground">
              <LogOut />
            </Button>
          </form>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-24">
        <NavigationPending />
        {children}
      </main>

      <BottomNav isAdmin={isAdmin} />
      {user && provider && <ChatWidget userName={user.name} provider={provider} />}
    </div>
  );
}
