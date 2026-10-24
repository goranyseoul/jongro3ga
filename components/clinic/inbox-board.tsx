"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ChipGroup, Input, Money, Table, type TableColumn } from "@/components/ui";
import { INBOX_TASKS, LANGUAGE_TEXT, type InboxTask } from "@/lib/ui-data/clinic";
import { DecisionSheet, type Decision, type DecisionMode, type DecisionResult } from "./decision-sheet";
import { formatAmount, formatSlot } from "./format";
import { KIND_TEXT, StateText } from "./task-state";

type Filter = "all" | "action" | "booking" | "quote";

// How long a confirmation can be taken back before the notice settles.
const UNDO_MS = 8000;

const needsAction = (task: InboxTask) =>
  task.kind === "booking" && (task.state === "TASK_STATE_WORKING" || task.state === "TASK_STATE_INPUT_REQUIRED");

// Bulk confirm skips anything with safety answers: those need an individual look.
const bulkSelectable = (task: InboxTask) =>
  task.kind === "booking" && task.state === "TASK_STATE_WORKING" && (task.safetyFlags?.length ?? 0) === 0;

const isHandled = (task: InboxTask) => task.state === "TASK_STATE_COMPLETED" || task.state === "TASK_STATE_REJECTED";

// Undecided bookings first, then newest first.
function byPriority(a: InboxTask, b: InboxTask): number {
  const rank = (task: InboxTask) => (task.state === "TASK_STATE_WORKING" ? 0 : needsAction(task) ? 1 : 2);
  return rank(a) - rank(b) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt);
}

