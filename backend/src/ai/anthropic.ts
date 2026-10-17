import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AiFailure, AiModel, ChatSession, ChatTool, ToolCall } from "./model";

// The Claude API. ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL are read by the SDK; ANTHROPIC_MODEL picks the model.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const REQUEST_TIMEOUT_MS = 300_000;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: REQUEST_TIMEOUT_MS });
  return client;
}

function tokensOf(usage: Anthropic.Usage): number {
  return usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
}

function claudeTools(tools: ChatTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool.InputSchema,
  }));
}

export const anthropicModel: AiModel = {
  async structured({ system, text, pdf, schema, maxTokens, signal }) {
    const format = zodOutputFormat(schema);
    // Streamed because a long statement takes minutes to write out.
    const message = await anthropic()
      .messages.stream(
        {
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [
            {
              role: "user",
              content: pdf
                ? [
                    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
                    { type: "text", text },
                  ]
                : text,
            },
          ],
          // Only the schema is passed on, so the SDK does not parse the answer itself: an answer cut off
          // at max_tokens is not valid JSON, and the caller reports that case on its own.
          output_config: { format: { type: format.type, schema: format.schema } },
        },
        { signal },
      )
      .finalMessage();
    return {
      text: message.content.map((block) => (block.type === "text" ? block.text : "")).join(""),
      truncated: message.stop_reason === "max_tokens",
      tokens: tokensOf(message.usage),
    };
  },

  chat({ system, messages, tools, maxTokens, signal }): ChatSession {
    const conversation: Anthropic.MessageParam[] = [...messages];
    const offered = claudeTools(tools);
    return {
      async next({ allowTools, onText }) {
        const reply = anthropic().messages.stream(
          {
            model: MODEL,
            max_tokens: maxTokens,
            system,
            messages: conversation,
            // The tools stay listed (the conversation may already hold tool calls) but cannot be used.
            tools: offered,
            ...(allowTools ? {} : { tool_choice: { type: "none" as const } }),
          },
          { signal },
        );
        reply.on("text", onText);
        const message = await reply.finalMessage();
        const toolCalls: ToolCall[] = [];
        if (message.stop_reason === "tool_use") {
          conversation.push({ role: "assistant", content: message.content });
          for (const block of message.content) {
            if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, input: block.input });
          }
        }
        return { tokens: tokensOf(message.usage), toolCalls };
      },
      answer(results) {
        conversation.push({
          role: "user",
          content: results.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.id,
            content: result.content,
            is_error: result.isError,
          })),
        });
      },
    };
  },

  failure(error): AiFailure {
    if (!(error instanceof Anthropic.APIError)) return null;
    const type = (error.error as { error?: { type?: string } } | undefined)?.error?.type;
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 402 || type === "billing_error" || /credit balance/i.test(error.message)) return "billing";
    if (error.status === 429 || error.status === 529) return "busy";
    return null;
  },

  status(error) {
    return error instanceof Anthropic.APIError ? error.status : undefined;
  },
};
