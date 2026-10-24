// Agent tokens and referral tokens (03-a2a-protocol.md "인증과 신뢰"). OWNER: track A2A core.
import type { AgentRef } from "./contract";

export interface ReferralClaims {
  jti: string;
  /** clinic id the token is valid for (aud) */
  clinicId: string;
  /** customer agent id (sub) */
  customerAgentId: string;
  requestId: string;
  matchId: string;
  scope: ("quote" | "book")[];
  exp: number;
}

export async function issueAgentToken(_ref: AgentRef): Promise<string> {
  throw new Error("agent tokens not implemented yet (track A2A core)");
}

/** Returns claims when valid for this clinic and not expired, otherwise null. */
export async function verifyReferralToken(_token: string, _clinicId: string): Promise<ReferralClaims | null> {
  throw new Error("referral tokens not implemented yet (track A2A core)");
}
