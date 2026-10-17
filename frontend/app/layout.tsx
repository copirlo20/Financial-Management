import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getLanguage } from "@/lib/i18n/server";
import { parseTheme, THEME_CLASSES, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

// Drawn for Vietnamese: the accents sit properly, which the previous Latin-only font left to a fallback.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Financial Management", template: "%s · Financial Management" },
  description: "Quản lý tài chính cá nhân: thu chi, ngân sách, mục tiêu tiết kiệm.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const language = await getLanguage();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={language}
      className={`${beVietnam.variable} ${geistMono.variable} ${THEME_CLASSES[theme]} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider initial={theme}>
          <I18nProvider language={language}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
