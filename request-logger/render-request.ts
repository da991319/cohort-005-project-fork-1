/**
 * render-request.ts — the request half of render.ts: one renderer per wire
 * format, plus the fencing and message-list helpers they share. render.ts
 * imports from here, never the other way round.
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function fenceJson(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

export function fence(text: string, lang = ""): string {
  return "```" + lang + "\n" + text + "\n```";
}

/** Collapse a content field that may be a string or an array of text-ish blocks
 * down to plain text, preserving everything (only image base64 is placeheld). */
function blockText(block: any): string {
  if (typeof block === "string") return block;
  if (block?.type === "text" && typeof block.text === "string")
    return block.text;
  if (block?.type === "input_text" && typeof block.text === "string")
    return block.text;
  if (block?.type === "output_text" && typeof block.text === "string")
    return block.text;
  return "";
}

function renderParams(reqJson: any, keys: string[]): string {
  const present = keys
    .filter((k) => reqJson[k] !== undefined)
    .map((k) => {
      const v = reqJson[k];
      const shown = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `- **${k}**: ${shown}`;
    });
  if (present.length === 0) return "";
  return ["<params>", "", ...present, "", "</params>"].join("\n");
}

// ---- Anthropic --------------------------------------------------------------

export function renderAnthropicRequest(j: any): string {
  const parts: string[] = [];

  const params = renderParams(j, [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stream",
    "stop_sequences",
    "tool_choice",
    "thinking",
    "metadata",
  ]);
  if (params) parts.push(params);

  if (j.system != null) {
    parts.push(
      [
        "<system-prompt>",
        "",
        renderAnthropicSystem(j.system),
        "",
        "</system-prompt>",
      ].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderAnthropicTools(j.tools));
  }

  parts.push(renderMessages(j.messages, renderAnthropicContent));

  return parts.join("\n\n");
}

function renderAnthropicSystem(system: any): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return system
      .map((block) => {
        const text = blockText(block);
        const marker = block?.cache_control
          ? "\n\n<!-- cache_control breakpoint -->"
          : "";
        return text + marker;
      })
      .join("\n\n");
  }
  return fenceJson(system);
}

function renderAnthropicTools(tools: any[]): string {
  const rendered = tools.map((tool) => {
    const lines = [`### ${tool.name ?? "(unnamed tool)"}`, ""];
    if (tool.description) lines.push(tool.description, "");
    if (tool.input_schema) lines.push(fenceJson(tool.input_schema));
    return lines.join("\n");
  });
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

function renderAnthropicContent(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return fenceJson(content);
  return content
    .map((block) => {
      switch (block?.type) {
        case "text":
          return block.text ?? "";
        case "tool_use":
          return [
            `<tool-use name="${block.name}" id="${block.id ?? ""}">`,
            "",
            fenceJson(block.input ?? {}),
            "",
            "</tool-use>",
          ].join("\n");
        case "tool_result": {
          const inner = renderToolResultContent(block.content);
          return [
            `<tool-result tool-use-id="${block.tool_use_id ?? ""}" is-error="${!!block.is_error}">`,
            "",
            inner,
            "",
            "</tool-result>",
          ].join("\n");
        }
        case "image":
          return imagePlaceholder(block);
        case "thinking":
          return [
            "<thinking>",
            "",
            block.thinking ?? "",
            "",
            "</thinking>",
          ].join("\n");
        default:
          return fenceJson(block);
      }
    })
    .join("\n\n");
}

function renderToolResultContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b?.type === "image" ? imagePlaceholder(b) : blockText(b) || fenceJson(b)
      )
      .join("\n\n");
  }
  return fenceJson(content);
}

function imagePlaceholder(block: any): string {
  const src = block.source ?? {};
  const bytes = typeof src.data === "string" ? src.data.length : 0;
  return `\`[image: ${src.media_type ?? src.type ?? "unknown"}, ${bytes} base64 chars — full data in .request.txt]\``;
}

// ---- OpenAI -----------------------------------------------------------------

