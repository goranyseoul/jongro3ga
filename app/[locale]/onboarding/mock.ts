import type { AgentCard } from "@/components/ui";
import type { IsoDate, Locale } from "@/lib/domain/common";
import type { CurrencyCode } from "@/lib/money";

// Mock onboarding: a fixed step script stands in for POST /api/onboarding/customer
// (04-onboarding-chat.md) until the backend exists. Slot names follow that spec.

export type NationalityOption = "JP" | "CN" | "US" | "KR" | "other";
export type Residency = "short_term_visitor" | "resident";
export type AgeBand = "20-24" | "25-29" | "30-34" | "35-39" | "40+";
export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
export type Concern =
  | "elasticity"
  | "fine_lines"
  | "pores"
  | "acne_scars"
  | "pigmentation"
  | "redness"
  | "dryness"
  | "contour";
export type Channel = "email" | "line" | "wechat" | "whatsapp";
export type ConsentType = "terms" | "privacy" | "sensitiveHealth" | "crossBorder" | "shareAnonymizedRecords";

export const NATIONALITIES: NationalityOption[] = ["JP", "CN", "US", "KR", "other"];
export const RESIDENCIES: Residency[] = ["short_term_visitor", "resident"];
export const AGE_BANDS: AgeBand[] = ["20-24", "25-29", "30-34", "35-39", "40+"];
export const AREAS: Area[] = ["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"];
export const CONCERNS: Concern[] = [
  "elasticity",
  "fine_lines",
  "pores",
  "acne_scars",
  "pigmentation",
  "redness",
  "dryness",
  "contour",
];
export const CHANNELS: Channel[] = ["email", "line", "wechat", "whatsapp"];
export const CONSENTS: ConsentType[] = ["terms", "privacy", "sensitiveHealth", "crossBorder", "shareAnonymizedRecords"];
export const REQUIRED_CONSENTS: ConsentType[] = ["terms", "privacy", "sensitiveHealth", "crossBorder"];
/** Without these the conversation cannot go on; sensitiveHealth may be declined. */
export const BLOCKING_CONSENTS: ConsentType[] = ["terms", "privacy", "crossBorder"];
export const DOWNTIME_DAYS = [0, 1, 3, 7];

// Won per unit, fixed reference values until data/seed/fx.json exists.
export const FX_RATES: Record<CurrencyCode, number> = { KRW: 1, JPY: 9.2, CNY: 190, USD: 1380 };
export const CURRENCIES: CurrencyCode[] = ["KRW", "JPY", "CNY", "USD"];

export type Draft = {
  locale?: Locale;
  consents: Partial<Record<ConsentType, boolean>>;
  nickname?: string;
  nationality?: NationalityOption;
  residency?: Residency;
  ageBand?: AgeBand;
  trip: { arrival?: IsoDate; departure?: IsoDate; stayArea?: Area };
  concerns: Concern[];
  history?: string;
  pregnant?: boolean;
  budget?: { currency: CurrencyCode; amount: number };
  downtime?: number;
  languages: Locale[];
  channel?: Channel;
  handle?: string;
  /** What the customer typed on the landing before onboarding started (04 slot `firstIntent`). */
  firstIntent?: string;
};

export const EMPTY_DRAFT: Draft = { consents: {}, trip: {}, concerns: [], languages: [] };

export type StepId =
  | "locale"
  | "consent"
  | "nickname"
  | "nationality"
  | "residency"
  | "ageBand"
  | "trip"
  | "stayArea"
  | "concerns"
  | "history"
  | "pregnant"
  | "budget"
  | "downtime"
  | "languages"
  | "channel"
  | "handle"
  | "summary"
  | "done";

export const STEP_ORDER: StepId[] = [
  "locale",
  "consent",
  "nickname",
  "nationality",
  "residency",
  "ageBand",
  "trip",
  "stayArea",
  "concerns",
  "history",
  "pregnant",
  "budget",
  "downtime",
  "languages",
  "channel",
  "handle",
  "summary",
  "done",
];

/** Steps a customer can jump back to from the summary card. */
export const EDITABLE_STEPS: StepId[] = [
  "nickname",
  "nationality",
  "residency",
  "ageBand",
  "trip",
  "stayArea",
  "concerns",
  "history",
  "pregnant",
  "budget",
  "downtime",
  "languages",
  "channel",
  "handle",
];

export type SlotKey = Exclude<StepId, "consent" | "summary" | "done"> | "consents" | "firstIntent";

