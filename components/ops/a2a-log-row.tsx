import { Button, JsonViewer } from "@/components/ui";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { TASK_STATE_LABEL, TASK_STATE_TONE, agentLabel, formatClock, koText, type A2ALogEntry, type ClinicNames } from "@/lib/ui-data/ops";
import { StatusText } from "./status-text";

export type A2ALogRowProps = {
  entry: A2ALogEntry;
  expanded: boolean;
  onToggle: () => void;
  /** Shows a button in the details that narrows the list to this entry's contextId. */
  onFilterContext?: (contextId: string) => void;
  /** Smaller type and no endpoint line, for the demo's middle column. */
  compact?: boolean;
  /** clinic id -> display name from the API. */
  clinics?: ClinicNames;
};

const shortDate = (iso: string) => iso.slice(5, 10).replace("-", "/");

// One call as a toggle row: time, skill, route and state on the first line, the human sentence below.
// Details (contextId, endpoint, request and response JSON) open under the row.
export function A2ALogRow({ entry, expanded, onToggle, onFilterContext, compact = false, clinics = {} }: A2ALogRowProps) {
  const detailsId = `${entry.id}-details`;

  return (
    <li className="border-b border-border-soft last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
        className={cn(
          "flex min-h-touch w-full flex-col gap-sp-1 px-sp-3 py-sp-3 text-start transition-colors duration-press ease-out hover:bg-sunken",
          focusRing,
        )}
      >
        <span className="flex flex-wrap items-baseline gap-x-sp-3 gap-y-sp-1">
          <span className="text-caption text-subtle tabular-nums">
            {shortDate(entry.at)} {formatClock(entry.at)}
          </span>
          <span className={cn("font-med", compact ? "text-label" : "text-body")}>{entry.skillId ?? entry.method}</span>
          {entry.state ? (
            <StatusText tone={TASK_STATE_TONE[entry.state] ?? "muted"} className="text-label">
              {TASK_STATE_LABEL[entry.state] ?? entry.state}
            </StatusText>
          ) : null}
          {entry.latencyMs !== undefined ? (
            <span className="text-caption text-subtle tabular-nums">{entry.latencyMs.toLocaleString("en-US")}ms</span>
          ) : null}
        </span>
        <span className="text-label text-muted">
          {agentLabel(entry.from, clinics)} → {agentLabel(entry.to, clinics)}
        </span>
        <span className={cn("text-muted", compact ? "text-caption" : "text-label")}>{koText(entry.humanSummary)}</span>
      </button>

      {expanded ? (
        <div id={detailsId} className="flex flex-col gap-sp-4 px-sp-3 pb-sp-4">
          <dl className="flex flex-col gap-sp-2 text-label">
            <div className="flex flex-wrap items-center gap-x-sp-4 gap-y-sp-1">
              <dt className="text-muted">contextId</dt>
              <dd className="tabular-nums">{entry.contextId ?? "없음"}</dd>
              {onFilterContext && entry.contextId ? (
                <dd>
                  <Button variant="ghost" onClick={() => onFilterContext(entry.contextId as string)}>
                    이 요청만 보기
                  </Button>
                </dd>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-sp-4 gap-y-sp-1">
              <dt className="text-muted">taskId</dt>
              <dd className="tabular-nums">{entry.taskId ?? "없음"}</dd>
              <dt className="text-muted">method</dt>
              <dd>{entry.method}</dd>
            </div>
            {compact ? null : (
              <div className="flex flex-wrap gap-x-sp-4 gap-y-sp-1">
                <dt className="text-muted">endpoint</dt>
                <dd className="min-w-0 break-all">{entry.to.url}</dd>
              </div>
            )}
          </dl>
          <div className={cn("grid gap-sp-4", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
            <section className="flex min-w-0 flex-col gap-sp-2" aria-label="요청 JSON">
              <p className="text-label font-med text-muted">요청</p>
              <JsonViewer value={entry.request} />
            </section>
            <section className="flex min-w-0 flex-col gap-sp-2" aria-label="응답 JSON">
              <p className="text-label font-med text-muted">응답</p>
              {entry.response !== undefined ? <JsonViewer value={entry.response} /> : <p className="text-label text-subtle">응답 없음</p>}
            </section>
          </div>
          <p className="text-caption text-subtle">민감 필드(safetyInfo, 연락처, 여권 이름)는 로그에 [masked]로 저장돼요.</p>
        </div>
      ) : null}
    </li>
  );
}
