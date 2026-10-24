import { describe, expect, it } from "vitest";
import { DIRECTORY, rankClinics } from "../../../../lib/ui-data/directory";
import { DIRECTORY_PROFILES } from "../../../../lib/ui-data/directory-profile";
import {
  EMPTY_FILTERS,
  activeChips,
  activeFilterCount,
  filterClinics,
  parseFilters,
  procedureOptions,
  removeChip,
  serializeFilters,
  toggleStandard,
  withGroup,
} from "./filters";
import { buildMap, markerFor, MINI_CARD_HEIGHT, miniCardEdge, type MapPoint, type PanelSize } from "./map";

const params = (query: string) => new URLSearchParams(query);

describe("explore filters in the URL", () => {
  it("round-trips every filter and drops unknown values", () => {
    const filters = parseFilters(params("group=lifting&tx=ulthera&area=sinsa&lang=ja&std=aftercare,registered&fd=1"));
    expect(filters).toEqual({
      group: "lifting",
      tx: "ulthera",
      area: "sinsa",
      lang: "ja",
      std: ["registered", "aftercare"],
      fd: true,
    });
    expect(serializeFilters(filters)).toBe("group=lifting&tx=ulthera&area=sinsa&lang=ja&std=registered,aftercare&fd=1");
    expect(parseFilters(params(serializeFilters(filters)))).toEqual(filters);

    const junk = parseFilters(params("group=nope&tx=nope&area=moon&lang=ko&std=nope,aftercare&fd=0"));
    expect(junk).toEqual({ ...EMPTY_FILTERS, std: ["aftercare"] });
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
  });

  it("keeps the whole directory ranked by standards passed when nothing is set", () => {
    const all = filterClinics(EMPTY_FILTERS);
    expect(all).toHaveLength(DIRECTORY.length);
    expect(all.map((c) => c.id)).toEqual(rankClinics(DIRECTORY).map((c) => c.id));
  });

  it("applies each filter and keeps the rank order inside the result", () => {
    const ja = filterClinics({ ...EMPTY_FILTERS, lang: "ja" });
    expect(ja.length).toBeGreaterThan(0);
    expect(ja.every((c) => c.languages.includes("ja"))).toBe(true);

    const sinsa = filterClinics({ ...EMPTY_FILTERS, area: "sinsa" });
    expect(sinsa.every((c) => c.area === "sinsa")).toBe(true);

    const tx = filterClinics({ ...EMPTY_FILTERS, tx: "ulthera" });
    expect(tx.every((c) => c.procedures.includes("ulthera"))).toBe(true);

    const std = filterClinics({ ...EMPTY_FILTERS, std: ["priceAsQuoted", "aftercare"] });
    expect(std.every((c) => c.passes.includes("priceAsQuoted") && c.passes.includes("aftercare"))).toBe(true);

    const female = filterClinics({ ...EMPTY_FILTERS, fd: true });
    const femaleIds = new Set(DIRECTORY_PROFILES.filter((p) => p.femaleDoctor).map((p) => p.id));
    expect(female.every((c) => femaleIds.has(c.id))).toBe(true);

    for (const list of [ja, sinsa, tx, std, female]) {
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i - 1]!.passes.length).toBeGreaterThanOrEqual(list[i]!.passes.length);
      }
    }
  });

  it("returns nothing for a combination no clinic satisfies", () => {
    expect(filterClinics({ ...EMPTY_FILTERS, area: "hongdae", tx: "sculptra" })).toEqual([]);
  });

  it("narrows by treatment group and drops a procedure outside the chosen group", () => {
    const lifting = filterClinics({ ...EMPTY_FILTERS, group: "lifting" });
    expect(lifting.length).toBeGreaterThan(0);
    expect(lifting.length).toBeLessThan(DIRECTORY.length);
    const next = withGroup({ ...EMPTY_FILTERS, tx: "skin_booster" }, "lifting");
    expect(next.group).toBe("lifting");
    expect(next.tx).toBeNull();
    expect(withGroup({ ...EMPTY_FILTERS, tx: "ulthera" }, "lifting").tx).toBe("ulthera");
  });

  it("offers each procedure once and only ones a clinic offers", () => {
    const all = procedureOptions(null).map((o) => o.id);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(DIRECTORY.some((c) => c.procedures.includes(id))).toBe(true);
    expect(procedureOptions("lifting").every((o) => o.group === "lifting")).toBe(true);
  });

  it("lists active filters as chips that remove one filter each", () => {
    const filters = parseFilters(params("group=lifting&area=sinsa&std=registered,aftercare&fd=1"));
    const chips = activeChips(filters);
    expect(chips).toHaveLength(activeFilterCount(filters));
    expect(chips).toHaveLength(5);
    for (const chip of chips) expect(activeFilterCount(removeChip(filters, chip))).toBe(4);
    expect(toggleStandard(filters, "registered").std).toEqual(["aftercare"]);
    expect(toggleStandard(filters, "dermatologist").std).toEqual(["registered", "dermatologist", "aftercare"]);
  });
});

