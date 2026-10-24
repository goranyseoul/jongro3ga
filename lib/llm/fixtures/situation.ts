import type { Locale } from "../../domain/common";
import type { SituationFilter } from "../tools/situation";

// Fixture "상황을 필터로 변환": the four situations of Grace (DEMO.md scenario 3, PLANNING.md 8-8) in four
// languages, matched by phrase. Same values as the prompt's mapping table.

interface Rule {
  patterns: RegExp[];
  apply: (filter: SituationFilter, phrase: string) => void;
}

const RULES: Rule[] = [
  {
    patterns: [/연\s?1회/, /1년에\s?한\s?번/, /일\s?년에\s?한\s?번/, /年に?\s?1回/, /年1回/, /一年一次/, /每年一次/, /once a year/i, /one visit a year/i],
    apply: (filter, phrase) => {
      filter.minMaintenanceDays = 300;
      filter.visitGapDays = 365;
      filter.evidence.push({ phrase, field: "minMaintenanceDays" }, { phrase, field: "visitGapDays" });
    },
  },
  {
    patterns: [/여행도 즐기고 싶/, /旅行も楽しみたい/, /也想好好(旅游|玩)/, /enjoy (the|my) trip/i],
    apply: (filter, phrase) => {
      filter.maxDowntimeDays = 0;
      filter.evidence.push({ phrase, field: "maxDowntimeDays" });
    },
  },
  {
    patterns: [/보수적/, /控えめ/, /慎重/, /保守/, /conservative/i],
    apply: (filter, phrase) => {
      filter.excludeMethods = ["injection", "thread"];
      filter.evidence.push({ phrase, field: "excludeMethods" });
    },
  },
  {
    patterns: [/영어만/, /英語(だけ|のみ)/, /只会(说)?英语/, /只能(说)?英语/, /english only/i, /only (speak )?english/i],
    apply: (filter, phrase) => {
      filter.languages = ["en"];
      filter.evidence.push({ phrase, field: "languages" });
    },
  },
];

/** The four demo sentences per language (the test feeds each and expects all four fields). */
export const GRACE_SITUATIONS: Record<Locale, string> = {
  en: "I can only come once a year. I want to enjoy the trip too. I'm conservative. English only, please.",
  ko: "1년에 한 번밖에 못 와요. 여행도 즐기고 싶어요. 보수적이에요. 영어만 돼요.",
  ja: "韓国には年に1回しか来られません。旅行も楽しみたいです。控えめにしたいです。英語だけ話せます。",
  "zh-CN": "我一年一次来韩国。也想好好旅游。我比较保守。我只会说英语。",
};

export function situationFixture(text: string): SituationFilter {
  const filter: SituationFilter = { evidence: [] };
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        rule.apply(filter, match[0]);
        break;
      }
    }
  }
  return filter;
}
