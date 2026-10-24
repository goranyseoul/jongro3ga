import type { TreatmentRecord } from "../../domain/customer";
import type { Store } from "../../store/types";
import { D0_ANCHOR, ZK_WALLETS } from "../../ui-data/customer";
import { C, listOf } from "./store";

/**
 * The chart append a D0 outcome triggers for a customer with a ZK wallet (platform.anchor_record, demo scene 6;
 * docs/INTEGRATION.md section 2). The relayer is not wired to the customer agent yet, so the tx and hashes are
 * the demo values of D0_ANCHOR; the version continues the seed wallet and the records already anchored.
 */
export async function d0AnchorFor(store: Store, customerId: string): Promise<TreatmentRecord["anchor"] | undefined> {
  const wallet = ZK_WALLETS[customerId];
  if (!wallet) return undefined;
  const records = await listOf<TreatmentRecord>(store, C.records, { customerId });
  const version = Math.max(wallet.version, ...records.map((r) => (r.anchor?.subjectId === wallet.subjectId ? r.anchor.version : 0)));
  return { subjectId: wallet.subjectId, version: version + 1, tx: D0_ANCHOR.tx, recordHash: D0_ANCHOR.recordHash };
}
