import type { RunOptions, ToolCallResult } from "../index";
import { consultFixtures } from "./consult";
import { intentFixtures } from "./intent";
import { onboardingFixtures } from "./onboarding";

// Deterministic stand-ins for Claude (09: "데모 모드 응답", lib/llm/fixtures/). A fixture is either a fixed
// answer or a function of the run options, so a scripted conversation can still read the prompt it was given.

export type Fixture = ToolCallResult | ((options: RunOptions) => ToolCallResult);

export const FIXTURES: Record<string, Fixture> = {
  ...onboardingFixtures,
  ...intentFixtures,
  ...consultFixtures,
};

export class FixtureMissingError extends Error {
  constructor(readonly fixtureKey: string) {
    super(`no fixture for ${fixtureKey}`);
    this.name = "FixtureMissingError";
  }
}

/**
 * Looks up `a.b.c`, then `a.b`, then `a`, so a caller can pass a specific key (scenario and locale) and still
 * land on a generic fixture.
 */
export function findFixture(fixtureKey: string): Fixture | undefined {
  const parts = fixtureKey.split(".");
  for (let n = parts.length; n > 0; n--) {
    const fixture = FIXTURES[parts.slice(0, n).join(".")];
    if (fixture) return fixture;
  }
  return undefined;
}

export function resolveFixture(options: RunOptions): ToolCallResult {
  const fixture = findFixture(options.fixtureKey);
  if (!fixture) throw new FixtureMissingError(options.fixtureKey);
  const result = typeof fixture === "function" ? fixture(options) : fixture;
  return { text: result.text, toolCalls: result.toolCalls.map((call) => ({ name: call.name, input: structuredClone(call.input) })) };
}
