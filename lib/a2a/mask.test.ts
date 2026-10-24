import { describe, expect, it } from "vitest";
import { wireFixtures } from "./__fixtures__/wire";
import { MASK, maskSensitive } from "./mask";
import { buildSendMessageRequest } from "./wire";

const data = (name: string) => structuredClone(wireFixtures.find((f) => f.name === name)!.data);

describe("maskSensitive", () => {
  it("masks safetyInfo values but keeps its keys, and masks guest.contactHandle", () => {
    const masked = maskSensitive(data("pibu/booking-request@1")) as Record<string, any>;
    expect(masked.safetyInfo).toEqual({
      pregnantOrBreastfeeding: MASK,
      allergies: MASK,
      anticoagulants: MASK,
      recentIsotretinoin: MASK,
      keloidHistory: MASK,
    });
    expect(masked.guest.contactHandle).toBe(MASK);
    // everything that is not sensitive stays readable for the ops log
    expect(masked.guest).toMatchObject({ displayName: "Yuki T.", contactChannel: "line", language: "ja" });
    expect(masked).toMatchObject({ requestId: "req_01J9Z8", quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00", consentRef: "cns_0091" });
  });

  it("masks passportName at any depth and contact.* as a whole", () => {
    const masked = maskSensitive({
      params: { message: { parts: [{ data: { values: { passportName: "YUKI TANAKA", lastRejuranDate: "2026-05-02" } } }] } },
      profile: { contact: { channel: "line", handle: "yuki_demo" }, safety: { allergies: ["lidocaine"] }, nickname: "Yuki" },
    });
    expect(masked.params.message.parts[0]!.data.values).toEqual({ passportName: MASK, lastRejuranDate: "2026-05-02" });
    expect(masked.profile).toEqual({
      contact: { channel: MASK, handle: MASK },
      safety: { allergies: MASK },
      nickname: "Yuki",
    });
  });

  it("masks a sensitive object that is not a plain object (array, string, null) as a single value", () => {
    expect(maskSensitive({ safetyInfo: ["a", "b"], contact: "x", safety: null })).toEqual({
      safetyInfo: MASK,
      contact: MASK,
      safety: MASK,
    });
  });

  it("masks extra field names the caller learned from an input request", () => {
    const body = { values: { visaNumber: "M12345678", note: "ok" } };
    expect(maskSensitive(body).values.visaNumber).toBe("M12345678");
    expect(maskSensitive(body, { extraFields: ["visaNumber"] }).values).toEqual({ visaNumber: MASK, note: "ok" });
  });

  it("does not modify its input and is idempotent", () => {
    const original = data("pibu/booking-request@1");
    const snapshot = structuredClone(original);
    const once = maskSensitive(original);
    expect(original).toEqual(snapshot);
    expect(maskSensitive(once)).toEqual(once);
  });

  it("passes primitives, null and arrays through, and leaves payloads without sensitive fields equal", () => {
    expect(maskSensitive("text")).toBe("text");
    expect(maskSensitive(3)).toBe(3);
    expect(maskSensitive(null)).toBeNull();
    expect(maskSensitive([1, { a: 2 }])).toEqual([1, { a: 2 }]);
    for (const name of ["pibu/quote@1", "pibu/clinic-shortlist@1", "pibu/fairness-verdict-list@1", "pibu/offers@1"]) {
      expect(maskSensitive(data(name)), name).toEqual(data(name));
    }
  });

  it("leaves no raw sensitive value anywhere in a full SendMessage request", () => {
    const request = buildSendMessageRequest({
      rpcId: "rpc_9",
      messageId: "msg_9",
      contextId: "req_01J9Z8",
      skillId: "clinic.book",
      text: "Booking request",
      data: data("pibu/booking-request@1"),
      metadata: { consentRef: "cns_0091" },
    });
    const text = JSON.stringify(maskSensitive(request));
    expect(text).not.toContain("yuki_demo");
    expect(text).toContain(MASK);
    expect(JSON.stringify(request)).toContain("yuki_demo");
  });

  it("does not choke on a prototype-looking key", () => {
    const payload = JSON.parse('{"__proto__": {"passportName": "X"}, "a": 1}');
    const masked = maskSensitive(payload);
    expect(JSON.stringify(masked)).not.toContain('"X"');
    expect(({} as Record<string, unknown>).passportName).toBeUndefined();
  });
});
