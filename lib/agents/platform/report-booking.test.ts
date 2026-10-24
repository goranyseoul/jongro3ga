import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { verifyReferralToken } from "../../a2a/auth";
import { sendMessage } from "../../a2a/client";
import { advanceClockHours } from "../../clock";
import { TEST_BASE, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_BOOKING, bookingFor, yukiShortlist } from "./__fixtures__/booking";
import { YUKI_AGENT } from "./__fixtures__/requests";
import { reportBooking } from "./outcomes";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

const PLATFORM_CARD = `${TEST_BASE}/a2a/platform/agent-card.json`;
const SEOUL_GLOW = { agentId: "cln_seoul_glow", role: "clinic" as const };

const report = (from: { agentId: string; role: "clinic" | "customer" }, data: Record<string, unknown>) =>
  sendMessage({ from, toCardUrl: PLATFORM_CARD, skillId: "platform.report_booking", data, contextId: "req_yuki_t1", fetchImpl: routeFetch });

describe("platform.report_booking", () => {
  it("attributes a booking with a valid referral token (aud = the clinic, sub = the customer agent)", async () => {
    const shortlist = await yukiShortlist();
    const booking = bookingFor(shortlist, "cln_seoul_glow");
    const task = await report(SEOUL_GLOW, booking);
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task.artifacts?.[0].parts[0].text).toBe(`booking ${YUKI_BOOKING} attributed to ${shortlist.matchId} (confirmed)`);

    const claims = await verifyReferralToken(booking.referralToken, { clinicId: "cln_seoul_glow" });
    if ("error" in claims) throw new Error(claims.error);
    expect(await platformStore.attributionByBooking(YUKI_BOOKING)).toMatchObject({
      id: `att_${YUKI_BOOKING}`,
      clinicId: "cln_seoul_glow",
      customerAgentId: YUKI_AGENT,
      matchId: shortlist.matchId,
      referralTokenJti: claims.jti,
      status: "confirmed",
      priceKrw: 340_000,
      nationality: "JP",
      quoteId: "qt_seoul_glow",
    });
  });

  it("rejects a token issued to another clinic, a tampered token and a token of another customer or request", async () => {
    const shortlist = await yukiShortlist();
    const mintToken = shortlist.candidates.find((c) => c.clinicId === "cln_mint")!.referralToken;
    const cases: [Record<string, unknown>, string][] = [
      [bookingFor(shortlist, "cln_seoul_glow", { referralToken: mintToken }), "invalid_referral_token: wrong_audience"],
      [bookingFor(shortlist, "cln_seoul_glow", { referralToken: `${bookingFor(shortlist, "cln_seoul_glow").referralToken.slice(0, -4)}AAAA` }), "invalid_referral_token"],
      [bookingFor(shortlist, "cln_seoul_glow", { customerAgentId: "cag_2m8x9" }), "customer_agent_mismatch"],
      [bookingFor(shortlist, "cln_seoul_glow", { requestId: "req_other" }), "request_mismatch"],
    ];
    for (const [booking, reason] of cases) {
      const task = await report(SEOUL_GLOW, booking);
      expect(task.status.state, reason).toBe("TASK_STATE_REJECTED");
      expect(task.status.message?.parts[0].text).toContain(reason);
    }
    expect(await platformStore.attributions()).toEqual([]);
  });

  it("rejects a clinic reporting another clinic's booking, and refuses customers at the server", async () => {
    const shortlist = await yukiShortlist();
    const booking = bookingFor(shortlist, "cln_seoul_glow");
    expect((await reportBooking(booking, { agentId: "cln_mint", role: "clinic" })).text).toContain("clinic_mismatch");
    await expect(report({ agentId: YUKI_AGENT, role: "customer" }, booking)).rejects.toMatchObject({ status: 403 });
  });

  it("takes later status changes of an attributed booking after the token expired", async () => {
    const shortlist = await yukiShortlist();
    const booking = bookingFor(shortlist, "cln_seoul_glow");
    const otherToken = bookingFor(await yukiShortlist(), "cln_seoul_glow").referralToken;
    expect((await reportBooking(booking, SEOUL_GLOW)).state).toBe("completed");
    advanceClockHours(73);
    // an expired token is only good for the booking it attributed
    expect((await reportBooking({ ...booking, status: "completed", referralToken: otherToken }, SEOUL_GLOW)).state).toBe("rejected");
    expect((await reportBooking({ ...booking, status: "completed" }, SEOUL_GLOW)).state).toBe("completed");
    expect(await platformStore.attributionByBooking(YUKI_BOOKING)).toMatchObject({ status: "completed", matchId: shortlist.matchId });
    // an expired token that never attributed this booking stays refused
    const other = bookingFor(shortlist, "cln_seoul_glow", { bookingId: "bkg_9999" });
    expect((await reportBooking(other, SEOUL_GLOW)).text).toContain("invalid_referral_token: expired");
  });
});
