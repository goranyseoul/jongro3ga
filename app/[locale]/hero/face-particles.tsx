"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";

// three.js runs in the browser only and loads after the page, so the hero text never waits for it.
const FaceParticlesScene = dynamic(() => import("./face-particles-scene"), { ssr: false });

/** The simulation needs WebGL2 with float render targets; without them the hero simply has no face. */
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

/** Hero visual: a woman's face made of particles. Reduced motion shows the face still. */
export function FaceParticles() {
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
    <div aria-hidden="true" className="pointer-events-none mx-auto aspect-square w-2/3 max-w-xs md:max-w-sm">
      {supported ? (
        <ParticlesBoundary>
          <FaceParticlesScene still={still} />
        </ParticlesBoundary>
      ) : null}
    </div>
  );
}