export function InboxBoard() {
  const [tasks, setTasks] = useState<InboxTask[]>(INBOX_TASKS);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState("");
  // Snapshot of the tasks the last confirmation changed, so it can be restored.
  const [undo, setUndo] = useState<InboxTask[] | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      action: tasks.filter(needsAction).length,
      booking: tasks.filter((task) => task.kind === "booking").length,
      quote: tasks.filter((task) => task.kind === "quote").length,
    }),
    [tasks],
  );

  const progress = useMemo(() => {
    const bookings = tasks.filter((task) => task.kind === "booking");
    const handled = bookings.filter(isHandled).length;
    return {
      total: bookings.length,
      handled,
      undecided: bookings.filter((task) => task.state === "TASK_STATE_WORKING").length,
      percent: bookings.length > 0 ? Math.round((handled / bookings.length) * 100) : 0,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (task: InboxTask) => {
      const inFilter = filter === "all" ? true : filter === "action" ? needsAction(task) : task.kind === filter;
      return inFilter && (needle === "" || `${task.from} ${task.product}`.toLowerCase().includes(needle));
    };
    return tasks.filter(match).sort(byPriority);
  }, [tasks, filter, query]);

  const selectableVisible = visible.filter(bulkSelectable);
  const allSelected = selectableVisible.length > 0 && selectableVisible.every((task) => selected.includes(task.id));

  const patch = (ids: string[], change: Partial<InboxTask>, message: string, undoable = false) => {
    setUndo(undoable ? tasks.filter((task) => ids.includes(task.id)) : null);
    setTasks((current) => current.map((task) => (ids.includes(task.id) ? { ...task, ...change } : task)));
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setNotice(message);
  };

  const confirmOne = (task: InboxTask) =>
    patch(
      [task.id],
      { state: "TASK_STATE_COMPLETED", outcome: "병원 직원이 확정" },
      `${task.from} 예약을 확정했어요`,
      true,
    );

  const confirmSelected = () =>
    patch(
      selected,
      { state: "TASK_STATE_COMPLETED", outcome: "병원 직원이 확정 (일괄)" },
      `예약 ${selected.length}건을 확정했어요`,
      true,
    );

  const undoLast = () => {
    if (!undo) return;
    const restore = new Map(undo.map((task) => [task.id, task]));
    setTasks((current) => current.map((task) => restore.get(task.id) ?? task));
    setUndo(null);
    setNotice(`예약 ${restore.size}건을 확정 전으로 되돌렸어요`);
  };

  const apply = (task: InboxTask, result: DecisionResult) => {
    if (result.mode === "propose") {
      patch(
        [task.id],
        { state: "TASK_STATE_INPUT_REQUIRED", requestedFields: undefined, outcome: `${formatSlot(result.slot)} 제안, 고객 응답 대기` },
        `${task.from}에게 ${formatSlot(result.slot)}을 제안했어요`,
      );
    } else if (result.mode === "reject") {
      patch(
        [task.id],
        { state: "TASK_STATE_REJECTED", outcome: `거절: ${result.reason}${result.memo ? ` · ${result.memo}` : ""}` },
        `${task.from} 예약을 거절했어요`,
      );
    } else {
      patch(
        [task.id],
        { state: "TASK_STATE_INPUT_REQUIRED", requestedFields: result.fields, outcome: undefined },
        `${task.from}에게 추가 정보를 요청했어요`,
      );
    }
    setDecision(null);
  };

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const toggleAll = () =>
    setSelected(allSelected ? [] : Array.from(new Set([...selected, ...selectableVisible.map((task) => task.id)])));

  const open = (task: InboxTask, mode: DecisionMode) => setDecision({ task, mode });

  const columns: TableColumn<InboxTask>[] = [
    {
      key: "select",
      header: (
        <label className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-sp-5 accent-brand"
            checked={allSelected}
            disabled={selectableVisible.length === 0}
            onChange={toggleAll}
            aria-label="확정 가능한 예약 모두 선택"
          />
        </label>
      ),
      card: "hidden",
      cell: (task) => {
        if (bulkSelectable(task)) {
          return (
            <label className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                className="size-sp-5 accent-brand"
                checked={selected.includes(task.id)}
                onChange={() => toggle(task.id)}
                aria-label={`${task.from} 예약 선택`}
              />
            </label>
          );
        }
        return task.kind === "booking" && task.state === "TASK_STATE_WORKING" ? (
          <span className="text-caption text-subtle">개별 확인</span>
        ) : null;
      },
    },
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
      cell: (task) => <TaskActions task={task} onConfirm={confirmOne} onOpen={open} />,
    },
  ];

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex flex-col gap-sp-2">
        <div
          role="progressbar"
          aria-label="예약 요청 처리 진행"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          className="h-sp-2 w-full overflow-hidden rounded-pill bg-sunken"
        >
          <div
            className="h-full rounded-pill bg-brand transition-all duration-dropdown ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-label text-muted tabular-nums">
          예약 요청 {progress.total}건 중 {progress.handled}건 처리 · 확인 필요 {progress.undecided}건
        </p>
      </div>

      <div className="flex flex-col gap-sp-3 md:flex-row md:items-end md:justify-between">
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
        <div className="w-full md:max-w-xs">
          <Input
            label="검색"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="고객 이름이나 시술"
          />
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex min-h-sp-5 flex-wrap items-center gap-sp-3 text-label text-muted"
      >
        <span>{notice}</span>
        {undo ? (
          <Button variant="ghost" onClick={undoLast}>
            되돌리기
          </Button>
        ) : null}
      </div>

      <Table
        caption="병원 에이전트가 받은 요청"
        columns={columns}
        rows={visible}
        rowKey={(task) => task.id}
        empty="해당하는 요청이 없어요"
      />

      {selected.length > 0 ? (
        <div
          role="region"
          aria-label="선택한 예약 일괄 처리"
          className="sticky bottom-sp-4 z-10 mx-auto flex w-full max-w-md flex-wrap items-center justify-between gap-sp-3 rounded-card border border-border bg-popover px-sp-4 py-sp-2 shadow-pop"
        >
          <span className="text-body font-med tabular-nums">{selected.length}건 선택</span>
          <div className="flex gap-sp-2">
            <Button variant="ghost" onClick={() => setSelected([])}>
              선택 해제
            </Button>
            <Button variant="primary" onClick={confirmSelected}>
              일괄 확정
            </Button>
          </div>
        </div>
      ) : null}

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
