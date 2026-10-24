import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { sendMessage } from "../../a2a/client";
import type { RecordAnchorV1, ReviewV1 } from "../../a2a/schemas";
import { anchorVisit, submitReview } from "../../zk/client";
import { TEST_BASE, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_BOOKING, attributedBooking, yukiOutcome } from "./__fixtures__/booking";
import { YUKI_AGENT } from "./__fixtures__/requests";
import { reportBooking, submitOutcome } from "./outcomes";
import { platformStore } from "./store";
import { anchorRecord, detectLocale, submitVerifiedReview } from "./zk-skills";

vi.mock("../../zk/client", () => ({ anchorVisit: vi.fn(), submitReview: vi.fn() }));

const yuki = { agentId: YUKI_AGENT, role: "customer" as const };
const PLATFORM_CARD = `${TEST_BASE}/a2a/platform/agent-card.json`;

beforeEach(async () => {
  await setupPlatformTest();
  vi.mocked(anchorVisit).mockReset().mockResolvedValue({ tx: "0xabc123", day: 29880274 });
  vi.mocked(submitReview).mockReset().mockResolvedValue({ ok: true });
});
afterEach(teardownPlatformTest);

const anchorInput = (extra: Partial<RecordAnchorV1> = {}): RecordAnchorV1 => ({
  schema: "pibu/record-anchor@1",
  bookingId: YUKI_BOOKING,
  clinicId: "cln_seoul_glow",
  procedureId: "rejuran_healer",
  subjectId: `0x${"5c".repeat(32)}`,
  record: { day: 29880274, recordNonce: "1234567890", ticketCommitment: "7788990011" },
  oldCommitment: "0x0",
  newCommitment: `0x${"1a".repeat(32)}`,
  recordHash: `0x${"3c".repeat(32)}`,
  proof: "0x2a3b",
  ...extra,
});

const review = (extra: Partial<ReviewV1> = {}): ReviewV1 => ({
  schema: "pibu/review@1",
  clinicId: "cln_seoul_glow",
  procedureId: "rejuran_healer",
  rating: 5,
  text: "日本語で全部説明してくれました。",
  visitProof: { merkleTreeDepth: 10, merkleTreeRoot: "1827", nullifier: "nf_yuki_1", message: "1122", scope: "5566", points: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  ...extra,
});

const seoulGlowVisits = async () => (await platformStore.verifiedVisits()).find((v) => v.id === "vv_seoul_glow_rejuran_healer")!.count;

describe("platform.anchor_record", () => {
  it("rejects a booking of another customer agent and a booking that is not done", async () => {
    await attributedBooking();
    const other = await anchorRecord(anchorInput(), { agentId: "cag_2m8x9", role: "customer" });
    expect(other).toMatchObject({ state: "rejected" });
    expect(other.text).toContain("booking_not_owned");
    const notDone = await anchorRecord(anchorInput(), yuki);
    expect(notDone.text).toContain("booking_not_completed");
    expect(await anchorRecord(anchorInput({ bookingId: "bkg_none" }), yuki)).toMatchObject({ state: "rejected" });
    expect(anchorVisit).not.toHaveBeenCalled();
  });

  it("anchors after the D0 outcome, as the caller's persona, and counts one more verified visit", async () => {
    await attributedBooking();
    await submitOutcome(yukiOutcome(), yuki);
    const before = await seoulGlowVisits();

    const task = await sendMessage({
      from: yuki,
      toCardUrl: PLATFORM_CARD,
      skillId: "platform.anchor_record",
      data: anchorInput(),
      contextId: "req_yuki_t1",
      fetchImpl: routeFetch,
    });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task.artifacts?.[0].parts[0].text).toBe("anchored 0xabc123");
    // cus_yuki_done shares cus_yuki's wallet on glowpass
    expect(anchorVisit).toHaveBeenCalledWith("cus_yuki", "cln_seoul_glow", "rejuran_healer");
    expect(await seoulGlowVisits()).toBe(before + 1);
    expect(await platformStore.anchorLogs()).toEqual([
      { id: `anc_${YUKI_BOOKING}`, bookingId: YUKI_BOOKING, subjectId: anchorInput().subjectId, tx: "0xabc123", day: 29880274, at: "2026-11-12T10:00:00+09:00" },
    ]);

    const again = await anchorRecord(anchorInput(), yuki);
    expect(again.text).toContain("already_anchored");
    expect(await seoulGlowVisits()).toBe(before + 1);
  });

  it("accepts a booking the clinic reported as completed even without an outcome", async () => {
    const { booking } = await attributedBooking();
    await reportBooking({ ...booking, status: "completed" }, { agentId: "cln_seoul_glow", role: "clinic" });
    expect(await anchorRecord(anchorInput(), yuki)).toEqual({ state: "completed", text: "anchored 0xabc123" });
  });

  it("fails with the relayer's reason when glowpass throws", async () => {
    await attributedBooking();
    await submitOutcome(yukiOutcome(), yuki);
    vi.mocked(anchorVisit).mockRejectedValueOnce(new Error("ZK server POST /api/records/visit failed (500): out of gas"));
    const result = await anchorRecord(anchorInput(), yuki);
    expect(result.state).toBe("failed");
    expect(result.text).toContain("out of gas");
    expect(await platformStore.anchorLogs()).toEqual([]);
  });
});

