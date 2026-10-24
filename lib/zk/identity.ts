// PibooK id -> GlowPass id (docs/INTEGRATION.md "PibooK와 GlowPass 식별자"). OWNER: track ZK.
//
// GlowPass (glowpass/catalog.mjs) keys wallets by the spec customer id (cus_*) and clinics by the spec
// clinic id (cln_*). The app knows a customer by the pseudonymous customer agent id (cag_*) bound at
// signup, so both are accepted here. Anything not in these tables has no ZK wallet: the client skips
// it (returns null) instead of asking GlowPass, which would only answer "unknown persona".

export interface PersonaRow {
  /** GlowPass persona id (catalog.mjs PERSONAS key, wallet file name). */
  glowpass: string;
  /** PibooK customer ids (docs/spec 06 customers.json, lib/ui-data/customer.ts). */
  customerIds: string[];
  /** PibooK customer agent ids (SessionUser.customerAgentId, A2A actor id). */
  customerAgentIds: string[];
}

/**
 * The one mapping table. cus_jisoo is deliberately absent: she lives in Korea, so matching and booking
 * are closed to her (08-compliance 2절) and her records are self-reported only, never provable.
 */
export const PERSONA_TABLE: readonly PersonaRow[] = [
  { glowpass: "cus_yuki", customerIds: ["cus_yuki", "cus_yuki_done"], customerAgentIds: ["cag_7f3k2"] },
  { glowpass: "cus_lin", customerIds: ["cus_lin"], customerAgentIds: ["cag_4n8vd"] },
  { glowpass: "cus_emily", customerIds: ["cus_emily"], customerAgentIds: ["cag_2q9wk"] },
];

/** PibooK clinic id -> GlowPass clinic id. Same ids today (catalog.mjs follows the spec registry). */
export const CLINIC_TABLE: Readonly<Record<string, string>> = {
  cln_seoul_glow: "cln_seoul_glow",
  cln_mint: "cln_mint",
  cln_hanbit: "cln_hanbit",
  cln_ara: "cln_ara",
  cln_dahye: "cln_dahye",
};

/** Customer used by the read-only /api/zk routes when nobody is signed in and DEMO_MODE=true (Yuki). */
export const DEMO_FALLBACK_CUSTOMER_AGENT_ID = "cag_7f3k2";

/** Accepts a GlowPass persona, a PibooK customer id or a customer agent id. */
export function toGlowpassPersona(id: string): string | null {
  const row = PERSONA_TABLE.find((r) => r.glowpass === id || r.customerIds.includes(id) || r.customerAgentIds.includes(id));
  return row?.glowpass ?? null;
}

export function toGlowpassClinic(clinicId: string): string | null {
  return CLINIC_TABLE[clinicId] ?? null;
}

export function fromGlowpassClinic(glowpassClinicId: string): string | null {
  const hit = Object.entries(CLINIC_TABLE).find(([, gp]) => gp === glowpassClinicId);
  return hit?.[0] ?? null;
}
