"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
};

// Bottom sheet on a native <dialog>: focus trap, Escape and inert background come from the browser.
export function Sheet({ open, onClose, title, closeLabel, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-full w-full max-w-none flex-col rounded-t-2xl border border-border-soft bg-popover p-0 text-text shadow-pop backdrop:animate-fade-in backdrop:bg-scrim open:flex open:animate-sheet-in md:mx-auto md:max-w-lg"
    >
      <div className="flex items-center justify-between gap-sp-3 border-b border-border-soft px-sp-4 py-sp-2">
        <h2 id={titleId} className="text-title font-semi">
          {title}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      <div className="overflow-y-auto p-sp-4">{children}</div>
    </dialog>
  );
}