describe("platform.submit_review", () => {
  it("adds an accepted review to the aggregate with its text, nullifier and locale", async () => {
    const result = await submitVerifiedReview(review(), yuki);
    expect(result).toEqual({ state: "completed", text: "review accepted: n=19, average 4.6" });
    expect(submitReview).toHaveBeenCalledWith("cus_yuki", "cln_seoul_glow", "rejuran_healer", { rating: 5, text: review().text });
    const stat = (await platformStore.reviewStats()).find((r) => r.id === "rs_seoul_glow_rejuran_healer")!;
    expect(stat.n).toBe(19);
    expect(stat.nullifiers.at(-1)).toBe("nf_yuki_1");
    expect(stat.reviews.at(-1)).toEqual({ rating: 5, text: review().text, locale: "ja" });
    expect(stat.avgRating).toBe(Math.round((stat.reviews.reduce((s, r) => s + r.rating, 0) / 19) * 10) / 10);
  });

  it("recomputes the average from the review ratings (Mint: 6 reviews averaging 3.5, plus a 5)", async () => {
    await submitVerifiedReview(review({ clinicId: "cln_mint", visitProof: { ...review().visitProof, nullifier: "nf_mint_new" } }), yuki);
    expect((await platformStore.reviewStats()).find((r) => r.id === "rs_mint_rejuran_healer")).toMatchObject({ n: 7, avgRating: 3.7 });
  });

  it("refuses a nullifier that was already spent, without asking glowpass", async () => {
    await submitVerifiedReview(review(), yuki);
    vi.mocked(submitReview).mockClear();
    const second = await submitVerifiedReview(review({ rating: 1 }), yuki);
    expect(second).toMatchObject({ state: "rejected" });
    expect(second.text).toContain("nullifier_already_used");
    expect(submitReview).not.toHaveBeenCalled();
    expect((await platformStore.reviewStats()).find((r) => r.id === "rs_seoul_glow_rejuran_healer")!.n).toBe(19);
  });

  it("passes on glowpass's refusal and starts an aggregate for a new clinic and procedure", async () => {
    vi.mocked(submitReview).mockResolvedValueOnce({ ok: false, reason: "no ticket for this visit" });
    const refused = await submitVerifiedReview(review(), yuki);
    expect(refused).toEqual({ state: "rejected", text: "review_rejected: no ticket for this visit" });

    await submitVerifiedReview(review({ clinicId: "cln_hanbit", procedureId: "thermage_flx", rating: 4, text: "中文沟通没问题。" }), yuki);
    expect((await platformStore.reviewStats()).find((r) => r.id === "rs_hanbit_thermage_flx")).toMatchObject({
      n: 1,
      avgRating: 4,
      reviews: [{ rating: 4, text: "中文沟通没问题。", locale: "zh-CN" }],
    });
  });

  it("detects the review language from its script", () => {
    expect(detectLocale("とても良かった")).toBe("ja");
    expect(detectLocale("설명이 친절했어요")).toBe("ko");
    expect(detectLocale("很满意")).toBe("zh-CN");
    expect(detectLocale("Great staff")).toBe("en");
  });
});
