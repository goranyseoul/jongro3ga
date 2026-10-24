import type { Locale } from "@/lib/domain/common";

// Landing copy (05-screens.md `/[locale]`). No clinic names, prices or reviews on this page
// (08-compliance.md 3절). Korean customers cannot be matched (08 2절), so `ko` describes the record book.
export type LandingCopy = {
  start: string;
  hero: { title: string; body: string };
  steps: { eyebrow: string; title: string; items: { title: string; body: string }[] };
  principles: { eyebrow: string; title: string; items: { title: string; body: string }[] };
  closing: { title: string; body: string };
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
      body: "肌の悩みと滞在日程を伝えるだけ。韓国の女性が実際に支払った記録をもとに、見積もりの価格と量を確かめます。",
    },
    steps: {
      eyebrow: "使い方",
      title: "3つのステップで進みます",
      items: [
        { title: "チャットでエージェントを作る", body: "言語、日程、肌の悩みを会話で伝えます。3分ほどで終わります。" },
        { title: "エージェントが問い合わせる", body: "条件に合うクリニックへ、まとめて見積もりを依頼します。" },
        { title: "記録と照らして比べる", body: "実際の支払い記録と比べて、価格と施術量を判定します。そのまま予約を依頼できます。" },
      ],
    },
    principles: {
      eyebrow: "約束",
      title: "あなたの側に立つエージェントです",
      items: [
        { title: "広告で順位が変わらない", body: "クリニックが支払うお金は、紹介の順位にも判定にも入りません。" },
        { title: "実際の支払い記録", body: "見積もりの単価と量を、同じ地域で実際に支払われた記録と比べます。" },
        { title: "診断はしません", body: "施術を受けられるかどうかは医師が判断します。エージェントは情報を集めて伝えます。" },
      ],
    },
    closing: { title: "まずはエージェントを作りましょう", body: "会話で3分ほど。利用は無料です。" },
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
      body: "只需告诉我们皮肤问题和行程。我们以韩国女性的实际支付记录为依据，确认报价的价格和用量是否合理。",
    },
    steps: {
      eyebrow: "使用方式",
      title: "三个步骤完成",
      items: [
        { title: "通过聊天创建代理", body: "在对话中告诉我们语言、行程和皮肤问题，大约 3 分钟。" },
        { title: "代理向诊所询价", body: "同时向符合条件的诊所发送报价请求。" },
        { title: "对照记录进行比较", body: "与实际支付记录比较，判断价格和用量，并可直接提交预约请求。" },
      ],
    },
    principles: {
      eyebrow: "承诺",
      title: "站在你这一边的代理",
      items: [
        { title: "排名不受广告影响", body: "诊所支付的费用不会进入推荐排序，也不会影响判断。" },
        { title: "真实支付记录", body: "将报价的单价和用量与同一地区的实际支付记录进行比较。" },
        { title: "不做诊断", body: "能否做项目由医生判断。代理只负责收集并传达信息。" },
      ],
    },
    closing: { title: "先创建你的代理吧", body: "对话约 3 分钟，免费使用。" },
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
      body: "Share your skin concerns and travel dates. We check quoted prices and doses against what Korean women actually paid.",
    },
    steps: {
      eyebrow: "How it works",
      title: "Three steps",
      items: [
        { title: "Create your agent in chat", body: "Tell us your language, dates and skin concerns in a conversation. It takes about 3 minutes." },
        { title: "Your agent asks clinics", body: "It sends quote requests to the clinics that fit your conditions, all at once." },
        { title: "Compare against real records", body: "Prices and doses are judged against real paid records. You can request a booking right there." },
      ],
    },
    principles: {
      eyebrow: "Our promise",
      title: "An agent on your side",
      items: [
        { title: "Ads never change the order", body: "Money paid by clinics never enters the ranking or the price check." },
        { title: "Real paid records", body: "Quoted unit prices and doses are compared with recent paid records in the same area." },
        { title: "No diagnosis", body: "A doctor decides whether a procedure is right for you. Your agent only gathers and passes on information." },
      ],
    },
    closing: { title: "Start by creating your agent", body: "About 3 minutes of chat. Free to use." },
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
      body: "시술, 용량, 병원, 가격만 남기면 3초면 끝나요. 시술마다 다른 주기를 계산해 다음 회차를 알려 드려요.",
    },
    steps: {
      eyebrow: "이용 방법",
      title: "세 단계면 돼요",
      items: [
        { title: "채팅으로 시작", body: "말하듯 알려 주면 내 기록장이 만들어져요. 3분이면 끝나요." },
        { title: "3초 기록", body: "시술, 용량, 병원, 가격만 남기면 돼요. 후기는 선택이에요." },
        { title: "다음 회차 알림", body: "때가 되면 알려 드려요. 계속, 쉬기, 그만 중에 고르면 돼요." },
      ],
    },
    principles: {
      eyebrow: "약속",
      title: "내 편인 기록장",
      items: [
        { title: "내 기록은 내 것", body: "익명 공유는 따로 동의했을 때만 해요." },
        { title: "광고 없는 기록장", body: "병원 광고나 순위를 보여 주지 않아요." },
        { title: "진단하지 않아요", body: "시술을 받을 수 있는지는 의사가 판단해요." },
      ],
    },
    closing: { title: "지금 기록장을 만들어 보세요", body: "대화로 3분, 무료예요." },
    footer: {
      regLabel: "외국인환자 유치사업자 등록번호",
      regDemo: "데모",
      patientRights: "외국인환자 권익 보호 안내",
      demoNotice: "이 사이트는 데모예요. 실제 환자 유치는 하지 않아요.",
      languages: "언어",
    },
  },
};
