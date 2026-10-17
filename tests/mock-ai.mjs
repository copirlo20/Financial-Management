// A stand-in for the AI APIs, so the tests never call (or pay for) the real ones. It answers both the
// Claude Messages API (POST /v1/messages) and the OpenAI Responses API (POST /v1/responses) from the same
// queue. The test runner starts it and points the app at it (ANTHROPIC_BASE_URL or OPENAI_BASE_URL).
//
//   POST /__mock/queue     body: array of answers for the next model calls, in order. Clears the log.
//                          { output: {...} }        answer with this JSON (structured output)
//                          { text: "..." }          answer with this raw text
//                          { stopReason: "..." }    with either of the above, e.g. "max_tokens" (an
//                                                   OpenAI answer then ends as incomplete at max_output_tokens)
//                          { status: 401 }          answer with an API error
//                          { code: "..." }          with `status`: the error code (OpenAI) or message
//                                                   (Claude), e.g. "insufficient_quota"
//                          { toolUse: { name, input } }  ask for a tool call (optionally after `text`)
//                          { delayMs: 500 }         with any of the above: wait before answering
//                          { usage: { input_tokens, output_tokens } }  what the answer reports it cost
//                          { readRows: true }       answer a spreadsheet request with one transaction per
//                                                   row under "Rows to read:", taking each row as
//                                                   [DD/MM/YYYY, description, signed amount]
//                          Inside `output`, { "$category": "Name" } becomes the index that the request's
//                          category list ("index | TYPE | Name") gave that category, or -1.
//   GET  /__mock/requests  the request bodies received since the last queue call, with `apiKey` and
//                          `provider` added. OpenAI requests are rewritten in the shape of a Claude
//                          request (system, messages with text/document/tool_use/tool_result blocks,
//                          tools with input_schema, tool_choice, output_config), so that the suites
//                          check both providers the same way.
//
// With nothing queued, a call is answered 400, which neither SDK retries.
import http from "node:http";

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function requestText(request) {
  return (request.messages ?? [])
    .flatMap((message) => (typeof message.content === "string" ? [message.content] : message.content.map((block) => block.text ?? "")))
    .join("\n");
}

function resolveCategories(value, text) {
  if (Array.isArray(value)) return value.map((item) => resolveCategories(item, text));
  if (value && typeof value === "object") {
    if (typeof value.$category === "string") {
      const line = text.split("\n").find((candidate) => /^\d+ \| (EXPENSE|INCOME) \| /.test(candidate) && candidate.split(" | ")[2] === value.$category);
      return line ? Number(line.split(" | ")[0]) : -1;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveCategories(item, text)]));
  }
  return value;
}

function readRows(text) {
  const rows = text.split("Rows to read:\n")[1] ?? "";
  const transactions = [];
  for (const line of rows.split("\n")) {
    const match = /^row (\d+): (\[.*\])$/.exec(line);
    if (!match) continue;
    const [date, description, amount] = JSON.parse(match[2]);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(date))) continue;
    const [day, month, year] = date.split("/");
    const value = Number(String(amount).replace(/,/g, ""));
    transactions.push({ row: Number(match[1]), date: `${year}-${month}-${day}`, type: value < 0 ? "EXPENSE" : "INCOME", amount: String(Math.abs(value)), description: description ?? "", category: null });
  }
  return { transactions };
}

// ---------- OpenAI requests, rewritten as Claude ones ----------

function claudeBlock(part) {
  if (part.type === "input_text") return { type: "text", text: part.text };
  if (part.type === "input_file") {
    const [header, data] = String(part.file_data).split(",");
    return { type: "document", source: { type: "base64", media_type: header.replace(/^data:|;base64$/g, ""), data }, filename: part.filename };
  }
  return { type: `unknown:${part.type}` };
}

