import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TaskStepStatus = "pending" | "active" | "done" | "error";

export type TaskStep = {
  id: string;
  label: ReactNode;
  /** Right-aligned result of the step, e.g. the answer the customer gave. */
  value?: ReactNode;
  status: TaskStepStatus;
};

export type TaskStepsProps = {
  steps: TaskStep[];
  /** Accessible name of the list. */
  label: string;
  /** Spoken name of each status; the icon alone carries no text. */
  statusLabels: Record<TaskStepStatus, string>;
  className?: string;
};

// A vertical checklist of a multi-step task with pending, active, done and error states, modelled on the
// 21st.dev "Task Steps" preview. Flat by design (05-screens.md rule 3): the icons are line glyphs with no
// tinted box, and values use the normal sans face with tabular figures.
export function TaskSteps({ steps, label, statusLabels, className }: TaskStepsProps) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {steps.map((step) => (
        <li
          key={step.id}
          aria-current={step.status === "active" ? "step" : undefined}
          className="flex items-center gap-sp-3 py-sp-2"
        >
          <StepIcon status={step.status} />
          <span className="sr-only">{statusLabels[step.status]}</span>
          <span
            className={cn(
              "shrink-0 text-body transition-colors duration-dropdown ease-out",
              step.status === "pending" && "text-subtle",
              step.status === "active" && "font-med text-text",
              step.status === "done" && "text-muted",
              step.status === "error" && "font-med text-text",
            )}
          >
            {step.label}
          </span>
          {step.value ? (
            <span className="min-w-0 flex-1 truncate text-end text-label tabular-nums text-muted">{step.value}</span>
          ) : (
            <span className="flex-1" />
          )}
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ status }: { status: TaskStepStatus }) {
  return (
    <span aria-hidden="true" className="flex size-sp-5 shrink-0 items-center justify-center">
      {status === "pending" ? <span className="size-sp-4 rounded-sm border border-input" /> : null}
      {status === "active" ? (
        <span className="cu-task-spinner size-sp-4 rounded-pill border-2 border-border border-t-brand" />
      ) : null}
      {status === "done" ? (
        <svg viewBox="0 0 16 16" fill="none" className="cu-task-check size-sp-4 text-success">
          <path d="M3 8.5 6.5 12 13 4.5" pathLength={1} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {status === "error" ? (
        <svg viewBox="0 0 16 16" fill="none" className="size-sp-4 text-danger">
          <path d="M8 3v6M8 12.5v.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      ) : null}
    </span>
  );
}