export function renderOpenAIRequest(j: any): string {
  const parts: string[] = [];

  const params = renderParams(j, [
    "max_tokens",
    "max_output_tokens",
    "temperature",
    "top_p",
    "stream",
    "stop",
    "tool_choice",
    "reasoning",
    "metadata",
  ]);
  if (params) parts.push(params);

  // /responses uses `instructions` as the system prompt.
  if (typeof j.instructions === "string" && j.instructions.length > 0) {
    parts.push(
      ["<system-prompt>", "", j.instructions, "", "</system-prompt>"].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderOpenAITools(j.tools));
  }

  // /chat/completions => messages ; /responses => input (string or items)
  if (Array.isArray(j.messages)) {
    parts.push(renderMessages(j.messages, renderOpenAIChatContent));
  } else if (typeof j.input === "string") {
    parts.push(
      [
        "<messages>",
        "",
        '<message role="user">',
        "",
        j.input,
        "",
        "</message>",
        "",
        "</messages>",
      ].join("\n")
    );
  } else if (Array.isArray(j.input)) {
    parts.push(renderMessages(j.input, renderOpenAIResponsesContent));
  }

  return parts.join("\n\n");
}

function renderOpenAITools(tools: any[]): string {
  const rendered = tools.map((tool) => {
    // chat: { type: "function", function: { name, description, parameters } }
    // responses: { type: "function", name, description, parameters }
    const fn = tool.function ?? tool;
    const lines = [`### ${fn.name ?? tool.type ?? "(unnamed tool)"}`, ""];
    if (fn.description) lines.push(fn.description, "");
    if (fn.parameters) lines.push(fenceJson(fn.parameters));
    return lines.join("\n");
  });
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

function renderOpenAIChatContent(message: any): string {
  // In chat/completions each element IS the message {role, content, tool_calls}.
  const out: string[] = [];
  const content = message.content;
  if (typeof content === "string") {
    out.push(content);
  } else if (Array.isArray(content)) {
    out.push(
      content
        .map((b) =>
          b?.type === "image_url"
            ? "`[image_url]`"
            : blockText(b) || fenceJson(b)
        )
        .join("\n\n")
    );
  }
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      const fn = call.function ?? {};
      out.push(
        [
          `<tool-use name="${fn.name}" id="${call.id ?? ""}">`,
          "",
          fence(fn.arguments ?? "", "json"),
          "",
          "</tool-use>",
        ].join("\n")
      );
    }
  }
  if (message.role === "tool") {
    out.push(
      [
        `<tool-result tool-call-id="${message.tool_call_id ?? ""}">`,
        "",
        typeof content === "string" ? content : fenceJson(content),
        "",
        "</tool-result>",
      ].join("\n")
    );
  }
  return out.join("\n\n");
}

function renderOpenAIResponsesContent(item: any): string {
  // /responses input items: message, function_call, function_call_output, ...
  switch (item?.type) {
    case "message":
    case undefined: {
      const content = item.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((b) => blockText(b) || fenceJson(b)).join("\n\n");
      }
      return fenceJson(item);
    }
    case "function_call":
      return [
        `<tool-use name="${item.name}" id="${item.call_id ?? item.id ?? ""}">`,
        "",
        fence(item.arguments ?? "", "json"),
        "",
        "</tool-use>",
      ].join("\n");
    case "function_call_output":
      return [
        `<tool-result call-id="${item.call_id ?? ""}">`,
        "",
        typeof item.output === "string" ? item.output : fenceJson(item.output),
        "",
        "</tool-result>",
      ].join("\n");
    default:
      return fenceJson(item);
  }
}

// ---- Gemini -----------------------------------------------------------------
//
// Gemini's shape differs from the other two everywhere it matters:
//  - the system prompt sits beside the messages as `systemInstruction`, not as
//    a field on the request and not as the first message;
//  - roles are `user` and `model`. There is no `assistant`;
//  - tools are nested twice, and the schema sits under a different key;
//  - sampling settings live in a nested config object.
//
// Under the free Google account login the whole body is wrapped one level
// deeper, and every response event is wrapped too. Both are unwrapped first, so
// the two auth routes then share one code path.

function unwrapGeminiRequest(j: any): any {
  return j && typeof j.request === "object" && j.request !== null
    ? j.request
    : j;
}

