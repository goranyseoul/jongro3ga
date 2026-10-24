import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AgentCard } from "@a2a-js/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetClock, setClock } from "../clock";
import { getStore, resetStore } from "../store";
import { COLLECTIONS } from "../store/collections";
import { clinicFixtures } from "./__fixtures__/clinics";
import { registerAgent } from "./auth";
import { EXT, cardSkillIds, clinicCard, customerCard, jsonRpcUrlOf, platformCard, type AgentCardJson } from "./cards";
import { resolveClinicCardInput, resolveCustomerAgent } from "./directory";
import { SKILL_IDS } from "./schemas";

// Same lists as scripts/verify-spec.mjs CARD_REQUIRED and SKILL_REQUIRED (A2A 1.0 required fields).
const CARD_REQUIRED = ["name", "description", "supportedInterfaces", "version", "capabilities", "defaultInputModes", "defaultOutputModes", "skills"];
const SKILL_REQUIRED = ["id", "name", "description", "tags"];

const BASE = "https://pibu.example";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", BASE);
  vi.stubEnv("ZK_CHAIN_ID", "");
  vi.stubEnv("ZK_REGISTRY_ADDRESS", "");
  setClock("2026-11-12T10:00:00+09:00");
  resetStore();
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

const mint = () => clinicFixtures().find((c) => c.id === "cln_mint")!;

function allCards(): AgentCardJson[] {
  return [platformCard(), ...clinicFixtures().map(clinicCard), customerCard("cag_7f3k2")];
}

/** The three Agent Card JSON blocks of docs/spec/03-a2a-protocol.md "Agent Card 예시". */
function specCards(): AgentCardJson[] {
  const text = readFileSync(join(process.cwd(), "docs/spec/03-a2a-protocol.md"), "utf8");
  return [...text.matchAll(/```json\n([\s\S]*?)```/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]) as AgentCardJson;
      } catch {
        return undefined;
      }
    })
    .filter((card): card is AgentCardJson => card !== undefined && "supportedInterfaces" in card);
}

describe("agent cards", () => {
  it("match the three 03 examples field for field", () => {
    const [platform, clinic, customer] = specCards();
    expect(platformCard()).toEqual(platform);
    expect(clinicCard(mint())).toEqual(clinic);
    expect(customerCard("cag_7f3k2")).toEqual(customer);
  });

  it("have every A2A 1.0 required field, on the platform, all five clinics and a customer", () => {
    const cards = allCards();
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      for (const key of CARD_REQUIRED) expect(card, `${card.name} ${key}`).toHaveProperty(key);
      expect(card.supportedInterfaces.length).toBeGreaterThan(0);
      for (const i of card.supportedInterfaces) {
        expect(i).toEqual({ url: expect.stringMatching(/^https:\/\/pibu\.example\/a2a\/.+\/rpc$/), protocolBinding: "JSONRPC", protocolVersion: "1.0" });
      }
      for (const skill of card.skills) {
        for (const key of SKILL_REQUIRED) expect(skill, `${skill.id} ${key}`).toHaveProperty(key);
        expect(skill.tags.length).toBeGreaterThan(0);
      }
    }
  });

  it("split SKILL_IDS by role exactly", () => {
    const platform = cardSkillIds(platformCard());
    const clinic = cardSkillIds(clinicCard(mint()));
    const customer = cardSkillIds(customerCard("cag_7f3k2"));
    expect(platform.every((id) => id.startsWith("platform."))).toBe(true);
    expect(clinic.every((id) => id.startsWith("clinic."))).toBe(true);
    expect(customer.every((id) => id.startsWith("customer."))).toBe(true);
    expect([...platform, ...clinic, ...customer].sort()).toEqual([...SKILL_IDS].sort());
    for (const c of clinicFixtures()) expect(cardSkillIds(clinicCard(c))).toEqual(clinic);
  });

  it("keep skill ids, extension URIs and the interface through the SDK AgentCard codec", () => {
    for (const card of allCards()) {
      const back = AgentCard.toJSON(AgentCard.fromJSON(card)) as AgentCardJson;
      expect(cardSkillIds(back)).toEqual(cardSkillIds(card));
      expect((back.capabilities.extensions ?? []).map((e) => e.uri)).toEqual((card.capabilities.extensions ?? []).map((e) => e.uri));
      expect(back.supportedInterfaces).toEqual(card.supportedInterfaces);
      expect(back.securitySchemes).toEqual(card.securitySchemes);
    }
  });

  it("describe proxy and direct operation per clinic", () => {
    const byId = Object.fromEntries(clinicFixtures().map((c) => [c.id, clinicCard(c)]));
    expect(byId.cln_mint.provider.organization).toBe("Pibu (operating on behalf of Mint Dermatology Clinic)");
    expect(byId.cln_seoul_glow.provider.organization).toBe("Seoul Glow Clinic");
    expect(byId.cln_seoul_glow.name).toBe("Seoul Glow Clinic Agent");
    expect(byId.cln_seoul_glow.description).toContain("(Sinsa)");
    const op = byId.cln_hanbit.capabilities.extensions!.find((e) => e.uri === EXT.clinicOperation)!;
    expect(op.params).toEqual({ mode: "proxy", dataSources: ["sms"], lastVerifiedAt: "2026-09-28", foreignPatientFacilityRegistered: true });
    expect(jsonRpcUrlOf(byId.cln_seoul_glow)).toBe(`${BASE}/a2a/clinics/seoul-glow/rpc`);
  });

  it("fall back to the Korean name and read ZK params from the environment", () => {
    vi.stubEnv("ZK_CHAIN_ID", "8453");
    vi.stubEnv("ZK_REGISTRY_ADDRESS", "0xabc");
    const card = clinicCard({ ...mint(), name: { ko: "민트피부과의원" } });
    expect(card.name).toBe("민트피부과의원 Agent");
    expect(card.capabilities.extensions!.find((e) => e.uri === EXT.zkOfferProof)!.params).toEqual({ chainId: 8453, registry: "0xabc" });
  });

  it("use PUBLIC_BASE_URL with the localhost default", () => {
    vi.stubEnv("PUBLIC_BASE_URL", "");
    expect(jsonRpcUrlOf(platformCard())).toBe("http://localhost:3000/a2a/platform/rpc");
    vi.stubEnv("PUBLIC_BASE_URL", "https://x.example/");
    expect(jsonRpcUrlOf(customerCard("cag_1"))).toBe("https://x.example/a2a/customers/cag_1/rpc");
  });
});

describe("directory", () => {
  it("finds a clinic by slug in the platform registry", async () => {
    for (const c of clinicFixtures()) await getStore().put("platform", COLLECTIONS.platform.clinicRegistry, c);
    expect((await resolveClinicCardInput("seoul-glow"))?.id).toBe("cln_seoul_glow");
    expect(await resolveClinicCardInput("nope")).toBeUndefined();
  });

  it("finds registered customer agents only", async () => {
    await registerAgent({ agentId: "cag_7f3k2", role: "customer", ownerId: "cus_yuki" });
    await registerAgent({ agentId: "cln_mint", role: "clinic", ownerId: "cln_mint" });
    expect((await resolveCustomerAgent("cag_7f3k2"))?.ownerId).toBe("cus_yuki");
    expect(await resolveCustomerAgent("cln_mint")).toBeUndefined();
    expect(await resolveCustomerAgent("cag_nobody")).toBeUndefined();
  });
});
