import type { Locale } from "../../domain/common";
import type { Channel } from "../onboarding/slots";

// What the fixture agent says during onboarding, per locale (04 rule 5: the customer's language; rule 6:
// two sentences at most, no emoji). Checked by lib/llm/medical-boundary.test.ts.

export interface OnboardingLines {
  greeting: string;
  intentAck: (text: string) => string;
  consent: string;
  consentBlocked: string;
  sensitiveDeclined: string;
  nickname: string;
  nationality: (name: string) => string;
  residency: string;
  residentNote: string;
  ageBand: string;
  trip: string;
  tripAck: (range: string) => string;
  stayArea: string;
  concerns: string;
  history: string;
  pregnant: string;
  budget: string;
  downtime: string;
  languages: string;
  channel: string;
  handle: (channel: string) => string;
  summary: string;
  edit: string;
  done: (name: string) => string;
  intentReady: (text: string) => string;
  nudge: string;
  reask: string;
  date: (iso: string) => string;
  range: (from: string, to: string) => string;
  channelName: Record<Channel, string>;
}

const brandChannels = { line: "LINE", wechat: "WeChat", whatsapp: "WhatsApp" } as const;
const md = (iso: string) => ({ m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ONBOARDING_LINES: Record<Locale, OnboardingLines> = {
  ja: {
    greeting: "はじめまして、PibooKの担当エージェントです。日本語で進めてもいいですか？",
    intentAck: (t) => `「${t}」ですね。お手伝いする前に、あなた専用のエージェントを作ります。3分ほどです。`,
    consent: "ありがとうございます。始める前に同意をお願いします。",
    consentBlocked: "利用規約、個人情報、海外からの情報処理への同意がないと進められません。",
    sensitiveDeclined: "わかりました。肌と施術の情報はお聞きしません。クリニックのご紹介は制限されます。",
    nickname: "ありがとうございます。何とお呼びすればいいですか？",
    nationality: (n) => `${n}さん、国籍を教えてください。`,
    residency: "韓国で外国人登録（または居所申告）をして暮らしていますか？",
    residentNote: "その場合、クリニックの紹介と予約はご案内できません。施術記録を中心に作成します。",
    ageBand: "年代を選んでください。生年月日はお聞きしません。",
    trip: "韓国に到着する日と帰国する日を教えてください。",
    tripAck: (r) => `${r}ですね。`,
    stayArea: "宿泊はどのエリアですか？",
    concerns: "気になる肌の悩みをすべて選んでください。",
    history: "これまでに受けた施術はありますか？なければ「なし」を押してください。",
    pregnant: "クリニックに伝える安全情報です。現在、妊娠中または授乳中ですか？",
    budget: "予算の上限があれば教えてください。なければスキップできます。",
    downtime: "施術後の赤みなど、回復期間は何日まで大丈夫ですか？",
    languages: "クリニックで必要な言語を選んでください。",
    channel: "通知はどこで受け取りますか？",
    handle: (c) => `${c}のIDまたはアドレスを教えてください。`,
    summary: "この内容でエージェントを作りますか？",
    edit: "どの項目を修正しますか？",
    done: (n) => `${n}さんのエージェントができました。受けたい施術を教えてください。`,
    intentReady: (t) => `「${t}」の条件を整理する準備ができました。`,
    nudge: "上の選択肢から選ぶか、そのまま入力してください。",
    reask: "すみません、うまく受け取れませんでした。もう一度教えてください。",
    date: (iso) => `${md(iso).m}月${md(iso).d}日`,
    range: (from, to) => (from.slice(5, 7) === to.slice(5, 7) ? `${md(from).m}月${md(from).d}日から${md(to).d}日` : `${md(from).m}月${md(from).d}日から${md(to).m}月${md(to).d}日`),
    channelName: { email: "メール", ...brandChannels },
  },
  ko: {
    greeting: "안녕하세요, PibooK 담당 에이전트예요. 한국어로 진행할까요?",
    intentAck: (t) => `'${t}' 말씀이군요. 도와드리기 전에 먼저 전용 에이전트를 만들게요. 3분이면 돼요.`,
    consent: "고마워요. 시작하기 전에 동의가 필요해요.",
    consentBlocked: "이용약관, 개인정보, 국외 처리 동의가 있어야 진행할 수 있어요.",
    sensitiveDeclined: "괜찮아요. 피부와 시술 정보는 묻지 않을게요. 병원 매칭은 제한돼요.",
    nickname: "고마워요. 뭐라고 부를까요?",
    nationality: (n) => `${n}님, 국적을 알려 주세요.`,
    residency: "한국에 외국인등록(또는 거소신고)을 하고 살고 계신가요?",
    residentNote: "그러면 병원 매칭과 예약은 도와드릴 수 없어요. 시술 기록 중심으로 만들게요.",
    ageBand: "나이대를 골라 주세요. 생년월일은 받지 않아요.",
    trip: "한국에 오는 날과 돌아가는 날을 알려 주세요.",
    tripAck: (r) => `${r} 일정이군요.`,
    stayArea: "숙소는 어느 지역인가요?",
    concerns: "신경 쓰이는 피부 고민을 모두 골라 주세요.",
    history: "전에 받아 본 시술이 있나요? 없으면 '없음'을 눌러 주세요.",
    pregnant: "병원에 전달할 안전 정보예요. 현재 임신 중이거나 수유 중인가요?",
    budget: "예산 상한이 있으면 알려 주세요. 없으면 건너뛰어도 돼요.",
    downtime: "시술 후 붉어짐 같은 회복 기간은 며칠까지 괜찮으세요?",
    languages: "병원에서 필요한 언어를 골라 주세요.",
    channel: "알림은 어디로 받을까요?",
    handle: (c) => `${c} 아이디나 주소를 알려 주세요.`,
    summary: "이 내용으로 에이전트를 만들까요?",
    edit: "어느 항목을 고칠까요?",
    done: (n) => `${n}님의 에이전트가 만들어졌어요. 이제 받고 싶은 시술을 말씀해 주세요.`,
    intentReady: (t) => `'${t}' 요청을 정리할 준비가 됐어요.`,
    nudge: "위 선택지에서 골라 주시거나 그대로 입력해 주세요.",
    reask: "죄송해요, 잘 받지 못했어요. 한 번 더 알려 주세요.",
    date: (iso) => `${md(iso).m}월 ${md(iso).d}일`,
    range: (from, to) => (from.slice(5, 7) === to.slice(5, 7) ? `${md(from).m}월 ${md(from).d}일부터 ${md(to).d}일까지` : `${md(from).m}월 ${md(from).d}일부터 ${md(to).m}월 ${md(to).d}일까지`),
    channelName: { email: "이메일", line: "라인", wechat: "위챗", whatsapp: "왓츠앱" },
  },
  en: {
    greeting: "Hi, I'm your PibooK agent. Shall we continue in English?",
    intentAck: (t) => `"${t}", got it. Before I help, I'll set up your own agent. It takes about 3 minutes.`,
    consent: "Thanks. Before we start, I need your consent.",
    consentBlocked: "We need your consent to the terms, privacy and cross-border processing to continue.",
    sensitiveDeclined: "No problem. I won't ask about your skin or treatments. Clinic matching will be limited.",
    nickname: "Thanks. What should I call you?",
    nationality: (n) => `${n}, what is your nationality?`,
    residency: "Do you live in Korea with an alien registration (or residence report)?",
    residentNote: "In that case I can't match or book clinics for you. I'll focus your agent on treatment records.",
    ageBand: "Pick your age range. I never ask for your birth date.",
    trip: "When do you arrive in Korea and when do you fly home?",
    tripAck: (r) => `${r}, got it.`,
    stayArea: "Which area are you staying in?",
    concerns: "Pick every skin concern that bothers you.",
    history: "Have you had any treatments before? If not, tap \"None\".",
    pregnant: "This is safety info for the clinic. Are you currently pregnant or breastfeeding?",
    budget: "Is there a budget cap? You can skip this.",
    downtime: "How many recovery days, like redness after a treatment, are okay for you?",
    languages: "Which languages do you need at the clinic?",
    channel: "Where should I send updates?",
    handle: (c) => `What is your ${c} ID or address?`,
    summary: "Shall I create your agent with these details?",
    edit: "Which item would you like to change?",
    done: (n) => `Your agent is ready, ${n}. Tell me which treatment you'd like.`,
    intentReady: (t) => `I'm ready to set up "${t}" as a request.`,
    nudge: "Choose from the options above, or just type your answer.",
    reask: "Sorry, I didn't catch that. Could you tell me again?",
    date: (iso) => `${EN_MONTHS[md(iso).m - 1]} ${md(iso).d}`,
    range: (from, to) => `${EN_MONTHS[md(from).m - 1]} ${md(from).d} to ${EN_MONTHS[md(to).m - 1]} ${md(to).d}`,
    channelName: { email: "email", ...brandChannels },
  },
  "zh-CN": {
    greeting: "你好，我是PibooK的专属代理。用中文继续可以吗？",
    intentAck: (t) => `“${t}”，明白了。帮你之前，我先为你建立专属代理，大约3分钟。`,
    consent: "谢谢。开始之前需要你的同意。",
    consentBlocked: "需要同意服务条款、个人信息和跨境处理才能继续。",
    sensitiveDeclined: "没关系。我不会询问皮肤和项目信息，诊所匹配会受到限制。",
    nickname: "谢谢。我该怎么称呼你？",
    nationality: (n) => `${n}，请告诉我你的国籍。`,
    residency: "你是否在韩国办理了外国人登录（或居所申报）并在韩国生活？",
    residentNote: "这样的话，我无法为你匹配和预约诊所。我会以项目记录为主来建立代理。",
    ageBand: "请选择年龄段。不会询问出生日期。",
    trip: "请告诉我到达韩国和回国的日期。",
    tripAck: (r) => `${r}，好的。`,
    stayArea: "你住在哪个区域？",
    concerns: "请选择所有在意的皮肤问题。",
    history: "以前做过什么项目吗？没有的话请点“没有”。",
    pregnant: "这是转交给诊所的安全信息。你目前是否怀孕或哺乳？",
    budget: "如果有预算上限请告诉我，没有可以跳过。",
    downtime: "项目后泛红等恢复期最多可以接受几天？",
    languages: "请选择在诊所需要的语言。",
    channel: "通知发到哪里？",
    handle: (c) => `请告诉我你的${c}账号或地址。`,
    summary: "按这些内容建立代理吗？",
    edit: "要修改哪一项？",
    done: (n) => `${n}，你的代理已建立。请告诉我你想做的项目。`,
    intentReady: (t) => `已准备好整理“${t}”的需求。`,
    nudge: "请从上面的选项中选择，或直接输入。",
    reask: "抱歉，没有收到正确的内容。请再告诉我一次。",
    date: (iso) => `${md(iso).m}月${md(iso).d}日`,
    range: (from, to) => (from.slice(5, 7) === to.slice(5, 7) ? `${md(from).m}月${md(from).d}日到${md(to).d}日` : `${md(from).m}月${md(from).d}日到${md(to).m}月${md(to).d}日`),
    channelName: { email: "邮箱", ...brandChannels },
  },
};
