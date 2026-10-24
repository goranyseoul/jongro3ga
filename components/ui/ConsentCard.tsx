"use client";

import { Button } from "./Button";

export interface ConsentCardProps {
  title: string;
  description: string;
  /** Plain-language list of the fields that will be shared and with whom. */
  scope: string[];
  recipient?: string;
  grantLabel: string;
  declineLabel: string;
  onGrant: () => void;
  onDecline: () => void;
}

export function ConsentCard({ title, description, scope, recipient, grantLabel, declineLabel, onGrant, onDecline }: ConsentCardProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-sp-3 rounded-card border border-line bg-elev p-sp-4 shadow-card">
      <h3 className="text-title font-semi text-text">{title}</h3>
      <p className="text-body text-muted">{description}</p>
      {recipient ? <p className="text-sm text-subtle">{recipient}</p> : null}
      <ul className="flex flex-col gap-sp-1 text-body text-text">
        {scope.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div className="grid gap-sp-2 sm:grid-cols-2">
        <Button onClick={onGrant}>{grantLabel}</Button>
        <Button variant="secondary" onClick={onDecline}>
          {declineLabel}
        </Button>
      </div>
    </section>
  );
}
