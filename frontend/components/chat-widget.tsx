"use client";

import { cn } from "cn";
import { MessageCircle, SendHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AI_PROVIDER_NAMES, type AiProvider } from "@fm/shared/ai";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };
type ChatEvent = { type: "text"; text: string } | { type: "done" } | { type: "error"; message: string };

// The server accepts at most 20 messages and 12,000 characters in all; older messages are left out of
// what is sent (never out of what is shown).
const HISTORY_SENT = 20;
const HISTORY_CHARS = 12_000;
const MAX_LENGTH = 2000;
const FAILED = "Trợ lý AI không trả lời được lúc này. Hãy thử lại.";
const SUGGESTIONS = [
  "Tháng này tôi đã chi bao nhiêu?",
  "Ngân sách nào sắp vượt hạn mức?",
  "Khoản chi lớn nhất tháng này là gì?",
  "Làm sao để nhập sao kê ngân hàng?",
];

// The assistant: a round button in the corner that opens a chat panel. It answers from the user's own
// data through /api/chat and cannot change anything. The conversation lives only in this component.
// The newest messages that fit the limits, starting with a question so the turns stay in order.
function recentHistory(history: Message[]): Message[] {
  const kept: Message[] = [];
  let chars = 0;
  for (const message of [...history].reverse()) {
    if (kept.length === HISTORY_SENT || chars + message.content.length > HISTORY_CHARS) break;
    kept.unshift(message);
    chars += message.content.length;
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}

export function ChatWidget({ userName, provider }: { userName: string; provider: AiProvider }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest text in view while the answer streams in.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const appendToAnswer = (text: string) =>
    setMessages((current) => {
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content: last.content + text }];
    });

  async function send(text: string) {
    const question = text.trim().slice(0, MAX_LENGTH);
    if (!question || busy) return;
    const history = [...messages.filter((message) => message.content), { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setBusy(true);

    let failure: string | null = null;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: recentHistory(history) }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        failure = body?.message ?? FAILED;
      } else {
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffered = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += value;
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line) as ChatEvent;
            if (event.type === "text") appendToAnswer(event.text);
            else if (event.type === "error") failure = event.message;
          }
        }
      }
    } catch {
      failure = FAILED;
    }

    // An answer that never got any text is dropped, so the next question does not send an empty turn.
    setMessages((current) => (current[current.length - 1]?.content ? current : current.slice(0, -1)));
    setError(failure);
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Mở trợ lý AI")}
        data-testid="chat-open"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:right-6 lg:bottom-6"
      >
        <MessageCircle className="size-6" aria-hidden />
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label={t("Trợ lý tài chính")}
      data-testid="chat-panel"
      className="fixed inset-0 z-50 flex flex-col bg-card sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-[25rem] sm:overflow-hidden sm:rounded-3xl sm:border sm:shadow-2xl"
    >
      <header className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{t("Trợ lý tài chính")}</p>
          <p className="truncate text-xs text-white/75">{t("Hỏi về chi tiêu, ngân sách hoặc cách dùng ứng dụng")}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={busy}
            aria-label={t("Xóa hội thoại")}
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("Đóng")}
          data-testid="chat-close"
          className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto bg-background p-4">
        {messages.length === 0 ? (
          <div className="my-auto grid gap-4">
            <div className="grid gap-1 text-center">
              <p className="font-semibold">{t("Xin chào, {0}", userName)}</p>
              <p className="text-sm text-muted-foreground">
                {t("Tôi xem được số liệu của bạn để trả lời, nhưng không thay đổi được gì trong ứng dụng.")}
              </p>
            </div>
            <ul className="grid gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => send(t(suggestion))}
                    className="w-full rounded-xl border bg-card px-3 py-2.5 text-left text-sm shadow-xs hover:border-primary/40 hover:bg-accent"
                  >
                    {t(suggestion)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              data-role={message.role}
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap",
                message.role === "user"
                  ? "self-end rounded-br-md bg-primary text-primary-foreground"
                  : "self-start rounded-bl-md border bg-card shadow-xs",
              )}
            >
              {message.content || (
                <span role="status" className="flex items-center gap-1 py-1" aria-label={t("Đang trả lời...")}>
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              )}
            </div>
          ))
        )}
        {error && (
          <p role="alert" className="self-start rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </div>

      <form
        className="grid gap-2 border-t bg-card p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder={t("Nhập câu hỏi...")}
            aria-label={t("Câu hỏi cho trợ lý")}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [field-sizing:content]"
          />
          <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label={t("Gửi")} className="rounded-xl">
            <SendHorizontal />
          </Button>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t("Câu hỏi và số liệu liên quan được gửi tới {0} để trả lời. AI có thể sai; hãy kiểm tra lại số liệu quan trọng.", AI_PROVIDER_NAMES[provider].company)}
        </p>
      </form>
    </section>
  );
}
