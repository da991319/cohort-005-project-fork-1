import { describe, it, expect } from "vitest";
import {
  agentProviders,
  CUSTOM_ID,
  listAgents,
  listProviders,
  shouldLogRequest,
} from "./agents";

describe("listAgents", () => {
  it("offers the agents in popularity order, refused ones last", () => {
    expect(listAgents().map((agent) => agent.id)).toEqual([
      "claude-code",
      "codex",
      "copilot",
      "opencode",
      "pi",
      "omp",
      "gemini",
      "antigravity",
      "junie",
      "cursor",
      "amp",
    ]);
  });

  it("puts every agent that can be logged above every agent that cannot", () => {
    const supported = listAgents().map((agent) => agent.supported);
    expect(supported.indexOf(false)).toBeGreaterThan(
      supported.lastIndexOf(true)
    );
  });

  it("marks Cursor as unsupported", () => {
    const cursor = listAgents().find((agent) => agent.id === "cursor");
    expect(cursor?.supported).toBe(false);
  });

  it("marks Claude Code as supported", () => {
    const claude = listAgents().find((agent) => agent.id === "claude-code");
    expect(claude?.supported).toBe(true);
  });

  it("says Claude Code needs a provider question now it has Vertex AI too", () => {
    const claude = listAgents().find((agent) => agent.id === "claude-code");
    expect(claude?.needsProvider).toBe(true);
  });

  it("says OpenCode needs a provider question", () => {
    const opencode = listAgents().find((agent) => agent.id === "opencode");
    expect(opencode?.needsProvider).toBe(true);
  });

  it("marks OMP as supported", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.supported).toBe(true);
  });

  it("marks OMP as always custom", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.alwaysCustom).toBe(true);
  });

  it("says no other agent is always custom", () => {
    const others = listAgents().filter(
      (agent) => agent.id !== "omp" && agent.id !== "junie"
    );
    expect(others.every((agent) => agent.alwaysCustom === false)).toBe(true);
  });

  it("says OMP needs no provider question, because it never shows one", () => {
    const omp = listAgents().find((agent) => agent.id === "omp");
    expect(omp?.needsProvider).toBe(false);
  });

  it("marks Junie as supported and always custom", () => {
    const junie = listAgents().find((agent) => agent.id === "junie");
    expect(junie?.supported).toBe(true);
    expect(junie?.alwaysCustom).toBe(true);
  });

  it("says Junie needs no provider question either, even though it has two internal templates", () => {
    // Junie is the first alwaysCustom agent with more than one catalogue
    // provider (see findCustomTemplate) — needsProvider must stay false
    // regardless, because askChoice skips the provider question for any
    // alwaysCustom agent before providers.length is ever consulted.
    const junie = listAgents().find((agent) => agent.id === "junie");
    expect(junie?.needsProvider).toBe(false);
  });
});

describe("listProviders", () => {
  it("returns nothing for an agent with one provider", () => {
    expect(listProviders("copilot")).toEqual([]);
  });

  it("returns nothing for a refused agent", () => {
    expect(listProviders("cursor")).toEqual([]);
  });

  it("returns both Claude Code providers", () => {
    expect(listProviders("claude-code").map((p) => p.id)).toEqual([
      "anthropic",
      "vertex",
    ]);
  });

  it("leads Claude Code with the Anthropic route, which is the simplest", () => {
    expect(listProviders("claude-code")[0].id).toBe("anthropic");
  });

  it("returns both OpenCode providers", () => {
    expect(listProviders("opencode").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
    ]);
  });

  it("returns all three Pi providers", () => {
    expect(listProviders("pi").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
      "codex",
    ]);
  });

  it("leads Pi with the Anthropic route, which is the simplest", () => {
    expect(listProviders("pi")[0].id).toBe("anthropic");
  });
});

describe("agentProviders", () => {
  it("returns the one provider a single-provider agent has, unlike listProviders", () => {
    expect(listProviders("copilot")).toEqual([]);
    expect(agentProviders("copilot").map((p) => p.id)).toEqual(["github"]);
  });

  it("returns nothing for a refused agent", () => {
    expect(agentProviders("cursor")).toEqual([]);
  });

  it("returns OMP's one internal template provider, even though the wizard never shows it", () => {
    // config.ts never calls agentProviders for an alwaysCustom agent — see
    // askChoice — but the entry exists to hold the command/setup template
    // resolveCustomTarget borrows from, so it is not empty here.
    expect(agentProviders("omp").map((p) => p.id)).toEqual([CUSTOM_ID]);
  });

  it("agrees with listProviders once there are two or more", () => {
    expect(agentProviders("opencode").map((p) => p.id)).toEqual(
      listProviders("opencode").map((p) => p.id)
    );
  });

  it("returns Junie's two internal template providers, even though the wizard never shows them", () => {
    // Same reasoning as OMP above, except Junie has two templates to pick
    // between (see findCustomTemplate) rather than one.
    expect(agentProviders("junie").map((p) => p.id)).toEqual([
      "anthropic",
      "openai",
    ]);
  });
});

describe("shouldLogRequest", () => {
  it("logs a real Anthropic turn", () => {
    expect(
      shouldLogRequest("POST", "/v1/messages?beta=true", "anthropic")
    ).toBe(true);
  });

  it("drops Anthropic token counting", () => {
    expect(
      shouldLogRequest("POST", "/v1/messages/count_tokens", "anthropic")
    ).toBe(false);
  });

  it("logs a real Claude Code on Vertex AI turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1/projects/my-proj/locations/global/publishers/anthropic/models/claude-sonnet-4-5:streamRawPredict",
        "anthropic"
      )
    ).toBe(true);
  });

  it("drops Vertex AI token counting, which uses countTokens instead of count_tokens", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1/projects/my-proj/locations/global/publishers/anthropic/models/claude-sonnet-4-5:countTokens",
        "anthropic"
      )
    ).toBe(false);
  });

  it("drops a connectivity probe, which would write an empty document", () => {
    expect(shouldLogRequest("HEAD", "/api/hello", "anthropic")).toBe(false);
  });

  it("drops a GET, because a model call is always a POST", () => {
    expect(shouldLogRequest("GET", "/v1/models", "openai")).toBe(false);
  });

  it("ignores the case of the method", () => {
    expect(shouldLogRequest("post", "/v1/messages", "anthropic")).toBe(true);
  });

  it("logs a real OpenAI turn", () => {
    expect(shouldLogRequest("POST", "/v1/responses", "openai")).toBe(true);
  });

  it("logs a streaming Gemini turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:streamGenerateContent",
        "gemini"
      )
    ).toBe(true);
  });

  it("logs a non-streaming Gemini turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:generateContent",
        "gemini"
      )
    ).toBe(true);
  });

  it("drops Gemini token counting, which has its own name", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:countTokens",
        "gemini"
      )
    ).toBe(false);
  });

  it("drops the Google login housekeeping calls, which carry no prompt", () => {
    expect(
      shouldLogRequest("POST", "/v1internal:loadCodeAssist", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:retrieveUserQuota", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:listExperiments", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:recordCodeAssistMetrics", "gemini")
    ).toBe(false);
  });
});
