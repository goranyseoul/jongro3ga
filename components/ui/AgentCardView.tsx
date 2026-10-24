import type { ReactNode } from "react";

export interface AgentCardSlot {
  key: string;
  label: string;
  /** Undefined means the slot is not filled yet. */
  value?: ReactNode;
}

export interface AgentCardViewProps {
  title: string;
  subtitle?: string;
  slots: AgentCardSlot[];
  emptyText?: string;
}

/** Live preview of an agent card: slots fill in as the onboarding chat progresses. */
export function AgentCardView({ title, subtitle, slots, emptyText = "Not set" }: AgentCardViewProps) {
  return (
    <section aria-label={title} className="rounded-card border border-line bg-elev p-sp-4 shadow-card">
      <h3 className="text-title font-semi text-text">{title}</h3>
      {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      <dl className="mt-sp-3 flex flex-col gap-sp-2">
        {slots.map((s) => (
          <div key={s.key} data-slot={s.key} data-filled={s.value !== undefined} className="flex items-baseline justify-between gap-sp-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className={s.value === undefined ? "text-body text-subtle" : "text-right text-body font-med text-text"}>
              {s.value === undefined ? emptyText : s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