function claudeMessages(input) {
  const messages = [];
  // Tool calls and their results are separate items in OpenAI's input; Claude keeps them as blocks of
  // one assistant message and one user message.
  const appendBlock = (role, block) => {
    const last = messages.at(-1);
    if (last?.role === role && Array.isArray(last.content) && last.content.every((b) => b.type === block.type)) last.content.push(block);
    else if (last?.role === role && role === "assistant") last.content = [...(typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content), block];
    else messages.push({ role, content: [block] });
  };
  for (const item of typeof input === "string" ? [{ role: "user", content: input }] : input) {
    if (item.type === "function_call") {
      appendBlock("assistant", { type: "tool_use", id: item.call_id, name: item.name, input: JSON.parse(item.arguments || "{}") });
    } else if (item.type === "function_call_output") {
      const failed = String(item.output).startsWith("Error: ");
      appendBlock("user", { type: "tool_result", tool_use_id: item.call_id, content: failed ? item.output.slice(7) : item.output, ...(failed ? { is_error: true } : {}) });
    } else if (item.role) {
      const blocks = typeof item.content === "string" ? item.content : item.content.map(claudeBlock);
      // A lone text part is plain text, as Claude takes it.
      messages.push({ role: item.role, content: Array.isArray(blocks) && blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks });
    } else {
      messages.push({ role: "unknown", content: JSON.stringify(item) });
    }
  }
  return messages;
}

function asClaudeRequest(request) {
  const { instructions, input, tools, tool_choice, text, max_output_tokens, ...rest } = request;
  return {
    ...rest,
    system: instructions,
    max_tokens: max_output_tokens,
    messages: claudeMessages(input ?? []),
    ...(tools ? { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters, type: tool.type })) } : {}),
    ...(tool_choice ? { tool_choice: typeof tool_choice === "string" ? { type: tool_choice } : tool_choice } : {}),
    ...(text?.format ? { output_config: { format: text.format } } : {}),
  };
}

// ---------- Answers ----------

function claudeAnswer(res, request, next, text, toolCall, index) {
  const content = [];
  if (text) content.push({ type: "text", text });
  if (toolCall) content.push({ type: "tool_use", id: `toolu_mock_${index}`, name: toolCall.name, input: toolCall.input ?? {} });
  const message = {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: request.model,
    content,
    stop_reason: next.stopReason ?? (toolCall ? "tool_use" : "end_turn"),
    stop_sequence: null,
    usage: { input_tokens: next.usage?.input_tokens ?? 1, output_tokens: next.usage?.output_tokens ?? 1 },
  };
  if (!request.stream) return sendJson(res, 200, message);

  res.writeHead(200, { "content-type": "text/event-stream" });
  const events = [{ type: "message_start", message: { ...message, content: [], stop_reason: null } }];
  content.forEach((block, blockIndex) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index: blockIndex, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index: blockIndex, delta: { type: "text_delta", text: block.text } });
    } else {
      events.push({ type: "content_block_start", index: blockIndex, content_block: { ...block, input: {} } });
      events.push({ type: "content_block_delta", index: blockIndex, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    }
    events.push({ type: "content_block_stop", index: blockIndex });
  });
  events.push({ type: "message_delta", delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: message.usage.output_tokens } });
  events.push({ type: "message_stop" });
  for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  res.end();
}

