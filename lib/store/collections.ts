import type { Namespace } from "./types";

// Collection names per namespace, one per entity of docs/spec/06-data-model.md. Every module that touches
// the store names a collection through this table so the seed loader, the A2A layer and the three agents
// agree without importing each other. Items are stored with an `id`; entities that have none in the spec
// use the key noted next to them.
export const COLLECTIONS = {
  customer: {
    accounts: "accounts", // CustomerAccount
    profiles: "profiles", // CustomerProfile (id = account id)
    consents: "consents", // ConsentEntry
    records: "records", // TreatmentRecord
    requests: "requests", // CustomerRequest (id = requestId = A2A contextId)
    quotes: "quotes", // ReceivedQuote
    bookings: "bookings", // CustomerBooking
    outcomeDrafts: "outcome_drafts", // OutcomeDraft
    onboardingSessions: "onboarding_sessions", // OnboardingSession
    wallets: "wallets", // RecordWallet (ZK)
    visitTickets: "visit_tickets", // VisitTicket (ZK)
  },
  platform: {
    clinicRegistry: "clinic_registry", // ClinicRegistryEntry (id = clinic id, e.g. "cln_mint")
    offerCache: "offer_cache", // ClinicOfferCache
    priceRecords: "price_records", // PriceRecord
    judgedQuotes: "judged_quotes", // JudgedQuote
    outcomes: "outcomes", // Outcome
    rules: "rules", // RoutingRule
    matchLogs: "match_logs", // MatchLog
    attributions: "attributions", // AttributionEntry
    signals: "signals", // Signal
    krPatterns: "kr_patterns", // kr-patterns.json rows (id per row)
    fx: "fx", // fx.json rows (id = currency code)
    verifiedVisits: "verified_visits", // VerifiedVisitStat (ZK)
    reviewStats: "review_stats", // ReviewStat (ZK)
    anchorLogs: "anchor_logs", // AnchorLog (ZK)
  },
  clinic: {
    profiles: "profiles", // ClinicProfile (id = clinic id)
    menuItems: "menu_items", // MenuItem
    offers: "offers", // Offer
    slotPolicies: "slot_policies", // SlotPolicy stored as { id: clinicId, ...policy }
    slots: "slots", // Slot
    bookings: "bookings", // ClinicBooking
    tasks: "tasks", // ClinicTask
  },
  shared: {
    a2aLog: "a2a_log", // A2ALogEntry
    agentIdentities: "agent_identities", // AgentIdentity stored as { id: agentId, ...identity }
  },
} as const satisfies Record<Namespace, Record<string, string>>;

/** Agent ids that are fixed for the demo. Customer agent ids ("cag_...") come from customers.json. */
export const PLATFORM_AGENT_ID = "agt_platform";

/** A clinic agent's id is its clinic id, e.g. "cln_mint". */
export const clinicAgentId = (clinicId: string): string => clinicId;
