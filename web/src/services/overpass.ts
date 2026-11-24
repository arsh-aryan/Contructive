// Fetches OSM features around a point (Overpass API) and measures them with Turf.
import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, Point } from 'geojson';
import type { AreaFeatures } from '../model/diagnose';
import { getCachedArea, putCachedArea } from './supabase';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Typical right-of-way (m) by OSM highway class when no width tag exists.
const CLASS_WIDTH: Record<string, number> = {
  footway: 2, path: 2, pedestrian: 4, living_street: 4, service: 3.5, track: 3, alley: 3,
  residential: 5, unclassified: 5, tertiary: 7, tertiary_link: 6, secondary: 10, secondary_link: 8,
  primary: 14, primary_link: 10, trunk: 18, trunk_link: 12, motorway: 24,
};

export interface StreetProps { name: string; width: number; cls: string; bridge?: boolean; nh?: boolean; ref?: string }

export interface AreaData {
  features: AreaFeatures;
  buildings: Feature<Polygon, { levels: number | null; height: number }>[];
  streets: Feature<LineString, StreetProps>[];
  drains: Feature<LineString>[];
  greens: Feature<Polygon>[];
  stations: Feature<Point, { name: string }>[];
  center: [number, number];
}

interface OsmEl { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; lat?: number; lon?: number; center?: { lat: number; lon: number } }

async function query(q: string): Promise<{ elements: OsmEl[] }> {
  let last: unknown;
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.ok) return r.json();
      last = new Error(`Overpass ${r.status}`);
    } catch (e) { last = e; }
  }
  throw last;
}

/** Flyover length and national-highway refs among the streets. */
export function gradeSeparation(streets: Feature<LineString, StreetProps>[]) {
  const fly = streets.filter((s) => s.properties.bridge && !['path'].includes(s.properties.cls));
  const nh = streets.filter((s) => s.properties.nh);
  const numbered = [...new Set(nh.map((s) => s.properties.ref ?? '').filter((r) => /^NH/i.test(r)))];
  const refs = numbered.length ? numbered : [...new Set(nh.filter((s) => !s.properties.bridge).map((s) => s.properties.name).filter((r) => r && !r.startsWith('Unnamed')))];
  return {
    flyoverM: Math.round(fly.reduce((a, s) => a + turf.length(s, { units: 'meters' }), 0)),
    flyoverNames: [...new Set(fly.map((s) => s.properties.name).filter((n) => !n.startsWith('Unnamed')))].slice(0, 3),
    nhRefs: refs.slice(0, 3),
    nhM: Math.round(nh.reduce((a, s) => a + turf.length(s, { units: 'meters' }), 0)),
  };
}

const num = (s?: string) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export async function fetchArea(lat: number, lng: number, radius = 250): Promise<AreaData> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = await getCachedArea(key);
  if (cached) return cached as AreaData;

  const q = `[out:json][timeout:25];
(
  way(around:${radius},${lat},${lng})[building];
  way(around:${radius},${lat},${lng})[highway];
  way(around:${radius},${lat},${lng})[waterway~"drain|ditch|canal"];
  way(around:${radius},${lat},${lng})[leisure~"park|garden"];
  way(around:${radius},${lat},${lng})[landuse~"grass|forest|recreation_ground"];
  nwr(around:8000,${lat},${lng})[amenity=fire_station];
);
out geom center;`;
  const { elements } = await query(q);
  const center: [number, number] = [lng, lat];
  const circle = turf.circle(center, radius / 1000, { units: 'kilometers', steps: 48 });
  const circleArea = turf.area(circle);

  const buildings: AreaData['buildings'] = [];
  const streets: AreaData['streets'] = [];
  const drains: AreaData['drains'] = [];
  const greens: AreaData['greens'] = [];
  const stations: AreaData['stations'] = [];

  for (const el of elements) {
    const t = el.tags ?? {};
    const coords = el.geometry?.map((g) => [g.lon, g.lat] as [number, number]);
    if (t.amenity === 'fire_station') {
      const p = el.center ?? (el.lat !== undefined ? { lat: el.lat, lon: el.lon! } : el.geometry?.[0] ? { lat: el.geometry[0].lat, lon: el.geometry[0].lon } : null);
      if (p) stations.push(turf.point([p.lon, p.lat], { name: t.name ?? 'Fire station' }));
      continue;
    }
    if (!coords || coords.length < 2) continue;
    const closed = coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
    if (t.building && closed) {
      const levels = num(t['building:levels']);
      const h = num(t.height) ?? (levels !== null ? levels * 3.2 : 9 + ((el.id % 5) * 1.6));
      buildings.push(turf.polygon([coords], { levels, height: h }));
    } else if (t.highway) {
      const tagged = num(t.width);
      const ref = t.ref ?? '';
      streets.push(turf.lineString(coords, { name: t.name ?? t['name:en'] ?? `Unnamed ${t.highway}`, width: tagged ?? CLASS_WIDTH[t.highway] ?? 5, cls: tagged ? 'tagged' : t.highway,
        bridge: t.bridge === 'yes' || t.layer === '1' || t.layer === '2', nh: /^NH\s?\d/i.test(ref) || t.highway === 'trunk' || t.highway === 'motorway', ref }));
    } else if (t.waterway) {
      drains.push(turf.lineString(coords));
    } else if (closed) {
      greens.push(turf.polygon([coords]));
    }
  }

  // Narrowest vehicle-relevant street within 120 m of the point
  const near = streets.filter((s) => !['footway', 'path', 'steps', 'cycleway'].includes(String(s.properties.cls)) && turf.pointToLineDistance(turf.point(center), s, { units: 'meters' }) < 120);
  const pick = (near.length ? near : streets).reduce<AreaData['streets'][number] | null>((a, s) => (!a || s.properties.width < a.properties.width ? s : a), null);

  let coverage = 0;
  for (const b of buildings) { try { const i = turf.intersect(turf.featureCollection([b, circle])); if (i) coverage += turf.area(i); } catch { /* bad ring */ } }
  let green = 0;
  for (const g of greens) { try { const i = turf.intersect(turf.featureCollection([g, circle])); if (i) green += turf.area(i); } catch { /* */ } }

  const levels = buildings.map((b) => b.properties.levels).filter((x): x is number => x !== null);
  let nearest: { km: number; name: string } | null = null;
  for (const s of stations) { const km = turf.distance(turf.point(center), s); if (!nearest || km < nearest.km) nearest = { km, name: s.properties.name }; }

  const features: AreaFeatures = {
    radiusM: radius,
    narrowestWidthM: pick?.properties.width ?? 4,
    narrowestName: pick?.properties.name ?? 'Nearest street',
    widthSource: pick?.properties.cls === 'tagged' ? 'tagged' : 'class-default',
    streetCount: streets.length,
    buildingCount: buildings.length,
    buildingCoverage: Math.min(1, coverage / circleArea),
    medianLevels: median(levels),
    levelsTaggedShare: buildings.length ? levels.length / buildings.length : 0,
    drainCount: drains.length,
    greenShare: Math.min(1, green / circleArea),
    nearestFireStationKm: nearest?.km ?? null,
    nearestFireStationName: nearest?.name ?? null,
    ...gradeSeparation(streets),
  };
  const data: AreaData = { features, buildings, streets, drains, greens, stations, center };
  putCachedArea(key, data);
  return data;
}
