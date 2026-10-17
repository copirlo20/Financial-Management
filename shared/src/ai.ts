// The AI services the backend can use for the statement import and the chat assistant. The server
// uses one at a time (AI_PROVIDER, or whichever key is configured).
export const AI_PROVIDERS = ["anthropic", "openai"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

// How the interface names each one: the assistant, and the company that receives what is sent to it.
export const AI_PROVIDER_NAMES: Record<AiProvider, { assistant: string; company: string }> = {
  anthropic: { assistant: "Claude", company: "Anthropic" },
  openai: { assistant: "GPT", company: "OpenAI" },
};
