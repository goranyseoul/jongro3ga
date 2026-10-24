import { describe, expect, it } from "vitest";
import { recordA2ALog } from "../../a2a/log";
import type { PriceRecord, Signal } from "../../domain/platform";
import type { A2ALogEntry } from "../../domain/shared";
import { createMemoryStore } from "../../store/memory";
import {
  DAY_MS,
  PLATFORM_COLLECTIONS,
  aggregateSegments,
  loadWindow,
  nationalityOfCall,
  priceDistribution,
  quantile,
  toKstIso,
  withFreshness,
} from "./signals";

const NOW = new Date("2026-11-12T10:00:00+09:00");
const daysAgo = (days: number) => toKstIso(new Date(NOW.getTime() - days * DAY_MS));

function quoteCall(i: number, nationality: string): A2ALogEntry {
  return {
    id: `log_q${i}`,
    at: daysAgo(i + 1),
    contextId: `req_${i}`,
    taskId: `tsk_q${i}`,
    from: { agentId: "cag_x", role: "customer" },
    to: { agentId: "cln_dahye", role: "clinic", url: "http://localhost/a2a/clinics/dahye/rpc" },
    method: "SendMessage",
    skillId: "clinic.quote",
    request: { jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { parts: [{ data: { schema: "pibu/procedure-request@1", visitorProfile: { nationality } } }] } } },
    humanSummary: { ko: "견적 요청" },
  };
}

describe("signals", () => {
  it("quantile interpolates linearly between closest ranks", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBeNull();
  });

  it("timeout ratio uses logged clinic.quote calls as the denominator and finds the nationality through the task id", async () => {
    const store = createMemoryStore();
    for (let i = 0; i < 6; i++) await recordA2ALog(store, quoteCall(i, "US"));
    const timeouts: Signal[] = [0, 1, 2, 3].map((i) => ({ id: `sig_${i}`, clinicId: "cln_dahye", kind: "response_timeout", value: 1, context: { taskId: `tsk_q${i}` }, at: daysAgo(i + 1) }));
    for (const s of timeouts) await store.put("platform", PLATFORM_COLLECTIONS.signals, s);
    const [segment] = aggregateSegments(await loadWindow(store, NOW));
    expect(segment).toMatchObject({ clinicId: "cln_dahye", nationality: "US", quoteRequests: 6, timeouts: 4 });
    expect(segment.timeoutRatio).toBeCloseTo(4 / 6);
    expect(nationalityOfCall(quoteCall(9, "JP"))).toBe("JP");
  });

  it("price distribution keeps verified non public records of the last 120 days, per area group and for all of Seoul", () => {
    const record = (i: number, area: PriceRecord["area"], unit: number, extra: Partial<PriceRecord> = {}): PriceRecord => ({
      id: `pr_${i}`,
      procedureId: "rejuran",
      area,
      amount: { value: 2, unit: "cc" },
      paidKrw: unit * 2,
      normalizedUnitKrw: unit,
      source: "shared_record",
      verified: true,
      date: "2026-10-01",
      ...extra,
    });
    const records = [
      record(1, "sinsa", 100_000),
      record(2, "gangnam", 200_000),
      record(3, "myeongdong", 300_000),
      record(4, "sinsa", 999_000, { source: "public_offer" }),
      record(5, "sinsa", 999_000, { verified: false }),
      record(6, "sinsa", 999_000, { date: "2026-07-01" }),
    ];
    const bands = priceDistribution(records, NOW);
    expect(bands.find((b) => b.region === "gangnam_sinsa")).toMatchObject({ n: 2, p25: 125_000, p50: 150_000, p75: 175_000 });
    expect(bands.find((b) => b.region === "seoul")).toMatchObject({ n: 3, p50: 200_000 });
    expect(bands[0].region).toBe("seoul");
  });

  it("freshness flags a registry entry verified more than 30 days ago", () => {
    const entry = { lastVerifiedAt: "2026-10-12" } as Parameters<typeof withFreshness>[0];
    expect(withFreshness(entry, "2026-11-11")).toMatchObject({ daysSinceVerified: 30, stale: false });
    expect(withFreshness(entry, "2026-11-12")).toMatchObject({ daysSinceVerified: 31, stale: true });
  });
});
