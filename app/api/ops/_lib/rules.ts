import { RuleTransitionError, daysToExpiry, reviewDue, type OpsRule } from "../../../../lib/agents/platform/proposer-rules";
import { errorJson } from "./http";

/** A rule as /ops/rules shows it: the stored rule plus expiry bookkeeping. */
export function present(rule: OpsRule, now: Date) {
  return { ...rule, daysToExpiry: daysToExpiry(rule, now), reviewDue: reviewDue(rule, now) };
}

export function transitionError(error: unknown): Response {
  if (error instanceof RuleTransitionError) {
    return error.code === "not_found" ? errorJson(404, "not_found", error.message) : errorJson(409, "invalid_transition", error.message);
  }
  return errorJson(500, "internal", error instanceof Error ? error.message : String(error));
}
