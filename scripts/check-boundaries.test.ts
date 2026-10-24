import { describe, expect, it } from "vitest";
import { checkRepo, resolveImport, violationsFor } from "./check-boundaries.mjs";

// Positive controls: the checker must catch each kind of violation listed in 09-architecture.md "모듈 경계".
describe("check-boundaries", () => {
  it("resolves alias and relative imports to repo paths", () => {
    expect(resolveImport("lib/agents/clinic/quote.ts", "@/lib/zk/clauses")).toBe("lib/zk/clauses");
    expect(resolveImport("lib/agents/clinic/quote.ts", "../platform/matching")).toBe("lib/agents/platform/matching");
    expect(resolveImport("lib/agents/clinic/quote.ts", "zod")).toBeNull();
  });

  it("flags an agent module importing another agent module", () => {
    const cases: Array<[string, string]> = [
      ["lib/agents/platform/matching.ts", 'import { quote } from "../clinic/quote";'],
      ["lib/agents/platform/matching.ts", 'import { x } from "@/lib/agents/customer/records";'],
      ["lib/agents/customer/orchestrator.ts", 'import { match } from "@/lib/agents/platform/matching";'],
      ["lib/agents/clinic/executor.ts", 'export { notify } from "../customer/executor";'],
      ["lib/agents/clinic/executor.ts", 'const m = await import("@/lib/agents/platform/outcomes");'],
      ["lib/zk/clauses.ts", 'import type { Offer } from "../agents/clinic/quote";'],
      ["app/[locale]/requests/[id]/page.tsx", 'import { judge } from "@/lib/agents/platform/fairness";'],
      ["app/api/customer/requests/route.ts", 'import { book } from "@/lib/agents/clinic/booking";'],
      ["lib/agents/platform/matching.ts", 'import { payout } from "./settlement";'],
    ];
    for (const [file, source] of cases) {
      expect(violationsFor(file, source), `${file}: ${source}`).toHaveLength(1);
    }
  });

  it("allows the shared libraries and same module imports", () => {
    const cases: Array<[string, string]> = [
      ["lib/agents/platform/matching.ts", 'import { clauseHolds } from "@/lib/zk";'],
      ["lib/agents/platform/matching.ts", 'import { sendMessage } from "../../a2a/client";'],
      ["lib/agents/platform/rules.ts", 'import { payout } from "./settlement";'],
      ["lib/agents/clinic/quote.ts", 'import { z } from "zod";'],
      ["app/[locale]/home/page.tsx", 'import { getRequests } from "@/lib/agents/customer/records";'],
      ["lib/zk/client.ts", 'import type { OfferProofV1 } from "../a2a/schemas";'],
    ];
    for (const [file, source] of cases) {
      expect(violationsFor(file, source), `${file}: ${source}`).toHaveLength(0);
    }
  });

  it("flags a module touching another store namespace and allows its own and shared", () => {
    expect(violationsFor("lib/agents/clinic/booking.ts", 'await store.put("platform", "bookings", b);')).toHaveLength(1);
    expect(violationsFor("lib/agents/customer/records.ts", 'store.list("clinic", "menus")')).toHaveLength(1);
    expect(violationsFor("app/api/ops/rules/route.ts", 'store.get("customer", "requests", id)')).toHaveLength(1);
    expect(violationsFor("lib/agents/clinic/booking.ts", 'await store.put("clinic", "bookings", b);')).toHaveLength(0);
    expect(violationsFor("lib/agents/clinic/booking.ts", 'await store.put("shared", "a2a_log", e);')).toHaveLength(0);
    expect(violationsFor("lib/a2a/log.ts", 'await store.put("platform", "x", e);')).toHaveLength(0);
  });

  it("passes on the repository itself", () => {
    const { scanned, violations } = checkRepo();
    expect(scanned).toBeGreaterThan(50);
    expect(violations).toEqual([]);
  });
});
