import { agentTimeline, type AgentTimelineItem } from "../../a2a/log";
import type { FairnessVerdictV1, QuoteV1 } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { I18nText, IsoDate, Locale } from "../../domain/common";
import type { ConsentEntry, CustomerProfile, TreatmentRecord } from "../../domain/customer";
import type { Store } from "../../store/types";
import { clinicDirectory, clinicEntry, type ClinicDirectoryEntry } from "./clinic-directory";
import { consentsOf, latestConsents } from "./consent";
import { STATUS_COPY, stepSummary } from "./copy";
import { customerCard } from "./definition";
import { inboxOf, type InboxView } from "./inbox";
import { createMockA2A, MOCK_BASE_URL, mockA2AEnabled, type MockA2A } from "./mock-a2a";
import { defaultDeps, refreshBooking, type OrchestratorDeps } from "./orchestrator";
import { listRecords, upcomingDue } from "./records";
import { canMatchProfile } from "./seed";
import { downtimeOverlapsDeparture } from "./schedule";
import { C, NS, getOf, listOf, type InboxItem, type StoredBooking, type StoredOutcome, type StoredQuote, type StoredRequest, type StoredShortlist } from "./store";

// Agent centred responses for the customer screens (HANDOFF 1.2): what the agent did (timeline), what it
// found (options with the platform's verdicts) and what the customer can do next.

/** Orchestrator dependencies for route handlers: the real A2A client, or the in-process mock when enabled. */
export function bffDeps(baseUrl: string, store?: Store): OrchestratorDeps {
  const deps = defaultDeps({ baseUrl: process.env.PUBLIC_BASE_URL || baseUrl, ...(store ? { store } : {}) });
  if (!mockA2AEnabled()) return deps;
  const g = globalThis as { __pibuCustomerMockA2A?: MockA2A };
  g.__pibuCustomerMockA2A ??= createMockA2A({ store: deps.store, confirmAfterPolls: 2 });
  return { ...deps, baseUrl: MOCK_BASE_URL, send: g.__pibuCustomerMockA2A.send, get: g.__pibuCustomerMockA2A.get };
}

export interface ClinicView {
  id: string;
  name: I18nText;
  area: string;
  address?: string;
}

function clinicView(id: string): ClinicView {
  const entry = clinicEntry(id);
  return { id, name: entry?.name ?? { en: id }, area: entry?.area ?? "other", ...(entry?.address ? { address: entry.address } : {}) };
}

export interface OptionView {
  quote: QuoteV1;
  verdict?: FairnessVerdictV1;
  clinic: ClinicView;
  score: number;
  reasons: string[];
  /** Row warnings (05: shown in the row, never hidden or moved). */
  warnings: ("underdosed" | "paid_more_than_quoted")[];
  /** Slots after which recovery may not end before departure (06 downtime warning). */
  downtimeSlots: string[];
}

export type NextAction = "confirm_conditions" | "wait" | "choose_option" | "wait_clinic" | "answer_clinic" | "record_outcome" | "done" | "retry";

export interface RequestView {
  request: StoredRequest;
  statusCopy: I18nText;
  timeline: AgentTimelineItem[];
  options: OptionView[];
  priceReference?: StoredShortlist["priceReference"];
  appliedRuleIds: string[];
  failures: (StoredShortlist["failures"][number] & { clinic: ClinicView })[];
  booking?: BookingSummary;
  departure?: IsoDate;
  nextAction: NextAction;
}

export interface BookingSummary {
  id: string;
  status: StoredBooking["status"];
  clinicId: string;
  quoteId: string;
  slot: string;
  requestId: string;
}

const summary = (b: StoredBooking): BookingSummary => ({ id: b.id, status: b.status, clinicId: b.clinicId, quoteId: b.quoteId, slot: b.slot, requestId: b.requestId });

/** Clinic id behind a log actor/target ("cln_mint" or a slug such as "mint"). */
function clinicNameFor(agentId: string): I18nText | undefined {
  return (clinicEntry(agentId) ?? clinicEntry(`cln_${agentId.replace(/-/g, "_")}`))?.name;
}

