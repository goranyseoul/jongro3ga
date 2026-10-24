"use client";

import type { ReactNode } from "react";
import { Card, CardHeader } from "./card";
import { ChipGroup } from "./chip-group";

export type ConsentCardProps = {
  title: ReactNode;
  description: ReactNode;
  /** Shown as a plain caption when set, e.g. "필수". */
  requiredLabel?: string;
  agreeLabel: string;
  declineLabel: string;
  /** null means not answered yet: consent is never pre-selected. */
  value: boolean | null;
  onChange: (value: boolean) => void;
};

export function ConsentCard({
  title,
  description,
  requiredLabel,
  agreeLabel,
  declineLabel,
  value,
  onChange,
}: ConsentCardProps) {
  return (
    <Card className="flex flex-col gap-sp-3">
      <CardHeader title={title} description={requiredLabel} />
      <p className="text-body text-muted">{description}</p>
      <ChipGroup
        label={typeof title === "string" ? title : agreeLabel}
        options={[
          { value: "agree", label: agreeLabel },
          { value: "decline", label: declineLabel },
        ]}
        value={value === null ? null : value ? "agree" : "decline"}
        onChange={(choice) => onChange(choice === "agree")}
      />
    </Card>
  );
}
