import type { z } from "zod";

// What the app asks of an AI service, whichever one is configured (see ./client.ts). Each provider module
// (./anthropic.ts, ./openai.ts) translates these into its own API.

// A request for one answer in JSON that matches `schema`, about `text` and, optionally, a PDF.
export type StructuredRequest = {
  system: string;
  text: string;
  pdf?: Buffer;
  schema: z.ZodType;
  maxTokens: number;
  signal?: AbortSignal;
};
// `text` is the raw answer, still to be parsed: when `truncated` it stopped at maxTokens and is not valid JSON.
export type StructuredAnswer = { text: string; truncated: boolean; tokens: number };

// A read-only function the chat assistant may call. `parameters` is a JSON schema of an object.
export type ChatTool = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; input: unknown };
export type ToolResult = { id: string; content: string; isError: boolean };
export type ChatMessage = { role: "user" | "assistant"; content: string };

// One conversation with the model. Each round sends the whole conversation and streams the answer
// through `onText`; when the model asks for tools, their results go back with answer() before the next round.
export interface ChatSession {
  next(options: { allowTools: boolean; onText: (text: string) => void }): Promise<{ tokens: number; toolCalls: ToolCall[] }>;
  answer(results: ToolResult[]): void;
}

// Why a request failed, for the message the user sees: the key is wrong, the service is busy, or the
// account behind the key has no credit left. null for anything else.
export type AiFailure = "auth" | "busy" | "billing" | null;

export interface AiModel {
  structured(request: StructuredRequest): Promise<StructuredAnswer>;
  chat(options: { system: string; messages: ChatMessage[]; tools: ChatTool[]; maxTokens: number; signal: AbortSignal }): ChatSession;
  failure(error: unknown): AiFailure;
  // The HTTP status of a failed request, for the logs.
  status(error: unknown): number | undefined;
}
