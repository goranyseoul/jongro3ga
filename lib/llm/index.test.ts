import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { FixtureMissingError, findFixture } from "./fixtures";
import { llmMode, runClaude } from "./index";
import { modelFor } from "./models";
import { parseToolInput, zodTool } from "./tools";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("runClaude without an API key", () => {
  it("serves the deterministic fixture for the key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const options = {
      tier: "chat" as const,
      system: "",
      messages: [{ role: "user" as const, content: "リジュラン受けたい" }],
      fixtureKey: "intent.draft",
    };
    const first = await runClaude(options);
    const second = await runClaude(options);
    expect(first).toEqual({ text: "", toolCalls: [{ name: "draft_procedure_request", input: { procedureId: "rejuran_healer" } }] });
    expect(second).toEqual(first);
  });

  it("falls back from a specific key to its parent and fails loudly when nothing matches", async () => {
    expect(findFixture("consult.opener.yuki.ja")).toBeDefined();
    expect(findFixture("consult.opener.unknown_scenario")).toBe(findFixture("consult.opener"));
    await expect(runClaude({ tier: "fast", system: "", messages: [{ role: "user", content: "x" }], fixtureKey: "nope.nothing" })).rejects.toBeInstanceOf(
      FixtureMissingError,
    );
  });

  it("stays on fixtures under vitest even with a key, and LLM_MODE=fixtures forces them", () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    expect(llmMode()).toBe("fixtures");
    process.env.LLM_MODE = "fixtures";
    expect(llmMode()).toBe("fixtures");
  });

  it("picks models per tier from the environment with the 09 defaults", () => {
    delete process.env.CLAUDE_MODEL_CHAT;
    delete process.env.CLAUDE_MODEL_REASONING;
    delete process.env.CLAUDE_MODEL_FAST;
    expect([modelFor("chat"), modelFor("reasoning"), modelFor("fast")]).toEqual(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]);
    process.env.CLAUDE_MODEL_CHAT = "claude-opus-5-5";
    expect(modelFor("chat")).toBe("claude-opus-5-5");
  });
});

describe("tools from zod schemas", () => {
  const tool = zodTool("demo", "demo tool", z.strictObject({ id: z.enum(["a", "b"]), count: z.number().int().optional() }));

  it("generates a JSON Schema object for the API", () => {
    expect(tool.spec.inputSchema).toMatchObject({
      type: "object",
      properties: { id: { enum: ["a", "b"] }, count: { type: "integer" } },
      required: ["id"],
      additionalProperties: false,
    });
    expect(tool.spec.inputSchema.$schema).toBeUndefined();
  });

  it("returns a path-named error for invalid input", () => {
    expect(parseToolInput(tool, { id: "a" })).toEqual({ ok: true, value: { id: "a" } });
    const bad = parseToolInput(tool, { id: "c", count: 1.5, extra: true });
    expect(bad.ok).toBe(false);
    expect((bad as { error: string }).error).toMatch(/id: .*count: |count: .*id: /s);
  });
});
