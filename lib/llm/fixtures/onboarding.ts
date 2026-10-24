import type { Locale } from "../../domain/common";
import {
  applyProfilePatch,
  type ClinicOnboardingDraft,
  type CustomerOnboardingDraft,
  type OnboardingDraft,
  type OnboardingKind,
} from "../tools/onboarding";

// Fixture onboarding conversations (04 "대화 예시"): Yuki (customer, ja) and Seoul Glow (clinic, ko).
// Stateless: the next step is the first one the draft does not satisfy yet, so a server that applies the
// update_profile patches drives it to the end. A user message equal to the step's scripted answer
// (fixtureNextUserUtterance, the demo's auto advance button) fills the slots; anything else re-asks the step.

export interface FixtureToolCall {
  name: string;
  input: unknown;
}

export interface FixtureTurn {
  text: string;
  toolCalls: FixtureToolCall[];
}

type Texts = Record<Locale, string>;

interface Step<D extends OnboardingDraft> {
  id: string;
  done: (draft: D) => boolean;
  ask: (locale: Locale, draft: D) => FixtureTurn;
  /** The scripted reply that fills this step. */
  answer?: { utterance: string; patch: D };
}

const widget = (type: string, slot: string, options?: { value: string; label: string }[]): FixtureToolCall => ({
  name: "show_widget",
  input: options ? { type, slot, options } : { type, slot },
});

const say = (locale: Locale, texts: Texts, ...toolCalls: FixtureToolCall[]): FixtureTurn => ({ text: texts[locale], toolCalls });

const md = (date: string | undefined, locale: Locale): string => {
  if (!date) return "";
  const [, month, day] = date.split("-").map(Number);
  if (locale === "ja" || locale === "zh-CN") return `${month}月${day}日`;
  if (locale === "ko") return `${month}월 ${day}일`;
  return `${month}/${day}`;
};

// ---- customer: Yuki ----

const LOCALE_OPTIONS = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "zh-CN", label: "中文" },
  { value: "ko", label: "한국어" },
];

const CONSENT_CALLS: FixtureToolCall[] = ["terms", "privacy", "sensitiveHealth", "crossBorder", "shareAnonymizedRecords"].map(
  (consentType) => ({ name: "request_consent", input: { consentType } }),
);

