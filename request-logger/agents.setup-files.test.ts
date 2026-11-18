import { describe, it, expect } from "vitest";
import { resolveChoice } from "./agents";
import { PORT, target } from "./agents.test-helpers";

describe("resolveChoice — setup files", () => {
  it("gives OpenCode a config file as the durable option", () => {
    expect(target("opencode", "anthropic").setup[0].path).toBe(
      "~/.config/opencode/opencode.json"
    );
  });

  it("puts the suffixed base URL into the OpenCode config file", () => {
    expect(target("opencode", "anthropic").setup[0].body).toContain(
      '"baseURL": "http://localhost:8787/v1"'
    );
  });

  it("leaves other placeholders in the OpenCode config alone", () => {
    expect(target("opencode", "anthropic").setup[0].body).toContain(
      "{env:ANTHROPIC_API_KEY}"
    );
  });

  it("gives Claude Code no config file to write", () => {
    expect(target("claude-code", "anthropic").setup).toEqual([]);
  });

  it("gives Claude Code on Vertex AI no config file either — it's all env vars", () => {
    expect(target("claude-code", "vertex").setup).toEqual([]);
  });

  it("gives Pi its models file, because Pi has no variable to set", () => {
    expect(target("pi", "anthropic").setup[0].path).toBe(
      "~/.pi/agent/models.json"
    );
  });

  it("uses Pi's exact spelling of the base URL key", () => {
    expect(target("pi", "anthropic").setup[0].body).toContain('"baseUrl"');
    expect(target("pi", "anthropic").setup[0].body).not.toContain('"baseURL"');
  });

  it("names Pi's Anthropic provider", () => {
    expect(target("pi", "anthropic").setup[0].body).toContain('"anthropic"');
  });

  it("names Pi's Codex provider with its hyphenated id", () => {
    expect(target("pi", "codex").setup[0].body).toContain('"openai-codex"');
  });

  it("gives Pi on a ChatGPT subscription a second file for the transport", () => {
    const files = target("pi", "codex").setup;
    expect(files).toHaveLength(2);
    expect(files[1].path).toBe("~/.pi/agent/settings.json");
  });

  it("sets the SSE transport in that second file", () => {
    expect(target("pi", "codex").setup[1].body).toContain('"transport": "sse"');
  });

  it("does not put the transport in the models file, where Pi would ignore it", () => {
    expect(target("pi", "codex").setup[0].body).not.toContain("transport");
  });

  it("gives Pi on Anthropic only one file to write", () => {
    expect(target("pi", "anthropic").setup).toHaveLength(1);
  });
});

describe("resolveChoice — notes and warnings", () => {
  it("explains the tool search flag to a Claude Code student", () => {
    expect(target("claude-code", "anthropic").notes.join(" ")).toContain(
      "ENABLE_TOOL_SEARCH"
    );
  });

  it("tells a Vertex AI student that ANTHROPIC_BASE_URL is ignored in Vertex mode", () => {
    const notes = target("claude-code", "vertex").notes.join(" ");
    expect(notes).toContain("ANTHROPIC_VERTEX_BASE_URL");
    expect(notes).toContain("ANTHROPIC_BASE_URL");
    expect(notes).toContain("silently ignored");
  });

  it("tells a Vertex AI student this entry only covers the global region", () => {
    expect(target("claude-code", "vertex").notes.join(" ")).toContain(
      "CLOUD_ML_REGION=global"
    );
  });

  it("tells a Codex student the flag does not touch their config file", () => {
    expect(target("codex", "openai").notes.join(" ")).toContain("config.toml");
  });

  it("tells a Copilot student where the extra documents come from", () => {
    expect(target("copilot").notes.join(" ")).toContain("MCP");
  });

  it("warns a Copilot student that some models write no log", () => {
    expect(target("copilot").warnings.join(" ")).toContain("WebSocket");
  });

  it("tells a Pi student on a ChatGPT subscription to use SSE", () => {
    expect(target("pi", "codex").notes.join(" ")).toContain("SSE");
  });

  it("tells a Pi student that the raw file keeps the compressed bytes", () => {
    expect(target("pi", "codex").notes.join(" ")).toContain(".request.txt");
  });

  it("warns a Gemini student that the two variables are not interchangeable", () => {
    expect(target("gemini", "api-key").warnings.join(" ")).toContain(
      "CODE_ASSIST_ENDPOINT"
    );
  });

  it("tells a Gemini student the Google login is free", () => {
    expect(target("gemini", "google-login").notes.join(" ")).toContain("free");
  });

  it("writes Antigravity CLI's settings file with modelProvider set to gemini", () => {
    const result = target("antigravity", "api-key");
    expect(result.setup).toHaveLength(1);
    expect(result.setup[0].path).toBe(
      "~/.gemini/antigravity-cli/settings.json"
    );
    expect(result.setup[0].body).toContain('"modelProvider": "gemini"');
  });

  it("tells an Antigravity CLI student to also export GEMINI_API_KEY", () => {
    expect(target("antigravity", "api-key").notes.join(" ")).toContain(
      "GEMINI_API_KEY"
    );
  });

  it("warns an Antigravity CLI student that the account sign-in route is not covered", () => {
    expect(target("antigravity", "api-key").warnings.join(" ")).toContain(
      "sign-in"
    );
  });
});

describe("resolveChoice — refusals", () => {
  it("refuses Cursor", () => {
    expect(resolveChoice({ agent: "cursor" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Cursor", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("refuses Amp", () => {
    expect(resolveChoice({ agent: "amp" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Amp", () => {
    const result = resolveChoice({ agent: "amp" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("names the agent in the refusal", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.agentLabel).toBe("Cursor CLI");
  });

  it("gives no upstream host for a refused agent", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result).not.toHaveProperty("upstreamHost");
  });
});

describe("resolveChoice — bad input", () => {
  it("rejects an unknown agent", () => {
    expect(resolveChoice({ agent: "nonesuch" }, PORT).kind).toBe("error");
  });

  it("lists the known agents when the agent is unknown", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("claude-code");
  });

  it("rejects a choice that omits a needed provider", () => {
    expect(resolveChoice({ agent: "opencode" }, PORT).kind).toBe("error");
  });

  it("lists the providers when one is missing", () => {
    const result = resolveChoice({ agent: "opencode" }, PORT);
    expect(result.kind === "error" && result.message).toContain("anthropic");
  });

  it("rejects an unknown provider", () => {
    expect(
      resolveChoice({ agent: "opencode", provider: "cohere" }, PORT).kind
    ).toBe("error");
  });

  it("accepts a single-provider agent with no provider given", () => {
    // Claude Code no longer qualifies now it has two providers (see below) —
    // Copilot is still single-provider and exercises this general case.
    expect(resolveChoice({ agent: "copilot" }, PORT).kind).toBe("target");
  });

  it("ignores a stale provider on a single-provider agent", () => {
    expect(target("copilot", "whatever").upstreamHost).toBe(
      "api.githubcopilot.com"
    );
  });

  it("now requires a provider for Claude Code, since it has two", () => {
    const result = resolveChoice({ agent: "claude-code" }, PORT);
    expect(result.kind).toBe("error");
    expect(result.kind === "error" && result.message).toContain("vertex");
  });

  it("points the student at --force when a choice cannot be resolved", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("--force");
  });
});
