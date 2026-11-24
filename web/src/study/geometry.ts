// Turns the real analysed area (OSM footprints + streets) into local-metre
// geometry for the 3D study, and applies proposed works to that real geometry:
// widening cuts the actual buildings inside the new right-of-way.
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon, MultiPolygon } from 'geojson';
import type { AreaData } from '../services/overpass';
import type { Levers } from '../model/model';

export type XZ = [number, number];
export interface StudyBuilding { id: number; ring: XZ[]; height: number; baseHeight: number; capped: boolean; cut: XZ[][]; affected: boolean; estimated: boolean }
export interface StudyStreet { ring: XZ[]; width: number; cls: string; isStudy: boolean }
export interface StudyGeometry {
  buildings: StudyBuilding[];
  streets: StudyStreet[];
  lane: XZ[];               // centreline of the studied street, local metres
  laneName: string;
  laneLength: number;
  newCorridors: XZ[][];     // proposed right-of-way outlines when widened
  laneSegments: XZ[][];     // every segment of the studied street
  affectedCount: number;
  removedAreaM2: number;
  radius: number;
}

export function projector(center: [number, number]) {
  const [lng0, lat0] = center;
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, kz = 110540;
  return (c: number[]): XZ => [(c[0] - lng0) * kx, -(c[1] - lat0) * kz];
}

const outer = (g: Polygon | MultiPolygon): number[][][] =>
  g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);

/** The street the study is about: the narrowest real vehicle street near the
 *  click, preferring named and longer segments (tiles split streets into stubs). */
export function studyStreet(area: { center: [number, number]; streets: AreaData['streets'] }): Feature<LineString, { name: string; width: number; cls: string }> | null {
  const c = turf.point(area.center);
  const len = (s: AreaData['streets'][number]) => turf.length(s, { units: 'meters' });
  const cands = area.streets.filter((s) => s.properties.cls !== 'path' && len(s) >= 25);
  const near = cands.filter((s) => turf.pointToLineDistance(c, s, { units: 'meters' }) < 150);
  const pool = near.length ? near : cands.length ? cands : area.streets;
  if (!pool.length) return null;
  const named = (s: AreaData['streets'][number]) => !s.properties.name.startsWith('Unnamed');
  return [...pool].sort((a, b) =>
    a.properties.width - b.properties.width ||
    Number(named(b)) - Number(named(a)) ||
    len(b) - len(a))[0];
}

export function buildStudy(area: AreaData, base: Levers, plan: Levers, isPlan: boolean): StudyGeometry {
  const P = projector(area.center);
  const street = studyStreet(area);
  const L = isPlan ? plan : base;

  // All segments of the studied street (tiles split one street into pieces).
  const sameStreet = street && !street.properties.name.startsWith('Unnamed')
    ? area.streets.filter((x) => x.properties.name === street.properties.name)
    : street ? [street] : [];
  const studySet = new Set(sameStreet);
  const longest = sameStreet.reduce<typeof street>((a, x) => (!a || turf.length(x) > turf.length(a) ? x : a), null);

  // Proposed right-of-way: buffer every segment to the new half-width.
  const corridors: Feature<Polygon | MultiPolygon>[] = [];
  if (isPlan && plan.width > base.width + 0.01) {
    for (const seg of sameStreet) {
      const b = turf.buffer(seg, plan.width / 2, { units: 'meters' }) as Feature<Polygon | MultiPolygon> | null;
      if (b) corridors.push(b);
    }
  }

  const buildings: StudyBuilding[] = [];
  let affected = 0, removed = 0;
  area.buildings.forEach((b, id) => {
    const baseHeight = b.properties.height;
    const capH = L.floors * 3.2;
    const height = isPlan && baseHeight > capH ? capH : baseHeight;
    let keep: number[][][] = [b.geometry.coordinates[0]];
    const cut: XZ[][] = [];
    let hit = false;
    for (const corridor of corridors) {
      if (!keep.length) break;
      try {
        const cur = turf.polygon([keep[0]]);
        const inter = turf.intersect(turf.featureCollection([cur, corridor as Feature<Polygon>]));
        if (inter && turf.area(inter) > 1) {
          hit = true; removed += turf.area(inter);
          outer(inter.geometry).forEach((r) => cut.push(r.map(P)));
          const diff = turf.difference(turf.featureCollection([cur, corridor as Feature<Polygon>]));
          keep = diff ? outer(diff.geometry) : [];
        }
      } catch { /* invalid footprint: leave as is */ }
    }
    if (hit) affected++;
    if (!keep.length) {
      buildings.push({ id, ring: [], height, baseHeight, capped: height < baseHeight, cut, affected: true, estimated: b.properties.levels === null });
      return;
    }
    keep.forEach((r, i) => buildings.push({
      id: id * 10 + i, ring: r.map(P), height, baseHeight, capped: height < baseHeight - 0.1, cut: i === 0 ? cut : [], affected: cut.length > 0, estimated: b.properties.levels === null,
    }));
  });

  const streets: StudyStreet[] = [];
  for (const s of area.streets) {
    const isStudy = studySet.has(s);
    const w = isStudy ? L.width : s.properties.width;
    try {
      const buf = turf.buffer(s, Math.max(1, w / 2), { units: 'meters' });
      if (buf) outer(buf.geometry as Polygon | MultiPolygon).forEach((r) => streets.push({ ring: r.map(P), width: w, cls: s.properties.cls, isStudy }));
    } catch { /* skip */ }
  }

  return {
    buildings, streets,
    lane: longest ? longest.geometry.coordinates.map(P) : [],
    laneName: street?.properties.name ?? area.features.narrowestName,
    laneLength: longest ? turf.length(longest, { units: 'meters' }) : 0,
    newCorridors: corridors.flatMap((c) => outer(c.geometry).map((r) => r.map(P))),
    laneSegments: sameStreet.map((x) => x.geometry.coordinates.map(P)),
    affectedCount: affected, removedAreaM2: removed,
    radius: area.features.radiusM,
  };
}

/** Points along a polyline every `step` metres, with the tangent direction. */
export function sampleLine(line: XZ[], step: number): { p: XZ; dir: XZ }[] {
  const out: { p: XZ; dir: XZ }[] = [];
  let carry = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, z1] = line[i], [x2, z2] = line[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 1e-6) continue;
    const dir: XZ = [(x2 - x1) / len, (z2 - z1) / len];
    for (let d = carry; d < len; d += step) out.push({ p: [x1 + dir[0] * d, z1 + dir[1] * d], dir });
    carry = (carry - len) % step; if (carry < 0) carry += step;
  }
  return out;
}

/** Position and heading at distance `d` along a polyline. */
export function pointAt(line: XZ[], d: number): { p: XZ; angle: number } {
  for (let i = 0; i < line.length - 1; i++) {
    const [x1, z1] = line[i], [x2, z2] = line[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (d <= len || i === line.length - 2) {
      const t = len ? Math.min(1, d / len) : 0;
      return { p: [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t], angle: Math.atan2(-(z2 - z1), x2 - x1) };
    }
    d -= len;
  }
  return { p: line[0] ?? [0, 0], angle: 0 };
}
