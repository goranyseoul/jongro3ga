import type { CSSProperties } from "react";

// Entry splash: the wordmark rises in letter by letter, then the layer fades to the hero.
// The closing capital (the K of PibooK) waits one extra beat and lands with a small overshoot,
// so the brand reads as "Piboo" + "K". Pure CSS (globals.css .splash), plays before any script.
export function Splash({ wordmark }: { wordmark: string }) {
  const letters = [...wordmark];
  const last = letters.length - 1;
  return (
    <div aria-hidden="true" className="splash theme-sunrise">
      <span className="type-wordmark">
        {letters.map((letter, index) => (
          <span
            key={index}
            className={index === last ? "splash-letter splash-letter-accent" : "splash-letter"}
            style={{ "--i": index === last ? index + 1 : index } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </span>
    </div>
  );
}
