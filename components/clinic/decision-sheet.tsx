"use client";

import { useState } from "react";
import { Button, ChipGroup, Input, Sheet } from "@/components/ui";
import { PROPOSAL_SLOTS, type InboxTask } from "@/lib/ui-data/clinic";
import { formatAmount, formatSlot } from "./format";

export type DecisionMode = "propose" | "reject" | "ask";

export type Decision = { task: InboxTask; mode: DecisionMode };

// What the clinic sends back for each mode; the board turns it into the task's next state.
export type DecisionResult =
  | { mode: "propose"; slot: string }
  | { mode: "reject"; reason: string; memo: string }
  | { mode: "ask"; fields: string[] };

const REJECT_REASONS = ["희망 시간이 마감됐어요", "시술이 어려워요 (안전 정보)", "해당 시술을 운영하지 않아요", "그 밖의 사유"];

// Fields the clinic may ask a guest for (03-a2a-protocol.md pibu/input-request@1); the guest answers inside the consent scope.
const ASK_FIELDS = ["직전 시술일", "복용 중인 약", "알레르기 상세", "여권상 이름"];

const COPY: Record<DecisionMode, { title: string; hint: string; submit: string }> = {
  propose: { title: "시간 제안", hint: "고객에게 보낼 시간을 하나 골라요 (참고용 빈 시간)", submit: "이 시간 제안하기" },
  reject: { title: "예약 거절", hint: "고객 에이전트에게 전달되는 사유를 골라요", submit: "거절하기" },
  ask: { title: "추가 정보 요청", hint: "고객이 동의한 범위에서만 답할 수 있어요 (여러 개 선택)", submit: "요청 보내기" },
};

export type DecisionSheetProps = {
  decision: Decision | null;
  onClose: () => void;
  onSubmit: (task: InboxTask, result: DecisionResult) => void;
};

export function DecisionSheet({ decision, onClose, onSubmit }: DecisionSheetProps) {
  return (
    <Sheet open={decision !== null} onClose={onClose} title={decision ? COPY[decision.mode].title : ""} closeLabel="닫기">
      {decision ? <DecisionForm key={`${decision.task.id}:${decision.mode}`} decision={decision} onSubmit={onSubmit} /> : null}
    </Sheet>
  );
}

function DecisionForm({ decision, onSubmit }: { decision: Decision; onSubmit: DecisionSheetProps["onSubmit"] }) {
  const { task, mode } = decision;
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [fields, setFields] = useState<string[]>([]);

  const ready = mode === "propose" ? slot !== null : mode === "reject" ? reason !== null : fields.length > 0;

  const submit = () => {
    if (mode === "propose" && slot) onSubmit(task, { mode, slot });
    if (mode === "reject" && reason) onSubmit(task, { mode, reason, memo: memo.trim() });
    if (mode === "ask") onSubmit(task, { mode, fields });
  };

  return (
    <div className="flex flex-col gap-sp-4">
      <div className="flex flex-col gap-sp-1">
        <p className="text-body font-med">
          {task.from} · {task.product} {formatAmount(task.amount)}
        </p>
        <p className="text-label text-muted tabular-nums">희망 {task.slot ? formatSlot(task.slot) : "·"}</p>
      </div>

      <p className="text-label text-muted">{COPY[mode].hint}</p>

      {mode === "propose" ? (
        <ChipGroup
          label="제안할 시간"
          value={slot}
          onChange={setSlot}
          options={PROPOSAL_SLOTS.map((value) => ({ value, label: formatSlot(value) }))}
        />
      ) : null}
      {mode === "reject" ? (
        <>
          <ChipGroup
            label="거절 사유"
            value={reason}
            onChange={setReason}
            options={REJECT_REASONS.map((value) => ({ value, label: value }))}
          />
          <Input
            label="메모 (선택)"
            value={memo}
            maxLength={200}
            onChange={(event) => setMemo(event.target.value)}
            hint="사유와 함께 고객 에이전트에게 전달돼요"
          />
        </>
      ) : null}
      {mode === "ask" ? (
        <ChipGroup
          multiple
          label="요청할 정보"
          value={fields}
          onChange={setFields}
          options={ASK_FIELDS.map((value) => ({ value, label: value }))}
        />
      ) : null}

      <Button variant="primary" fullWidth disabled={!ready} onClick={submit}>
        {COPY[mode].submit}
      </Button>
    </div>
  );
}