const CUSTOMER_STEPS: Step<CustomerOnboardingDraft>[] = [
  {
    id: "locale",
    done: (d) => d.locale !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "はじめまして、PibooKの担当エージェントです。日本語で進めてもいいですか？",
          en: "Hi, I am your PibooK agent. Shall we continue in English?",
          "zh-CN": "您好，我是PibooK的专属代理。我们用中文继续可以吗？",
          ko: "안녕하세요, PibooK 담당 에이전트예요. 한국어로 진행해도 될까요?",
        },
        widget("chips", "locale", LOCALE_OPTIONS),
      ),
    answer: { utterance: "日本語で", patch: { locale: "ja" } },
  },
  {
    id: "consents",
    done: (d) =>
      d.consents?.terms !== undefined &&
      d.consents.privacy !== undefined &&
      d.consents.sensitiveHealth !== undefined &&
      d.consents.crossBorder !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "ありがとうございます。始める前に、こちらの同意内容をご確認ください。",
          en: "Thank you. Before we start, please review these consents.",
          "zh-CN": "谢谢。开始之前，请确认以下同意事项。",
          ko: "감사해요. 시작하기 전에 아래 동의 내용을 확인해 주세요.",
        },
        ...CONSENT_CALLS,
      ),
    answer: {
      utterance: "すべて同意します",
      patch: { consents: { terms: true, privacy: true, sensitiveHealth: true, crossBorder: true, shareAnonymizedRecords: true } },
    },
  },
  {
    id: "nickname",
    done: (d) => d.nickname !== undefined,
    ask: (l) =>
      say(l, {
        ja: "ありがとうございます。何とお呼びすればいいですか？",
        en: "Thank you. What should I call you?",
        "zh-CN": "谢谢。我该怎么称呼您？",
        ko: "감사해요. 뭐라고 불러 드릴까요?",
      }),
    answer: {
      utterance: "ゆきです。29歳、東京から明日の金曜から日曜まで行きます",
      patch: { nickname: "ゆき", nationality: "JP", ageBand: "25-29", trip: { arrival: "2026-11-13", departure: "2026-11-15" } },
    },
  },
  {
    id: "nationality",
    done: (d) => d.nationality !== undefined,
    ask: (l) =>
      say(
        l,
        { ja: "国籍を教えてください。", en: "What is your nationality?", "zh-CN": "请告诉我您的国籍。", ko: "국적을 알려 주세요." },
        widget("chips", "nationality", [
          { value: "JP", label: "日本 / Japan" },
          { value: "CN", label: "中国 / China" },
          { value: "US", label: "USA" },
          { value: "KR", label: "한국 / Korea" },
        ]),
      ),
  },
  {
    id: "ageBand",
    done: (d) => d.ageBand !== undefined,
    ask: (l) =>
      say(
        l,
        { ja: "年代を選んでください。", en: "Which age group are you in?", "zh-CN": "请选择您的年龄段。", ko: "나이대를 골라 주세요." },
        widget(
          "chips",
          "ageBand",
          ["20-24", "25-29", "30-34", "35-39", "40+"].map((value) => ({ value, label: value })),
        ),
      ),
  },
  {
    id: "residency",
    done: (d) => d.nationality === "KR" || d.residency !== undefined,
    ask: (l, d) =>
      say(
        l,
        {
          ja: `${d.nickname ?? ""}さん、よろしくお願いします。韓国で外国人登録(または居所申告)をして暮らしていますか？`,
          en: `Nice to meet you, ${d.nickname ?? ""}. Do you live in Korea with an alien registration or residence report?`,
          "zh-CN": `${d.nickname ?? ""}，您好。您是否在韩国办理了外国人登录(或居所申报)并在韩国居住？`,
          ko: `${d.nickname ?? ""}님, 반가워요. 한국에 외국인등록(또는 거소신고)을 하고 살고 계신가요?`,
        },
        widget("chips", "residency", [
          { value: "resident", label: "はい / Yes" },
          { value: "short_term_visitor", label: "いいえ / No" },
        ]),
      ),
    answer: { utterance: "いいえ、旅行です", patch: { residency: "short_term_visitor" } },
  },
  {
    id: "trip",
    done: (d) =>
      d.nationality === "KR" || d.residency === "resident" || (d.trip?.arrival !== undefined && d.trip.departure !== undefined),
    ask: (l) =>
      say(
        l,
        {
          ja: "韓国に滞在する日程を教えてください。",
          en: "Which dates will you be in Korea?",
          "zh-CN": "请告诉我您在韩国的日程。",
          ko: "한국에 머무는 일정을 알려 주세요.",
        },
        widget("date_range", "trip"),
      ),
  },
  {
    id: "flightTimeHome",
    done: (d) => d.nationality === "KR" || d.residency === "resident" || d.trip?.flightTimeHome !== undefined,
    ask: (l, d) =>
      say(
        l,
        {
          ja: `${md(d.trip?.arrival, l)}から${md(d.trip?.departure, l)}ですね。帰りの飛行機は何時ごろですか？`,
          en: `${md(d.trip?.arrival, l)} to ${md(d.trip?.departure, l)}, got it. What time is your flight home?`,
          "zh-CN": `是${md(d.trip?.arrival, l)}到${md(d.trip?.departure, l)}对吧。回程航班大概几点？`,
          ko: `${md(d.trip?.arrival, l)}부터 ${md(d.trip?.departure, l)}까지네요. 돌아가는 비행기는 몇 시쯤인가요?`,
        },
        widget("time", "trip.flightTimeHome"),
      ),
    answer: { utterance: "夜8時の便です", patch: { trip: { flightTimeHome: "20:00" } } },
  },
  {
    id: "stayArea",
    done: (d) => d.nationality === "KR" || d.residency === "resident" || d.trip?.stayArea !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "どのあたりに泊まりますか？",
          en: "Which area are you staying in?",
          "zh-CN": "您住在哪个区域？",
          ko: "어느 동네에 묵으세요?",
        },
        widget("chips", "trip.stayArea", [
          { value: "sinsa", label: "新沙 / Sinsa" },
          { value: "gangnam", label: "江南 / Gangnam" },
          { value: "apgujeong", label: "狎鴎亭 / Apgujeong" },
          { value: "myeongdong", label: "明洞 / Myeongdong" },
          { value: "hongdae", label: "弘大 / Hongdae" },
          { value: "other", label: "その他 / Other" },
        ]),
      ),
    answer: { utterance: "新沙です", patch: { trip: { stayArea: "sinsa" } } },
  },
  {
    id: "concerns",
    done: (d) => d.consents?.sensitiveHealth === false || (d.skin?.concerns?.length ?? 0) > 0,
    ask: (l) =>
      say(
        l,
        {
          ja: "肌で気になっていることを選んでください。いくつ選んでも大丈夫です。",
          en: "Which skin concerns would you like to note? You can pick several.",
          "zh-CN": "请选择您在意的皮肤问题，可以多选。",
          ko: "피부에서 신경 쓰이는 점을 골라 주세요. 여러 개 골라도 돼요.",
        },
        widget("multi_chips", "skin.concerns", [
          { value: "elasticity", label: "ハリ / Elasticity" },
          { value: "fine_lines", label: "小じわ / Fine lines" },
          { value: "pores", label: "毛穴 / Pores" },
          { value: "acne_scars", label: "ニキビ跡 / Acne scars" },
          { value: "pigmentation", label: "シミ / Pigmentation" },
          { value: "redness", label: "赤み / Redness" },
          { value: "dryness", label: "乾燥 / Dryness" },
          { value: "contour", label: "輪郭 / Contour" },
        ]),
      ),
    answer: { utterance: "ハリと小じわです", patch: { skin: { concerns: ["elasticity", "fine_lines"] } } },
  },
  {
    id: "history",
    done: (d) => d.consents?.sensitiveHealth === false || d.history !== undefined,
    ask: (l) =>
      say(l, {
        ja: "これまでに受けた美容施術はありますか？なければ「なし」で大丈夫です。",
        en: "Have you had any aesthetic procedures before? If not, just say none.",
        "zh-CN": "您以前做过医美项目吗？没有的话回答“没有”就可以。",
        ko: "지금까지 받은 미용 시술이 있나요? 없으면 \"없음\"이라고 해 주세요.",
      }),
    answer: { utterance: "韓国では初めてです。なしです", patch: { history: [] } },
  },
  {
    id: "pregnant",
    done: (d) => d.consents?.sensitiveHealth === false || d.safety?.pregnantOrBreastfeeding !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "妊娠中、または授乳中ですか？この情報はクリニックに伝え、施術できるかどうかは医師が判断します。",
          en: "Are you pregnant or breastfeeding? This goes to the clinic, and the doctor decides whether a procedure is possible.",
          "zh-CN": "您是否在怀孕或哺乳期？此信息会转达给诊所，能否进行项目由医生判断。",
          ko: "임신 중이거나 수유 중인가요? 이 정보는 병원에 전달되고, 시술 가능 여부는 의사가 판단해요.",
        },
        widget("yes_no", "safety.pregnantOrBreastfeeding"),
      ),
    answer: { utterance: "いいえ", patch: { safety: { pregnantOrBreastfeeding: false } } },
  },
  {
    id: "allergies",
    done: (d) => d.consents?.sensitiveHealth === false || d.safety?.allergies !== undefined,
    ask: (l) =>
      say(l, {
        ja: "薬や麻酔でアレルギーが出たことはありますか？",
        en: "Have you ever had an allergy to a medicine or an anesthetic?",
        "zh-CN": "您对药物或麻醉剂有过过敏吗？",
        ko: "약이나 마취제에 알레르기가 있었던 적이 있나요?",
      }),
    answer: { utterance: "ありません", patch: { safety: { allergies: [] } } },
  },
  {
    id: "budget",
    done: (d) => d.prefs?.budgetKrw !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "1回の施術のご予算の上限はありますか？円で入力しても大丈夫です。",
          en: "Do you have a budget limit for one visit? You can enter it in your own currency.",
          "zh-CN": "单次项目的预算上限是多少？也可以用人民币输入。",
          ko: "한 번 시술에 쓸 예산 상한이 있나요?",
        },
        widget("money", "prefs.budgetKrw"),
      ),
    answer: { utterance: "45万ウォンまでです", patch: { prefs: { budgetKrw: { max: 450000 } } } },
  },
  {
    id: "languages",
    done: (d) => (d.prefs?.languagesNeeded?.length ?? 0) > 0,
    ask: (l) =>
      say(
        l,
        {
          ja: "クリニックではどの言語での対応が必要ですか？",
          en: "Which language do you need at the clinic?",
          "zh-CN": "在诊所需要用哪种语言沟通？",
          ko: "병원에서 어떤 언어로 안내받고 싶으세요?",
        },
        widget("chips", "prefs.languagesNeeded", LOCALE_OPTIONS),
      ),
    answer: { utterance: "日本語でお願いします", patch: { prefs: { languagesNeeded: ["ja"] } } },
  },
  {
    id: "contact",
    done: (d) => d.contact?.channel !== undefined && d.contact.handle !== undefined,
    ask: (l) =>
      say(
        l,
        {
          ja: "予約のご連絡はどこにお送りしましょうか？",
          en: "Where should I send booking updates?",
          "zh-CN": "预约通知发到哪里比较好？",
          ko: "예약 연락은 어디로 보내 드릴까요?",
        },
        widget("chips", "contact.channel", [
          { value: "line", label: "LINE" },
          { value: "email", label: "Email" },
          { value: "wechat", label: "WeChat" },
          { value: "whatsapp", label: "WhatsApp" },
        ]),
      ),
    answer: { utterance: "LINEでお願いします。IDは yuki_tokyo です", patch: { contact: { channel: "line", handle: "yuki_tokyo" } } },
  },
  {
    id: "firstIntent",
    done: (d) => d.firstIntent !== undefined,
    ask: (l) =>
      say(l, {
        ja: "今、受けてみたい施術はありますか？",
        en: "Is there a procedure you are interested in right now?",
        "zh-CN": "现在有想了解的项目吗？",
        ko: "지금 관심 있는 시술이 있나요?",
      }),
    answer: { utterance: "リジュランを受けたいです", patch: { firstIntent: "リジュランを受けたい" } },
  },
];

