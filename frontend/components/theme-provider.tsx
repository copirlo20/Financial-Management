"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { PREFERENCE_COOKIE_MAX_AGE, THEME_CLASSES, THEME_COOKIE, type Theme } from "@/lib/theme";

type ThemeState = {
  theme: Theme;
  // What is on screen: the choice, or for "system" what the device asks for.
  dark: boolean;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);
const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Holds the appearance chosen on this device. Changing it updates the cookie (read by the server on the
// next render) and the class on <html> at once, so the page switches without a reload.
export function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState(initial);
  // The server cannot know the device setting, so the first render assumes light and corrects itself.
  const deviceDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches, () => false);

  const setTheme = useCallback((next: Theme) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
    const root = document.documentElement;
    for (const name of Object.values(THEME_CLASSES)) if (name) root.classList.remove(name);
    if (THEME_CLASSES[next]) root.classList.add(THEME_CLASSES[next]);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, dark: theme === "dark" || (theme === "system" && deviceDark), setTheme }),
    [theme, deviceDark, setTheme],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error("useTheme needs a ThemeProvider");
  return state;
}
