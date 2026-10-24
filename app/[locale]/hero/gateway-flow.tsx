"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// The "Gateway Flow" backdrop (21st.dev), redrawn on a plain canvas: dotted curves run in from both edges to
// the centre, a dot travels along each one, and a click sends out a ripple that pushes the dots aside. The
// original ran a whole page in an iframe with CDN scripts and fixed colours; here the lines take the hero
// text colour (--text through text-text), so the theme decides how they look.

type Point = { x: number; y: number };
type Path = { left: boolean; startY: number; t: number; speed: number };
type Ripple = { x: number; y: number; radius: number; life: number };

const PATH_COUNT = 80;
const LINE_ALPHA = 0.3;
const DOT_ALPHA = 0.6;
// per second; the original moved per frame at 60 fps
const RIPPLE_GROWTH = 900;
const RIPPLE_FADE = 0.9;
const RIPPLE_BAND = 120;
const RIPPLE_PUSH = 80;

function bezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function makePaths(): Path[] {
  return Array.from({ length: PATH_COUNT }, (_, i) => ({
    left: i % 2 === 0,
    // a fraction of the height, so a resize keeps the fan in place
    startY: (i / PATH_COUNT) * 1.4 - 0.2,
    t: Math.random(),
    speed: 0.09 + Math.random() * 0.12,
  }));
}

/** Hero backdrop: lines that gather in the middle. Reduced motion shows it still; `quiet` dims it while typing. */
export function GatewayFlow({ className, quiet = false }: { className?: string; quiet?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paths = makePaths();
    let ripples: Ripple[] = [];
    let width = 0;
    let height = 0;
    let color = "";
    let frame = 0;
    let last = 0;
    let visible = true;

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      const center = { x: width / 2, y: height / 2 };

      for (const ripple of ripples) {
        ripple.radius += RIPPLE_GROWTH * dt;
        ripple.life -= RIPPLE_FADE * dt;
      }
      ripples = ripples.filter((ripple) => ripple.life > 0);

      const curves = paths.map((path) => {
        const y = path.startY * height;
        return [
          { x: path.left ? 0 : width, y },
          { x: path.left ? center.x * 0.5 : width - center.x * 0.5, y },
          { x: path.left ? center.x * 0.8 : width - center.x * 0.8, y: center.y },
          center,
        ] as const;
      });

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([1, 4]);
      ctx.globalAlpha = LINE_ALPHA;
      ctx.beginPath();
      for (const [p0, p1, p2, p3] of curves) {
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = DOT_ALPHA;
      paths.forEach((path, i) => {
        path.t += path.speed * dt;
        if (path.t > 1) {
          path.t = 0;
          path.startY += ((Math.random() - 0.5) * 10) / Math.max(height, 1);
        }
        const [p0, p1, p2, p3] = curves[i];
        const pos = bezier(path.t, p0, p1, p2, p3);
        for (const ripple of ripples) {
          const dx = pos.x - ripple.x;
          const dy = pos.y - ripple.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && Math.abs(dist - ripple.radius) < RIPPLE_BAND) {
            const force = (1 - Math.abs(dist - ripple.radius) / RIPPLE_BAND) * ripple.life;
            pos.x += (dx / dist) * force * RIPPLE_PUSH;
            pos.y += (dy / dist) * force * RIPPLE_PUSH;
          }
        }
        ctx.fillRect(pos.x - 1.5, pos.y - 1.5, 3, 3);
      });
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      // a long gap (hidden tab, paused loop) must not jump the dots
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      draw(dt);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (still || frame || !visible || document.hidden) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      color = getComputedStyle(canvas).color;
      if (still || !frame) draw(0);
    };

    // the canvas sits under the hero and takes no pointer events, so clicks are caught on the window
    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      ripples.push({ x, y, radius: 0, life: 1 });
    };

    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    viewObserver.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!still) window.addEventListener("pointerdown", onPointerDown);

    resize();
    start();

    return () => {
      stop();
      sizeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none", className)}>
      <canvas
        ref={canvasRef}
        className={cn("block size-full text-text transition-opacity duration-modal", quiet && "opacity-50")}
      />
    </div>
  );
}
