// Agent-facing ZK bridge used by the clinic and customer agents (contract from docs/spec/BUILD-TRACKS.md).
// Lives next to the shared ZK library (index.ts re-exports both).
// Customer and clinic agents call these when ZK_SERVER_URL is set; null means "ZK not configured, skip".
export interface ZkOfferProofBundle {
  subjectId: string;
  offerId: string;
  today: number;
  proofs: { proof: string; publicInputs: string[] }[];
}

export interface ZkVerification {
  ok: boolean;
  reason?: string;
}

export function zkEnabled(): boolean {
  return Boolean(process.env.ZK_SERVER_URL);
}

/** Customer side: offers this customer is eligible for, matched on the device/server holding the chart. */
export async function matchOffers(_persona: string): Promise<{ clinicId: string; offerId: string; title: string; eligible: boolean }[] | null> {
  return null;
}

/** Customer side: build the proof bundle to attach as metadata.zkOfferProof on clinic.quote. */
export async function proveOffer(_persona: string, _offerId: string): Promise<ZkOfferProofBundle | null> {
  return null;
}

/** Clinic side: verify before applying an offer discount. */
export async function verifyOffer(_clinicId: string, _bundle: ZkOfferProofBundle): Promise<ZkVerification | null> {
  return null;
}
