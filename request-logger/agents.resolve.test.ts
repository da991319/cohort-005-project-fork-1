import { describe, it, expect } from "vitest";
import {
  ISSUE_URL,
  listAgents,
  listProviders,
  OTHER_ID,
  resolveChoice,
} from "./agents";
import { PORT, target } from "./agents.fixtures";

describe('resolveChoice — "Other"', () => {
  it("asks for the missing agent instead of failing", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    expect(result.kind).toBe("request");
  });

  it("asks for the missing provider of an agent it knows", () => {
    const result = resolveChoice({ agent: "codex", provider: OTHER_ID }, PORT);
    expect(result.kind).toBe("request");
  });

  it("names the agent when the student named one", () => {
    const result = resolveChoice({ agent: "codex", provider: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.agentLabel).toBe("Codex");
  });

  it("names no agent when the agent itself was the missing one", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.agentLabel).toBeNull();
  });

  it("sends the student to the issue tracker", () => {
    const result = resolveChoice({ agent: OTHER_ID }, PORT);
    if (result.kind !== "request") throw new Error("expected a request");
    expect(result.url).toBe(ISSUE_URL);
    expect(result.url).toContain("/issues/new");
  });

  it("never offers Other as an agent in the catalogue", () => {
    // The wizard adds it to the question. It is not an agent, so it must not
    // appear in the list the catalogue publishes.
    expect(listAgents().map((agent) => agent.id)).not.toContain(OTHER_ID);
    expect(listProviders("codex").map((p) => p.id)).not.toContain(OTHER_ID);
  });
});

