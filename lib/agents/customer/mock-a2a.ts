import type { SendOptions } from "../../a2a/client";
import type { AgentRef } from "../../a2a/contract";
import { recordA2ALog } from "../../a2a/log";
import type { FairnessVerdictV1, QuoteV1 } from "../../a2a/schemas";
import type { WireTask } from "../../a2a/wire";
import { clock } from "../../clock";
import type { Store } from "../../store/types";
import { clinicEntry } from "./clinic-directory";
import { stepSummary } from "./copy";

// In-process stand-in for the platform and clinic agents with the reference values of
// 07-platform-intelligence.md ("기준 테스트 케이스") and 06 seeds: Seoul Glow 2cc 340,000 (fair),
// Mint 1cc event 99,000 (underdosed), Ara 2cc 300,000 VAT excluded (fair + paid more than quoted).
// Used by the customer track tests and, only when PIBU_CUSTOMER_MOCK_A2A=true, by the BFF so the
// customer screens can be verified before the A2A core, platform and clinic tracks are merged.

export const MOCK_BASE_URL = "https://pibu.example";

const kst = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`;

export const REFERENCE_CLINICS = ["cln_seoul_glow", "cln_ara", "cln_mint"] as const;

const SLUG: Record<string, string> = { cln_seoul_glow: "seoul-glow", cln_mint: "mint", cln_ara: "ara", cln_hanbit: "hanbit" };

export function mockCardUrl(clinicId: string): string {
  return `${MOCK_BASE_URL}/a2a/clinics/${SLUG[clinicId] ?? clinicId}/agent-card.json`;
}

export function referenceQuote(clinicId: string, requestId: string, procedureId: string): QuoteV1 | undefined {
  const base = { schema: "pibu/quote@1" as const, requestId, procedureId, product: "Rejuran Healer", excludes: [] as string[] };
  switch (clinicId) {
    case "cln_seoul_glow":
      return {
        ...base,
        quoteId: "qt_1203",
        clinicId,
        amount: { value: 2, unit: "cc" },
        priceKrw: 340000,
        vatIncluded: true,
        includes: ["numbing_cream", "soothing_mask"],
        slots: [kst("2026-11-13", 14), kst("2026-11-14", 11), kst("2026-11-14", 15), kst("2026-11-15", 10)],
        languages: ["ja", "en"],
        indicative: false,
        validUntil: "2026-11-20",
        operationMode: "clinic",
      };
    case "cln_mint":
      return {
        ...base,
        quoteId: "qt_88a1",
        clinicId,
        amount: { value: 1, unit: "cc" },
        priceKrw: 99000,
        vatIncluded: true,
        includes: ["numbing_cream"],
        excludes: ["soothing_mask"],
        event: { title: "First visit 1cc event", regularPriceKrw: 150000, validFrom: "2026-11-01", validUntil: "2026-11-30", conditions: "First visit only" },
        slots: [kst("2026-11-13", 15), kst("2026-11-14", 11), kst("2026-11-15", 10)],
        languages: ["ja", "en"],
        indicative: true,
        validUntil: "2026-11-19",
        operationMode: "proxy",
      };
    case "cln_ara":
      return {
        ...base,
        quoteId: "qt_5f02",
        clinicId,
        amount: { value: 2, unit: "cc" },
        priceKrw: 300000,
        vatIncluded: false,
        includes: ["numbing_cream"],
        excludes: ["soothing_mask"],
        slots: [kst("2026-11-13", 10), kst("2026-11-13", 11), kst("2026-11-14", 14)],
        languages: ["ja"],
        indicative: true,
        validUntil: "2026-11-19",
        operationMode: "proxy",
      };
    case "cln_hanbit":
      return {
        ...base,
        quoteId: "qt_77h1",
        clinicId,
        amount: { value: 2, unit: "cc" },
        priceKrw: 420000,
        vatIncluded: true,
        includes: ["numbing_cream"],
        slots: [kst("2026-11-14", 10)],
        languages: ["ja", "zh-CN"],
        indicative: true,
        validUntil: "2026-11-19",
        operationMode: "proxy",
      };
    default:
      return undefined;
  }
}

const typical = { min: 2, max: 3, unit: "cc" as const };

/** The 07 reference verdict for a quote, by clinic. */
export function referenceVerdict(quote: Pick<QuoteV1, "quoteId" | "clinicId" | "priceKrw" | "vatIncluded" | "amount">): FairnessVerdictV1 {
  const total = quote.vatIncluded ? quote.priceKrw : Math.round(quote.priceKrw * 1.1);
  const unitKrw = Math.round(total / quote.amount.value);
  const base = { quoteId: quote.quoteId, normalizedUnitKrw: unitKrw, typicalAmount: typical, confidence: "high" as const, sampleSize: 42 };
  switch (quote.clinicId) {
    case "cln_mint":
      return {
        ...base,
        priceBand: "low",
        doseFlag: "below_typical",
        clinicFlags: [{ code: "indicative_price" }],
        label: "underdosed",
        explanation: {
          en: "1cc is below the 2~3cc Korean women in their late 20s usually receive. The unit price is low, but the total treatment is smaller.",
          ja: "1ccは、韓国の20代後半女性が通常受ける2~3ccより少ない量です。単価は安いですが、施術量も少なくなります。",
          "zh-CN": "1cc 低于韩国20多岁后半女性通常接受的 2~3cc。单价较低,但施术量也更少。",
          ko: "1cc는 한국 20대 후반 여성이 보통 받는 2~3cc보다 적어요. 단가는 낮지만 시술량도 적어요.",
        },
      };
    case "cln_ara":
      return {
        ...base,
        priceBand: "mid",
        doseFlag: "within",
        clinicFlags: [{ code: "paid_more_than_quoted", avgGapPct: 15 }, { code: "indicative_price" }],
        label: "fair",
        explanation: {
          en: "With VAT added the unit price is within the usual range of 42 recorded payments in the last 120 days, and 2cc is a usual amount.",
          ja: "VAT加算後の単価は直近120日の記録42件の通常範囲に収まり、2ccは通常の量です。",
          "zh-CN": "加上增值税后单价处于最近120天42条记录的常见区间,2cc 为常见用量。",
          ko: "부가세를 더한 단가가 최근 120일 기록 42건의 보통 범위 안이고, 2cc는 보통 용량이에요.",
        },
      };
    case "cln_hanbit":
      return {
        ...base,
        priceBand: "high",
        doseFlag: "within",
        clinicFlags: [{ code: "indicative_price" }],
        label: "high",
        explanation: { en: "The unit price is above the usual range of recorded payments.", ja: "単価は記録の通常範囲より高めです。", "zh-CN": "单价高于记录的常见区间。", ko: "단가가 기록의 보통 범위보다 높아요." },
      };
    default:
      return {
        ...base,
        priceBand: "mid",
        doseFlag: "within",
        clinicFlags: [],
        label: "fair",
        explanation: {
          en: "The unit price is within the usual range of 42 recorded payments in the last 120 days, and 2cc is a usual amount.",
          ja: "単価は直近120日の記録42件の通常範囲に収まり、2ccは通常の量です。",
          "zh-CN": "单价处于最近120天42条记录的常见区间,2cc 为常见用量。",
          ko: "단가가 최근 120일 기록 42건의 보통 범위 안이고, 2cc는 보통 용량이에요.",
        },
      };
  }
}

function completed(id: string, contextId: string, payload: { data?: unknown; text?: string }): WireTask {
  return {
    id,
    contextId,
    status: { state: "TASK_STATE_COMPLETED", timestamp: clock.nowIso() },
    artifacts: [
      {
        artifactId: `art_${id}`,
        parts: [payload.data !== undefined ? { data: payload.data as Record<string, unknown>, mediaType: "application/json" } : { text: payload.text ?? "ok" }],
      },
    ],
  };
}

export interface MockA2AOptions {
  /** Clinics that never answer clinic.quote (to test the 20s timeout). */
  silentClinics?: string[];
  /** Clinics that answer clinic.quote with TASK_STATE_REJECTED. */
  rejectingClinics?: string[];
  /** GetTask calls before clinic.book completes as confirmed. */
  confirmAfterPolls?: number;
  /** Writes an A2A log entry per call so the progress timeline has rows. */
  store?: Store;
  candidates?: string[];
}

export interface MockA2A {
  send: (options: SendOptions) => Promise<WireTask>;
  get: (options: { from: AgentRef; toCardUrl: string; taskId: string }) => Promise<WireTask>;
  calls: SendOptions[];
  polls: string[];
}

function clinicIdFromCard(url: string): string {
  const slug = url.match(/\/a2a\/clinics\/([^/]+)\//)?.[1] ?? "";
  return Object.entries(SLUG).find(([, s]) => s === slug)?.[0] ?? slug;
}

export function createMockA2A(options: MockA2AOptions = {}): MockA2A {
  const calls: SendOptions[] = [];
  const polls: string[] = [];
  const bookings = new Map<string, { data: Record<string, unknown>; contextId: string; clinicId: string; polls: number; referralToken: string; from: AgentRef }>();
  let seq = 0;
  const confirmAfter = options.confirmAfterPolls ?? 1;

  const log = async (o: SendOptions, task: WireTask, method: "SendMessage" | "GetTask" = "SendMessage") => {
    if (!options.store) return;
    seq += 1;
    const isClinic = o.toCardUrl.includes("/clinics/");
    const clinicId = isClinic ? clinicIdFromCard(o.toCardUrl) : undefined;
    await recordA2ALog(options.store, {
      id: `log_mock_${Date.parse(clock.nowIso())}_${seq}_${Math.random().toString(36).slice(2, 8)}`,
      at: clock.nowIso(),
      contextId: o.contextId,
      taskId: task.id,
      from: o.from,
      to: { agentId: clinicId ?? "platform", role: isClinic ? "clinic" : "platform", url: o.toCardUrl.replace("agent-card.json", "rpc") },
      method,
      skillId: o.skillId,
      request: { jsonrpc: "2.0", id: `rpc_${seq}`, method, params: { message: { parts: [{ data: o.data }], metadata: { ...o.metadata, skillId: o.skillId } } } },
      response: { jsonrpc: "2.0", id: `rpc_${seq}`, result: { task } },
      state: task.status.state,
      latencyMs: 120 + seq * 7,
      humanSummary: stepSummary(o.skillId, task.status.state, clinicId ? clinicEntry(clinicId)?.name : undefined),
    });
  };

  const send = async (o: SendOptions): Promise<WireTask> => {
    calls.push(o);
    const id = `tsk_mock_${++seq}`;
    const data = o.data as Record<string, unknown>;
    let task: WireTask;
    switch (o.skillId) {
      case "platform.recipe":
        task = completed(id, o.contextId, {
          data: {
            schema: "pibu/recipe@1",
            combinations: [{ procedureIds: [String((data.procedureIds as string[] | undefined)?.[0] ?? "rejuran")], share: 0.42, sampleSize: 120 }],
            procedures: [
              {
                procedureId: String((data.procedureIds as string[] | undefined)?.[0] ?? "rejuran"),
                typicalAmount: typical,
                cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } },
                downtimeDays: { min: 1, max: 3 },
                onsetDays: { min: 14, max: 28 },
              },
            ],
            disclaimer: "Recorded choices of Korean women, not a recommendation.",
          },
        });
        break;
      case "platform.match_clinics": {
        const candidates = options.candidates ?? [...REFERENCE_CLINICS];
        const scores: Record<string, number> = { cln_seoul_glow: 0.86, cln_ara: 0.74, cln_mint: 0.68, cln_hanbit: 0.5 };
        task = completed(id, o.contextId, {
          data: {
            schema: "pibu/clinic-shortlist@1",
            requestId: data.requestId,
            matchId: "mt_4401",
            appliedRuleIds: [],
            priceReference: { procedureId: data.procedureId, unit: "cc", region: "gangnam_sinsa", p25UnitKrw: 140000, p50UnitKrw: 160000, p75UnitKrw: 185000, sampleSize: 42, windowDays: 120 },
            candidates: candidates.map((clinicId) => ({
              clinicId,
              agentCardUrl: mockCardUrl(clinicId),
              score: scores[clinicId] ?? 0.4,
              reasons: ["Japanese support on site", "Open slots during your stay"],
              referralToken: `ref.${clinicId}.sig`,
            })),
          },
        });
        break;
      }
      case "clinic.quote": {
        const clinicId = clinicIdFromCard(o.toCardUrl);
        if (options.silentClinics?.includes(clinicId)) return new Promise<WireTask>(() => undefined);
        if (options.rejectingClinics?.includes(clinicId)) {
          task = { id, contextId: o.contextId, status: { state: "TASK_STATE_REJECTED", message: { messageId: `m_${id}`, role: "ROLE_AGENT", parts: [{ text: "procedure not offered" }] } } };
          break;
        }
        const quote = referenceQuote(clinicId, String(data.requestId), String(data.procedureId));
        task = quote ? completed(id, o.contextId, { data: quote }) : { id, contextId: o.contextId, status: { state: "TASK_STATE_REJECTED" } };
        break;
      }
      case "platform.judge_quote": {
        const quotes = (data.quotes as Array<Pick<QuoteV1, "quoteId" | "clinicId" | "priceKrw" | "vatIncluded" | "amount">>) ?? [];
        task = completed(id, o.contextId, { data: { schema: "pibu/fairness-verdict-list@1", requestId: data.requestId, verdicts: quotes.map(referenceVerdict) } });
        break;
      }
      case "clinic.book": {
        const clinicId = clinicIdFromCard(o.toCardUrl);
        if (o.taskId && bookings.has(o.taskId)) {
          task = { id: o.taskId, contextId: o.contextId, status: { state: "TASK_STATE_WORKING" } };
          break;
        }
        bookings.set(id, { data, contextId: o.contextId, clinicId, polls: 0, referralToken: String(o.metadata?.referralToken ?? ""), from: o.from });
        task = { id, contextId: o.contextId, status: { state: "TASK_STATE_WORKING", timestamp: clock.nowIso() } };
        break;
      }
      default:
        task = completed(id, o.contextId, { text: "Received." });
    }
    await log(o, task);
    return task;
  };

  const get = async ({ taskId, toCardUrl, from }: { from: AgentRef; toCardUrl: string; taskId: string }): Promise<WireTask> => {
    polls.push(taskId);
    const booking = bookings.get(taskId);
    if (!booking) throw new Error(`unknown task ${taskId}`);
    booking.polls += 1;
    if (booking.polls < confirmAfter) return { id: taskId, contextId: booking.contextId, status: { state: "TASK_STATE_WORKING" } };
    const quote = referenceQuote(booking.clinicId, String(booking.data.requestId), "rejuran");
    const task = completed(taskId, booking.contextId, {
      data: {
        schema: "pibu/booking@1",
        bookingId: "bkg_5521",
        requestId: booking.data.requestId,
        quoteId: booking.data.quoteId,
        clinicId: booking.clinicId,
        customerAgentId: booking.from.agentId,
        slot: booking.data.slot,
        status: "confirmed",
        confirmedBy: quote?.operationMode === "clinic" ? "clinic_staff" : "pibu_operator",
        priceKrw: quote?.priceKrw ?? 0,
        referralToken: booking.referralToken || "ref.sig",
        instructions: { ja: "当日はノーメイクでお越しください。", en: "Please come without makeup.", ko: "당일에는 화장하지 않고 와 주세요.", "zh-CN": "当天请素颜前来。" },
      },
    });
    if (booking.polls === confirmAfter) await log({ from, toCardUrl, skillId: "clinic.book", data: {}, contextId: booking.contextId }, task, "GetTask");
    return task;
  };

  return { send, get, calls, polls };
}

export function mockA2AEnabled(): boolean {
  return process.env.PIBU_CUSTOMER_MOCK_A2A === "true";
}