// phone, tablet and desktop panel sizes in pixels
const SIZES: PanelSize[] = [
  { w: 358, h: 430 },
  { w: 736, h: 552 },
  { w: 522, h: 576 },
];

/** No two markers closer than the room they need (an ellipse of rx by ry pixels), within a small rounding slack. */
function expectApart(markers: { x: number; y: number }[], size: PanelSize, rx: number, ry: number) {
  for (let i = 0; i < markers.length; i += 1) {
    for (let j = i + 1; j < markers.length; j += 1) {
      const a = markers[i]!;
      const b = markers[j]!;
      const dist = Math.hypot((((b.x - a.x) / 100) * size.w) / rx, (((b.y - a.y) / 100) * size.h) / ry);
      expect(dist, `${i}/${j} at ${size.w}x${size.h}`).toBeGreaterThan(0.97);
    }
  }
}

const points: MapPoint[] = DIRECTORY_PROFILES.map((profile) => ({
  id: profile.id,
  area: DIRECTORY.find((c) => c.id === profile.id)!.area,
  lat: profile.lat,
  lng: profile.lng,
}));

describe("explore map projection", () => {
  it("shows one marker per area in the overview, all inside the panel", () => {
    const model = buildMap(points, null);
    const areas = new Set(points.map((p) => p.area));
    expect(model.zoomArea).toBeNull();
    expect(model.markers).toHaveLength(areas.size);
    const counted = model.markers.reduce((sum, m) => sum + (m.kind === "area" ? m.ids.length : 1), 0);
    expect(counted).toBe(points.length);
    for (const m of model.markers) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(100);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(100);
    }
  });

  it("places the neighbourhoods in their real order (north up, east right)", () => {
    const model = buildMap(points, null);
    const at = (area: string) => model.markers.find((m) => m.kind === "area" && m.area === area)!;
    expect(at("myeongdong").y).toBeLessThan(at("gangnam").y);
    expect(at("hongdae").x).toBeLessThan(at("apgujeong").x);
  });

  it("zooms to one area and gives every clinic its own pin, apart from each other, on any panel size", () => {
    for (const size of SIZES) {
      for (const area of new Set(points.map((p) => p.area))) {
        const model = buildMap(points, area, size);
        const inArea = points.filter((p) => p.area === area);
        expect(model.zoomArea).toBe(area);
        expect(model.canZoomOut).toBe(true);
        expect(model.markers).toHaveLength(inArea.length);
        expect(model.markers.every((m) => m.kind === "pin")).toBe(true);
        expectApart(model.markers, size, 30, 36);
      }
    }
  });

  it("keeps the area markers of the overview (circle plus name) from touching on any panel size", () => {
    for (const size of SIZES) expectApart(buildMap(points, null, size).markers, size, 64, 68);
  });

  it("puts the mini card on the edge that hides fewer markers and never over the selected pin", () => {
    for (const size of SIZES) for (const area of new Set(points.map((p) => p.area))) {
      const model = buildMap(points, area, size);
      for (const marker of model.markers) {
        if (marker.kind !== "pin") continue;
        const edge = miniCardEdge(model, marker.id, size);
        const tip = (marker.y / 100) * size.h;
        // the card spans its height at the bottom, or from 68px down at the top
        if (edge === "bottom") expect(tip, `${marker.id} under the bottom card`).toBeLessThan(size.h - MINI_CARD_HEIGHT);
        else expect(tip - 34, `${marker.id} under the top card`).toBeGreaterThan(68 + MINI_CARD_HEIGHT);
      }
    }
    expect(miniCardEdge(buildMap(points, null, SIZES[0]!), null, SIZES[0]!)).toBe("bottom");
  });

  it("zooms by itself when the filtered clinics sit in one area, and finds the marker of a clinic", () => {
    const sinsa = points.filter((p) => p.area === "sinsa");
    const model = buildMap(sinsa, null);
    expect(model.zoomArea).toBe("sinsa");
    expect(model.canZoomOut).toBe(false);
    expect(markerFor(model, sinsa[0]!.id)?.kind).toBe("pin");
    expect(markerFor(buildMap(points, null), sinsa[0]!.id)?.kind).toBe("area");
    expect(buildMap([], null).markers).toEqual([]);
  });

  it("shows a lone clinic as a pin in the middle of a panel instead of zooming without limit", () => {
    const model = buildMap([points[0]!], null);
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0]!.kind).toBe("pin");
  });
});
