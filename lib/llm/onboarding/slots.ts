import { z } from "zod";
import { AgeBandSchema, AreaSchema, ConcernSchema, IsoDateSchema, LocaleSchema } from "../../a2a/schemas";
import type { AgeBand, Area, Concern, IsoDate, Locale } from "../../domain/common";
import type { CurrencyCode } from "../../money";

// Customer onboarding slots (04-onboarding-chat.md "단계와 슬롯"). Shared by the server engine, the fixture
// agent and the chat screen (progress, checklist), so this module only depends on zod and types.

export const CONSENT_TYPES = ["terms", "privacy", "sensitiveHealth", "crossBorder", "shareAnonymizedRecords"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
/** Required to answer (04 `*`). sensitiveHealth may be declined, the others must be granted. */
export const REQUIRED_CONSENTS: ConsentType[] = ["terms", "privacy", "sensitiveHealth", "crossBorder"];
export const BLOCKING_CONSENTS: ConsentType[] = ["terms", "privacy", "crossBorder"];

export const NATIONALITY_OPTIONS = ["JP", "CN", "US", "KR", "other"] as const;
export type NationalityOption = (typeof NATIONALITY_OPTIONS)[number];
/** ISO 3166 user assigned code stored when the customer picks "other" without naming a country. */
export const UNKNOWN_NATIONALITY = "ZZ";
export const RESIDENCIES = ["short_term_visitor", "resident"] as const;
export type Residency = (typeof RESIDENCIES)[number];
export const AGE_BANDS: AgeBand[] = ["20-24", "25-29", "30-34", "35-39", "40+"];
export const AREAS: Area[] = ["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"];
export const CONCERNS: Concern[] = ["elasticity", "fine_lines", "pores", "acne_scars", "pigmentation", "redness", "dryness", "contour"];
export const CHANNELS = ["email", "line", "wechat", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];
export const SKIN_TYPES = ["dry", "oily", "combination", "sensitive", "unknown"] as const;
export const DOWNTIME_DAYS = [0, 1, 3, 7] as const;
export const PAIN_LEVELS = ["low", "mid", "high"] as const;
export const LOCALES: Locale[] = ["ja", "zh-CN", "en", "ko"];

/** Won per unit, fixed reference rates shown as "참고 환율" until data/seed/fx.json exists. */
export const FX_RATES: Record<CurrencyCode, number> = { KRW: 1, JPY: 9.2, CNY: 190, USD: 1380 };
export const CURRENCIES: CurrencyCode[] = ["KRW", "JPY", "CNY", "USD"];

export function defaultCurrency(nationality?: string): CurrencyCode {
  if (nationality === "JP") return "JPY";
  if (nationality === "CN") return "CNY";
  if (nationality === "US") return "USD";
  return "KRW";
}

export interface HistoryItem {
  procedureId?: string;
  text: string;
  approxDate?: string;
}

export interface OnboardingDraft {
  locale?: Locale;
  consents: Partial<Record<ConsentType, boolean>>;
  nickname?: string;
  nationality?: string;
  residency?: Residency;
  ageBand?: AgeBand;
  trip: { arrival?: IsoDate; departure?: IsoDate; stayArea?: Area; flightTimeHome?: string };
  skin: { type?: (typeof SKIN_TYPES)[number]; concerns: Concern[] };
  /** `none: true` is a valid answer ("없음"). */
  history?: { none: boolean; items: HistoryItem[] };
  safety: {
    pregnantOrBreastfeeding?: boolean;
    allergies?: string[];
    anticoagulants?: boolean;
    recentIsotretinoin?: boolean;
    keloidHistory?: boolean;
  };
  prefs: {
    budgetKrw?: { max: number };
    /** What the customer typed, kept to show the reference currency. */
    budgetInput?: { currency: CurrencyCode; amount: number };
    downtimeToleranceDays?: number;
    painTolerance?: (typeof PAIN_LEVELS)[number];
    languagesNeeded: Locale[];
    doctorGender?: "any" | "female";
  };
  contact: { channel?: Channel; handle?: string };
  /** First thing typed on the landing (04 slot `firstIntent`). */
  firstIntent?: string;
}

export function emptyDraft(): OnboardingDraft {
  return { consents: {}, trip: {}, skin: { concerns: [] }, safety: {}, prefs: { languagesNeeded: [] }, contact: {} };
}

// ---- update_profile patch (what Claude may write) ----
// Consents are not part of it: only the customer's own tap on a consent card sets them.

const CurrencySchema = z.enum(["KRW", "JPY", "CNY", "USD"]);
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM (24h)");

export const ProfilePatchSchema = z.strictObject({
  locale: LocaleSchema.optional(),
  nickname: z.string().trim().min(1).max(40).optional(),
  nationality: z.string().regex(/^[A-Z]{2}$/, "expected an ISO 3166 alpha-2 code such as JP").optional(),
  residency: z.enum(RESIDENCIES).optional(),
  ageBand: AgeBandSchema.optional(),
  trip: z
    .strictObject({
      arrival: IsoDateSchema.optional(),
      departure: IsoDateSchema.optional(),
      stayArea: AreaSchema.optional(),
      flightTimeHome: TimeSchema.optional(),
    })
    .optional(),
  skin: z
    .strictObject({ type: z.enum(SKIN_TYPES).optional(), concerns: z.array(ConcernSchema).min(1).optional() })
    .optional(),
  history: z
    .strictObject({
      none: z.boolean(),
      items: z.array(
        z.strictObject({ procedureId: z.string().min(1).optional(), text: z.string().min(1), approxDate: z.string().optional() }),
      ),
    })
    .optional(),
  safety: z
    .strictObject({
      pregnantOrBreastfeeding: z.boolean().optional(),
      allergies: z.array(z.string().min(1)).optional(),
      anticoagulants: z.boolean().optional(),
      recentIsotretinoin: z.boolean().optional(),
      keloidHistory: z.boolean().optional(),
    })
    .optional(),
  prefs: z
    .strictObject({
      budgetKrw: z.strictObject({ max: z.number().int().positive() }).optional(),
      budgetInput: z.strictObject({ currency: CurrencySchema, amount: z.number().positive() }).optional(),
      downtimeToleranceDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]).optional(),
      painTolerance: z.enum(PAIN_LEVELS).optional(),
      languagesNeeded: z.array(LocaleSchema).min(1).optional(),
      doctorGender: z.enum(["any", "female"]).optional(),
    })
    .optional(),
  contact: z
    .strictObject({ channel: z.enum(CHANNELS).optional(), handle: z.string().trim().min(1).max(80).optional() })
    .optional(),
  firstIntent: z.string().trim().min(1).max(200).optional(),
});
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export function applyPatch(draft: OnboardingDraft, patch: ProfilePatch): OnboardingDraft {
  return {
    ...draft,
    ...pick(patch, ["locale", "nickname", "nationality", "residency", "ageBand", "firstIntent"]),
    trip: { ...draft.trip, ...patch.trip },
    skin: { ...draft.skin, ...patch.skin, concerns: patch.skin?.concerns ?? draft.skin.concerns },
    history: patch.history ?? draft.history,
    safety: { ...draft.safety, ...patch.safety },
    prefs: { ...draft.prefs, ...patch.prefs, languagesNeeded: patch.prefs?.languagesNeeded ?? draft.prefs.languagesNeeded },
    contact: { ...draft.contact, ...patch.contact },
    consents: draft.consents,
  };
}

