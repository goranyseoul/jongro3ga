"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

export type TourStep = { target: string; title: string; body: string };

export type TourLabels = {
  next: string;
  back: string;
  skip: string;
  done: string;
  /** "{n} / {total}" */
  stepLabel: string;
  /** Accessible name of the tour dialog. */
  region: string;
};

export type SpotlightTourProps = {
  steps: TourStep[];
  labels: TourLabels;
  /** Called once when the tour ends, by finishing or skipping. */
  onFinish: (reason: "done" | "skip") => void;
  /** Called when a step becomes current, so the page can open what the step points at. */
  onStep?: (target: string, index: number) => void;
};

type Box = { top: number; left: number; width: number; height: number };

const readPx = (token: string, fallback: number) => {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Dims the page, cuts a lit hole around the element a step points at (found by its data-tour attribute)
// and puts a small card next to it. Targets that are missing simply show the card on a plain dim.
export function SpotlightTour({ steps, labels, onFinish, onStep }: SpotlightTourProps) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [tip, setTip] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [step.target]);

  // bring the target into view, then follow it while the scroll settles and whenever the page moves
  useEffect(() => {
    onStep?.(step.target, index);
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    let frame = 0;
    const until = performance.now() + 900;
    const follow = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    follow();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // onStep only reads the current step; re-running when its identity changes would restart the scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step.target, measure]);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (el) setTip({ width: el.offsetWidth, height: el.offsetHeight });
  }, [index, viewport.width]);

  // the card stays invisible until it has been measured, and an invisible button cannot take focus
  const measured = tip.width > 0;
  useEffect(() => {
    if (measured) nextRef.current?.focus({ preventScroll: true });
  }, [index, measured]);

  const gap = typeof window === "undefined" ? 16 : readPx("--sp-4", 16);
  const pad = typeof window === "undefined" ? 8 : readPx("--sp-2", 8);

  // the card goes below the target, above it when there is no room, and is kept inside the screen
  let cardStyle: { top: number; left: number } = { top: gap, left: gap };
  if (viewport.width > 0) {
    const left = box ? box.left + box.width / 2 - tip.width / 2 : (viewport.width - tip.width) / 2;
    const below = box ? box.top + box.height + pad + gap : 0;
    const above = box ? box.top - pad - gap - tip.height : 0;
    const top = !box
      ? (viewport.height - tip.height) / 2
      : below + tip.height <= viewport.height - gap
        ? below
        : above >= gap
          ? above
          : viewport.height - tip.height - gap;
    cardStyle = {
      top: Math.max(gap, top),
      left: Math.min(Math.max(gap, left), Math.max(gap, viewport.width - tip.width - gap)),
    };
  }

  const finish = (reason: "done" | "skip") => onFinish(reason);

  return (
    <>
      {/* blocks the page under the dim; the agent window and the card sit above it */}
      <div className="fixed inset-0 z-40" aria-hidden="true" />
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-card outline outline-2 outline-brand transition-all duration-modal ease-drawer"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            // the huge spread is the dim: everything outside this box is covered by the scrim token
            boxShadow: "0 0 0 100vmax var(--scrim)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-scrim" />
      )}
      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.region}
        aria-describedby="tour-body"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            finish("skip");
          }
          if (event.key === "Tab") {
            // keep keyboard focus on the card while the page is dimmed
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
            const first = buttons[0];
            const final = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              final?.focus();
            } else if (!event.shiftKey && document.activeElement === final) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        className="fixed z-50 flex flex-col gap-sp-3 rounded-card border border-border bg-popover p-sp-4 text-text shadow-pop"
        style={{
          ...cardStyle,
          width: "min(calc(var(--sp-16) * 5.5), calc(100vw - var(--sp-8)))",
          // hidden until its size is known, so the card never flashes in the wrong place
          visibility: tip.width === 0 ? "hidden" : "visible",
        }}
      >
        <div className="flex flex-col gap-sp-1">
          <p className="text-caption text-subtle tabular-nums">
            {labels.stepLabel.replace("{n}", String(index + 1)).replace("{total}", String(steps.length))}
          </p>
          <h2 className="text-title font-semi">{step.title}</h2>
          <p id="tour-body" className="text-body text-muted">
            {step.body}
          </p>
        </div>
        <div className="flex items-center justify-between gap-sp-2">
          <Button variant="ghost" onClick={() => finish("skip")}>
            {labels.skip}
          </Button>
          <div className="flex gap-sp-2">
            {index > 0 ? (
              <Button variant="secondary" onClick={() => setIndex(index - 1)}>
                {labels.back}
              </Button>
            ) : null}
            <Button ref={nextRef} variant="primary" onClick={() => (last ? finish("done") : setIndex(index + 1))}>
              {last ? labels.done : labels.next}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
