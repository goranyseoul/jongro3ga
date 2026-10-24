import type { Nationality } from "../../domain/common";
import type { RuleActionDraft, RuleConditionDraft } from "../tools/rules";
import type { SystemPrompt } from "../types";

// Rule proposer stage 2 (07 4절). Stage 1 (deterministic triggers, WP4) hands over its candidates and the
// segment table; Claude writes the Korean reason and evidence summary of each and may add at most two patterns.
// No personal data goes in: segments are clinic x nationality aggregates.

export type TriggerKind = "quote_gap" | "low_satisfaction" | "response_timeout" | "area_preference" | "side_effect";

export interface TriggerCandidate {
  trigger: TriggerKind;
  when: RuleConditionDraft;
  then: RuleActionDraft;
  clinicId?: string;
  clinicName?: string;
  nationality?: Nationality;
  /** Sample size of the segment. */
  n: number;
  /** The trigger's measured value: mean quoteGapRatio (0.31), low satisfaction or timeout share, rating gap. */
  value: number;
  outcomeIds: string[];
  signalIds: string[];
  urgent?: boolean;
  expiresInDays?: number;
}

export interface SegmentStat {
  clinicId: string;
  nationality?: Nationality;
  procedureId?: string;
  n: number;
  avgQuoteGapRatio?: number;
  avgSatisfaction?: number;
  lowSatisfactionShare?: number;
  timeoutShare?: number;
  outcomeIds?: string[];
}

export interface ProposerInput {
  candidates: TriggerCandidate[];
  segments: SegmentStat[];
  /** Registry clinic ids. Drafts naming anything else are dropped. */
  knownClinicIds: string[];
  /** Display names for the reasons, e.g. { cln_ara: "아라의원" }. */
  clinicNames?: Record<string, string>;
}

export const PROPOSER_STABLE = `You help the PibooK operators keep clinic routing fair. You receive rule candidates found by deterministic triggers (stage 1) and a 30 day segment table (clinic x nationality, no personal data). Return them with the propose_rules schema.

## What to write
- For every stage 1 candidate: keep "when" and "then" exactly, set origin "trigger", and write reason (one Korean line with the number, e.g. "견적 대비 실결제 평균 +31% (n=20)") and evidence.summary (one or two Korean sentences of what the data shows). Copy outcomeIds and signalIds.
- You may add at most 2 extra patterns the triggers missed, with origin "pattern". Each needs outcomeIds from the table as evidence. Do not add a pattern if the data is thin.
- Numbers come from the input only. Never invent counts, rates or ids.

## Guardrails (07, enforced again by the server)
1. A nationality condition is only for language or area preference, or to exclude a clinic where harm to that nationality was actually recorded. Never set or vary prices by nationality, never treat people worse for their nationality alone.
2. Health information (safety, skin condition) is never a rule condition. The condition fields are only: procedureIds, nationalities, languages, areas, ageBands, firstKProcedure, budgetMaxBelowKrw.
3. exclude_clinic expires after 90 days unless the candidate says otherwise. Side effect candidates stay urgent.
4. Only clinic ids from the given registry list.`;

export function buildProposerPrompt(input: ProposerInput): SystemPrompt {
  return {
    stable: PROPOSER_STABLE,
    dynamic: `## Input
Registry clinic ids: ${JSON.stringify(input.knownClinicIds)}
Clinic names: ${JSON.stringify(input.clinicNames ?? {})}
Stage 1 candidates: ${JSON.stringify(input.candidates)}
Segments (30 days): ${JSON.stringify(input.segments)}`,
  };
}
