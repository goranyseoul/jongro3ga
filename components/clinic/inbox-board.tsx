"use client";

import { useMemo, useState } from "react";
import { Button, ChipGroup, Money, Table, type TableColumn } from "@/components/ui";
import { INBOX_TASKS, LANGUAGE_TEXT, type InboxTask } from "@/lib/ui-data/clinic";
import { DecisionSheet, type Decision, type DecisionMode, type DecisionResult } from "./decision-sheet";
import { formatAmount, formatSlot } from "./format";
import { KIND_TEXT, StateText } from "./task-state";

type Filter = "all" | "action" | "booking" | "quote";

const needsAction = (task: InboxTask) =>
  task.kind === "booking" && (task.state === "TASK_STATE_WORKING" || task.state === "TASK_STATE_INPUT_REQUIRED");

// Undecided bookings first, then newest first.
function byPriority(a: InboxTask, b: InboxTask): number {
  const rank = (task: InboxTask) => (task.state === "TASK_STATE_WORKING" ? 0 : needsAction(task) ? 1 : 2);
  return rank(a) - rank(b) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
}

export function InboxBoard() {
  const [tasks, setTasks] = useState<InboxTask[]>(INBOX_TASKS);
  const [filter, setFilter] = useState<Filter>("all");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState("");

  const counts = useMemo(
    () => ({
      all: tasks.length,
      action: tasks.filter(needsAction).length,
      booking: tasks.filter((task) => task.kind === "booking").length,
      quote: tasks.filter((task) => task.kind === "quote").length,
    }),
    [tasks],
  );

  const visible = useMemo(() => {
    const match = (task: InboxTask) =>
      filter === "all" ? true : filter === "action" ? needsAction(task) : task.kind === filter;
    return tasks.filter(match).sort(byPriority);
  }, [tasks, filter]);

  const update = (id: string, patch: Partial<InboxTask>, message: string) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    setNotice(message);
  };

  const confirm = (task: InboxTask) =>
    update(
      task.id,
      { state: "TASK_STATE_COMPLETED", outcome: "병원 직원이 확정" },
      `${task.from} 예약을 확정했어요. 고객 에이전트에게 전달돼요`,
    );

  const apply = (task: InboxTask, result: DecisionResult) => {
    if (result.mode === "propose") {
      update(
        task.id,
        { state: "TASK_STATE_INPUT_REQUIRED", requestedFields: undefined, outcome: `${formatSlot(result.slot)} 제안, 고객 응답 대기` },
        `${task.from}에게 ${formatSlot(result.slot)}을 제안했어요`,
      );
    } else if (result.mode === "reject") {
      update(task.id, { state: "TASK_STATE_REJECTED", outcome: `거절: ${result.reason}` }, `${task.from} 예약을 거절했어요`);
    } else {
      update(
        task.id,
        { state: "TASK_STATE_INPUT_REQUIRED", requestedFields: result.fields, outcome: undefined },
        `${task.from}에게 추가 정보를 요청했어요`,
      );
    }
    setDecision(null);
  };

  const open = (task: InboxTask, mode: DecisionMode) => setDecision({ task, mode });

  const columns: TableColumn<InboxTask>[] = [
    {
      key: "request",
      header: "요청",
      card: "title",
      cell: (task) => (
        <div className="flex flex-col gap-sp-1">
          <span className="text-body font-med">{task.from}</span>
          <span className="text-caption font-reg text-subtle">
            {KIND_TEXT[task.kind]} · {LANGUAGE_TEXT[task.language]}
          </span>
        </div>
      ),
    },
    {
      key: "procedure",
      header: "시술",
      cell: (task) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span className="text-body">
            {task.product} {formatAmount(task.amount)}
          </span>
          <Money krw={task.priceKrw} className="text-label" />
        </div>
      ),
    },
    {
      key: "slot",
      header: "희망 시간",
      cell: (task) => <span className="tabular-nums">{task.slot ? formatSlot(task.slot) : "·"}</span>,
    },
    {
      key: "received",
      header: "접수",
      cell: (task) => <span className="tabular-nums text-muted">{formatSlot(task.receivedAt)}</span>,
    },
    {
      key: "state",
      header: "상태",
      cell: (task) => <TaskStatus task={task} />,
    },
    {
      key: "actions",
      header: "처리",
      card: "action",
      cell: (task) => <TaskActions task={task} onConfirm={confirm} onOpen={open} />,
    },
  ];

  return (
    <div className="flex flex-col gap-sp-4">
      <ChipGroup
        label="요청 종류"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `전체 ${counts.all}` },
          { value: "action", label: `처리 필요 ${counts.action}` },
          { value: "booking", label: `예약 요청 ${counts.booking}` },
          { value: "quote", label: `견적 요청 ${counts.quote}` },
        ]}
      />

      <p role="status" aria-live="polite" className="min-h-sp-5 text-label text-muted">
        {notice}
      </p>

      <Table
        caption="병원 에이전트가 받은 요청"
        columns={columns}
        rows={visible}
        rowKey={(task) => task.id}
        empty="해당하는 요청이 없어요"
      />

      <DecisionSheet decision={decision} onClose={() => setDecision(null)} onSubmit={apply} />
    </div>
  );
}

function TaskStatus({ task }: { task: InboxTask }) {
  const flagged = (task.safetyFlags?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-sp-1 md:items-start">
      <StateText task={task} />
      {task.kind === "quote" && task.respondedInSec !== undefined ? (
        <span className="text-caption text-subtle">{task.respondedInSec}초 만에 답했어요</span>
      ) : null}
      {task.outcome ? <span className="text-caption text-muted">{task.outcome}</span> : null}
      {task.requestedFields?.length ? (
        <span className="text-caption text-muted">요청한 정보: {task.requestedFields.join(", ")}</span>
      ) : null}
      {task.kind === "booking" && flagged ? (
        <span className="text-caption text-muted">
          <span className="font-med text-warning">안전 정보</span> {task.safetyFlags?.join(", ")}
        </span>
      ) : null}
      {task.kind === "booking" && !flagged ? <span className="text-caption text-subtle">안전 정보 해당 없음</span> : null}
      {task.state === "TASK_STATE_COMPLETED" && task.contact ? (
        <span className="text-caption text-muted">
          연락처 {task.contact.channel} {task.contact.handle}
        </span>
      ) : null}
    </div>
  );
}

function TaskActions({
  task,
  onConfirm,
  onOpen,
}: {
  task: InboxTask;
  onConfirm: (task: InboxTask) => void;
  onOpen: (task: InboxTask, mode: DecisionMode) => void;
}) {
  if (!needsAction(task)) return null;

  const waitingGuest = task.state === "TASK_STATE_INPUT_REQUIRED";

  return (
    <div className="flex flex-wrap gap-sp-2">
      <Button variant="primary" onClick={() => onConfirm(task)}>
        확정
      </Button>
      {waitingGuest ? null : (
        <Button variant="secondary" onClick={() => onOpen(task, "propose")}>
          시간 제안
        </Button>
      )}
      <Button variant="secondary" onClick={() => onOpen(task, "reject")}>
        거절
      </Button>
      {waitingGuest ? null : (
        <Button variant="ghost" onClick={() => onOpen(task, "ask")}>
          추가 정보 요청
        </Button>
      )}
    </div>
  );
}