const CUSTOMER_SUMMARY: Step<CustomerOnboardingDraft> = {
  id: "summary",
  done: () => false,
  ask: (l) =>
    say(
      l,
      {
        ja: "この内容でエージェントを作りますか？",
        en: "Shall I create your agent with these details?",
        "zh-CN": "要用这些信息创建您的代理吗？",
        ko: "이 내용으로 에이전트를 만들까요?",
      },
      widget("summary", "summary", [
        { value: "create", label: "作成する" },
        { value: "edit", label: "修正する" },
      ]),
    ),
  answer: { utterance: "作成する", patch: {} },
};

const CUSTOMER_DONE: Texts = {
  ja: "エージェントができました。ホームに移動します。",
  en: "Your agent is ready. Taking you home.",
  "zh-CN": "您的代理已创建，即将前往首页。",
  ko: "에이전트가 만들어졌어요. 홈으로 이동할게요.",
};

// ---- clinic: Seoul Glow ----

const ko = (text: string): Texts => ({ ja: text, en: text, "zh-CN": text, ko: text });

const CLINIC_STEPS: Step<ClinicOnboardingDraft>[] = [
  {
    id: "contactPerson",
    done: (d) => d.contactPerson?.name !== undefined && d.contactPerson.role !== undefined,
    ask: (l) => say(l, ko("안녕하세요, PibooK 병원 온보딩을 도와드릴게요. 담당자 성함과 직함을 알려 주세요.")),
    answer: { utterance: "김지현 실장입니다", patch: { contactPerson: { name: "김지현", role: "실장" } } },
  },
  {
    id: "institution",
    done: (d) => d.clinicName !== undefined && d.address !== undefined && d.area !== undefined,
    ask: (l) => say(l, ko("병원 이름과 주소를 알려 주세요.")),
    answer: {
      utterance: "서울글로우피부과, 서울 강남구 압구정로 123이에요",
      patch: { clinicName: "서울글로우피부과", address: "서울 강남구 압구정로 123", area: "apgujeong" },
    },
  },
  {
    id: "medicalInstitutionId",
    done: (d) => d.medicalInstitutionId !== undefined,
    ask: (l) => say(l, ko("압구정 지역으로 등록할게요. 의료기관 개설 신고 번호나 요양기관 기호를 알려 주세요.")),
    answer: { utterance: "12345678이에요", patch: { medicalInstitutionId: "12345678" } },
  },
  {
    id: "businessRegistrationNo",
    done: (d) => d.businessRegistrationNo !== undefined,
    ask: (l) => say(l, ko("사업자등록번호도 알려 주세요.")),
    answer: { utterance: "123-45-67890이에요", patch: { businessRegistrationNo: "123-45-67890" } },
  },
  {
    id: "openingCertificate",
    done: (d) => d.docs?.openingCertificate === true,
    ask: (l) => say(l, ko("의료기관 개설신고증명서를 올려 주세요."), widget("upload", "docs.openingCertificate")),
    answer: { utterance: "개설신고증명서 올렸어요", patch: { docs: { openingCertificate: true } } },
  },
  {
    id: "foreignPatientFacilityRegistration",
    done: (d) => d.docs?.foreignPatientFacilityRegistration !== undefined,
    ask: (l) =>
      say(
        l,
        ko("외국인환자 유치 의료기관 등록증과 등록번호를 올려 주세요. 등록증이 확인되기 전에는 매칭에 노출되지 않아요."),
        widget("upload", "docs.foreignPatientFacilityRegistration"),
      ),
    answer: {
      utterance: "유치기관 등록증도 올렸어요. 등록번호는 2026-0123이에요",
      patch: { docs: { foreignPatientFacilityRegistration: { uploaded: true, registrationNo: "2026-0123" } } },
    },
  },
  {
    id: "doctors",
    done: (d) => (d.doctors?.length ?? 0) > 0,
    ask: (l) => say(l, ko("진료하시는 의사 선생님을 알려 주세요. 피부과 전문의인지도 함께요.")),
    answer: {
      utterance: "박서연 원장님, 피부과 전문의, 12년차예요",
      patch: { doctors: [{ name: "박서연", boardCertifiedDermatology: true, yearsOfPractice: 12 }] },
    },
  },
  {
    id: "languages",
    done: (d) => (d.languages?.length ?? 0) > 0,
    ask: (l) => say(l, ko("어떤 언어로 응대할 수 있나요?"), widget("chips", "languages", LOCALE_OPTIONS)),
    answer: {
      utterance: "일본어 코디가 있고 영어는 통역으로 해요",
      patch: {
        languages: [
          { locale: "ko", mode: "staff" },
          { locale: "ja", mode: "staff" },
          { locale: "en", mode: "interpreter" },
        ],
      },
    },
  },
  {
    id: "menu",
    done: (d) => (d.menu?.length ?? 0) > 0,
    ask: (l) => say(l, ko("가격표를 올리시거나 시술별 가격을 알려 주세요."), widget("upload", "menu")),
    answer: {
      utterance: "리쥬란 힐러 2cc 34만 원, 부가세 포함이고 외국인도 같은 가격이에요",
      patch: {
        menu: [
          {
            procedureId: "rejuran_healer",
            product: "Rejuran Healer",
            amount: { value: 2, unit: "cc" },
            priceKrw: 340000,
            vatIncluded: true,
            includes: [],
            foreignerSamePrice: true,
          },
        ],
      },
    },
  },
  {
    id: "hours",
    done: (d) => (d.hours?.length ?? 0) > 0,
    ask: (l) => say(l, ko("진료 시간을 알려 주세요."), widget("weekly_hours", "hours")),
    answer: {
      utterance: "평일 10시부터 19시, 토요일은 10시부터 15시요",
      patch: {
        hours: [
          ...(["mon", "tue", "wed", "thu", "fri"] as const).map((day) => ({ day, open: "10:00", close: "19:00" })),
          { day: "sat", open: "10:00", close: "15:00" },
        ],
      },
    },
  },
  {
    id: "slotPolicy",
    done: (d) => d.slotPolicy !== undefined,
    ask: (l) => say(l, ko("시술별 소요 시간, 하루 외국인 예약 수, 자동 확정 여부를 알려 주세요.")),
    answer: {
      utterance: "리쥬란은 30분, 외국인 예약은 하루 4개, 확정은 직접 할게요",
      patch: {
        slotPolicy: { durationMinByProcedure: [{ procedureId: "rejuran_healer", minutes: 30 }], foreignSlotsPerDay: 4, autoConfirm: false },
      },
    },
  },
  {
    id: "commissionAgreement",
    done: (d) => d.commissionAgreement?.agreed === true,
    ask: (l) =>
      say(l, ko("마지막으로 정산 약정을 확인해 주세요."), { name: "request_consent", input: { consentType: "commissionAgreement" } }),
    answer: { utterance: "동의합니다", patch: { commissionAgreement: { agreed: true, version: "2026-10-24.v1" } } },
  },
];

