// Stand-ins for the clinic and customer agents (owned by other tracks) so A2A core tests run before
// those tracks land. They follow the contracts in lib/a2a/contract.ts and read the seeded clinic store.
// Test-only module.
import { buildAgentCard, EXT_CLINIC_OPERATION, EXT_REFERRAL, rpcUrlFor, clinicSlug } from "../cards";
import type { AgentDefinition } from "../contract";
import { verifyReferralToken } from "../auth";
import { clock } from "../../clock";
import { getStore } from "../../store";
import type { ClinicProfile, MenuItem, Offer } from "../../domain";
import type { BookingRequestV1 } from "../schemas";

export const testClinicAgent: AgentDefinition = {
  role: "clinic",
  async card(clinicId, baseUrl) {
    const profile = await getStore().get<ClinicProfile>("clinic", "profiles", clinicId);
    return buildAgentCard({
      name: `${profile?.name.en ?? clinicId} Agent`,
      description: "Test double clinic agent",
      rpcUrl: rpcUrlFor("clinic", await clinicSlug(clinicId), baseUrl),
      organization: "PibooK (test double)",
      baseUrl,
      extensions: [
        { uri: EXT_CLINIC_OPERATION, description: "Operation mode", required: false, params: { mode: profile?.operationMode } },
        { uri: EXT_REFERRAL, description: "Referral token required for quote and book", required: false },
      ],
      skills: [
        { id: "clinic.offers", name: "Monthly offers", description: "Offers and menu", tags: ["price"] },
        { id: "clinic.book", name: "Book", description: "Booking", tags: ["booking"] },
      ],
    });
  },
  async exists(clinicId) {
    return Boolean(await getStore().get("clinic", "profiles", clinicId));
  },
  skills: {
    async "clinic.offers"(_data, ctx) {
      const clinicId = ctx.self.agentId;
      const menu = await getStore().list<MenuItem>("clinic", "menu_items", { clinicId });
      const today = clock.today();
      const offers = (await getStore().list<Offer>("clinic", "offers", { clinicId })).filter(
        (o) => o.validFrom <= today && today <= o.validUntil,
      );
      return {
        state: "TASK_STATE_COMPLETED",
        data: {
          schema: "pibu/offers@1",
          clinicId,
          month: today.slice(0, 7),
          items: [
            ...menu.map((m) => ({ procedureId: m.procedureId, product: m.product, amount: m.amount, priceKrw: m.priceKrw, vatIncluded: m.vatIncluded })),
            ...offers.map((o) => ({
              procedureId: o.procedureId,
              product: o.title,
              amount: o.amount,
              priceKrw: o.priceKrw,
              vatIncluded: true,
              event: { title: o.title, regularPriceKrw: o.regularPriceKrw, validFrom: o.validFrom, validUntil: o.validUntil, conditions: o.conditions },
            })),
          ],
        },
      };
    },
    async "clinic.book"(data, ctx) {
      const request = data as unknown as BookingRequestV1;
      const token = ctx.metadata.referralToken;
      const claims = typeof token === "string" ? await verifyReferralToken(token, ctx.self.agentId) : null;
      if (!claims) return { state: "TASK_STATE_REJECTED", text: "referral token missing or invalid" };
      return {
        state: "TASK_STATE_WORKING",
        data: {
          schema: "pibu/booking@1",
          bookingId: "bkg_test_0001",
          requestId: request.requestId,
          quoteId: request.quoteId,
          clinicId: ctx.self.agentId,
          customerAgentId: ctx.caller.agentId,
          slot: request.slot,
          status: "pending_clinic",
          priceKrw: 340000,
          referralToken: token as string,
        },
      };
    },
  },
};

export const testCustomerAgent: AgentDefinition = {
  role: "customer",
  async card(agentId, baseUrl) {
    return buildAgentCard({
      name: `PibooK Customer Agent ${agentId}`,
      description: "Test double customer agent",
      rpcUrl: rpcUrlFor("customer", agentId, baseUrl),
      organization: "PibooK (test double)",
      baseUrl,
      skills: [
        { id: "customer.notify", name: "Receive notification", description: "Notifications", tags: ["notification"] },
        { id: "customer.checkin", name: "Outcome check-in", description: "Check-in", tags: ["outcome"] },
      ],
    });
  },
  async exists(agentId) {
    return agentId.startsWith("cag_");
  },
  skills: {
    async "customer.notify"() {
      return { state: "TASK_STATE_COMPLETED", text: "notified" };
    },
    async "customer.checkin"(_data, ctx) {
      if (ctx.existingTaskState === "TASK_STATE_INPUT_REQUIRED") return { state: "TASK_STATE_COMPLETED", text: "check-in answered" };
      return {
        state: "TASK_STATE_INPUT_REQUIRED",
        text: "Need one more answer",
        inputRequest: { schema: "pibu/input-request@1", fields: [{ key: "satisfaction", label: { en: "Satisfaction" }, sensitive: false }] },
      };
    },
  },
};
