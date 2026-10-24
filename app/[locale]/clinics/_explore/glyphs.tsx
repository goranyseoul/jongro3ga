// Bare line glyphs (no filled box around them) for the explore screen.

/** Map pin: the tip of the drop is the bottom centre of the box. Fill and stroke come from explore.css. */
export function PinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 30" aria-hidden="true" className={className}>
      <path d="M12 29C6 22.5 3 18 3 13.5a9 9 0 0 1 18 0C21 18 18 22.5 12 29Z" className="ex-pin-body" />
      <circle cx="12" cy="13.5" r="3.5" className="ex-pin-hole" />
    </svg>
  );
}

export function CloseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MapGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 21c-4-4.2-6-7.4-6-10.5a6 6 0 0 1 12 0c0 3.1-2 6.3-6 10.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function FilterGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
