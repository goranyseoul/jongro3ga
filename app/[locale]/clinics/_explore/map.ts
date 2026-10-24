import type { Area } from "@/lib/ui-data/customer";

// Projection for the schematic map. No map library: a clinic's lat/lng is mapped linearly into the panel,
// as a percentage of its width and height. Clinics of one neighbourhood sit within a few hundred metres
// of each other, so the overview groups them into one marker per area (with a count) and a tap on it
// zooms the panel to that area, where every clinic gets its own pin. Markers that would still touch are
// pushed apart, measured in pixels of the panel's real size.

export type MapPoint = { id: string; area: Area; lat: number; lng: number };

export type Marker =
  | { kind: "pin"; id: string; area: Area; x: number; y: number }
  | { kind: "area"; area: Area; ids: string[]; x: number; y: number };

export type MapModel = {
  markers: Marker[];
  /** Area the panel is zoomed to, or null for the overview. */
  zoomArea: Area | null;
  /** More than one area is on the map, so a zoomed panel can go back to the overview. */
  canZoomOut: boolean;
};

export type PanelSize = { w: number; h: number };

/** Used until the panel has been measured: a phone-width panel at the 5:6 shape of explore.css. */
export const DEFAULT_PANEL: PanelSize = { w: 358, h: 430 };

// Share of the panel kept free around the markers. The top is larger because a pin grows upward from its tip.
const PAD = { left: 0.14, right: 0.14, top: 0.28, bottom: 0.18 };
// A single clinic (or a tight cluster) never zooms in further than this span, in degrees.
const MIN_SPAN = { lat: 0.012, lng: 0.015 };
// Closest two markers of a kind may sit, horizontally and vertically, in pixels (the two form an ellipse):
// a pin is 24x30 and needs 44px to tap; an area marker is a 44px circle with its name underneath.
const ROOM = { pin: { rx: 30, ry: 36 }, area: { rx: 64, ry: 68 } } as const;

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

function boundsOf(points: { lat: number; lng: number }[]): Bounds {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  if (maxLat - minLat < MIN_SPAN.lat) {
    const mid = (minLat + maxLat) / 2;
    minLat = mid - MIN_SPAN.lat / 2;
    maxLat = mid + MIN_SPAN.lat / 2;
  }
  if (maxLng - minLng < MIN_SPAN.lng) {
    const mid = (minLng + maxLng) / 2;
    minLng = mid - MIN_SPAN.lng / 2;
    maxLng = mid + MIN_SPAN.lng / 2;
  }
  return { minLat, maxLat, minLng, maxLng };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Position in percent of the panel. */
export function project(point: { lat: number; lng: number }, bounds: Bounds): { x: number; y: number } {
  const fx = (point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
  const fy = (bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat);
  return {
    x: round(100 * (PAD.left + fx * (1 - PAD.left - PAD.right))),
    y: round(100 * (PAD.top + fy * (1 - PAD.top - PAD.bottom))),
  };
}

type Placed = { x: number; y: number; rx: number; ry: number };

/**
 * Pushes markers apart until their rooms no longer overlap, then keeps them inside the padded panel.
 * Works in pixels, so the result is right for a narrow phone panel and a wide desktop one alike.
 */
export function spread<T extends { x: number; y: number }>(items: T[], rooms: { rx: number; ry: number }[], size: PanelSize): T[] {
  const placed: Placed[] = items.map((item, i) => ({
    x: (item.x / 100) * size.w,
    y: (item.y / 100) * size.h,
    rx: rooms[i]?.rx ?? ROOM.pin.rx,
    ry: rooms[i]?.ry ?? ROOM.pin.ry,
  }));
  const minX = (PAD.left - 0.04) * size.w;
  const maxX = (1 - PAD.right + 0.04) * size.w;
  const minY = (PAD.top - 0.04) * size.h;
  const maxY = (1 - PAD.bottom + 0.04) * size.h;

  for (let pass = 0; pass < 60; pass += 1) {
    let moved = false;
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]!;
        const b = placed[j]!;
        // the two rooms touch when the offset, in units of their combined half-axes, is shorter than 1
        const rx = (a.rx + b.rx) / 2;
        const ry = (a.ry + b.ry) / 2;
        let dx = (b.x - a.x) / rx;
        let dy = (b.y - a.y) / ry;
        let dist = Math.hypot(dx, dy);
        if (dist >= 1) continue;
        moved = true;
        if (dist < 0.001) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (1 - dist) / 2;
        a.x -= (dx / dist) * push * rx;
        a.y -= (dy / dist) * push * ry;
        b.x += (dx / dist) * push * rx;
        b.y += (dy / dist) * push * ry;
      }
    }
    for (const p of placed) {
      p.x = Math.min(maxX, Math.max(minX, p.x));
      p.y = Math.min(maxY, Math.max(minY, p.y));
    }
    if (!moved) break;
  }
  return items.map((item, i) => ({
    ...item,
    x: round((placed[i]!.x / size.w) * 100),
    y: round((placed[i]!.y / size.h) * 100),
  }));
}

