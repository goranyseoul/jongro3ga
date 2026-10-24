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
  signup: {
    toggle: string;
    title: string;
    email: string;
    submit: string;
    demo: string;
    close: string;
    password: string;
    loginTitle: string;
    loginSubmit: string;
    googleSignup: string;
    googleLogin: string;
    haveAccount: string;
    loginLink: string;
    noAccount: string;
    signupLink: string;
    demoNote: string;
  };
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
      title: "相談から予約、施術の記録まで。あなたのエージェントがずっと一緒です",
      body: "やりたいことをそのまま書いてください。エージェントが相談にのり、クリニックのエージェントと直接やりとりして日程に合う見積もりを集めます。施術の記録はあなたの手元に残り、次の来韓をもっと良くします。",
    },
    suggestionsLabel: "入力例",
    suggestions: [
      "11月13日から15日まで韓国に行くけど、サーマクールを受けたい",
      "来月ソウルに3泊。ダウンタイムが短い施術で毛穴をケアしたい",
      "前回のリジュランから4か月たった。次はいつがいい？",
    ],
    startPlain: "まずエージェントを作る",
    signup: { toggle: "会員登録", title: "会員登録", email: "メールアドレス", submit: "登録して始める", demo: "デモアカウントで試す", close: "閉じる", password: "パスワード", loginTitle: "ログイン", loginSubmit: "ログイン", googleSignup: "Googleで登録", googleLogin: "Googleでログイン", haveAccount: "すでにアカウントをお持ちですか？", loginLink: "ログイン", noAccount: "アカウントをお持ちでないですか？", signupLink: "会員登録", demoNote: "デモでは実際のアカウントは作成されません。" },
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
      title: "从咨询、预约到项目记录，你的代理全程陪伴",
      body: "直接写下你的想法。代理会和你沟通，直接与诊所代理对接，收集符合行程的报价。项目记录由你保管，让下一次来韩更顺利。",
    },
    suggestionsLabel: "示例",
    suggestions: [
      "我11月13日到15日去韩国，想做热玛吉",
      "下个月在首尔住3晚，想改善毛孔，恢复期要短",
      "上次做丽珠兰已经4个月了，下次什么时候合适？",
    ],
    startPlain: "先创建代理",
    signup: { toggle: "注册", title: "注册", email: "邮箱", submit: "注册并开始", demo: "使用演示账号", close: "关闭", password: "密码", loginTitle: "登录", loginSubmit: "登录", googleSignup: "使用 Google 注册", googleLogin: "使用 Google 登录", haveAccount: "已有账号？", loginLink: "登录", noAccount: "还没有账号？", signupLink: "注册", demoNote: "演示中不会创建真实账号。" },
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
      title: "From the first question to your next visit, one agent with you",
      body: "Just write what you want. Your agent talks it through, asks clinic agents for quotes that fit your trip, and keeps your treatment records with you so every next visit gets better.",
    },
    suggestionsLabel: "Examples",
    suggestions: [
      "I'm in Korea from Nov 13 to 15 and want Thermage",
      "3 nights in Seoul next month. Pores, with short downtime",
      "It's been 4 months since my last Rejuran. When is the next one?",
    ],
    startPlain: "Just create my agent",
    signup: { toggle: "Sign up", title: "Sign up", email: "Email", submit: "Sign up and start", demo: "Try a demo account", close: "Close", password: "Password", loginTitle: "Log in", loginSubmit: "Log in", googleSignup: "Sign up with Google", googleLogin: "Log in with Google", haveAccount: "Already have an account?", loginLink: "Log in", noAccount: "Don't have an account?", signupLink: "Sign up", demoNote: "No real account is created in the demo." },
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
      title: "상담부터 시술 기록, 다음 방문까지 에이전트가 함께해요",
      body: "말하듯 적어 주세요. 에이전트가 상담하고, 받은 시술을 기록해 두고, 다음 회차와 다음 경험을 더 낫게 만들어요.",
    },
    suggestionsLabel: "예시",
    suggestions: [
      "11월 13일부터 15일까지 한국 가는데, 써마지 맞고 싶어",
      "지난주에 리쥬란 2cc 맞았어. 기록해 줘",
      "써마지 받은 지 1년 됐는데 다음은 언제가 좋아?",
    ],
    startPlain: "그냥 시작하기",
    signup: { toggle: "회원가입", title: "회원가입", email: "이메일", submit: "가입하고 시작하기", demo: "데모 계정으로 해 보기", close: "닫기", password: "비밀번호", loginTitle: "로그인", loginSubmit: "로그인", googleSignup: "Google로 가입", googleLogin: "Google로 로그인", haveAccount: "이미 계정이 있나요?", loginLink: "로그인", noAccount: "계정이 없나요?", signupLink: "회원가입", demoNote: "데모에서는 실제 계정을 만들지 않아요." },
    footer: {
      regLabel: "외국인환자 유치사업자 등록번호",
      regDemo: "데모",
      patientRights: "외국인환자 권익 보호 안내",
      demoNotice: "이 사이트는 데모예요. 실제 환자 유치는 하지 않아요.",
      languages: "언어",
    },
  },
};
