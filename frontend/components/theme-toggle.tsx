"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

// One button that switches between light and dark. The icon is picked by CSS (dark: variant), so it is right
// from the first paint, even when the choice is "follow the device" and only the browser knows the answer.
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { dark, setTheme } = useTheme();
  const label = t("Giao diện tối");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("text-muted-foreground", className)}
      data-testid="theme-toggle"
    >
      <Moon className="dark:hidden" aria-hidden />
      <Sun className="hidden dark:block" aria-hidden />
    </Button>
  );
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo thiết bị", icon: Monitor },
];

// The three choices side by side, for the settings page.
export function ThemeChooser() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label={t("Giao diện")} className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            theme === value
              ? "border-primary bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {t(label)}
        </button>
      ))}
    </div>
  );
}