describe("resolveChoice — upstream hosts", () => {
  it("sends Claude Code to Anthropic", () => {
    expect(target("claude-code", "anthropic").upstreamHost).toBe(
      "api.anthropic.com"
    );
  });

  it("sends Claude Code on Vertex AI to the global Vertex endpoint", () => {
    expect(target("claude-code", "vertex").upstreamHost).toBe(
      "aiplatform.googleapis.com"
    );
  });

  it("gives Claude Code's two providers different hosts", () => {
    expect(target("claude-code", "anthropic").upstreamHost).not.toBe(
      target("claude-code", "vertex").upstreamHost
    );
  });

  it("sends Codex on an API key to OpenAI", () => {
    expect(target("codex", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Codex on a ChatGPT subscription to chatgpt.com", () => {
    expect(target("codex", "chatgpt").upstreamHost).toBe("chatgpt.com");
  });

  it("sends Copilot to its own host", () => {
    expect(target("copilot").upstreamHost).toBe("api.githubcopilot.com");
  });

  it("sends OpenCode on Anthropic to Anthropic", () => {
    expect(target("opencode", "anthropic").upstreamHost).toBe(
      "api.anthropic.com"
    );
  });

  it("sends OpenCode on OpenAI to OpenAI", () => {
    expect(target("opencode", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Pi on Anthropic to Anthropic", () => {
    expect(target("pi", "anthropic").upstreamHost).toBe("api.anthropic.com");
  });

  it("sends Pi on OpenAI to OpenAI", () => {
    expect(target("pi", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Pi on a ChatGPT subscription to the ChatGPT host", () => {
    expect(target("pi", "codex").upstreamHost).toBe("chatgpt.com");
  });

  it("does not send Pi on a ChatGPT subscription to the OpenAI host", () => {
    expect(target("pi", "codex").upstreamHost).not.toBe("api.openai.com");
  });

  it("sends Gemini on an API key to the public API host", () => {
    expect(target("gemini", "api-key").upstreamHost).toBe(
      "generativelanguage.googleapis.com"
    );
  });

  it("sends Gemini on a Google login to the Code Assist host", () => {
    expect(target("gemini", "google-login").upstreamHost).toBe(
      "cloudcode-pa.googleapis.com"
    );
  });

  it("gives the two Gemini routes different hosts", () => {
    expect(target("gemini", "api-key").upstreamHost).not.toBe(
      target("gemini", "google-login").upstreamHost
    );
  });

  it("sends Antigravity CLI's API key route to the same public API host as Gemini CLI's", () => {
    expect(target("antigravity", "api-key").upstreamHost).toBe(
      "generativelanguage.googleapis.com"
    );
    expect(target("antigravity", "api-key").upstreamHost).toBe(
      target("gemini", "api-key").upstreamHost
    );
  });
});

describe("resolveChoice — renderers", () => {
  it("reads Claude Code with the Anthropic renderer", () => {
    expect(target("claude-code", "anthropic").renderer).toBe("anthropic");
  });

  it("reads Claude Code on Vertex AI with the Anthropic renderer too, since Vertex's Claude endpoint is the same Messages API shape", () => {
    expect(target("claude-code", "vertex").renderer).toBe("anthropic");
  });

  it("reads Codex with the OpenAI renderer", () => {
    expect(target("codex", "openai").renderer).toBe("openai");
    expect(target("codex", "chatgpt").renderer).toBe("openai");
  });

  it("reads Copilot with the OpenAI renderer", () => {
    expect(target("copilot").renderer).toBe("openai");
  });

  it("reads OpenCode on Anthropic with the Anthropic renderer", () => {
    expect(target("opencode", "anthropic").renderer).toBe("anthropic");
  });

  it("reads OpenCode on OpenAI with the OpenAI renderer", () => {
    expect(target("opencode", "openai").renderer).toBe("openai");
  });

  it("reads Pi on a ChatGPT subscription with the OpenAI renderer", () => {
    expect(target("pi", "codex").renderer).toBe("openai");
  });

  it("reads both Gemini routes with the Gemini renderer", () => {
    expect(target("gemini", "api-key").renderer).toBe("gemini");
    expect(target("gemini", "google-login").renderer).toBe("gemini");
  });

  it("reads Antigravity CLI with the Gemini renderer too, since it speaks the same wire format", () => {
    expect(target("antigravity", "api-key").renderer).toBe("gemini");
  });
});

describe("resolveChoice — base URLs", () => {
  it("gives OpenCode the /v1 suffix its SDK needs", () => {
    expect(target("opencode", "anthropic").baseUrl).toBe(
      "http://localhost:8787/v1"
    );
  });

  it("gives Claude Code no suffix, because it appends the whole path itself", () => {
    expect(target("claude-code", "anthropic").baseUrl).toBe(
      "http://localhost:8787"
    );
  });

  it("gives Claude Code on Vertex AI no suffix either, for the same reason", () => {
    expect(target("claude-code", "vertex").baseUrl).toBe(
      "http://localhost:8787"
    );
  });

  it("gives Copilot no suffix", () => {
    expect(target("copilot").baseUrl).toBe("http://localhost:8787");
  });

  it("gives Pi on Anthropic no suffix, because Pi's SDK adds /v1/messages", () => {
    expect(target("pi", "anthropic").baseUrl).toBe("http://localhost:8787");
  });

  it("gives Pi on OpenAI the /v1 suffix, because that SDK adds only /responses", () => {
    expect(target("pi", "openai").baseUrl).toBe("http://localhost:8787/v1");
  });

  it("gives Pi on a ChatGPT subscription the /backend-api suffix", () => {
    // Pi appends /codex/responses itself, and the real endpoint sits under
    // /backend-api. Without the suffix the forwarded path loses that segment.
    expect(target("pi", "codex").baseUrl).toBe(
      "http://localhost:8787/backend-api"
    );
  });

  it("uses the port it is given", () => {
    const result = resolveChoice(
      { agent: "claude-code", provider: "anthropic" },
      { port: 9000, platform: "linux" }
    );
    expect(result.kind === "target" && result.baseUrl).toBe(
      "http://localhost:9000"
    );
  });

  it("puts the chosen port into the command", () => {
    const result = resolveChoice(
      { agent: "claude-code", provider: "anthropic" },
      { port: 9000, platform: "linux" }
    );
    expect(result.kind === "target" && result.command).toContain(
      "http://localhost:9000"
    );
  });
});