function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) if (value[key] !== undefined) out[key] = value[key];
  return out;
}

// ---- slot rules ----

export const canMatch = (d: OnboardingDraft) => d.nationality !== "KR" && d.residency !== "resident";
export const hasSensitiveConsent = (d: OnboardingDraft) => d.consents.sensitiveHealth === true;
export const consentsSettled = (d: OnboardingDraft) =>
  BLOCKING_CONSENTS.every((type) => d.consents[type] === true) && d.consents.sensitiveHealth !== undefined;

export type SlotId =
  | "locale"
  | "consents"
  | "nickname"
  | "nationality"
  | "residency"
  | "ageBand"
  | "trip"
  | "trip.stayArea"
  | "skin.concerns"
  | "history"
  | "safety.pregnantOrBreastfeeding"
  | "prefs.budgetKrw"
  | "prefs.downtimeToleranceDays"
  | "prefs.languagesNeeded"
  | "contact.channel"
  | "contact.handle";

export type WidgetType = "chips" | "chips_multi" | "consent" | "date_range" | "currency" | "slider" | "summary" | "free_text";

export interface WidgetSpec {
  type: WidgetType;
  /** Slot the widget fills, "summary" for the closing card. */
  slot: SlotId | "summary";
  /** Values for chips and sliders. Labels are the screen's job. */
  options?: Array<string | number>;
  consentTypes?: ConsentType[];
  /** Optional slots offer a skip button. */
  skippable?: boolean;
}

