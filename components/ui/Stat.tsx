import type { ReactNode } from "react";

export interface StatProps {
  label: string;
  value: ReactNode;
  caption?: string;
}

export function Stat({ label, value, caption }: StatProps) {
  return (
    <div className="flex flex-col gap-sp-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-h2 font-semi text-text">{value}</span>
      {caption ? <span className="text-xs text-subtle">{caption}</span> : null}
    </div>
  );
}