const CLINIC_SUMMARY: Step<ClinicOnboardingDraft> = {
  id: "summary",
  done: () => false,
  ask: (l) =>
    say(
      l,
      ko("에이전트 카드 미리보기예요. 이대로 운영을 시작할까요?"),
      widget("summary", "summary", [
        { value: "start", label: "운영 시작" },
        { value: "edit", label: "수정하기" },
      ]),
    ),
  answer: { utterance: "운영 시작", patch: {} },
};

const CLINIC_DONE = ko("운영을 시작했어요. 대시보드로 이동할게요.");

// ---- engine ----

const normalize = (text: string) => text.normalize("NFKC").replace(/[\s。、.,!?！？]/g, "");

interface Script<D extends OnboardingDraft> {
  steps: Step<D>[];
  summary: Step<D>;
  done: Texts;
}

const SCRIPTS: { customer: Script<CustomerOnboardingDraft>; clinic: Script<ClinicOnboardingDraft> } = {
  customer: { steps: CUSTOMER_STEPS, summary: CUSTOMER_SUMMARY, done: CUSTOMER_DONE },
  clinic: { steps: CLINIC_STEPS, summary: CLINIC_SUMMARY, done: CLINIC_DONE },
};

function currentStep<D extends OnboardingDraft>(script: Script<D>, draft: D): Step<D> {
  return script.steps.find((step) => !step.done(draft)) ?? script.summary;
}

