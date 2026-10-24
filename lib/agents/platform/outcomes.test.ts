import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { A2AClientError, sendMessage } from "../../a2a/client";
import type { AgentRef } from "../../a2a/client";
import { TEST_BASE, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_BOOKING, attributedBooking, yukiOutcome } from "./__fixtures__/booking";
import { YUKI_AGENT } from "./__fixtures__/requests";
import { injectAraBurst, outcomeSignals, submitOutcome } from "./outcomes";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

const PLATFORM_CARD = `${TEST_BASE}/a2a/platform/agent-card.json`;
const yuki = { agentId: YUKI_AGENT, role: "customer" as const };

const send = (from: AgentRef, data: Record<string, unknown>) =>
  sendMessage({ from, toCardUrl: PLATFORM_CARD, skillId: "platform.submit_outcome", data, contextId: "req_yuki_t1", fetchImpl: routeFetch });

describe("platform.submit_outcome: who may submit", () => {
  it("refuses a clinic token at the server with 403 (outcomes come from customers only)", async () => {
    await attributedBooking();
    const call = send({ agentId: "cln_seoul_glow", role: "clinic" }, yukiOutcome());
    await expect(call).rejects.toBeInstanceOf(A2AClientError);
    await expect(call).rejects.toMatchObject({ kind: "http", status: 403 });
    expect(await platformStore.outcomes().then((all) => all.filter((o) => o.bookingId === YUKI_BOOKING))).toEqual([]);
  });

  it("rejects another customer agent's outcome for Yuki's booking", async () => {
    await attributedBooking();
    const task = await send({ agentId: "cag_2m8x9", role: "customer" }, yukiOutcome());
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(task.status.message?.parts[0].text).toContain("customer_agent_mismatch");
  });

  it("rejects a booking the platform never attributed", async () => {
    const result = await submitOutcome(yukiOutcome({ bookingId: "bkg_unknown" }), yuki);
    expect(result).toMatchObject({ state: "rejected" });
    expect(result.text).toContain("unknown_booking");
  });
});

describe("platform.submit_outcome: what it records", () => {
  it("accepts Yuki's D0 over A2A, computes the gap from the judged quote and adds a verified PriceRecord", async () => {
    await attributedBooking();
    const task = await send(yuki, yukiOutcome());
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task.artifacts?.[0].parts[0].text).toContain("accepted outcome out_3310");

    const outcome = (await platformStore.outcomes()).find((o) => o.bookingId === YUKI_BOOKING)!;
    expect(outcome).toMatchObject({ id: "out_3310", quotedKrw: 340_000, quoteGapRatio: 0 });
    const record = (await platformStore.priceRecords()).find((r) => r.id === `pr_${YUKI_BOOKING}_D0`);
    expect(record).toMatchObject({
      procedureId: "rejuran_healer",
      area: "sinsa",
      paidKrw: 340_000,
      normalizedUnitKrw: 170_000,
      source: "outcome",
      verified: true,
      clinicId: "cln_seoul_glow",
      nationalityGroup: "foreign",
      date: "2026-11-14",
    });
    expect((await platformStore.signals()).filter((s) => s.context.outcomeId === "out_3310")).toEqual([]);
  });

  it("normalizes a VAT excluded quote before the gap: Ara 300,000 + VAT, paid 412,500 -> +0.25", async () => {
    await attributedBooking("cln_ara", { priceKrw: 300_000, vatIncluded: false });
    const result = await submitOutcome(yukiOutcome({ clinicId: "cln_ara", paidKrw: 412_500 }), yuki);
    expect(result.state).toBe("completed");
    const outcome = (await platformStore.outcomes()).find((o) => o.bookingId === YUKI_BOOKING)!;
    expect(outcome).toMatchObject({ quotedKrw: 330_000, quoteGapRatio: 0.25 });
  });

  it("raises quote_gap above 0.10, low_satisfaction at 2 or less and side_effect_report", async () => {
    await attributedBooking();
    await submitOutcome(yukiOutcome({ paidKrw: 374_000, satisfaction: 3 }), yuki); // gap exactly 0.10: no signal
    expect((await platformStore.signals()).filter((s) => s.context.outcomeId === "out_3310")).toEqual([]);

    await submitOutcome(yukiOutcome({ paidKrw: 380_000, satisfaction: 2, sideEffects: ["swelling"] }), yuki);
    const signals = (await platformStore.signals()).filter((s) => s.context.outcomeId === "out_3310");
    expect(signals.map((s) => [s.kind, s.clinicId, s.context.nationality])).toEqual([
      ["quote_gap", "cln_seoul_glow", "JP"],
      ["low_satisfaction", "cln_seoul_glow", "JP"],
      ["side_effect_report", "cln_seoul_glow", "JP"],
    ]);
    expect(signals[0].value).toBeCloseTo(40_000 / 340_000, 6);
  });

  it("overwrites a second submission of the same booking and checkpoint and keeps the first in history", async () => {
    await attributedBooking();
    await submitOutcome(yukiOutcome({ paidKrw: 400_000, satisfaction: 2 }), yuki);
    const second = await submitOutcome(yukiOutcome({ outcomeId: "out_3311", paidKrw: 340_000, satisfaction: 5 }), yuki);
    expect(second.text).toContain("replaced outcome out_3310");

    const mine = (await platformStore.outcomes()).filter((o) => o.bookingId === YUKI_BOOKING);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: "out_3310", outcomeId: "out_3311", paidKrw: 340_000, quoteGapRatio: 0 });
    expect((await platformStore.outcomeHistory()).map((h) => h.value.paidKrw)).toEqual([400_000]);
    expect((await platformStore.priceRecords()).filter((r) => r.clinicId === "cln_seoul_glow" && r.id.startsWith("pr_bkg"))).toHaveLength(1);
    // the first submission's signals are gone with it
    expect((await platformStore.signals()).filter((s) => s.context.outcomeId === "out_3310")).toEqual([]);
  });

  it("does not add a PriceRecord for a later check-in", async () => {
    await attributedBooking();
    await submitOutcome(yukiOutcome({ outcomeId: "out_3312", checkpoint: "D7" }), yuki);
    expect((await platformStore.priceRecords()).some((r) => r.id.startsWith(`pr_${YUKI_BOOKING}`))).toBe(false);
  });
});

describe("outcome helpers", () => {
  it("outcomeSignals is pure and reads only the outcome", () => {
    const base = { ...yukiOutcome(), id: "out_x", receivedAt: "2026-11-14T13:10:00+09:00" };
    expect(outcomeSignals({ ...base, quoteGapRatio: 0.11 }).map((s) => s.kind)).toEqual(["quote_gap"]);
    expect(outcomeSignals({ ...base, quoteGapRatio: 0.1 })).toEqual([]);
  });

  it("injectAraBurst stores the 20 burst outcomes within the last 29 days and no PriceRecord", async () => {
    const records = (await platformStore.priceRecords()).length;
    const burst = await injectAraBurst();
    expect(burst).toHaveLength(20);
    expect((await platformStore.outcomes()).filter((o) => o.id.startsWith("out_ara_burst"))).toHaveLength(20);
    expect((await platformStore.priceRecords()).length).toBe(records);
  });
});
