import type { Locale } from "@/lib/domain/common";
import type { AgeBand, Area, Channel, Concern, ConsentType, NationalityOption, Residency, SlotKey } from "./mock";

// Mock onboarding copy, one block per locale. The real flow gets its agent lines from Claude
// (04-onboarding-chat.md); widget and slot labels stay here.
export type OnboardingCopy = {
  title: string;
  previewTitle: string;
  previewCaption: string;
  progress: (percent: number) => string;
  close: string;
  inputLabel: string;
  placeholder: string;
  send: string;
  next: string;
  skip: string;
  typing: string;
  required: string;
  optional: string;
  agree: string;
  decline: string;
  yes: string;
  no: string;
  historyNone: string;
  nudge: string;
  widgetNudge: string;
  agentCard: { version: string; skills: string; endpoint: string; json: string };
  say: {
    locale: string;
    consent: string;
    consentBlocked: string;
    sensitiveDeclined: string;
    nickname: string;
    nationality: (name: string) => string;
    residency: string;
    residentNote: string;
    ageBand: string;
    trip: string;
    stayArea: (range: string) => string;
    concerns: string;
    history: string;
    pregnant: string;
    budget: string;
    downtime: string;
    languages: string;
    channel: string;
    handle: (channel: string) => string;
    summary: string;
    editPick: string;
    done: (name: string) => string;
  };
  summary: { title: string; create: string; edit: string };
  doneTitle: string;
  slots: Record<SlotKey, string>;
  consents: Record<ConsentType, { title: string; description: string }>;
  dates: { start: string; end: string };
  currency: { currency: string; amount: string; rateNote: string };
  downtimeLabel: string;
  days: (n: number) => string;
  nationality: Record<NationalityOption, string>;
  residency: Record<Residency, string>;
  ageBand: Record<AgeBand, string>;
  area: Record<Area, string>;
  concern: Record<Concern, string>;
  channel: Record<Channel, string>;
};

const brandChannels = { line: "LINE", wechat: "WeChat", whatsapp: "WhatsApp" } as const;
const agentCardKo = { version: "버전", skills: "스킬", endpoint: "엔드포인트", json: "JSON 보기" };

