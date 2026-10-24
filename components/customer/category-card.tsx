import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import type { ProcedureArea } from "@/lib/ui-data/directory";

export type CategoryCardProps = {
  area: ProcedureArea;
  name: string;
  /** One short line under the title, e.g. two procedure names. */
  sample: string;
  /** The call to action line, e.g. the clinic count. */
  cta: string;
  onSelect: () => void;
  className?: string;
};

// Treatment group card after the shadcn "GradientCard": a soft diagonal gradient surface, a 3D object
// anchored bottom right and clipped by the card, and a call to action whose arrow nudges on hover.
// Motion is CSS only and runs on the motion tokens, so reduced motion switches it off with no extra code.
export function CategoryCard({ area, name, sample, cta, onSelect, className }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-2xl border border-border-soft bg-gradient-to-br from-elev to-sunken p-sp-4 text-start shadow-card",
        "transition duration-dropdown ease-out hover:-translate-y-sp-1 hover:border-border active:scale-press",
        focusRing,
        className,
      )}
    >
      <img
        src={`/landing/category-${area}.webp`}
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute -bottom-sp-3 -right-sp-3 w-3/5 select-none transition duration-modal ease-out group-hover:-rotate-6 group-hover:scale-110 group-active:scale-110"
      />
      <span className="relative flex min-w-0 flex-col gap-sp-1">
        <span className="text-title font-semi">{name}</span>
        <span className="line-clamp-2 w-3/4 text-caption text-muted">{sample}</span>
      </span>
      <span className="relative inline-flex items-center gap-sp-1 text-label font-semi tabular-nums text-brand">
        {cta}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="size-sp-3 shrink-0 transition duration-dropdown ease-out group-hover:translate-x-sp-1"
        >
          <path d="M3 8h9M8.5 4 12.5 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
