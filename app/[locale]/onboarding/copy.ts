import type { ClinicCardLabels } from "@/components/customer/clinic-carousel";
import type { Locale } from "@/lib/domain/common";
import type { AgeBand, Area, Channel, Concern, ConsentType, NationalityOption, Residency, SlotKey } from "./mock";

// Onboarding screen copy, one block per locale. The agent lines come from POST /api/onboarding/customer
// (Claude or lib/llm/fixtures); widget, slot and consent labels stay here.
export type OnboardingCopy = {
  title: string;
  previewTitle: string;
  previewCaption: string;
  progress: (percent: number) => string;
  close: string;
  inputLabel: string;
  placeholder: string;
  send: string;
  inputHint: string;
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
  editPick: string;
  connectionError: string;
  goChat: string;
  summary: { title: string; create: string; edit: string };
  doneTitle: string;
  taskStatus: { pending: string; active: string; done: string; error: string };
  results: (subject: string, n: number) => string;
  resultsAll: (n: number) => string;
  resultsNone: string;
  clinicCard: ClinicCardLabels;
  goHome: string;
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
    inputHint: "Enter 보내기 · Shift+Enter 줄바꿈",
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
    editPick: "어느 항목을 고칠까요?",
    connectionError: "연결이 끊겼어요. 잠시 후 다시 보내 주세요.",
    goChat: "요청 정리하러 가기",
    summary: { title: "에이전트 요약", create: "만들기", edit: "수정하기" },
    doneTitle: "에이전트 활성화됨",
    taskStatus: { pending: "대기", active: "진행 중", done: "완료", error: "확인 필요" },
    results: (s, n) => `${s} 조건에 맞는, 기준을 통과한 클리닉은 ${n}곳이에요. 카드를 옆으로 넘겨 보세요. 견적은 에이전트를 만든 뒤 대신 받아 드릴게요.`,
    resultsAll: (n) => `기준을 통과한 클리닉은 모두 ${n}곳이에요. 카드를 옆으로 넘겨 보세요. 견적은 에이전트를 만든 뒤 대신 받아 드릴게요.`,
    resultsNone: "아직 이 조건에 맞는 클리닉이 없어요. 에이전트를 만들면 조건을 넓혀 다시 찾아볼게요.",
    clinicCard: {
      standards: (k, n) => `기준 ${k}/${n} 확인`,
      details: "기준 보기",
      hide: "접기",
      checked: "확인됨",
      unchecked: "확인 전",
      proxy: "PibooK 대행 응답",
      direct: "병원 직접 응답",
      demo: "가상 데이터예요.",
    },
    goHome: "홈으로 가기",
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
      firstIntent: "첫 요청",
    },
    consents: {
      terms: { title: "이용약관", description: "PibooK 서비스 이용 조건에 동의해요." },
      privacy: { title: "개인정보 수집·이용", description: "호칭, 국적, 나이대, 일정, 연락처를 에이전트 운영에 써요." },
      sensitiveHealth: {
        title: "피부·시술 정보",
        description: "피부 고민, 과거 시술, 안전 정보를 수집해요. 동의하지 않으면 병원 매칭이 제한돼요.",
      },
      crossBorder: { title: "국외 거주자 정보 처리", description: "입력한 정보가 국외에서 처리(AI 응답 생성 등)되거나 국외 서버에 보관될 수 있어요." },
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
    inputHint: "Enterで送信 · Shift+Enterで改行",
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
    editPick: "どの項目を修正しますか？",
    connectionError: "接続できませんでした。少し待ってからもう一度送ってください。",
    goChat: "条件の整理へ",
    summary: { title: "エージェントの内容", create: "作成する", edit: "修正する" },
    doneTitle: "エージェント有効",
    taskStatus: { pending: "待機", active: "進行中", done: "完了", error: "要確認" },
    results: (s, n) => `${s}の条件に合う、基準を通過したクリニックは${n}院です。カードを横にスワイプしてご覧ください。見積もりは、エージェントを作ってから代わりに集めます。`,
    resultsAll: (n) => `基準を通過したクリニックは全部で${n}院です。カードを横にスワイプしてご覧ください。見積もりは、エージェントを作ってから代わりに集めます。`,
    resultsNone: "この条件に合うクリニックはまだありません。エージェントを作ったら、条件を広げて探し直します。",
    clinicCard: {
      standards: (k, n) => `基準 ${k}/${n} 確認済み`,
      details: "基準を見る",
      hide: "閉じる",
      checked: "確認済み",
      unchecked: "未確認",
      proxy: "PibooKが代理で回答",
      direct: "クリニックが直接回答",
      demo: "架空のデータです。",
    },
    goHome: "ホームへ",
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
      firstIntent: "最初の依頼",
    },
    consents: {
      terms: { title: "利用規約", description: "PibooKのサービス利用条件に同意します。" },
      privacy: { title: "個人情報", description: "呼び名、国籍、年代、日程、連絡先をエージェントの運用に使います。" },
      sensitiveHealth: {
        title: "肌と施術の情報",
        description: "肌の悩み、過去の施術、安全情報を収集します。同意しない場合、クリニックの紹介が制限されます。",
      },
      crossBorder: { title: "海外からの情報処理", description: "入力した情報は、外国にある第三者（AIによる応答の生成など）に提供され、国外のサーバーで処理・保管されることがあります。" },
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
    inputHint: "Enter to send · Shift+Enter for a new line",
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
    editPick: "Which item would you like to change?",
    connectionError: "Connection lost. Please send that again in a moment.",
    goChat: "Set up my request",
    summary: { title: "Agent summary", create: "Create", edit: "Edit" },
    doneTitle: "Agent active",
    taskStatus: { pending: "Pending", active: "In progress", done: "Done", error: "Needs attention" },
    results: (s, n) => `${n} clinics that pass our standards match "${s}". Swipe through the cards. Once your agent is set up, I'll collect quotes for you.`,
    resultsAll: (n) => `${n} clinics pass our standards. Swipe through the cards. Once your agent is set up, I'll collect quotes for you.`,
    resultsNone: "No clinic matches this yet. Once your agent is set up, I'll widen the search.",
    clinicCard: {
      standards: (k, n) => `${k}/${n} standards checked`,
      details: "See standards",
      hide: "Hide",
      checked: "Checked",
      unchecked: "Not yet checked",
      proxy: "PibooK answers for the clinic",
      direct: "Answered by the clinic",
      demo: "Fictional data.",
    },
    goHome: "Go to home",
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
      firstIntent: "First request",
    },
    consents: {
      terms: { title: "Terms of use", description: "I agree to the PibooK terms of service." },
      privacy: {
        title: "Personal information",
        description: "Your name, nationality, age band, trip and contact are used to run your agent.",
      },
      sensitiveHealth: {
        title: "Skin and procedure information",
        description: "We collect skin concerns, past procedures and safety information. Without this, clinic matching is limited.",
      },
      crossBorder: { title: "Cross-border processing", description: "What you enter may be processed outside Korea (for example, by an AI provider generating replies) and stored on servers abroad." },
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
    inputHint: "Enter 发送 · Shift+Enter 换行",
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
    editPick: "要修改哪一项？",
    connectionError: "连接中断了，请稍后再发送一次。",
    goChat: "去整理需求",
    summary: { title: "代理概要", create: "创建", edit: "修改" },
    doneTitle: "代理已启用",
    taskStatus: { pending: "待处理", active: "进行中", done: "已完成", error: "需处理" },
    results: (s, n) => `符合「${s}」条件、通过标准的诊所共有 ${n} 家。左右滑动卡片查看。创建代理后,我会替您收集报价。`,
    resultsAll: (n) => `通过标准的诊所共有 ${n} 家。左右滑动卡片查看。创建代理后,我会替您收集报价。`,
    resultsNone: "暂时没有符合这个条件的诊所。创建代理后,我会放宽条件再找。",
    clinicCard: {
      standards: (k, n) => `已核查 ${k}/${n} 项标准`,
      details: "查看标准",
      hide: "收起",
      checked: "已核查",
      unchecked: "未核查",
      proxy: "PibooK 代为回复",
      direct: "诊所直接回复",
      demo: "这是虚拟数据。",
    },
    goHome: "进入首页",
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
      firstIntent: "首个需求",
    },
    consents: {
      terms: { title: "使用条款", description: "同意 PibooK 服务使用条件。" },
      privacy: { title: "个人信息", description: "称呼、国籍、年龄段、行程和联系方式用于运行你的代理。" },
      sensitiveHealth: {
        title: "皮肤与项目信息",
        description: "收集皮肤问题、既往项目和安全信息。不同意时诊所匹配会受到限制。",
      },
      crossBorder: { title: "跨境信息处理", description: "你输入的信息可能会提供给境外接收方（例如生成回复的 AI 服务），并在境外服务器上处理和存储。" },
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
