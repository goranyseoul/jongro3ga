import type { ProposerInput, TriggerCandidate } from "../prompts/proposer";
import type { RoutingRuleDraft } from "../tools/rules";

// Fixture and fallback for the rule proposer. 07 4절: "API 실패 시 1단계 후보를 템플릿 사유로 그대로 제안".
// Exported as templateRuleDrafts so WP4 can call it without going through the LLM client at all.

const NATIONALITY_KO: Record<string, string> = { JP: "일본", CN: "중국", US: "미국", KR: "한국" };

const pct = (ratio: number) => Math.round(ratio * 100);

function reasonOf(candidate: TriggerCandidate): string {
  const { n, value } = candidate;
  switch (candidate.trigger) {
    case "quote_gap":
      return `견적 대비 실결제 평균 +${pct(value)}% (n=${n})`;
    case "low_satisfaction":
      return `낮은 만족도 비율 ${pct(value)}% (n=${n})`;
    case "response_timeout":
      return `응답 시간초과 비율 ${pct(value)}% (n=${n})`;
    case "area_preference":
      return `지역 그룹별 만족도 차이 ${value.toFixed(1)}점 (n=${n})`;
    case "side_effect":
      return `부작용 보고 ${n}건`;
  }
}

function summaryOf(candidate: TriggerCandidate, clinicName: string): string {
  const who = candidate.nationality ? `${NATIONALITY_KO[candidate.nationality] ?? candidate.nationality} 고객` : "전체 고객";
  const { n, value } = candidate;
  switch (candidate.trigger) {
    case "quote_gap":
      return `${clinicName}의 최근 30일 ${who} 결과 ${n}건에서 실결제가 견적보다 평균 ${pct(value)}% 높았어요.`;
    case "low_satisfaction":
      return `${clinicName}의 최근 30일 ${who} 결과 ${n}건 중 ${pct(value)}%가 낮은 만족도였어요.`;
    case "response_timeout":
      return `${clinicName}에 보낸 최근 30일 ${who} 견적 요청 ${n}건 중 ${pct(value)}%가 시간 안에 응답이 없었어요.`;
    case "area_preference":
      return `최근 30일 ${who} 결과에서 지역 그룹별 평균 만족도가 ${value.toFixed(1)}점 차이 났어요 (각 n 8 이상, 합계 ${n}건).`;
    case "side_effect":
      return `${clinicName}에 대해 부작용 보고가 ${n}건 들어왔어요. 운영자 확인이 필요해요.`;
  }
}

export function templateRuleDrafts(input: ProposerInput): RoutingRuleDraft[] {
  return input.candidates.map((candidate) => {
    const clinicName =
      candidate.clinicName ?? (candidate.clinicId ? input.clinicNames?.[candidate.clinicId] : undefined) ?? candidate.clinicId ?? "해당 병원";
    const draft: RoutingRuleDraft = {
      when: candidate.when,
      then: candidate.then,
      reason: reasonOf(candidate),
      evidence: { outcomeIds: candidate.outcomeIds, signalIds: candidate.signalIds, summary: summaryOf(candidate, clinicName) },
      origin: "trigger",
    };
    if (candidate.expiresInDays !== undefined) draft.expiresInDays = candidate.expiresInDays;
    if (candidate.urgent || candidate.trigger === "side_effect") draft.urgent = true;
    return draft;
  });
}

/** 10 데모 7행: 20 injected Ara outcomes from Japanese customers, paid 31% above the quote on average. */
export const DEMO_ARA_PROPOSER_INPUT: ProposerInput = {
  candidates: [
    {
      trigger: "quote_gap",
      when: { nationalities: ["JP"] },
      then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
      clinicId: "cln_ara",
      clinicName: "아라의원",
      nationality: "JP",
      n: 20,
      value: 0.31,
      outcomeIds: Array.from({ length: 20 }, (_, index) => `out_ara_${String(index + 1).padStart(2, "0")}`),
      signalIds: [],
    },
  ],
  segments: [{ clinicId: "cln_ara", nationality: "JP", n: 20, avgQuoteGapRatio: 0.31 }],
  knownClinicIds: ["cln_seoul_glow", "cln_mint", "cln_ara", "cln_hanbit", "cln_dahye"],
  clinicNames: { cln_ara: "아라의원" },
};
