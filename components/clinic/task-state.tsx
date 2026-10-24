import { cn } from "@/lib/cn";
import type { InboxTask, TaskKind, TaskState } from "@/lib/ui-data/clinic";

// Flat text status: one word, semantic color only where it carries meaning (05-screens.md rule 3).
const STATE_TEXT: Record<TaskKind, Record<TaskState, string>> = {
  booking: {
    TASK_STATE_WORKING: "확인 필요",
    TASK_STATE_INPUT_REQUIRED: "고객 응답 대기",
    TASK_STATE_COMPLETED: "확정",
    TASK_STATE_REJECTED: "거절",
  },
  quote: {
    TASK_STATE_WORKING: "응답 중",
    TASK_STATE_INPUT_REQUIRED: "고객 응답 대기",
    TASK_STATE_COMPLETED: "자동 응답",
    TASK_STATE_REJECTED: "거절",
  },
};

const STATE_TONE: Record<TaskState, string> = {
  TASK_STATE_WORKING: "text-warning",
  TASK_STATE_INPUT_REQUIRED: "text-muted",
  TASK_STATE_COMPLETED: "text-success",
  TASK_STATE_REJECTED: "text-muted",
};

export const KIND_TEXT: Record<TaskKind, string> = { booking: "예약 요청", quote: "견적 요청" };

export function stateText(task: Pick<InboxTask, "kind" | "state">): string {
  return STATE_TEXT[task.kind][task.state];
}

export function StateText({ task, className }: { task: Pick<InboxTask, "kind" | "state">; className?: string }) {
  return <span className={cn("text-body font-semi", STATE_TONE[task.state], className)}>{stateText(task)}</span>;
}
