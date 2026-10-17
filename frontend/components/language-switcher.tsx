import { LOCALES } from "@fm/shared/i18n/config";
import { setLanguage } from "@/app/actions/settings";
import { getLanguage } from "@/lib/i18n/server";

export async function LanguageSwitcher() {
  const current = await getLanguage();

  return (
    <form
      action={setLanguage}
      className="flex items-center gap-0.5 rounded-full border bg-card p-0.5 text-xs"
      aria-label="Ngôn ngữ / Language"
    >
      {LOCALES.map((language) => (
        <button
          key={language}
          type="submit"
          name="language"
          value={language}
          aria-pressed={language === current}
          className={`rounded-full px-2.5 py-1.5 leading-none font-semibold uppercase transition-colors ${
            language === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {language}
        </button>
      ))}
    </form>
  );
}
