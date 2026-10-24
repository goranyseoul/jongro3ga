import type { ZkClause } from "../../a2a/schemas";
import type { ZkChart } from "../../domain/zk";
import { offerEligible } from "../clauses";
import { clinicIdByCode, procedureIdByCode } from "../codes";

// Public offer rules as GET /api/offers returns them (glowpass/catalog.mjs): clauses carry circuit codes
// (`type`, `clinic`) instead of ids. Matching happens here, on the device, with no network call.

/** One clause in circuit codes; 0 or absent type/clinic means "any". */
export interface CodedClause {
  type?: number;
  clinic?: number;
  minDays?: number;
  maxDays?: number;
  minCount?: number;
  maxCount?: number;
}

export interface PublicOffer {
  id: string;
  clinicId: string;
  clinic: string;
  title: string;
  benefit: string;
  /** Human-readable conditions (Medical Act decree art. 23 keeps them required). */
  conditions: string[];
  clauses: ZkClause[];
}

const optionalCount = (value: unknown): number | undefined =>
  Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined;

/** Circuit codes back to wire ids (zk/codes.json reversed). Throws on a code this app does not know. */
export function fromCodedClause(clause: CodedClause): ZkClause {
  const result: ZkClause = {};
  if (clause.type) result.type = procedureIdByCode(clause.type);
  if (clause.clinic) result.clinicId = clinicIdByCode(clause.clinic);
  if (clause.minDays !== undefined) result.minDays = clause.minDays;
  if (clause.maxDays !== undefined) result.maxDays = clause.maxDays;
  if (clause.minCount !== undefined) result.minCount = clause.minCount;
  if (clause.maxCount !== undefined) result.maxCount = clause.maxCount;
  return result;
}

const toCodedClause = (raw: unknown): CodedClause => {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    type: optionalCount(value.type),
    clinic: optionalCount(value.clinic),
    minDays: optionalCount(value.minDays),
    maxDays: optionalCount(value.maxDays),
    minCount: optionalCount(value.minCount),
    maxCount: optionalCount(value.maxCount),
  };
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Parses the /api/offers payload. Offers whose clauses use an unknown code or are empty are dropped:
 * the wallet only claims offers it can evaluate exactly.
 */
export function parsePublicOffers(payload: unknown): PublicOffer[] {
  if (!Array.isArray(payload)) throw new Error("offers payload is not an array");
  const offers: PublicOffer[] = [];
  for (const raw of payload) {
    if (typeof raw !== "object" || raw === null) continue;
    const value = raw as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.clinicId !== "string" || !Array.isArray(value.clauses)) continue;
    try {
      const clauses = value.clauses.map((clause) => fromCodedClause(toCodedClause(clause)));
      if (clauses.length === 0) continue;
      offers.push({
        id: value.id,
        clinicId: value.clinicId,
        clinic: text(value.clinic) || value.clinicId,
        title: text(value.title),
        benefit: text(value.benefit),
        conditions: Array.isArray(value.conditions) ? value.conditions.map(text).filter(Boolean) : [],
        clauses,
      });
    } catch {
      // unknown circuit code: skip the offer rather than guess
    }
  }
  return offers;
}

/** On-device match: true when the local chart satisfies every clause of the offer today. */
export const matchesOffer = (chart: ZkChart, today: number, offer: PublicOffer): boolean =>
  offerEligible(chart, today, offer.clauses);
