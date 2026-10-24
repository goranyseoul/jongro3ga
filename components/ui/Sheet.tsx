"use client";

import { useEffect, type ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel?: string;
  children: ReactNode;
}

/** Bottom sheet on small screens, centered panel from md. */
export function Sheet({ open, onClose, title, closeLabel = "Close", children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full overflow-auto rounded-xl bg-elev p-sp-6 shadow-pop md:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-sp-4 flex items-center justify-between gap-sp-4">
          <h2 className="text-title font-semi text-text">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-touch px-sp-3 text-body text-muted">
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
