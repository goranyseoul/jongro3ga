"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// three.js runs in the browser only and loads after the page, so the hero text never waits for it.
const ParticleFieldScene = dynamic(() => import("./particle-field-scene"), { ssr: false });

/** The simulation needs WebGL2 with float render targets; without them the hero simply has no particles. */
function canRenderParticles(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    return Boolean(gl && gl.getExtension("EXT_color_buffer_float"));
  } catch {
    return false;
  }
}

// A failing canvas (lost context, driver bug) must never take the landing down with it.
class ParticlesBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Hero backdrop: a field of drifting particles behind the chat. Reduced motion shows it still. */
export function ParticleField({ className, shrink = false }: { className?: string; shrink?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setSupported(canRenderParticles());
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(query.matches);
    const onChange = (event: MediaQueryListEvent) => setStill(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none", className)}>
      {supported ? (
        <ParticlesBoundary>
          <ParticleFieldScene still={still} shrink={shrink} />
        </ParticlesBoundary>
      ) : null}
    </div>
  );
}
