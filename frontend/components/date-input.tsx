"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "cn";
import * as React from "react";
import { isoDateToText, parseDateText } from "@fm/shared/dates";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";

// A date field that always reads dd/mm/yyyy, whatever the browser's or the phone's language (a native
// date input follows the device instead, and on phones also sizes itself in its own way).
//
// The text field is the form's field: it is sent as typed (dd/mm/yyyy), and the backend accepts that as
// well as "YYYY-MM-DD", so the form also works without JavaScript. Typing adds the slashes; the calendar
// button is a transparent native date input laid over the icon, so a tap opens the phone's own date picker.

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  // "YYYY-MM-DD" or dd/mm/yyyy (what the form sent back); empty for no date.
  defaultValue?: string;
};

// Puts the slashes in while digits are typed: "1910" → "19/10/", "5/" → "05/"; a whole date typed over the
// field or pasted ("19102026", "2026-10-19") is shown as dd/mm/yyyy. Deleting is left alone: from the end
// (so a slash can be removed) and in the middle (so the other digits keep their place).
export function maskDate(raw: string, previous: string): string {
  const iso = parseDateText(raw);
  if (iso) return isoDateToText(iso);
  if (raw.length < previous.length && (previous.startsWith(raw) || /[/.-]/.test(raw))) return raw;
  let text = "";
  let group = "";
  let groups = 0; // day and month done so far
  for (const char of raw) {
    if (/\d/.test(char)) {
      if (groups < 2 && group.length === 2) {
        text += `${group}/`;
        group = "";
        groups++;
      }
      if (groups === 2 && group.length === 4) break;
      group += char;
    } else if (groups < 2 && group) {
      // A separator typed after one digit: "5/" is the 5th.
      text += `${group.padStart(2, "0")}/`;
      group = "";
      groups++;
    }
  }
  text += group;
  if (groups < 2 && group.length === 2) text += "/";
  return text.slice(0, 10);
}

export function DateInput({ defaultValue = "", className, disabled, ...props }: Props) {
  const { t } = useI18n();
  const shown = isoDateToText(defaultValue);
  const [text, setText] = React.useState(shown);
  const input = React.useRef<HTMLInputElement>(null);

  // A new value from the server (the form sent back what was typed, or a fresh default) replaces the text.
  const [lastShown, setLastShown] = React.useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
  }

  // After a successful submit React resets the form; this field is controlled, so it follows by hand.
  React.useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => setText(shown);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [shown]);

  return (
    <div className="relative">
      <Input
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t("dd/mm/yyyy")}
        maxLength={10}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(maskDate(event.target.value, text))}
        className={cn("pr-11 tabular-nums", className)}
        {...props}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground">
        <CalendarDays className="size-4" />
      </span>
      <input
        type="date"
        tabIndex={-1}
        aria-label={t("Chọn ngày trên lịch")}
        disabled={disabled}
        value={parseDateText(text) ?? ""}
        onChange={(event) => setText(isoDateToText(event.target.value))}
        // Desktop browsers open their picker only from their own icon; a click anywhere here asks for it.
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // Already open, or not supported: the native tap behaviour is all there is.
          }
        }}
        // text-base: iOS zooms the page into any field under 16px when it is tapped.
        className="absolute inset-y-0 right-0 w-10 cursor-pointer text-base opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
