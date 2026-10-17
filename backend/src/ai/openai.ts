import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";
import type { FunctionTool, Response, ResponseInputItem } from "openai/resources/responses/responses";
import { z } from "zod";
import type { AiFailure, AiModel, ChatSession, ChatTool, ToolCall } from "./model";

// The OpenAI Responses API. OPENAI_API_KEY and OPENAI_BASE_URL are read by the SDK; OPENAI_MODEL picks the
// model and OPENAI_REASONING_EFFORT, when set, how long a reasoning model thinks (none … max, as the model allows).
const MODEL = process.env.OPENAI_MODEL || "gpt-6.1-sol";
const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const effortSetting = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
const REASONING_EFFORT = EFFORTS.find((effort) => effort === effortSetting) as ReasoningEffort | undefined;
if (effortSetting && !REASONING_EFFORT) console.warn(`OPENAI_REASONING_EFFORT="${effortSetting}" is not one of ${EFFORTS.join(", ")}; ignored.`);
// A reasoning model's thinking counts towards max_output_tokens, so it gets this much on top of what the
// written answer needs.
const REASONING_TOKENS = 8000;
const REQUEST_TIMEOUT_MS = 300_000;

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({ maxRetries: 2, timeout: REQUEST_TIMEOUT_MS });
  return client;
}

// Shared by every request: OpenAI is asked not to keep the conversation (it holds the user's finances),
// so each request carries everything the model needs.
const COMMON = { model: MODEL, store: false, ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}) };

function tokensOf(response: Response): number {
  return (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
}

function outputText(response: Response): string {
  return response.output
    .flatMap((item) => (item.type === "message" ? item.content.flatMap((part) => (part.type === "output_text" ? [part.text] : [])) : []))
    .join("");
}

// Strict structured output wants a plain JSON schema without the $schema marker.
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function functionTools(tools: ChatTool[]): FunctionTool[] {
  // Not strict: strict mode would need every parameter to be required. The arguments are checked by the
  // tool's own schema before it runs.
  return tools.map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters, strict: false }));
}

export const openAiModel: AiModel = {
  async structured({ system, text, pdf, schema, maxTokens, signal }) {
    const response = await openai()
      .responses.stream(
        {
          ...COMMON,
          instructions: system,
          input: [
            {
              role: "user",
              content: [
                ...(pdf
                  ? [{ type: "input_file" as const, filename: "statement.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}` }]
                  : []),
                { type: "input_text" as const, text },
              ],
            },
          ],
          max_output_tokens: maxTokens + REASONING_TOKENS,
          text: { format: { type: "json_schema", name: "answer", schema: jsonSchema(schema), strict: true } },
        },
        { signal },
      )
      .finalResponse();
    return {
      text: outputText(response),
      truncated: response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens",
      tokens: tokensOf(response),
    };
  },

  chat({ system, messages, tools, maxTokens, signal }): ChatSession {
    const input: ResponseInputItem[] = messages.map((message) => ({ role: message.role, content: message.content }));
    const offered = functionTools(tools);
    return {
      async next({ allowTools, onText }) {
        const stream = openai().responses.stream(
          {
            ...COMMON,
            instructions: system,
            input,
            tools: offered,
            tool_choice: allowTools ? "auto" : "none",
            max_output_tokens: maxTokens + REASONING_TOKENS,
          },
          { signal },
        );
        stream.on("response.output_text.delta", (event) => onText(event.delta));
        const response = await stream.finalResponse();
        const toolCalls: ToolCall[] = [];
        for (const item of response.output) {
          if (item.type !== "function_call") continue;
          let args: unknown = null;
          try {
            args = JSON.parse(item.arguments || "{}");
          } catch {
            // Left null: the tool's input check turns it into an error the model can read.
          }
          toolCalls.push({ id: item.call_id, name: item.name, input: args });
        }
        if (toolCalls.length > 0) {
          // The answer goes back as plain items: with store=false the API cannot look up items by id.
          const said = outputText(response);
          if (said) input.push({ role: "assistant", content: said });
          for (const item of response.output) {
            if (item.type === "function_call") input.push({ type: "function_call", call_id: item.call_id, name: item.name, arguments: item.arguments });
          }
        }
        return { tokens: tokensOf(response), toolCalls };
      },
      answer(results) {
        for (const result of results) {
          input.push({ type: "function_call_output", call_id: result.id, output: result.isError ? `Error: ${result.content}` : result.content });
        }
      },
    };
  },

  failure(error): AiFailure {
    if (!(error instanceof OpenAI.APIError)) return null;
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.code === "insufficient_quota" || error.status === 402) return "billing";
    if (error.status === 429 || error.status === 503) return "busy";
    return null;
  },

  status(error) {
    return error instanceof OpenAI.APIError ? error.status : undefined;
  },
};
