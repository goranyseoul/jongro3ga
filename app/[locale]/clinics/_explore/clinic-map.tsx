"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui";
import type { Area } from "@/lib/ui-data/customer";
import type { ExploreCopy } from "./copy";
import { PinGlyph } from "./glyphs";
import { DEFAULT_PANEL, buildMap, miniCardEdge, type MapPoint, type PanelSize } from "./map";

export const MAP_DOM_ID = "explore-map";

export type MapClinic = MapPoint & { name: string };

type Props = {
  copy: ExploreCopy;
  clinics: MapClinic[];
  areaName: (area: Area) => string;
  /** Clinic whose card or pin the pointer or focus is on, else the selected one. */
  activeId: string | null;
  selectedId: string | null;
  /** Area the customer zoomed to from the overview; null shows every area. */
  focusArea: Area | null;
  onFocusArea: (area: Area | null) => void;
  onSelect: (clinicId: string | null) => void;
  onHover: (clinicId: string | null) => void;
  /** Content of the mini card shown for the selected clinic. */
  mini: ReactNode;
};

// Real size of the map panel in pixels, so markers can be kept apart by what they take on screen.
function usePanelSize(ref: RefObject<HTMLDivElement | null>): PanelSize {
  const [size, setSize] = useState<PanelSize>(DEFAULT_PANEL);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = () => {
      const { width, height } = element.getBoundingClientRect();
      // a hidden panel (phone list view) measures 0x0: keep the last real size
      if (width < 1 || height < 1) return;
      setSize((prev) => (Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: Math.round(width), h: Math.round(height) }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const nameAlign = (x: number) => (x < 28 ? "start" : x > 72 ? "end" : "center");

// Schematic map on plain DOM: markers are buttons placed by percentage, so every pin is a 44px target.
export function ClinicMap({ copy, clinics, areaName, activeId, selectedId, focusArea, onFocusArea, onSelect, onHover, mini }: Props) {
  const m = copy.map;
  const points = useMemo<MapPoint[]>(() => clinics.map(({ id, area, lat, lng }) => ({ id, area, lat, lng })), [clinics]);
  const names = useMemo(() => new Map(clinics.map((c) => [c.id, c.name])), [clinics]);
  const panelRef = useRef<HTMLDivElement>(null);
  const size = usePanelSize(panelRef);
  const model = useMemo(() => buildMap(points, focusArea, size), [points, focusArea, size]);
  const miniEdge = miniCardEdge(model, selectedId, size);
  const hasOverview = !model.zoomArea && model.markers.some((marker) => marker.kind === "area");

  return (
    <div className="ex-map-col" id={MAP_DOM_ID}>
      <div
        ref={panelRef}
        className="ex-map"
        role="group"
        aria-label={m.label}
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && selectedId) onSelect(null);
        }}
      >
        {model.zoomArea ? (
          <div className="ex-map-top">
            <span className="ex-map-zoomed">{m.zoomed(areaName(model.zoomArea))}</span>
            {model.canZoomOut ? (
              <Button variant="secondary" onClick={() => onFocusArea(null)}>
                {m.allAreas}
              </Button>
            ) : null}
          </div>
        ) : null}

        {model.markers.map((marker) => {
          if (marker.kind === "area") {
            const active = activeId !== null && marker.ids.includes(activeId);
            return (
              <button
                key={`area-${marker.area}`}
                type="button"
                className="ex-bubble"
                data-area-marker={marker.area}
                data-active={active}
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                aria-label={m.areaMarker(areaName(marker.area), marker.ids.length)}
                onClick={() => onFocusArea(marker.area)}
              >
                <span className="ex-bubble-dot">{marker.ids.length}</span>
                <span className="ex-bubble-name" aria-hidden="true">
                  {areaName(marker.area)}
                </span>
              </button>
            );
          }
          const name = names.get(marker.id) ?? marker.id;
          const active = activeId === marker.id;
          const selected = selectedId === marker.id;
          return (
            <button
              key={marker.id}
              type="button"
              className="ex-pin"
              data-clinic-pin={marker.id}
              data-active={active}
              data-selected={selected}
              data-align={nameAlign(marker.x)}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              aria-label={m.pinMarker(name, areaName(marker.area))}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : marker.id)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") onHover(marker.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") onHover(null);
              }}
              onFocus={() => onHover(marker.id)}
              onBlur={() => onHover(null)}
            >
              <PinGlyph />
              {active && !selected ? (
                <span className="ex-pin-name" aria-hidden="true">
                  {name}
                </span>
              ) : null}
            </button>
          );
        })}

        {model.markers.length === 0 ? <p className="ex-map-empty">{m.empty}</p> : null}
        {hasOverview && !selectedId ? <p className="ex-map-hint">{m.hint}</p> : null}

        {selectedId ? (
          <div className="ex-mini" data-edge={miniEdge}>
            {mini}
          </div>
        ) : null}
      </div>
      <p className="mt-sp-2 text-caption text-subtle">{m.caption}</p>
    </div>
  );
}
