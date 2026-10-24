import { cn } from "@/lib/cn";

// Points of a sphere (Fibonacci lattice) seen from a slight tilt, computed once. Front dots are larger
// and stronger, back dots smaller and faint, so the dots read as a little particle globe like the hero.
const DOTS = (() => {
  const count = 56;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tilt = 0.45;
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const x = Math.cos(golden * i) * ring;
    const z = Math.sin(golden * i) * ring;
    const ty = y * Math.cos(tilt) - z * Math.sin(tilt);
    const tz = y * Math.sin(tilt) + z * Math.cos(tilt);
    const depth = (tz + 1) / 2;
    return {
      cx: Number((12 + x * 9).toFixed(2)),
      cy: Number((12 + ty * 9).toFixed(2)),
      r: Number((0.35 + depth * 0.55).toFixed(2)),
      opacity: Number((0.25 + depth * 0.75).toFixed(2)),
    };
  });
})();

/** The agent's avatar: a small turning globe of particles, the hero's particles in miniature. */
export function AgentOrb({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-sp-8 shrink-0 items-center justify-center rounded-pill bg-sunken text-brand", className)}
    >
      <svg viewBox="0 0 24 24" className="agent-orb-spin size-sp-6" fill="currentColor">
        {DOTS.map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} opacity={dot.opacity} />
        ))}
      </svg>
    </span>
  );
}