export interface OnboardingFixtureState {
  kind?: OnboardingKind;
  draft: OnboardingDraft;
  /** Defaults to the draft's locale, then ja (customer) or ko (clinic). */
  locale?: Locale;
}

function localeOf(state: OnboardingFixtureState): Locale {
  if (state.kind === "clinic") return "ko";
  return (state.draft as CustomerOnboardingDraft).locale ?? state.locale ?? "ja";
}

/** One fixture turn: the answer patch (if the message is the scripted answer), then the next question. */
export function onboardingFixtureTurn(state: OnboardingFixtureState, lastUserText: string | undefined): FixtureTurn {
  const kind = state.kind ?? "customer";
  const script = SCRIPTS[kind] as Script<OnboardingDraft>;
  let draft = state.draft;
  let step = currentStep(script, draft);
  const toolCalls: FixtureToolCall[] = [];

  if (lastUserText !== undefined && step.answer && normalize(lastUserText) === normalize(step.answer.utterance)) {
    if (step === script.summary) {
      return { text: script.done[localeOf({ ...state, draft })], toolCalls: [{ name: "finish_onboarding", input: {} }] };
    }
    toolCalls.push({ name: "update_profile", input: { patch: step.answer.patch } });
    draft = applyProfilePatch(draft, step.answer.patch);
    step = currentStep(script, draft);
  }

  const asked = step.ask(localeOf({ ...state, draft }), draft);
  return { text: asked.text, toolCalls: [...toolCalls, ...asked.toolCalls] };
}

/**
 * What the scripted persona says next, for the demo's auto advance button (10 데모 1행). Undefined when the
 * current step has no scripted answer (the script was left by typing something else).
 */
export function fixtureNextUserUtterance(state: OnboardingFixtureState): string | undefined {
  const script = SCRIPTS[state.kind ?? "customer"] as Script<OnboardingDraft>;
  return currentStep(script, state.draft).answer?.utterance;
}

/** Every text the onboarding fixtures can say, for the medical boundary test. */
export function allOnboardingFixtureTexts(): string[] {
  const texts: string[] = [];
  const locales: Locale[] = ["ja", "en", "zh-CN", "ko"];
  const sample: CustomerOnboardingDraft = { nickname: "ゆき", trip: { arrival: "2026-11-13", departure: "2026-11-15" } };
  for (const step of [...CUSTOMER_STEPS, CUSTOMER_SUMMARY]) {
    for (const locale of locales) texts.push(step.ask(locale, sample).text);
  }
  for (const step of [...CLINIC_STEPS, CLINIC_SUMMARY]) texts.push(step.ask("ko", {}).text);
  texts.push(...Object.values(CUSTOMER_DONE), CLINIC_DONE.ko);
  return texts;
}