export const COPY: Record<Locale, OnboardingCopy> = {
  ko: {
    title: "에이전트 만들기",
    previewTitle: "내 에이전트",
    previewCaption: "채운 내용이 여기에 바로 반영돼요",
    progress: (p) => `에이전트 완성도 ${p}%`,
    close: "닫기",
    inputLabel: "메시지",
    placeholder: "메시지를 입력하세요",
    send: "보내기",
    next: "다음",
    skip: "건너뛰기",
    typing: "입력 중",
    required: "필수",
    optional: "선택",
    agree: "동의",
    decline: "동의 안 함",
    yes: "예",
    no: "아니오",
    historyNone: "없음",
    nudge: "위 선택지에서 골라 주시거나 그대로 입력해 주세요.",
    widgetNudge: "위 입력 칸을 써 주세요.",
    agentCard: agentCardKo,
    say: {
      locale: "안녕하세요, Pibu 담당 에이전트예요. 한국어로 진행할까요?",
      consent: "시작하기 전에 동의가 필요해요. 하나씩 확인해 주세요.",
      consentBlocked: "이용약관, 개인정보, 국외 처리 동의가 있어야 진행할 수 있어요.",
      sensitiveDeclined: "괜찮아요. 피부와 시술 정보는 묻지 않을게요. 병원 매칭은 제한돼요.",
      nickname: "고마워요. 뭐라고 부를까요?",
      nationality: (n) => `${n}님, 국적을 알려 주세요.`,
      residency: "한국에 외국인등록(또는 거소신고)을 하고 살고 계신가요?",
      residentNote: "그러면 병원 매칭과 예약은 도와드릴 수 없어요. 시술 기록 중심으로 만들게요.",
      ageBand: "나이대를 골라 주세요. 생년월일은 받지 않아요.",
      trip: "한국에 오는 날과 돌아가는 날을 알려 주세요.",
      stayArea: (r) => `${r} 일정이군요. 숙소는 어느 지역인가요?`,
      concerns: "신경 쓰이는 피부 고민을 모두 골라 주세요.",
      history: "전에 받아 본 시술이 있나요? 없으면 '없음'을 눌러 주세요.",
      pregnant: "병원에 전달할 안전 정보예요. 현재 임신 중이거나 수유 중인가요?",
      budget: "예산 상한이 있으면 알려 주세요. 없으면 건너뛰어도 돼요.",
      downtime: "시술 후 붉어짐 같은 회복 기간은 며칠까지 괜찮으세요?",
      languages: "병원에서 필요한 언어를 골라 주세요.",
      channel: "알림은 어디로 받을까요?",
      handle: (c) => `${c} 아이디나 주소를 알려 주세요.`,
      summary: "이 내용으로 에이전트를 만들까요?",
      editPick: "어느 항목을 고칠까요?",
      done: (n) => `${n}님의 에이전트가 만들어졌어요. 이제 받고 싶은 시술을 말씀해 주세요.`,
    },
    summary: { title: "에이전트 요약", create: "만들기", edit: "수정하기" },
    doneTitle: "에이전트 활성화됨",
    slots: {
      locale: "언어",
      consents: "동의",
      nickname: "호칭",
      nationality: "국적",
      residency: "체류",
      ageBand: "나이대",
      trip: "일정",
      stayArea: "숙소 지역",
      concerns: "피부 고민",
      history: "과거 시술",
      pregnant: "임신·수유",
      budget: "예산 상한",
      downtime: "회복 기간",
      languages: "필요 언어",
      channel: "알림 채널",
      handle: "연락처",
    },
    consents: {
      terms: { title: "이용약관", description: "Pibu 서비스 이용 조건에 동의해요." },
      privacy: { title: "개인정보 수집·이용", description: "호칭, 국적, 나이대, 일정, 연락처를 에이전트 운영에 써요." },
      sensitiveHealth: {
        title: "피부·시술 정보",
        description: "피부 고민, 과거 시술, 안전 정보를 수집해요. 동의하지 않으면 병원 매칭이 제한돼요.",
      },
      crossBorder: { title: "국외 거주자 정보 처리", description: "해외에서 입력한 정보가 한국의 서버에서 처리돼요." },
      shareAnonymizedRecords: { title: "익명 기록 공유", description: "내 기록을 익명으로 가격 판정 표본에 써요." },
    },
    dates: { start: "입국일", end: "출국일" },
    currency: { currency: "통화", amount: "금액", rateNote: "참고 환율" },
    downtimeLabel: "회복 기간",
    days: (n) => `${n}일`,
    nationality: { JP: "일본", CN: "중국", US: "미국", KR: "한국", other: "기타" },
    residency: { short_term_visitor: "여행·단기 방문", resident: "한국 거주" },
    ageBand: { "20-24": "20~24세", "25-29": "25~29세", "30-34": "30~34세", "35-39": "35~39세", "40+": "40세 이상" },
    area: { gangnam: "강남", sinsa: "신사", apgujeong: "압구정", myeongdong: "명동", hongdae: "홍대", other: "기타" },
    concern: {
      elasticity: "탄력",
      fine_lines: "잔주름",
      pores: "모공",
      acne_scars: "여드름 흉터",
      pigmentation: "색소",
      redness: "붉은기",
      dryness: "건조",
      contour: "윤곽",
    },
    channel: { email: "이메일", ...brandChannels },
  },

  ja: {
    title: "エージェント作成",
    previewTitle: "わたしのエージェント",
    previewCaption: "入力した内容がここにすぐ反映されます",
    progress: (p) => `エージェント完成度 ${p}%`,
    close: "閉じる",
    inputLabel: "メッセージ",
    placeholder: "メッセージを入力",
    send: "送信",
    next: "次へ",
    skip: "スキップ",
    typing: "入力中",
    required: "必須",
    optional: "任意",
    agree: "同意する",
    decline: "同意しない",
    yes: "はい",
    no: "いいえ",
    historyNone: "なし",
    nudge: "上の選択肢から選ぶか、そのまま入力してください。",
    widgetNudge: "上の入力欄を使ってください。",
    agentCard: { version: "バージョン", skills: "スキル", endpoint: "エンドポイント", json: "JSONを表示" },
    say: {
      locale: "はじめまして、Pibuの担当エージェントです。日本語で進めてもいいですか？",
      consent: "始める前に同意をお願いします。ひとつずつ確認してください。",
      consentBlocked: "利用規約、個人情報、海外からの情報処理への同意が必要です。",
      sensitiveDeclined: "わかりました。肌と施術の情報はお聞きしません。クリニックのご紹介は制限されます。",
      nickname: "ありがとうございます。何とお呼びすればいいですか？",
      nationality: (n) => `${n}さん、国籍を教えてください。`,
      residency: "韓国で外国人登録（または居所申告）をして暮らしていますか？",
      residentNote: "その場合、クリニックの紹介と予約はご案内できません。施術記録を中心に作成します。",
      ageBand: "年代を選んでください。生年月日はお聞きしません。",
      trip: "韓国に到着する日と帰国する日を教えてください。",
      stayArea: (r) => `${r}ですね。宿泊はどのエリアですか？`,
      concerns: "気になる肌の悩みをすべて選んでください。",
      history: "これまでに受けた施術はありますか？なければ「なし」を押してください。",
      pregnant: "クリニックに伝える安全情報です。現在、妊娠中または授乳中ですか？",
      budget: "予算の上限があれば教えてください。なければスキップできます。",
      downtime: "施術後の赤みなど、回復期間は何日まで大丈夫ですか？",
      languages: "クリニックで必要な言語を選んでください。",
      channel: "通知はどこで受け取りますか？",
      handle: (c) => `${c}のIDまたはアドレスを教えてください。`,
      summary: "この内容でエージェントを作りますか？",
      editPick: "どの項目を修正しますか？",
      done: (n) => `${n}さんのエージェントができました。受けたい施術を教えてください。`,
    },
    summary: { title: "エージェントの内容", create: "作成する", edit: "修正する" },
    doneTitle: "エージェント有効",
    slots: {
      locale: "言語",
      consents: "同意",
      nickname: "呼び名",
      nationality: "国籍",
      residency: "滞在",
      ageBand: "年代",
      trip: "日程",
      stayArea: "宿泊エリア",
      concerns: "肌の悩み",
      history: "過去の施術",
      pregnant: "妊娠・授乳",
      budget: "予算上限",
      downtime: "回復期間",
      languages: "必要な言語",
      channel: "通知先",
      handle: "連絡先",
    },
    consents: {
      terms: { title: "利用規約", description: "Pibuのサービス利用条件に同意します。" },
      privacy: { title: "個人情報", description: "呼び名、国籍、年代、日程、連絡先をエージェントの運用に使います。" },
      sensitiveHealth: {
        title: "肌と施術の情報",
        description: "肌の悩み、過去の施術、安全情報を収集します。同意しない場合、クリニックの紹介が制限されます。",
      },
      crossBorder: { title: "海外からの情報処理", description: "海外で入力した情報は韓国のサーバーで処理されます。" },
      shareAnonymizedRecords: { title: "匿名での記録共有", description: "記録を匿名化し、価格判定のサンプルとして使います。" },
    },
    dates: { start: "到着日", end: "帰国日" },
    currency: { currency: "通貨", amount: "金額", rateNote: "参考レート" },
    downtimeLabel: "回復期間",
    days: (n) => `${n}日`,
    nationality: { JP: "日本", CN: "中国", US: "アメリカ", KR: "韓国", other: "その他" },
    residency: { short_term_visitor: "旅行・短期滞在", resident: "韓国に居住" },
    ageBand: { "20-24": "20~24歳", "25-29": "25~29歳", "30-34": "30~34歳", "35-39": "35~39歳", "40+": "40歳以上" },
    area: { gangnam: "江南", sinsa: "新沙", apgujeong: "狎鴎亭", myeongdong: "明洞", hongdae: "弘大", other: "その他" },
    concern: {
      elasticity: "ハリ",
      fine_lines: "小じわ",
      pores: "毛穴",
      acne_scars: "ニキビ跡",
      pigmentation: "シミ",
      redness: "赤み",
      dryness: "乾燥",
      contour: "輪郭",
    },
    channel: { email: "メール", ...brandChannels },
  },

  en: {
    title: "Set up your agent",
    previewTitle: "My agent",
    previewCaption: "What you share shows up here right away",
    progress: (p) => `Agent ${p}% complete`,
    close: "Close",
    inputLabel: "Message",
    placeholder: "Type a message",
    send: "Send",
    next: "Next",
    skip: "Skip",
    typing: "Typing",
    required: "Required",
    optional: "Optional",
    agree: "Agree",
    decline: "Decline",
    yes: "Yes",
    no: "No",
    historyNone: "None",
    nudge: "Pick one of the options above, or type it.",
    widgetNudge: "Please use the input above.",
    agentCard: { version: "Version", skills: "Skills", endpoint: "Endpoint", json: "Show JSON" },
    say: {
      locale: "Hi, I'm your Pibu agent. Shall we continue in English?",
      consent: "Before we start, I need your consent. Please review each item.",
      consentBlocked: "Consent to the terms, personal information and cross-border processing is needed to continue.",
      sensitiveDeclined: "No problem. I won't ask about your skin or procedures. Clinic matching will be limited.",
      nickname: "Thank you. What should I call you?",
      nationality: (n) => `Nice to meet you, ${n}. What is your nationality?`,
      residency: "Do you live in Korea with an alien registration (or residence report)?",
      residentNote: "In that case I can't help with clinic matching or booking. I'll set you up for procedure records.",
      ageBand: "Which age band are you in? I don't ask for your birth date.",
      trip: "When do you arrive in Korea, and when do you fly home?",
      stayArea: (r) => `${r}, got it. Which area are you staying in?`,
      concerns: "Pick every skin concern you have.",
      history: "Have you had any procedures before? If not, tap None.",
      pregnant: "This is safety information for the clinic. Are you pregnant or breastfeeding?",
      budget: "Do you have a budget limit? You can skip this.",
      downtime: "How many days of recovery, such as redness, are fine for you?",
      languages: "Which languages do you need at the clinic?",
      channel: "Where should I send notifications?",
      handle: (c) => `What is your ${c} ID or address?`,
      summary: "Shall I create your agent with these details?",
      editPick: "Which item would you like to change?",
      done: (n) => `Your agent is ready, ${n}. Tell me which procedure you'd like.`,
    },
    summary: { title: "Agent summary", create: "Create", edit: "Edit" },
    doneTitle: "Agent active",
    slots: {
      locale: "Language",
      consents: "Consent",
      nickname: "Name",
      nationality: "Nationality",
      residency: "Stay",
      ageBand: "Age band",
      trip: "Trip",
      stayArea: "Stay area",
      concerns: "Skin concerns",
      history: "Past procedures",
      pregnant: "Pregnancy or breastfeeding",
      budget: "Budget limit",
      downtime: "Recovery time",
      languages: "Languages needed",
      channel: "Notifications",
      handle: "Contact",
    },
    consents: {
      terms: { title: "Terms of use", description: "I agree to the Pibu terms of service." },
      privacy: {
        title: "Personal information",
        description: "Your name, nationality, age band, trip and contact are used to run your agent.",
      },
      sensitiveHealth: {
        title: "Skin and procedure information",
        description: "We collect skin concerns, past procedures and safety information. Without this, clinic matching is limited.",
      },
      crossBorder: { title: "Cross-border processing", description: "Information you enter abroad is processed on servers in Korea." },
      shareAnonymizedRecords: {
        title: "Anonymous record sharing",
        description: "Your records are anonymized and used as samples for price checks.",
      },
    },
    dates: { start: "Arrival", end: "Departure" },
    currency: { currency: "Currency", amount: "Amount", rateNote: "Reference rate" },
    downtimeLabel: "Recovery time",
    days: (n) => (n === 1 ? "1 day" : `${n} days`),
    nationality: { JP: "Japan", CN: "China", US: "United States", KR: "Korea", other: "Other" },
    residency: { short_term_visitor: "Visiting or short stay", resident: "Living in Korea" },
    ageBand: { "20-24": "20~24", "25-29": "25~29", "30-34": "30~34", "35-39": "35~39", "40+": "40+" },
    area: { gangnam: "Gangnam", sinsa: "Sinsa", apgujeong: "Apgujeong", myeongdong: "Myeongdong", hongdae: "Hongdae", other: "Other" },
    concern: {
      elasticity: "Firmness",
      fine_lines: "Fine lines",
      pores: "Pores",
      acne_scars: "Acne scars",
      pigmentation: "Pigmentation",
      redness: "Redness",
      dryness: "Dryness",
      contour: "Contour",
    },
    channel: { email: "Email", ...brandChannels },
  },

  "zh-CN": {
    title: "创建代理",
    previewTitle: "我的代理",
    previewCaption: "你填写的内容会立即显示在这里",
    progress: (p) => `代理完成度 ${p}%`,
    close: "关闭",
    inputLabel: "消息",
    placeholder: "输入消息",
    send: "发送",
    next: "下一步",
    skip: "跳过",
    typing: "正在输入",
    required: "必填",
    optional: "选填",
    agree: "同意",
    decline: "不同意",
    yes: "是",
    no: "否",
    historyNone: "没有",
    nudge: "请从上面的选项中选择，或直接输入。",
    widgetNudge: "请使用上面的输入框。",
    agentCard: { version: "版本", skills: "技能", endpoint: "接口地址", json: "查看 JSON" },
    say: {
      locale: "你好，我是 Pibu 的专属代理。用中文继续可以吗？",
      consent: "开始之前需要你的同意，请逐项确认。",
      consentBlocked: "需要同意使用条款、个人信息和跨境处理才能继续。",
      sensitiveDeclined: "好的，我不会询问皮肤和项目信息。诊所匹配会受到限制。",
      nickname: "谢谢。我该怎么称呼你？",
      nationality: (n) => `${n}，请告诉我你的国籍。`,
      residency: "你是否在韩国办理了外国人登录（或居所申报）并在韩国居住？",
      residentNote: "这样的话，我无法提供诊所匹配和预约，将以项目记录为主创建。",
      ageBand: "请选择年龄段。我们不收集出生日期。",
      trip: "请告诉我到达韩国和回国的日期。",
      stayArea: (r) => `${r}，明白了。你住在哪个区域？`,
      concerns: "请选择所有在意的皮肤问题。",
      history: "以前做过项目吗？没有的话请点「没有」。",
      pregnant: "这是要告知诊所的安全信息。你目前是否怀孕或哺乳？",
      budget: "如有预算上限请告诉我，也可以跳过。",
      downtime: "术后泛红等恢复期最多可以接受几天？",
      languages: "请选择在诊所需要的语言。",
      channel: "通知发送到哪里？",
      handle: (c) => `请告诉我你的 ${c} 账号或地址。`,
      summary: "用这些内容创建代理吗？",
      editPick: "要修改哪一项？",
      done: (n) => `${n}，你的代理已创建。告诉我你想做的项目吧。`,
    },
    summary: { title: "代理概要", create: "创建", edit: "修改" },
    doneTitle: "代理已启用",
    slots: {
      locale: "语言",
      consents: "同意",
      nickname: "称呼",
      nationality: "国籍",
      residency: "居留",
      ageBand: "年龄段",
      trip: "行程",
      stayArea: "住宿区域",
      concerns: "皮肤问题",
      history: "既往项目",
      pregnant: "怀孕或哺乳",
      budget: "预算上限",
      downtime: "恢复期",
      languages: "所需语言",
      channel: "通知渠道",
      handle: "联系方式",
    },
    consents: {
      terms: { title: "使用条款", description: "同意 Pibu 服务使用条件。" },
      privacy: { title: "个人信息", description: "称呼、国籍、年龄段、行程和联系方式用于运行你的代理。" },
      sensitiveHealth: {
        title: "皮肤与项目信息",
        description: "收集皮肤问题、既往项目和安全信息。不同意时诊所匹配会受到限制。",
      },
      crossBorder: { title: "跨境信息处理", description: "你在境外输入的信息将在韩国的服务器上处理。" },
      shareAnonymizedRecords: { title: "匿名共享记录", description: "将你的记录匿名化，用作价格判断的样本。" },
    },
    dates: { start: "到达日期", end: "回国日期" },
    currency: { currency: "币种", amount: "金额", rateNote: "参考汇率" },
    downtimeLabel: "恢复期",
    days: (n) => `${n}天`,
    nationality: { JP: "日本", CN: "中国", US: "美国", KR: "韩国", other: "其他" },
    residency: { short_term_visitor: "旅游或短期停留", resident: "在韩国居住" },
    ageBand: { "20-24": "20~24岁", "25-29": "25~29岁", "30-34": "30~34岁", "35-39": "35~39岁", "40+": "40岁以上" },
    area: { gangnam: "江南", sinsa: "新沙", apgujeong: "狎鸥亭", myeongdong: "明洞", hongdae: "弘大", other: "其他" },
    concern: {
      elasticity: "紧致",
      fine_lines: "细纹",
      pores: "毛孔",
      acne_scars: "痘印",
      pigmentation: "色斑",
      redness: "泛红",
      dryness: "干燥",
      contour: "轮廓",
    },
    channel: { email: "邮箱", ...brandChannels },
  },
};
