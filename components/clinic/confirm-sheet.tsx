"use client";

import type { ReactNode } from "react";
import { Button, Sheet } from "@/components/ui";

export type ConfirmSheetProps = {
  open: boolean;
  title: string;
  /** What will happen, in one or two sentences. */
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Confirmation before an action that cannot be undone, built on the shared Sheet.
export function ConfirmSheet({ open, title, message, confirmLabel, onConfirm, onClose }: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel="닫기">
      <div className="flex flex-col gap-sp-4">
        <p className="text-body text-muted">{message}</p>
        <div className="flex flex-col gap-sp-2 sm:flex-row-reverse">
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
