import { formatCurrency } from "@/lib/money";
import {
  AREA_LABEL,
  LOCALE_LABEL,
  NATIONALITY_LABEL,
  PROCEDURE_LABEL,
  clinicName,
  type RuleAction,
  type RuleCondition,
} from "@/lib/ui-data/ops";

const names = <T,>(items: T[], label: (item: T) => string) => items.map(label).join(", ");

/** "국적 일본 · 시술 울쎄라": what a request must look like for the rule to apply. */
export function describeCondition(when: RuleCondition): string {
  const parts: string[] = [];
  if (when.nationalities?.length) parts.push(`국적 ${names(when.nationalities, (code) => NATIONALITY_LABEL[code] ?? code)}`);
  if (when.procedureIds?.length) parts.push(`시술 ${names(when.procedureIds, (id) => PROCEDURE_LABEL[id] ?? id)}`);
  if (when.languages?.length) parts.push(`언어 ${names(when.languages, (locale) => LOCALE_LABEL[locale])}`);
  if (when.areas?.length) parts.push(`지역 ${names(when.areas, (area) => AREA_LABEL[area])}`);
  if (when.ageBands?.length) parts.push(`연령대 ${when.ageBands.join(", ")}`);
  if (when.firstKProcedure) parts.push("첫 K시술");
  if (when.budgetMaxBelowKrw) parts.push(`예산 ${formatCurrency(when.budgetMaxBelowKrw, "KRW")} 미만`);
  return parts.length > 0 ? parts.join(" · ") : "모든 요청";
}

const signed = (delta: number) => `${delta >= 0 ? "+" : "-"}${Math.abs(delta)}`;

/** What the rule does to the shortlist once the condition matches. */
export function describeAction(then: RuleAction): string {
  switch (then.kind) {
    case "exclude_clinic":
      return `${names(then.clinicIds, clinicName)} 매칭 제외`;
    case "boost_clinic":
      return `${names(then.clinicIds, clinicName)} 점수 ${signed(then.delta)}`;
    case "demote_clinic":
      return `${names(then.clinicIds, clinicName)} 점수 ${signed(-then.delta)}`;
    case "prefer_area":
      return `${names(then.areas, (area) => AREA_LABEL[area])} 지역 점수 ${signed(then.delta)}`;
    case "require_language":
      return `${names(then.languages, (locale) => LOCALE_LABEL[locale])} 응대 가능한 병원만 통과`;
  }
}
