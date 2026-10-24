"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui";
import type { DirectoryTopic } from "@/lib/ui-data/directory";
import { useAgent } from "../agent-context";

export type AskButtonProps = Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className"> & {
  /** The sentence the agent receives, as if the customer typed it. */
  text: string;
  topic: DirectoryTopic;
  /** Longer accessible name that starts with the visible label. */
  accessibleName?: string;
  children: ReactNode;
};

// The only client piece of the detail page: a tap becomes a message to the floating agent.
export function AskButton({ text, topic, accessibleName, children, ...style }: AskButtonProps) {
  const { ask } = useAgent();
  return (
    <Button {...style} aria-label={accessibleName} onClick={() => ask(text, topic)}>
      {children}
    </Button>
  );
}
