// Light or dark appearance. The choice is kept per device in a cookie, so the server renders the right
// palette from the first byte (no flash of the wrong colours). "system" follows the device's own setting
// through CSS alone (see the dark variant in app/globals.css), with no script needed before the page paints.
export const THEME_COOKIE = "theme";
// How long a device remembers a preference: this theme cookie, and the language one (lib/api/client.ts).
export const PREFERENCE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

// The class on <html> for a choice: "dark" forces the dark palette, "theme-system" defers to the device.
export const THEME_CLASSES = { light: "", dark: "dark", system: "theme-system" } as const satisfies Record<Theme, string>;