// The event sequence of a streamed Responses API answer, as the OpenAI SDK's stream helper checks it.
function openAiAnswer(res, request, next, text, toolCall, index) {
  const items = [];
  if (text) items.push({ id: `msg_mock_${index}`, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] });
  if (toolCall) {
    items.push({ id: `fc_mock_${index}`, type: "function_call", status: "completed", call_id: `call_mock_${index}`, name: toolCall.name, arguments: JSON.stringify(toolCall.input ?? {}) });
  }
  const cutOff = next.stopReason === "max_tokens";
  const input_tokens = next.usage?.input_tokens ?? 1;
  const output_tokens = next.usage?.output_tokens ?? 1;
  const base = { id: `resp_mock_${index}`, object: "response", created_at: Math.floor(Date.now() / 1000), model: request.model, error: null, incomplete_details: null };
  const final = {
    ...base,
    status: cutOff ? "incomplete" : "completed",
    incomplete_details: cutOff ? { reason: "max_output_tokens" } : null,
    output: items,
    usage: { input_tokens, output_tokens, total_tokens: input_tokens + output_tokens, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  };
  if (!request.stream) return sendJson(res, 200, final);

  const events = [
    { type: "response.created", response: { ...base, status: "in_progress", output: [] } },
    { type: "response.in_progress", response: { ...base, status: "in_progress", output: [] } },
  ];
  items.forEach((item, output_index) => {
    if (item.type === "message") {
      const part = item.content[0];
      events.push({ type: "response.output_item.added", output_index, item: { ...item, status: "in_progress", content: [] } });
      events.push({ type: "response.content_part.added", item_id: item.id, output_index, content_index: 0, part: { ...part, text: "" } });
      events.push({ type: "response.output_text.delta", item_id: item.id, output_index, content_index: 0, delta: part.text, logprobs: [] });
      events.push({ type: "response.output_text.done", item_id: item.id, output_index, content_index: 0, text: part.text, logprobs: [] });
      events.push({ type: "response.content_part.done", item_id: item.id, output_index, content_index: 0, part });
    } else {
      events.push({ type: "response.output_item.added", output_index, item: { ...item, status: "in_progress", arguments: "" } });
      events.push({ type: "response.function_call_arguments.delta", item_id: item.id, output_index, delta: item.arguments });
      events.push({ type: "response.function_call_arguments.done", item_id: item.id, output_index, name: item.name, arguments: item.arguments });
    }
    events.push({ type: "response.output_item.done", output_index, item });
  });
  events.push({ type: cutOff ? "response.incomplete" : "response.completed", response: final });

  res.writeHead(200, { "content-type": "text/event-stream" });
  events.forEach((event, sequence_number) => res.write(`event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number })}\n\n`));
  res.end();
}

function apiError(res, provider, status, code) {
  if (provider === "openai") {
    return sendJson(res, status, { error: { message: "mock error", type: status === 429 ? "insufficient_quota" : "api_error", code: code ?? null, param: null } });
  }
  return sendJson(res, status, { type: "error", error: { type: status === 400 ? "invalid_request_error" : "api_error", message: code ?? "mock error" } });
}

export function startMockAi(port) {
  let queue = [];
  let requests = [];

  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    if (req.url === "/__mock/queue" && req.method === "POST") {
      queue = JSON.parse(body);
      requests = [];
      return sendJson(res, 200, { queued: queue.length });
    }
    if (req.url === "/__mock/requests") return sendJson(res, 200, requests);
    const provider = req.url.startsWith("/v1/messages") ? "anthropic" : req.url.startsWith("/v1/responses") ? "openai" : null;
    if (!provider || req.method !== "POST") return sendJson(res, 404, {});

    const raw = JSON.parse(body);
    const request = provider === "openai" ? asClaudeRequest(raw) : raw;
    const apiKey = provider === "openai" ? String(req.headers.authorization ?? "").replace(/^Bearer /, "") : req.headers["x-api-key"];
    requests.push({ ...request, apiKey, provider });
    const next = queue.shift();
    if (!next) return apiError(res, provider, 400, "mock: nothing queued");
    if (next.status) return apiError(res, provider, next.status, next.code);

    if (next.delayMs) await new Promise((resolve) => setTimeout(resolve, next.delayMs));
    const output = next.readRows ? readRows(requestText(request)) : resolveCategories(next.output, requestText(request));
    const text = typeof next.text === "string" ? next.text : next.toolUse ? "" : JSON.stringify(output);
    (provider === "openai" ? openAiAnswer : claudeAnswer)(res, raw, next, text, next.toolUse, requests.length);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