export function renderGeminiRequest(rawJson: any): string {
  const j = unwrapGeminiRequest(rawJson);
  const parts: string[] = [];

  const params = renderParams(
    {
      ...(j.generationConfig ?? {}),
      toolConfig: j.toolConfig,
      safetySettings: j.safetySettings,
    },
    [
      "temperature",
      "topP",
      "topK",
      "maxOutputTokens",
      "candidateCount",
      "stopSequences",
      "responseMimeType",
      "thinkingConfig",
      "toolConfig",
      "safetySettings",
    ]
  );
  if (params) parts.push(params);

  if (j.systemInstruction != null) {
    parts.push(
      [
        "<system-prompt>",
        "",
        renderGeminiParts(j.systemInstruction.parts ?? j.systemInstruction),
        "",
        "</system-prompt>",
      ].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderGeminiTools(j.tools));
  }

  parts.push(
    renderMessages(
      Array.isArray(j.contents) ? j.contents : [],
      renderGeminiContent
    )
  );

  return parts.join("\n\n");
}

function renderGeminiTools(tools: any[]): string {
  const rendered: string[] = [];
  for (const tool of tools) {
    if (Array.isArray(tool?.functionDeclarations)) {
      for (const fn of tool.functionDeclarations) {
        const lines = [`### ${fn.name ?? "(unnamed tool)"}`, ""];
        // oxlint-disable-next-line max-depth -- legacy: predates this rule
        if (fn.description) lines.push(fn.description, "");
        const schema = fn.parametersJsonSchema ?? fn.parameters;
        // oxlint-disable-next-line max-depth -- legacy: predates this rule
        if (schema) lines.push(fenceJson(schema));
        rendered.push(lines.join("\n"));
      }
      continue;
    }
    // Built-in tools arrive as bare keys, e.g. { googleSearch: {} }
    for (const key of Object.keys(tool ?? {})) {
      rendered.push([`### ${key}`, "", fenceJson(tool[key])].join("\n"));
    }
  }
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

function renderGeminiContent(message: any): string {
  return renderGeminiParts(message?.parts);
}

function renderGeminiParts(parts: any): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return fenceJson(parts);
  return parts
    .map((part) => {
      if (typeof part?.text === "string") {
        return part.thought
          ? ["<thinking>", "", part.text, "", "</thinking>"].join("\n")
          : part.text;
      }
      if (part?.functionCall) {
        const call = part.functionCall;
        return [
          `<tool-use name="${call.name ?? ""}" id="${call.id ?? ""}">`,
          "",
          fenceJson(call.args ?? {}),
          "",
          "</tool-use>",
        ].join("\n");
      }
      if (part?.functionResponse) {
        const result = part.functionResponse;
        return [
          `<tool-result name="${result.name ?? ""}" id="${result.id ?? ""}">`,
          "",
          typeof result.response === "string"
            ? result.response
            : fenceJson(result.response),
          "",
          "</tool-result>",
        ].join("\n");
      }
      if (part?.inlineData) {
        const data = part.inlineData;
        const bytes = typeof data.data === "string" ? data.data.length : 0;
        return `\`[inline data: ${data.mimeType ?? "unknown"}, ${bytes} base64 chars — full data in .request.txt]\``;
      }
      return fenceJson(part);
    })
    .join("\n\n");
}

// ---- shared message list ----------------------------------------------------

function renderMessages(
  messages: any[],
  renderContent: (message: any) => string
): string {
  if (!Array.isArray(messages)) return "<messages></messages>";
  const rendered = messages.map((message, i) => {
    const role = message.role ?? message.type ?? "unknown";
    // Anthropic: content lives on msg.content ; renderContent handles the shape.
    const inner =
      renderContent === renderAnthropicContent
        ? renderAnthropicContent(message.content)
        : renderContent(message);
    return [
      `<message index="${i + 1}" role="${role}">`,
      "",
      inner,
      "",
      "</message>",
    ].join("\n");
  });
  return ["<messages>", "", rendered.join("\n\n"), "", "</messages>"].join(
    "\n"
  );
}
