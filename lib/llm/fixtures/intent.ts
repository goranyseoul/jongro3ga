import type { RunOptions, ToolCallResult } from "../index";
import { findProcedureId } from "../procedure-names";

// Fixture for draft_procedure_request: recognizes the procedure name and a stated amount, nothing else, like
// the prompt asks the live model to do. Covers "리주란 받고 싶어", "リジュラン受けたい", "I want Rejuran 2cc".

const UNIT_WORDS: Array<[RegExp, string]> = [
  [/^(cc|ml|씨씨|シーシー|毫升)$/i, "cc"],
  [/^(shots?|샷|ショット|発|发)$/i, "shot"],
  [/^(units?|u|유닛|単位|ユニット|单位)$/i, "unit"],
  [/^(vials?|바이알|バイアル|瓶)$/i, "vial"],
  [/^(lines?|줄|本|根)$/i, "line"],
  [/^(sessions?|회|回|次)$/i, "session"],
];

export function parseAmount(text: string): { value: number; unit: string } | undefined {
  const m = text.normalize("NFKC").match(/(\d+(?:\.\d+)?)\s*(cc|ml|씨씨|シーシー|毫升|shots?|샷|ショット|発|发|units?|유닛|単位|ユニット|单位|vials?|바이알|バイアル|瓶|lines?|줄|本|根)/i);
  if (!m) return undefined;
  const unit = UNIT_WORDS.find(([pattern]) => pattern.test(m[2]!))?.[1];
  return unit ? { value: Number(m[1]), unit } : undefined;
}

export function intentAgent(options: RunOptions): ToolCallResult {
  const utterance = [...options.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const procedureId = findProcedureId(utterance) ?? "unknown";
  const amount = parseAmount(utterance);
  return {
    text: "",
    toolCalls: [{ name: "draft_procedure_request", input: { procedureId, ...(amount ? { amount } : {}) } }],
  };
}

export const intentFixtures = { "intent.draft": intentAgent };
