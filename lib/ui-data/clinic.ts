import type { AgentCard } from "@/components/ui";
import type { IsoDate, Locale, Unit } from "@/lib/domain/common";
import type { ZkClause } from "./customer";

// View types and client calls for the clinic console (docs/spec/05-screens.md, 병원 콘솔). The data comes from
// the clinic agent's own store through app/api/clinic/** (server pages read the same service directly).
// Browser safe: no server imports here.

export type ClinicOperationMode = "proxy" | "clinic";

export const OPERATION_MODE_TEXT: Record<ClinicOperationMode, string> = {
  proxy: "PibooK 대행",
  clinic: "직접 운영",
};

export const LANGUAGE_TEXT: Record<Locale, string> = {
  ja: "일본어",
  "zh-CN": "중국어(간체)",
  en: "영어",
  ko: "한국어",
};

export type AmountUnit = Unit;

export const UNIT_TEXT: Record<AmountUnit, string> = {
  cc: "cc",
  shot: "샷",
  unit: "유닛",
  line: "줄",
  session: "회",
  vial: "바이알",
};

export type Amount = { value: number; unit: AmountUnit };

/** Inclusion codes on the wire (03 quote example) and how the console labels them. */
export const INCLUDE_TEXT: Record<string, string> = {
  numbing_cream: "마취크림",
  soothing_mask: "진정팩",
  recovery_cream: "재생크림",
};

export const OPERATION_SOURCE_TEXT: Record<string, string> = {
  clinic_input: "병원 콘솔",
  clinic_console: "병원 콘솔",
  sms: "문자",
  public_web: "공개 웹",
};

export type ConsoleClinic = {
  id: string;
  name: string;
  area: string;
  operationMode: ClinicOperationMode;
  autoConfirm: boolean;
};

// A2A task states that reach a clinic (03-a2a-protocol.md 태스크 상태 매핑), narrowed to what the inbox shows.
export type TaskState =
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_REJECTED";

export type TaskKind = "quote" | "booking";

export type InboxTask = {
  /** Booking id for bookings, A2A task id for quotes. */
  id: string;
  a2aTaskId: string;
  skillId: "clinic.quote" | "clinic.book";
  kind: TaskKind;
  state: TaskState;
  receivedAt: string;
  /** Booking: guest display name. Quote: the asking customer agent (the clinic never sees a name before booking). */
  from: string;
  language: Locale;
  product: string;
  amount: Amount;
  /** Missing when the agent declined to quote. */
  priceKrw?: number;
  /** Booking: the requested slot, or the confirmed slot once decided. */
  slot?: string;
  /** Safety answers the guest consented to share with a booking request; empty means nothing to flag. */
  safetyFlags?: string[];
  /** Released only after confirmation, within the consent scope: the server leaves it out until then. */
  contact?: { channel: string; handle: string };
  /** Quote: seconds the agent took to answer. */
  respondedInSec?: number;
  /** What the clinic asked the guest for while INPUT_REQUIRED. */
  requestedFields?: string[];
  /** Time the clinic proposed, while waiting for the guest's answer. */
  proposedSlot?: string;
  /** Outcome line shown on decided tasks, e.g. the rejection reason. */
  outcome?: string;
  /** Open times the clinic can propose instead (clinic.availability data). */
  proposalSlots?: string[];
};

export type MenuItem = {
  id: string;
  procedureId: string;
  product: string;
  nameKo: string;
  amount: Amount;
  priceKrw: number;
  vatIncluded: boolean;
  includes: string[];
  foreignerSamePrice: boolean;
};

// An event always carries its regular price, period and conditions (05-screens.md, 병원 콘솔 메뉴·가격).
export type Offer = {
  id: string;
  procedureId: string;
  title: string;
  amount: Amount;
  priceKrw: number;
  regularPriceKrw: number;
  validFrom: IsoDate;
  validUntil: IsoDate;
  conditions: string;
  /** Off means the offer is kept but not sent to customer agents (clinic.offers and clinic.quote skip it). */
  active: boolean;
};