export const STEP_SLOT: Partial<Record<StepId, SlotKey>> = {
  locale: "locale",
  consent: "consents",
  nickname: "nickname",
  nationality: "nationality",
  residency: "residency",
  ageBand: "ageBand",
  trip: "trip",
  stayArea: "stayArea",
  concerns: "concerns",
  history: "history",
  pregnant: "pregnant",
  budget: "budget",
  downtime: "downtime",
  languages: "languages",
  channel: "channel",
  handle: "handle",
};

const canMatch = (d: Draft) => d.nationality !== "KR" && d.residency !== "resident";
const hasSensitiveConsent = (d: Draft) => d.consents.sensitiveHealth === true;

// Skip rules from the slot table: KR skips residency, KR and residents skip the trip,
// declined sensitive-health consent skips skin, history and safety questions.
export function isStepApplicable(step: StepId, d: Draft): boolean {
  switch (step) {
    case "residency":
      return d.nationality !== "KR";
    case "trip":
    case "stayArea":
      return canMatch(d);
    case "concerns":
    case "history":
    case "pregnant":
      return hasSensitiveConsent(d);
    default:
      return true;
  }
}

export function nextStep(current: StepId, d: Draft): StepId {
  const start = STEP_ORDER.indexOf(current) + 1;
  return STEP_ORDER.slice(start).find((step) => isStepApplicable(step, d)) ?? "done";
}

// Progress = filled required slots / applicable required slots (04-onboarding-chat.md).
export function progressPercent(d: Draft): number {
  const checks: [applies: boolean, filled: boolean][] = [
    [true, d.locale !== undefined],
    ...REQUIRED_CONSENTS.map((type): [boolean, boolean] => [true, d.consents[type] !== undefined]),
    [true, Boolean(d.nickname)],
    [true, d.nationality !== undefined],
    [d.nationality !== "KR", d.residency !== undefined],
    [true, d.ageBand !== undefined],
    [canMatch(d), Boolean(d.trip.arrival)],
    [canMatch(d), Boolean(d.trip.departure)],
    [hasSensitiveConsent(d), d.concerns.length > 0],
    [hasSensitiveConsent(d), d.pregnant !== undefined],
    [true, d.languages.length > 0],
    [true, d.channel !== undefined],
    [true, Boolean(d.handle)],
  ];
  const applicable = checks.filter(([applies]) => applies);
  const filled = applicable.filter(([, isFilled]) => isFilled).length;
  return Math.round((filled / applicable.length) * 100);
}

export function defaultCurrency(nationality?: NationalityOption): CurrencyCode {
  if (nationality === "JP") return "JPY";
  if (nationality === "CN") return "CNY";
  if (nationality === "US") return "USD";
  return "KRW";
}

export const MOCK_AGENT_ID = "cag_7f3k2";

// Customer Agent Card in the shape of the 03-a2a-protocol.md example. Wire text stays English.
export function buildAgentCard(active: boolean): AgentCard {
  const base = "https://pibu.example";
  return {
    name: `Pibuk Customer Agent ${MOCK_AGENT_ID}`,
    description: "Personal agent acting on behalf of one Pibuk customer. Receives booking updates and outcome check-ins.",
    version: active ? "0.1.0" : "0.0.0-draft",
    provider: { organization: "Pibuk (hosting on behalf of the customer)", url: base },
    supportedInterfaces: active
      ? [{ url: `${base}/a2a/customers/${MOCK_AGENT_ID}/rpc`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }]
      : [],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        { uri: "https://pibu.app/ext/consent/v1", description: "Personal fields carry metadata.consentRef", required: false },
      ],
    },
    skills: [
      {
        id: "customer.notify",
        name: "Receive notification",
        description: "Receives booking confirmations, changes, reminders and notices from clinics and the platform.",
        tags: ["notification"],
      },
      {
        id: "customer.checkin",
        name: "Outcome check-in",
        description: "Answers platform follow-up questions about a past procedure, asking the customer when needed.",
        tags: ["outcome", "review"],
      },
    ],
  };
}

/** Matches free text against option labels, so typing "日本" picks JP like tapping the chip does. */
export function matchOption<T extends string>(text: string, labels: Record<T, string>): T | undefined {
  const needle = text.trim().toLowerCase();
  if (!needle) return undefined;
  const entries = Object.entries(labels) as [T, string][];
  return (
    entries.find(([value, label]) => label.toLowerCase() === needle || value.toLowerCase() === needle)?.[0] ??
    entries.find(([, label]) => needle.includes(label.toLowerCase()))?.[0]
  );
}

/** Mock agent typing delay. */
export const REPLY_DELAY_MS = 450;
