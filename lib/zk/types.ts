import type { OfferProofV1 } from "../a2a/schemas";

// Shapes of the glowpass HTTP API (docs/INTEGRATION.md section 5). Only the fields the app reads are typed.

export interface VerifiedRecordView {
  procedureId: string;
  procedure: string;
  clinicId: string;
  clinic: string;
  daysAgo: number;
  tx: string;
  source: "clinic_confirmed";
}

export interface SelfReportedRecord {
  date: string;
  procedureId: string;
  amount?: number;
  where?: string;
  yearInferred?: boolean;
  procedure?: string;
  source?: "self_reported";
}

export interface WalletView {
  today: number;
  verifiedRecords: VerifiedRecordView[];
  selfReported: SelfReportedRecord[];
  onchain: { subjectId: string; commitment: string; version: number };
  pendingReviews: Array<{ clinicId: string; procedureId: string; clinic: string; procedure: string }>;
}

export interface OfferMatch {
  offerId: string;
  clinicId: string;
  clinic: string;
  title: string;
  benefit: string;
  conditions: string[];
  eligible: boolean;
  scene?: number;
}

/** pibu/offer-proof@1 without schema, clinicId, chainId and registry. */
export interface ProofBundle {
  subjectId: string;
  offerId: string;
  today: number;
  provingMs?: number;
  /** True when the pseudonym has no on-chain commitment yet: the proof was made against the local empty chart. */
  unanchored?: boolean;
  proofs: OfferProofV1["proofs"];
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
  /** The verifier applied the "never anchored = empty chart" rule instead of comparing with the chain. */
  unanchored?: boolean;
  commitment?: string;
  today?: number;
  conditions?: string[];
}

export interface AnchorResult {
  tx: string;
  day: number;
}

export interface ReviewInput {
  rating: number;
  text?: string;
}

export interface ReviewResult {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface ZkStats {
  verifiedUsersByProcedure?: Record<string, number>;
  [key: string]: unknown;
}

export interface LedgerView {
  deployment: Record<string, unknown>;
  ledger: unknown[];
  personas: unknown[];
}