export type MenuData = { today: IsoDate; items: MenuItem[]; offers: Offer[] };

export type DashboardData = {
  clinic: ConsoleClinic;
  now: string;
  today: IsoDate;
  quotesToday: number;
  quotesYesterdayByNow: number;
  waiting: number;
  waitingGuest: number;
  needsAction: InboxTask[];
  thisWeek: InboxTask[];
  bookingsLastWeek: number;
  response: { windowDays: number; quoteRequests: number; answeredWithin20s: number; percent: number | null; previousPercent: number | null };
  offersNow: Offer[];
};

export type AgentOperation = {
  mode: ClinicOperationMode;
  dataSources: string[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
};

export type AgentView = {
  card: AgentCard;
  /** "a2a" when the card was read from the public A2A route, "direct" when built in process. */
  source: "a2a" | "direct";
  cardUrl: string;
  endpoint: string;
  operation: AgentOperation;
  today: IsoDate;
};

export type BookingDecision =
  | { action: "confirm" }
  | { action: "propose"; slot: string }
  | { action: "reject"; reason: string; memo?: string }
  | { action: "ask"; fields: string[] };

// ---- client calls (browser) ----

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `요청이 실패했어요 (${response.status})`);
  return body;
}

export const clinicApi = {
  inbox: () => call<{ tasks: InboxTask[] }>("/api/clinic/inbox"),
  decide: (bookingId: string, decision: BookingDecision) =>
    call<{ tasks: InboxTask[] }>(`/api/clinic/bookings/${encodeURIComponent(bookingId)}`, {
      method: "POST",
      body: JSON.stringify(decision),
    }),
  menu: () => call<MenuData>("/api/clinic/menu"),
  saveMenuItem: (item: MenuItem) =>
    call<MenuData>(`/api/clinic/menu/${encodeURIComponent(item.id)}`, { method: "PUT", body: JSON.stringify(item) }),
  saveOffer: (offer: Offer) => call<MenuData>("/api/clinic/offers", { method: "POST", body: JSON.stringify(offer) }),
  deleteOffer: (offerId: string) =>
    call<MenuData>(`/api/clinic/offers/${encodeURIComponent(offerId)}`, { method: "DELETE" }),
};

// ZK offer condition presets for clinic events (teammate ZK work, docs/INTEGRATION.md).
export type ZkPreset = "none" | "first_visit" | "second_session" | "regular";

export const ZK_PRESETS: ZkPreset[] = ["none", "first_visit", "second_session", "regular"];

export const ZK_PRESET_TEXT: Record<ZkPreset, { option: string; short: string }> = {
  none: { option: "없음", short: "없음" },
  first_visit: { option: "첫 방문 (우리 병원 기록 0건)", short: "첫 방문" },
  second_session: { option: "2회차 (해당 시술 정확히 1회)", short: "2회차" },
  regular: { option: "단골 (해당 시술 3회 이상)", short: "단골" },
};

/** The clauses a preset writes for an event on `procedureId`. "none" writes nothing. */
export function zkClausesFor(preset: ZkPreset, procedureId: string): ZkClause[] | undefined {
  switch (preset) {
    case "first_visit":
      return [{ clinicId: CLINIC.id, maxCount: 0 }];
    case "second_session":
      return [{ type: procedureId, minCount: 1, maxCount: 1 }];
    case "regular":
      return [{ type: procedureId, minCount: 3 }];
    case "none":
      return undefined;
  }
}

const clauseKey = (clauses: ZkClause[]) =>
  JSON.stringify(clauses.map((clause) => Object.entries(clause).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))));

/** Reads the preset back from stored clauses; any other shape (date windows, several clauses) is "custom". */
export function zkPresetOf(clauses: ZkClause[] | undefined, procedureId: string): ZkPreset | "custom" {
  if (!clauses || clauses.length === 0) return "none";
  const key = clauseKey(clauses);
  return ZK_PRESETS.find((preset) => preset !== "none" && clauseKey(zkClausesFor(preset, procedureId) ?? []) === key) ?? "custom";
}
