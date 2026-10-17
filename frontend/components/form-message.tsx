"use client";

import { cn } from "cn";
import { useI18n } from "@/components/i18n-provider";

// A form's own message, as opposed to one field's (see FieldError). It arrives from the server as Vietnamese
// source text and is translated here.
export function FormMessage({ message, className }: { message?: string; className?: string }) {
  const { t } = useI18n();
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-sm text-destructive", className)}>
      {t(message)}
    </p>
  );
}
