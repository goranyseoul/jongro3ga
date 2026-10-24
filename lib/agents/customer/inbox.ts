import type { AgentRef } from "../../a2a/contract";
import type { CheckinRequestV1, NotificationV1 } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { Store } from "../../store/types";
import { checkinRequestText } from "./copy";
import { C, getOf, listOf, newId, putOf, type InboxItem } from "./store";

// The customer's in-app inbox: notifications other agents send (customer.notify), the agent's own
// booking confirmations, D7/D30 check-ins and platform check-in questions. Nothing is sent outside the app.

export async function storeNotification(store: Store, customerId: string, notification: NotificationV1, from: AgentRef): Promise<InboxItem> {
  const now = clock.nowIso();
  const item: InboxItem = {
    id: newId("inb"),
    customerId,
    kind: notification.kind,
    text: notification.text,
    ...(notification.bookingId ? { bookingId: notification.bookingId } : {}),
    from,
    dueAt: now,
    createdAt: now,
    status: "open",
  };
  await putOf(store, C.inbox, item);
  return item;
}

export async function storeCheckinRequest(store: Store, customerId: string, request: CheckinRequestV1, from: AgentRef, taskId: string): Promise<InboxItem> {
  const now = clock.nowIso();
  const item: InboxItem = {
    id: newId("inb"),
    customerId,
    kind: "checkin_request",
    text: checkinRequestText(request.questions),
    bookingId: request.bookingId,
    checkpoint: request.checkpoint,
    taskId,
    questions: request.questions,
    from,
    dueAt: now,
    createdAt: now,
    status: "open",
  };
  await putOf(store, C.inbox, item);
  return item;
}

export interface InboxView {
  /** Due now, newest first. */
  due: InboxItem[];
  /** Scheduled for later (D7/D30 before their day), soonest first. */
  upcoming: InboxItem[];
}

export async function inboxOf(store: Store, customerId: string): Promise<InboxView> {
  const now = clock.now().getTime();
  const items = await listOf<InboxItem>(store, C.inbox, { customerId });
  const due = items.filter((i) => Date.parse(i.dueAt) <= now).sort((a, b) => Date.parse(b.dueAt) - Date.parse(a.dueAt));
  const upcoming = items.filter((i) => Date.parse(i.dueAt) > now && i.status === "open").sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return { due, upcoming };
}

export async function markRead(store: Store, customerId: string, id: string): Promise<InboxItem | undefined> {
  const item = await getOf<InboxItem>(store, C.inbox, id);
  if (!item || item.customerId !== customerId) return undefined;
  const next: InboxItem = { ...item, readAt: item.readAt ?? clock.nowIso(), status: item.kind.startsWith("checkin") ? item.status : "done" };
  await putOf(store, C.inbox, next);
  return next;
}
