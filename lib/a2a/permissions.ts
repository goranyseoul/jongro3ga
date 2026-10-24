import type { AgentRole } from "../domain";
import type { SkillId } from "./schemas";

// Who may call which skill: the "호출자" column of the three skill tables in docs/spec/02-agents.md.
// lib/a2a/server.ts answers HTTP 403 (JSON-RPC -32098) to any other role before the skill runs.
export const SKILL_CALLERS: Readonly<Record<SkillId, readonly AgentRole[]>> = {
  "platform.recipe": ["customer"],
  "platform.match_clinics": ["customer"],
  "platform.judge_quote": ["customer"],
  "platform.report_booking": ["clinic"],
  "platform.submit_outcome": ["customer"],
  "platform.report_signal": ["customer"],
  "platform.anchor_record": ["customer"],
  "platform.submit_review": ["customer"],
  "clinic.offers": ["platform", "customer"],
  "clinic.quote": ["customer"],
  "clinic.availability": ["customer"],
  "clinic.book": ["customer"],
  "clinic.cancel": ["customer"],
  "customer.notify": ["clinic", "platform"],
  "customer.checkin": ["platform"],
};

export function allowedCallers(skillId: SkillId): readonly AgentRole[] {
  return SKILL_CALLERS[skillId];
}

export function canCall(role: AgentRole, skillId: SkillId): boolean {
  return SKILL_CALLERS[skillId].includes(role);
}
