import type { Locale } from "@/lib/domain/common";

// Landing copy (05-screens.md `/[locale]`). The landing is the onboarding chat (owner decision
// 2026-10-24). No clinic names, prices or reviews here (08-compliance.md 3절). Korean customers
// cannot be matched (08 2절), so `ko` speaks about the record book.
export type LandingCopy = {
  start: string;
  hero: { title: string; body: string };
  suggestionsLabel: string;
  suggestions: string[];
  startPlain: string;
  footer: {
    regLabel: string;
    regDemo: string;
    patientRights: string;
    demoNotice: string;
    languages: string;
  };
};

export const LANDING_COPY: Record<Locale, LandingCopy> = {
  ja: {
    start: "はじめる",
    hero: {
      title: "あなたの代わりに、エージェントが韓国のクリニックと話します",
      body: "受けたいことをそのまま書いてください。韓国の女性が実際に支払った記録をもとに、見積もりの価格と量を確かめます。",
    },
    suggestionsLabel: "入力例",
    suggestions: ["リジュランを受けたい", "肌のハリが気になる", "2泊3日で受けられる施術を知りたい"],
    startPlain: "まずエージェントを作る",
    footer: {
      regLabel: "外国人患者誘致事業者 登録番号",
      regDemo: "デモ",
      patientRights: "外国人患者の権利保護について",
      demoNotice: "このサイトはデモです。実際の患者誘致は行っていません。",
      languages: "言語",
    },
  },
  "zh-CN": {
    start: "开始",
    hero: {
      title: "由代理替你和韩国诊所沟通",
      body: "直接写下你想做的。我们以韩国女性的实际支付记录为依据，确认报价的价格和用量是否合理。",
    },
    suggestionsLabel: "示例",
    suggestions: ["想做丽珠兰", "在意皮肤紧致", "想了解三天行程能做的项目"],
    startPlain: "先创建代理",
    footer: {
      regLabel: "外国患者招揽业者 登记号",
      regDemo: "演示",
      patientRights: "外国患者权益保护说明",
      demoNotice: "本网站为演示版本，不进行实际的患者招揽。",
      languages: "语言",
    },
  },
  en: {
    start: "Get started",
    hero: {
      title: "Your agent talks to Korean clinics for you",
      body: "Just write what you want. We check quoted prices and doses against what Korean women actually paid.",
    },
    suggestionsLabel: "Examples",
    suggestions: ["I want Rejuran", "My skin is losing firmness", "What fits a 3-day trip?"],
    startPlain: "Just create my agent",
    footer: {
      regLabel: "Foreign patient attraction agency registration no.",
      regDemo: "Demo",
      patientRights: "Foreign patient rights",
      demoNotice: "This site is a demo. No real patient referrals are made.",
      languages: "Language",
    },
  },
  ko: {
    start: "시작하기",
    hero: {
      title: "내 시술 기록, 다음 회차까지 챙겨 드려요",
      body: "말하듯 적어 주세요. 시술마다 다른 주기를 계산해 다음 회차를 알려 드려요.",
    },
    suggestionsLabel: "예시",
    suggestions: ["리쥬란 맞은 거 기록하고 싶어", "다음 시술 날짜 알려 줘", "써마지 받은 지 1년 됐나?"],
    startPlain: "그냥 시작하기",
    footer: {
      regLabel: "외국인환자 유치사업자 등록번호",
      regDemo: "데모",
      patientRights: "외국인환자 권익 보호 안내",
      demoNotice: "이 사이트는 데모예요. 실제 환자 유치는 하지 않아요.",
      languages: "언어",
    },
  },
};