function withSummaries(items: AgentTimelineItem[]): AgentTimelineItem[] {
  return items.map((item) => {
    if (item.summary && Object.keys(item.summary).length >= 4) return item;
    const own = stepSummary(item.skillId, item.state, item.target.role === "clinic" ? clinicNameFor(item.target.agentId) : undefined);
    return { ...item, summary: { ...own, ...item.summary } };
  });
}

function nextActionFor(request: StoredRequest, booking: StoredBooking | undefined): NextAction {
  switch (request.status) {
    case "draft":
      return "confirm_conditions";
    case "matching":
    case "quoting":
    case "judging":
      return "wait";
    case "comparing":
      return "choose_option";
    case "booking":
      return booking?.inputRequest ? "answer_clinic" : "wait_clinic";
    case "booked":
      return "record_outcome";
    case "closed":
      return "done";
    case "failed":
      return "retry";
  }
}

export async function requestView(store: Store, customerId: string, requestId: string): Promise<RequestView | undefined> {
  const request = await getOf<StoredRequest>(store, C.requests, requestId);
  if (!request || request.customerId !== customerId) return undefined;
  const profile = await getOf<CustomerProfile>(store, C.profiles, customerId);
  const shortlist = await getOf<StoredShortlist>(store, C.shortlists, requestId);
  const quotes = await listOf<StoredQuote>(store, C.quotes, { requestId });
  const bookings = await listOf<StoredBooking>(store, C.bookings, { requestId });
  const booking = bookings.find((b) => b.status !== "canceled") ?? bookings.at(-1);
  const departure = profile?.trip?.departure ?? request.request.dateWindow.to;

  const options: OptionView[] = quotes.map(({ quote, verdict }) => {
    const candidate = shortlist?.candidates.find((c) => c.clinicId === quote.clinicId);
    const warnings: OptionView["warnings"] = [];
    if (verdict?.label === "underdosed") warnings.push("underdosed");
    if (verdict?.clinicFlags.some((f) => f.code === "paid_more_than_quoted")) warnings.push("paid_more_than_quoted");
    return {
      quote,
      ...(verdict ? { verdict } : {}),
      clinic: clinicView(quote.clinicId),
      score: candidate?.score ?? 0,
      reasons: candidate?.reasons ?? [],
      warnings,
      downtimeSlots: quote.slots.filter((slot) => downtimeOverlapsDeparture(quote.procedureId, slot, departure)),
    };
  });
  // default order: the platform's match score (05)
  options.sort((a, b) => b.score - a.score);

  return {
    request,
    statusCopy: STATUS_COPY[request.status],
    timeline: withSummaries(await agentTimeline(store, requestId)),
    options,
    ...(shortlist ? { priceReference: shortlist.priceReference } : {}),
    appliedRuleIds: shortlist?.appliedRuleIds ?? [],
    failures: (shortlist?.failures ?? []).map((f) => ({ ...f, clinic: clinicView(f.clinicId) })),
    ...(booking ? { booking: summary(booking) } : {}),
    departure,
    nextAction: nextActionFor(request, booking),
  };
}