interface SlotDef {
  id: SlotId;
  required: boolean;
  /** Needs the sensitiveHealth consent before it may be asked or written (04 rule 3). */
  sensitive: boolean;
  applies: (d: OnboardingDraft) => boolean;
  filled: (d: OnboardingDraft) => boolean;
  widget?: Omit<WidgetSpec, "slot">;
}

const always = () => true;

/** Asking order. The same order drives the fixture agent, the live prompt hint and the screen checklist. */
export const SLOTS: SlotDef[] = [
  { id: "locale", required: true, sensitive: false, applies: always, filled: (d) => d.locale !== undefined, widget: { type: "chips", options: LOCALES } },
  {
    id: "consents",
    required: true,
    sensitive: false,
    applies: always,
    filled: consentsSettled,
    widget: { type: "consent", consentTypes: [...CONSENT_TYPES] },
  },
  { id: "nickname", required: true, sensitive: false, applies: always, filled: (d) => Boolean(d.nickname) },
  {
    id: "nationality",
    required: true,
    sensitive: false,
    applies: always,
    filled: (d) => d.nationality !== undefined,
    widget: { type: "chips", options: [...NATIONALITY_OPTIONS] },
  },
  {
    id: "residency",
    required: true,
    sensitive: false,
    applies: (d) => d.nationality !== "KR",
    filled: (d) => d.residency !== undefined,
    widget: { type: "chips", options: [...RESIDENCIES] },
  },
  { id: "ageBand", required: true, sensitive: false, applies: always, filled: (d) => d.ageBand !== undefined, widget: { type: "chips", options: AGE_BANDS } },
  {
    id: "trip",
    required: true,
    sensitive: false,
    applies: canMatch,
    filled: (d) => Boolean(d.trip.arrival && d.trip.departure),
    widget: { type: "date_range" },
  },
  {
    id: "trip.stayArea",
    required: false,
    sensitive: false,
    applies: canMatch,
    filled: (d) => d.trip.stayArea !== undefined,
    widget: { type: "chips", options: AREAS, skippable: true },
  },
  {
    id: "skin.concerns",
    required: true,
    sensitive: true,
    applies: hasSensitiveConsent,
    filled: (d) => d.skin.concerns.length > 0,
    widget: { type: "chips_multi", options: CONCERNS },
  },
  {
    id: "history",
    required: false,
    sensitive: true,
    applies: hasSensitiveConsent,
    filled: (d) => d.history !== undefined,
    widget: { type: "chips", options: ["none"], skippable: true },
  },
  {
    id: "safety.pregnantOrBreastfeeding",
    required: true,
    sensitive: true,
    applies: hasSensitiveConsent,
    filled: (d) => d.safety.pregnantOrBreastfeeding !== undefined,
    widget: { type: "chips", options: ["yes", "no"] },
  },
  {
    id: "prefs.budgetKrw",
    required: false,
    sensitive: false,
    applies: canMatch,
    filled: (d) => d.prefs.budgetKrw !== undefined,
    widget: { type: "currency", skippable: true },
  },
  {
    id: "prefs.downtimeToleranceDays",
    required: false,
    sensitive: false,
    applies: canMatch,
    filled: (d) => d.prefs.downtimeToleranceDays !== undefined,
    widget: { type: "slider", options: [...DOWNTIME_DAYS], skippable: true },
  },
  {
    id: "prefs.languagesNeeded",
    required: true,
    sensitive: false,
    applies: always,
    filled: (d) => d.prefs.languagesNeeded.length > 0,
    widget: { type: "chips_multi", options: LOCALES },
  },
  {
    id: "contact.channel",
    required: true,
    sensitive: false,
    applies: always,
    filled: (d) => d.contact.channel !== undefined,
    widget: { type: "chips", options: [...CHANNELS] },
  },
  { id: "contact.handle", required: true, sensitive: false, applies: always, filled: (d) => Boolean(d.contact.handle) },
];

const SLOT_BY_ID = new Map(SLOTS.map((slot) => [slot.id, slot]));

export function slotDef(id: SlotId): SlotDef | undefined {
  return SLOT_BY_ID.get(id);
}

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === "string" && SLOT_BY_ID.has(value as SlotId);
}

export const SENSITIVE_SLOTS: SlotId[] = SLOTS.filter((slot) => slot.sensitive).map((slot) => slot.id);

