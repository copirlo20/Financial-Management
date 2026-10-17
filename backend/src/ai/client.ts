import { AI_PROVIDERS, type AiProvider } from "@fm/shared/ai";
import { hit, used } from "../rate-limit";
import { anthropicModel } from "./anthropic";
import type { AiFailure, AiModel } from "./model";
import { openAiModel } from "./openai";

// Everything AI in the app (statement import, chat assistant) goes through one provider: Claude
// (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY). AI_PROVIDER chooses when both keys are set; without it
// Claude is used if its key is there, else OpenAI. A provider chosen without its key leaves AI off, so the
// data never goes to a company the administrator did not pick.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KEYS: Record<AiProvider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
const MODELS: Record<AiProvider, AiModel> = { anthropic: anthropicModel, openai: openAiModel };

function limitFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// What the AI service may cost per day, in tokens (input + output, as the API reports them). The whole
// app shares the first; every user also has a share of their own, so that one account, or a few new
// ones, cannot spend the day's budget for everyone.
const DAILY_TOKEN_BUDGET = limitFromEnv("AI_DAILY_TOKEN_BUDGET", 2_000_000);
const USER_DAILY_TOKEN_BUDGET = limitFromEnv("AI_USER_DAILY_TOKEN_BUDGET", 200_000);

const warned = new Set<string>();
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

export function aiProvider(): AiProvider | null {
  const hasKey = (provider: AiProvider) => Boolean(process.env[KEYS[provider]]);
  const setting = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (setting) {
    const chosen = AI_PROVIDERS.find((provider) => provider === setting);
    if (chosen) {
      if (hasKey(chosen)) return chosen;
      warnOnce(`AI_PROVIDER is ${chosen} but ${KEYS[chosen]} is not set: the AI features are off.`);
      return null;
    }
    warnOnce(`AI_PROVIDER="${setting}" is not one of ${AI_PROVIDERS.join(", ")}; using whichever key is set.`);
  }
  return AI_PROVIDERS.find(hasKey) ?? null;
}

export function aiAvailable(): boolean {
  return aiProvider() !== null;
}

// Call only after aiAvailable() said yes.
export function aiModel(): AiModel {
  const provider = aiProvider();
  if (!provider) throw new Error("No AI provider is configured");
  return MODELS[provider];
}

// Why a request to the configured provider failed (see AiFailure), and its HTTP status for the logs.
export function aiFailure(error: unknown): { failure: AiFailure; status: number | undefined } {
  const model = MODELS[aiProvider() ?? "anthropic"];
  return { failure: model.failure(error), status: model.status(error) };
}

// Counts one use of a feature and says whether the user is still within `perHour` of them. Kept in the
// database so the count survives restarts and is shared by every backend process.
export async function takeHourlyQuota(feature: string, userId: string, perHour: number): Promise<boolean> {
  return (await hit(`ai-uses:${feature}:${userId}`, HOUR_MS)) <= perHour;
}

export class AiBudgetError extends Error {}

// Throws AiBudgetError when today's budget (the app's or this user's) is used up. Call before each request.
export async function assertAiBudget(userId: string): Promise<void> {
  const [all, mine] = await Promise.all([used("ai-tokens:all", DAY_MS), used(`ai-tokens:user:${userId}`, DAY_MS)]);
  if (all >= DAILY_TOKEN_BUDGET || mine >= USER_DAILY_TOKEN_BUDGET) throw new AiBudgetError("AI budget used up");
}

// Adds what a finished request cost to today's counters.
export async function recordAiUsage(userId: string, tokens: number): Promise<void> {
  if (!(tokens > 0)) return;
  await Promise.all([hit("ai-tokens:all", DAY_MS, tokens), hit(`ai-tokens:user:${userId}`, DAY_MS, tokens)]);
}
