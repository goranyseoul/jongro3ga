import type { ProcedureRequestV1 } from "../../../a2a/schemas";

// Yuki's demo request (03 procedure-request example, 10 demo row 3) from the completed profile cus_yuki_done.
export const YUKI_AGENT = "cag_7f3k2d";

export const yukiRequest = (extra: Partial<ProcedureRequestV1> = {}): ProcedureRequestV1 => ({
  schema: "pibu/procedure-request@1",
  requestId: "req_yuki_t1",
  customerAgentId: YUKI_AGENT,
  procedureId: "rejuran_healer",
  productPreference: "any",
  amount: { value: 2, unit: "cc" },
  budgetKrw: { max: 450_000 },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
  ...extra,
});
