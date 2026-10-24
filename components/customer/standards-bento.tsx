import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StandardsBentoProps = {
  headingId: string;
  eyebrow: string;
  title: string;
  sub: string;
  /** Exactly three: no paid rankings, prices checked, standards rechecked. */
  principles: { title: string; body: string }[];
  stats: { value: string; caption: string }[];
  source: string;
  standards: { label: string; cycle: string }[];
};

const GLYPHS: string[][] = [
  ["M4 7h16", "M4 12h10", "M4 17h6", "M19 4 8 20"],
  ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M8.5 12.5 11 15l4.5-5"],
  ["M4 12a8 8 0 0 1 13.7-5.7L20 8", "M20 4v4h-4", "M20 12a8 8 0 0 1-13.7 5.7L4 16", "M4 20v-4h4"],
];

const tile = "rounded-2xl border border-border-soft shadow-card";
const surface = "bg-gradient-to-br from-elev to-sunken";

// The standards block as a bento grid (layout after the 21st.dev "Feature Bento" by uilayout.contact):
// one large headline tile, a tile per principle, a row of figure tiles and the numbered standards list.
// Phones stack everything in one column, figures two by two.
export function StandardsBento({ headingId, eyebrow, title, sub, principles, stats, source, standards }: StandardsBentoProps) {
  const half = Math.ceil(standards.length / 2);
  return (
    <div className="flex flex-col gap-sp-3">
      <div className="grid gap-sp-3 md:grid-cols-2 lg:grid-cols-4">
        <div className={cn(tile, surface, "flex flex-col justify-between gap-sp-8 p-sp-6 md:col-span-2 lg:row-span-2")}>
          <p className="text-label font-med text-muted">{eyebrow}</p>
          <div className="flex flex-col gap-sp-2">
            <h2 id={headingId} className="text-h1 font-semi">
              {title}
            </h2>
            <p className="text-body text-muted">{sub}</p>
          </div>
        </div>
        {principles.map((p, i) => (
          <div
            key={p.title}
            className={cn(tile, surface, "flex flex-col gap-sp-3 p-sp-6", i === 2 && "md:col-span-2")}
          >
            <Glyph paths={GLYPHS[i] ?? GLYPHS[0]} />
            <div className="flex flex-col gap-sp-1">
              <p className="text-title font-semi">{p.title}</p>
              <p className="text-label text-muted">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-sp-3 lg:grid-cols-4">
        {stats.map((s, i) => {
          const last = i === stats.length - 1;
          return (
            <div
              key={s.caption}
              className={cn(
                tile,
                "flex flex-col justify-between gap-sp-6 p-sp-4 md:p-sp-6",
                last ? "border-transparent bg-brand text-on-brand" : surface,
              )}
            >
              <dt className="order-2 text-label">{s.caption}</dt>
              <dd className="order-1 text-display font-semi tabular-nums">{s.value}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-caption text-subtle">{source}</p>

      <div className={cn(tile, surface, "grid overflow-hidden md:grid-cols-2")}>
        <StandardList items={standards.slice(0, half)} offset={0} />
        <StandardList items={standards.slice(half)} offset={half} className="border-t border-border-soft md:border-s md:border-t-0" />
      </div>
    </div>
  );
}

function StandardList({
  items,
  offset,
  className,
}: {
  items: { label: string; cycle: string }[];
  offset: number;
  className?: string;
}): ReactNode {
  return (
    <ol className={cn("flex flex-col divide-y divide-border-soft", className)}>
      {items.map((item, i) => (
        <li key={item.label} className="flex items-baseline gap-sp-3 px-sp-4 py-sp-3 md:px-sp-6">
          <span className="w-sp-6 shrink-0 text-title font-semi tabular-nums text-brand">{String(offset + i + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1 text-body font-med">{item.label}</span>
          <span className="shrink-0 text-label text-muted">{item.cycle}</span>
        </li>
      ))}
    </ol>
  );
}

// Bare line glyph in the same style as the treatment glyphs: no fill, no tinted box.
function Glyph({ paths }: { paths: string[] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-sp-6 text-brand">
      {paths.map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