export function widgetFor(id: SlotId | "summary"): WidgetSpec {
  if (id === "summary") return { type: "summary", slot: "summary" };
  const def = SLOT_BY_ID.get(id);
  return def?.widget ? { ...def.widget, slot: id } : { type: "free_text", slot: id };
}

export interface FlowState {
  draft: OnboardingDraft;
  /** Optional slots the customer skipped. */
  skipped: SlotId[];
  /** Slot reopened from the summary card. */
  editing?: SlotId;
  summaryConfirmed: boolean;
}

/** Required slots that apply to this customer and are still empty (finish_onboarding refuses while any is left). */
export function missingRequired(draft: OnboardingDraft): SlotId[] {
  return SLOTS.filter((slot) => slot.required && slot.applies(draft) && !slot.filled(draft)).map((slot) => slot.id);
}

/** Next thing to ask: an edited slot first, then the first open slot in order, then the summary card. */
export function nextSlot(state: FlowState): SlotId | "summary" | null {
  const { draft } = state;
  if (state.editing && slotDef(state.editing)?.applies(draft)) return state.editing;
  const open = SLOTS.find((slot) => slot.applies(draft) && !slot.filled(draft) && !state.skipped.includes(slot.id));
  if (open) return open.id;
  return state.summaryConfirmed ? null : "summary";
}

/** Progress = filled required slots / required slots that apply (04 "화면 구조"). Consents count one by one. */
export function progressPercent(draft: OnboardingDraft): number {
  const checks: [applies: boolean, filled: boolean][] = [
    [true, draft.locale !== undefined],
    ...REQUIRED_CONSENTS.map((type): [boolean, boolean] => [true, draft.consents[type] !== undefined]),
    [true, Boolean(draft.nickname)],
    [true, draft.nationality !== undefined],
    [draft.nationality !== "KR", draft.residency !== undefined],
    [true, draft.ageBand !== undefined],
    [canMatch(draft), Boolean(draft.trip.arrival)],
    [canMatch(draft), Boolean(draft.trip.departure)],
    [hasSensitiveConsent(draft), draft.skin.concerns.length > 0],
    [hasSensitiveConsent(draft), draft.safety.pregnantOrBreastfeeding !== undefined],
    [true, draft.prefs.languagesNeeded.length > 0],
    [true, draft.contact.channel !== undefined],
    [true, Boolean(draft.contact.handle)],
  ];
  const applicable = checks.filter(([applies]) => applies);
  const filled = applicable.filter(([, isFilled]) => isFilled).length;
  return Math.round((filled / applicable.length) * 100);
}

/** Paths a patch touches, e.g. ["nickname", "trip.arrival"], for rule checks and the filledSlots log. */
export function patchPaths(patch: ProfilePatch): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && key !== "history") {
      for (const [inner, innerValue] of Object.entries(value)) if (innerValue !== undefined) paths.push(`${key}.${inner}`);
    } else {
      paths.push(key);
    }
  }
  return paths;
}

const SENSITIVE_PATH = /^(skin\.|history$|safety\.)/;

/**
 * Business rules on top of the schema (04): no health data before the sensitiveHealth consent, residency only
 * for foreign nationals, trip dates only for visitors who can be matched, dates not in the past and in order.
 * Returns the error messages Claude gets back; an empty list means the patch may be applied.
 */
export function checkPatchRules(draft: OnboardingDraft, patch: ProfilePatch, today: IsoDate): string[] {
  const errors: string[] = [];
  const paths = patchPaths(patch);
  if (!hasSensitiveConsent(draft) && paths.some((path) => SENSITIVE_PATH.test(path))) {
    errors.push(
      "skin, history and safety need the sensitiveHealth consent first. Do not ask or store health information until the customer grants it.",
    );
  }
  const nationality = patch.nationality ?? draft.nationality;
  if (patch.residency !== undefined && nationality === "KR") errors.push("residency is only asked to foreign nationals (nationality is KR).");
  const next = applyPatch(draft, patch);
  if (patch.trip && (patch.trip.arrival || patch.trip.departure) && !canMatch(next)) {
    errors.push("trip dates are not collected for Korean nationals or residents of Korea.");
  }
  const { arrival, departure } = next.trip;
  if (patch.trip?.arrival && arrival! < today) errors.push(`trip.arrival ${arrival} is in the past (today is ${today}).`);
  if (arrival && departure && departure < arrival) errors.push(`trip.departure ${departure} is before trip.arrival ${arrival}.`);
  return errors;
}
