"use client";

import { useI18n } from "@/components/i18n-provider";

// Validation messages arrive from the server as Vietnamese source text and are translated here.
export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  const { t } = useI18n();
  if (!messages?.length) return null;
  return (
    <ul id={id} className="text-sm text-destructive">
      {messages.map((message) => (
        <li key={message}>{t(message)}</li>
      ))}
    </ul>
  );
}
