import type { Namespace, Store, StoreSnapshot } from "../store/types";

// Deletes everything one customer owns in the `customer` namespace (DELETE /api/me, 08-compliance.md 5).
// The Store interface has no "list collections", so this asks the implementation (Postgres store:
// collections(), memory store: snapshot()). An item belongs to the customer when
//   id == accountId, customerId == accountId, agentId/customerAgentId == the customer's agent id,
// and, transitively, when its requestId or bookingId points at an item already selected
// (ReceivedQuote -> CustomerRequest, OutcomeDraft -> CustomerBooking, 06-data-model.md).

interface Owner {
  accountId: string;
  agentId: string;
}

type Doc = Record<string, unknown> & { id: string };

async function customerCollections(store: Store): Promise<string[]> {
  const s = store as Store & {
    collections?: (ns: Namespace) => Promise<string[]>;
    snapshot?: () => StoreSnapshot | Promise<StoreSnapshot>;
  };
  if (typeof s.collections === "function") return s.collections("customer");
  if (typeof s.snapshot === "function") return Object.keys((await s.snapshot()).customer);
  throw new Error("store cannot enumerate collections; cannot purge customer data");
}

const LINK_FIELDS = ["requestId", "bookingId"] as const;

export async function purgeCustomerData(store: Store, owner: Owner): Promise<{ removed: Record<string, number> }> {
  const collections = await customerCollections(store);
  const docs: { collection: string; doc: Doc }[] = [];
  for (const collection of collections) {
    for (const doc of await store.list<Doc>("customer", collection)) docs.push({ collection, doc });
  }

  const owns = (d: Doc) =>
    d.id === owner.accountId ||
    d.customerId === owner.accountId ||
    d.agentId === owner.agentId ||
    d.customerAgentId === owner.agentId;

  const selected = new Set<number>();
  const selectedIds = new Set<string>();
  docs.forEach((entry, i) => {
    if (owns(entry.doc)) {
      selected.add(i);
      selectedIds.add(entry.doc.id);
    }
  });

  // follow requestId / bookingId links until nothing new is reached
  let grew = true;
  while (grew) {
    grew = false;
    docs.forEach((entry, i) => {
      if (selected.has(i)) return;
      if (LINK_FIELDS.some((field) => typeof entry.doc[field] === "string" && selectedIds.has(entry.doc[field] as string))) {
        selected.add(i);
        selectedIds.add(entry.doc.id);
        grew = true;
      }
    });
  }

  const removed: Record<string, number> = {};
  for (const i of selected) {
    const { collection, doc } = docs[i];
    await store.remove("customer", collection, doc.id);
    removed[collection] = (removed[collection] ?? 0) + 1;
  }
  return { removed };
}
