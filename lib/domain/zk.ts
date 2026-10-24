import type { ZkClause } from "../a2a/schemas";
import type { IsoDateTime } from "./common";

// Entities of the ZK record layer, docs/INTEGRATION.md. Circuit codes (see zk/codes.json) and days are plain numbers.
export type { ZkClause };

/** The private chart a wallet proves against: 8 slots, 0 means an empty slot. */
export interface ZkChart {
  types: number[];
  dates: number[];
  clinics: number[];
  /** Decimal string of the field element blinding the on-chain commitment. */
  salt: string;
}

export interface RecordWallet {
  id: string;
  /** Pseudonym on the registry: 0x followed by 64 hex digits. */
  subjectId: string;
  chart: ZkChart;
  version: number;
}

/** One review ticket (Semaphore identity) issued when a clinic confirmed a visit. */
export interface VisitTicket {
  id: string;
  customerId: string;
  clinicId: string;
  procedureId: string;
  identity: string;
  used: boolean;
}

export interface VerifiedVisitStat {
  id: string;
  clinicId: string;
  procedureId: string;
  count: number;
}

export interface ReviewStat {
  id: string;
  clinicId: string;
  procedureId: string;
  n: number;
  avgRating: number;
  /** Spent Semaphore nullifiers: one visit, one review. */
  nullifiers: string[];
}

export interface AnchorLog {
  id: string;
  bookingId: string;
  subjectId: string;
  tx: string;
  day: number;
  at: IsoDateTime;
}