export async function listRequests(store: Store, customerId: string): Promise<(StoredRequest & { quoteCount: number })[]> {
  const requests = await listOf<StoredRequest>(store, C.requests, { customerId });
  const withCounts = await Promise.all(
    requests.map(async (r) => ({ ...r, quoteCount: (await listOf<StoredQuote>(store, C.quotes, { requestId: r.id })).length })),
  );
  return withCounts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface BookingView {
  booking: StoredBooking;
  clinic: ClinicView;
  quote?: QuoteV1;
  operationMode?: "proxy" | "clinic";
  downtimeWarning: boolean;
  outcome?: StoredOutcome;
  timeline: AgentTimelineItem[];
}

export async function bookingView(deps: OrchestratorDeps, customerId: string, bookingId: string, refresh = true): Promise<BookingView | undefined> {
  const { store } = deps;
  const stored = await getOf<StoredBooking>(store, C.bookings, bookingId);
  if (!stored || stored.customerId !== customerId) return undefined;
  const booking = refresh ? await refreshBooking(deps, customerId, bookingId) : stored;
  const received = await getOf<StoredQuote>(store, C.quotes, `${booking.requestId}:${booking.quoteId}`);
  const profile = await getOf<CustomerProfile>(store, C.profiles, customerId);
  const request = await getOf<StoredRequest>(store, C.requests, booking.requestId);
  const departure = profile?.trip?.departure ?? request?.request.dateWindow.to;
  const outcome = await getOf<StoredOutcome>(store, C.outcomes, `od_${booking.id}_D0`);
  const timeline = (await agentTimeline(store, booking.requestId)).filter((item) => item.skillId === "clinic.book" || item.skillId === "platform.submit_outcome");
  return {
    booking,
    clinic: clinicView(booking.clinicId),
    ...(received ? { quote: received.quote, operationMode: received.quote.operationMode } : {}),
    downtimeWarning: downtimeOverlapsDeparture(booking.procedureId, booking.slot, departure),
    ...(outcome ? { outcome } : {}),
    timeline: withSummaries(timeline),
  };
}

export async function listBookings(store: Store, customerId: string): Promise<StoredBooking[]> {
  const bookings = await listOf<StoredBooking>(store, C.bookings, { customerId });
  return bookings.sort((a, b) => a.slot.localeCompare(b.slot));
}

export interface MeView {
  profile: CustomerProfile;
  canMatch: boolean;
  demo: boolean;
  today: IsoDate;
  card: Record<string, unknown>;
  consents: ConsentEntry[];
}

export async function meView(store: Store, profile: CustomerProfile, demo: boolean, baseUrl: string): Promise<MeView> {
  const consents = [...latestConsents(await consentsOf(store, profile.id)).values()];
  return {
    profile,
    canMatch: canMatchProfile(profile),
    demo,
    today: clock.today(),
    card: customerCard(profile.agentId, process.env.PUBLIC_BASE_URL || baseUrl),
    consents,
  };
}

export interface HomeView {
  me: MeView;
  requests: (StoredRequest & { quoteCount: number })[];
  bookings: StoredBooking[];
  records: TreatmentRecord[];
  due: TreatmentRecord[];
  inbox: InboxView;
}

export async function homeView(store: Store, profile: CustomerProfile, demo: boolean, baseUrl: string): Promise<HomeView> {
  const records = await listRecords(store, profile.id);
  return {
    me: await meView(store, profile, demo, baseUrl),
    requests: (await listRequests(store, profile.id)).filter((r) => r.status !== "draft"),
    bookings: (await listBookings(store, profile.id)).filter((b) => b.status !== "canceled"),
    records,
    due: upcomingDue(records),
    inbox: await inboxOf(store, profile.id),
  };
}

/** "내보내기": everything the customer agent holds about this customer, as JSON (02 데이터 이식). */
export async function exportData(store: Store, customerId: string): Promise<Record<string, unknown>> {
  const collections = Object.values(C);
  const out: Record<string, unknown> = { exportedAt: clock.nowIso(), customerId };
  for (const collection of collections) {
    if (collection === C.profiles || collection === C.accounts) {
      out[collection] = await getOf(store, collection, customerId);
      continue;
    }
    const items = await listOf<{ customerId?: string; requestId?: string }>(store, collection);
    if (collection === C.quotes || collection === C.shortlists) {
      const ids = new Set((await listOf<StoredRequest>(store, C.requests, { customerId })).map((r) => r.id));
      out[collection] = items.filter((i) => i.requestId && ids.has(i.requestId));
    } else {
      out[collection] = items.filter((i) => i.customerId === customerId);
    }
  }
  return out;
}

/** "전체 삭제": removes every item of this customer from the customer namespace. */
export async function deleteAll(store: Store, customerId: string): Promise<number> {
  const exported = await exportData(store, customerId);
  let removed = 0;
  for (const collection of Object.values(C)) {
    const value = exported[collection];
    const items = Array.isArray(value) ? (value as { id: string }[]) : value ? [value as { id: string }] : [];
    for (const item of items) {
      await store.remove(NS, collection, item.id);
      removed += 1;
    }
  }
  return removed;
}

export function clinicsForAutocomplete(): { id: string; name: I18nText; area: string }[] {
  return clinicDirectory().map((c: ClinicDirectoryEntry) => ({ id: c.id, name: c.name, area: c.area }));
}

export type { InboxItem, Locale };
