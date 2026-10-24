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
  /** The agent window that opens over the landing (floating button, expand, close). */
  agentWindow: { open: string; title: string; expand: string; close: string };
  /** First-visit spotlight tour. `stepLabel` carries {n} and {total}; steps follow the order of TOUR_TARGETS. */
  tour: {
    next: string;
    back: string;
    skip: string;
    done: string;
    stepLabel: string;
    region: string;
    steps: { title: string; body: string }[];
  };
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
    agentWindow: { open: "エージェントに相談", title: "あなたのエージェント", expand: "大きく表示", close: "ウィンドウを閉じる" },
    tour: {
      next: "次へ",
      back: "戻る",
      skip: "スキップ",
      done: "はじめる",
      stepLabel: "{n} / {total}",
      region: "使い方の案内",
      steps: [
        { title: "やりたいことをそのまま書く", body: "日程・施術・お悩みを一行で。足りないことはエージェントが聞きます。" },
        { title: "お悩みから探す", body: "カードをタップすると、エージェントがそのテーマで答えます。この画面はそのままです。" },
        { title: "登録すると記録が残ります", body: "デモなので、登録しなくても会話を始められます。" },
        { title: "エージェントのウィンドウ", body: "ここでエージェントと話します。いつでも閉じて、また開けます。" },
      ],
    },
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
    agentWindow: { open: "和代理对话", title: "你的代理", expand: "放大", close: "关闭窗口" },
    tour: {
      next: "下一步",
      back: "上一步",
      skip: "跳过",
      done: "开始",
      stepLabel: "{n} / {total}",
      region: "使用指引",
      steps: [
        { title: "想做什么，直接写", body: "日期、项目、困扰写一行就行，其余由代理来问。" },
        { title: "按困扰浏览", body: "点卡片，代理会就该主题回答。当前页面保持不变。" },
        { title: "注册后会保留记录", body: "这是演示，不注册也可以开始对话。" },
        { title: "代理窗口", body: "在这里和代理对话。随时可以关闭再打开。" },
      ],
    },
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
    agentWindow: { open: "Chat with your agent", title: "Your agent", expand: "Expand", close: "Close window" },
    tour: {
      next: "Next",
      back: "Back",
      skip: "Skip",
      done: "Start",
      stepLabel: "{n} of {total}",
      region: "Quick tour",
      steps: [
        { title: "Write what you want, as it is", body: "Dates, procedures, concerns in one line. Your agent asks the rest." },
        { title: "Browse by concern", body: "Tap a card and your agent answers on that topic. This page stays as it is." },
        { title: "Sign up to keep your records", body: "This is a demo, so you can start a conversation without an account." },
        { title: "Your agent window", body: "Talk to your agent here. Close it and reopen it any time." },
      ],
    },
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
    agentWindow: { open: "에이전트와 대화", title: "내 에이전트", expand: "크게 보기", close: "창 닫기" },
    tour: {
      next: "다음",
      back: "이전",
      skip: "건너뛰기",
      done: "시작하기",
      stepLabel: "{n} / {total}",
      region: "이용 안내",
      steps: [
        { title: "하고 싶은 걸 그대로 적어요", body: "기간, 시술, 고민을 한 줄로 쓰면 에이전트가 이어서 물어봐요." },
        { title: "고민별로 둘러봐요", body: "카드를 누르면 에이전트가 그 주제로 답해 줘요. 이 화면은 그대로예요." },
        { title: "가입하면 기록이 남아요", body: "지금은 데모라 가입 없이도 대화를 시작할 수 있어요." },
        { title: "에이전트 창", body: "여기서 에이전트와 대화해요. 언제든 닫고 다시 열 수 있어요." },
      ],
    },
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
