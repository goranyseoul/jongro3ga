import type { ProcedureArea } from "@/lib/ui-data/directory";

// Bare line glyphs for the treatment groups (no fill, no tinted box), drawn on a 24 grid.
const PATHS: Record<ProcedureArea, string[]> = {
  lifting: ["M12 20V5", "M7 10l5-5 5 5", "M6 20h12"],
  hydration_glow: ["M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z", "M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"],
  texture_renewal: ["M4 12h16", "M4 7h16", "M4 17h10", "M17 15l2 2-2 2"],
  pigment_tone: ["M12 4a8 8 0 1 0 0 16", "M12 4a8 8 0 0 1 0 16", "M12 4v16"],
  pores_oil: ["M7 8h.01", "M12 7h.01", "M17 9h.01", "M8 13h.01", "M13 12h.01", "M16 15h.01", "M10 17h.01"],
  acne_scars: ["M5 15c2-3 4-3 6 0s4 3 6 0", "M8 9h.01", "M15 8h.01"],
  wrinkles: ["M4 9c2.7-2 5.3-2 8 0s5.3 2 8 0", "M4 15c2.7-2 5.3-2 8 0s5.3 2 8 0"],
  volume: ["M12 4c4.4 0 8 3.6 8 8s-3.6 8-8 8", "M12 4C7.6 4 4 7.6 4 12", "M12 8v8", "M8 12h8"],
  contouring: ["M7 4c-2 5-2 10 1 13l4 3 4-3c3-3 3-8 1-13"],
  redness: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"],
};

export function CategoryGlyph({ area, className }: { area: ProcedureArea; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {PATHS[area].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