export function buildMap(points: MapPoint[], focus: Area | null, size: PanelSize = DEFAULT_PANEL): MapModel {
  const byArea = new Map<Area, MapPoint[]>();
  for (const point of points) byArea.set(point.area, [...(byArea.get(point.area) ?? []), point]);
  const areas = [...byArea.keys()];
  const canZoomOut = areas.length > 1;
  const zoomArea: Area | null = focus && byArea.has(focus) ? focus : areas.length === 1 ? (areas[0] ?? null) : null;

  if (zoomArea) {
    const inArea = byArea.get(zoomArea) ?? [];
    const bounds = boundsOf(inArea);
    const pins = inArea.map((p): Marker => ({ kind: "pin", id: p.id, area: p.area, ...project(p, bounds) }));
    return { markers: spread(pins, pins.map(() => ROOM.pin), size), zoomArea, canZoomOut };
  }

  if (areas.length === 0) return { markers: [], zoomArea: null, canZoomOut: false };

  const groups = areas.map((area) => {
    const inArea = byArea.get(area) ?? [];
    return {
      area,
      inArea,
      lat: inArea.reduce((sum, p) => sum + p.lat, 0) / inArea.length,
      lng: inArea.reduce((sum, p) => sum + p.lng, 0) / inArea.length,
    };
  });
  const bounds = boundsOf(groups);
  const markers = groups.map((g): Marker => {
    const at = project(g, bounds);
    const only = g.inArea[0];
    return g.inArea.length === 1 && only
      ? { kind: "pin", id: only.id, area: g.area, ...at }
      : { kind: "area", area: g.area, ids: g.inArea.map((p) => p.id), ...at };
  });
  const rooms = markers.map((m) => (m.kind === "pin" ? ROOM.pin : ROOM.area));
  return { markers: spread(markers, rooms, size), zoomArea: null, canZoomOut: false };
}

/** Where the marker that stands for this clinic is on the map (a pin, or the area marker holding it). */
export function markerFor(model: MapModel, id: string): Marker | undefined {
  return model.markers.find((m) => (m.kind === "pin" ? m.id === id : m.ids.includes(id)));
}

// What the one-row mini card takes (with its margin, and a line more for a long name) and what a pin needs
// above its tip, in pixels. The top edge starts under the "All areas" bar.
const MINI_CARD = { height: 84, topBar: 68, pin: 34 } as const;
export const MINI_CARD_HEIGHT = MINI_CARD.height;

/**
 * Which edge of the panel the mini card goes to: the one that hides fewer markers, and never the one
 * that hides the selected pin. Ties go to the bottom.
 */
export function miniCardEdge(model: MapModel, selectedId: string | null, size: PanelSize): "top" | "bottom" {
  if (!selectedId) return "bottom";
  const height = MINI_CARD.height;
  const hidden = (edge: "top" | "bottom") =>
    model.markers.reduce((count, marker) => {
      const tip = (marker.y / 100) * size.h;
      const covered =
        edge === "bottom" ? tip >= size.h - height : tip - MINI_CARD.pin <= MINI_CARD.topBar + height;
      if (!covered) return count;
      const isSelected = marker.kind === "pin" ? marker.id === selectedId : marker.ids.includes(selectedId);
      return count + (isSelected ? 100 : 1);
    }, 0);
  return hidden("top") < hidden("bottom") ? "top" : "bottom";
}
