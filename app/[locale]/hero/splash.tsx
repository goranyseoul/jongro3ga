import type { CSSProperties } from "react";

// Entry splash: the wordmark rises in letter by letter, then the layer fades to the hero.
// Pure CSS (globals.css .splash), so it plays before any script loads; decorative only.
export function Splash({ wordmark }: { wordmark: string }) {
  return (
    <div aria-hidden="true" className="splash theme-sunrise">
      <span className="type-wordmark">
        {[...wordmark].map((letter, index) => (
          <span key={index} className="splash-letter" style={{ "--i": index } as CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    </div>
  );
}
