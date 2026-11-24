// Reads an area straight from the vector tiles already loaded in the map
// (OpenMapTiles schema, © OpenStreetMap contributors). Instant, works for any
// Indian city, and needs no extra API — the primary source for diagnosis.
import * as turf from '@turf/turf';
import type { Map as MLMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, Polygon, LineString } from 'geojson';
import { gradeSeparation, type AreaData, type StreetProps } from './overpass';
import { studyStreet } from '../study/geometry';
import { OVERTURE_SRC, heightOf } from './buildings';

const CLASS_WIDTH: Record<string, number> = {
  motorway: 24, trunk: 18, primary: 14, secondary: 10, tertiary: 7, minor: 5, service: 3.5, track: 3, path: 2, raceway: 8, busway: 7,
};

const safePoly = (rings: number[][][]) => {
  const ok = rings.filter((r) => r.length >= 4);
  if (!ok.length || ok[0] !== rings[0]) return null;
  try { return turf.polygon(ok); } catch { return null; }
};

export function areaFromTiles(map: MLMap, lat: number, lng: number, radius = 250): AreaData {
  const center: [number, number] = [lng, lat];
  const cpt = turf.point(center);
  const circle = turf.circle(center, radius / 1000, { units: 'kilometers', steps: 48 });
  const circleArea = turf.area(circle);
  const src = Object.entries(map.getStyle().sources).find(([, s]) => (s as { type: string }).type === 'vector')?.[0] ?? 'openmaptiles';
  const q = (layer: string) => map.querySourceFeatures(src, { sourceLayer: layer }) as MapGeoJSONFeature[];
  const within = (f: Feature) => { try { return turf.booleanIntersects(f, circle); } catch { return false; } };

  // Buildings (dedupe tile-split copies by id + rounded centroid)
  const seen = new Set<string>();
  const buildings: AreaData['buildings'] = [];
  const useOv = !!map.getSource(OVERTURE_SRC);
  const bsrc = useOv ? (map.querySourceFeatures(OVERTURE_SRC, { sourceLayer: 'building' }) as MapGeoJSONFeature[]) : q('building');
  for (const f of bsrc) {
    if (f.properties?.is_underground === true) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const rings of polys) {
      const poly = safePoly(rings as number[][][]);
      if (!poly || !within(poly)) continue;
      const c = turf.centroid(poly).geometry.coordinates;
      const key = `${f.properties?.id ?? f.id ?? ''}:${c[0].toFixed(5)},${c[1].toFixed(5)}`;
      if (seen.has(key)) continue; seen.add(key);
      let height: number, levels: number | null;
      if (useOv) ({ h: height, levels } = heightOf(f.properties));
      else { const h = Number(f.properties?.render_height) || 0; const tagged = h > 0 && h !== 5 && h !== 10; height = h || 9; levels = tagged ? Math.max(1, Math.round(h / 3.2)) : null; }
      buildings.push(turf.polygon(poly.geometry.coordinates, { levels, height }) as Feature<Polygon, { levels: number | null; height: number }>);
    }
  }

  // Streets
  const streets: AreaData['streets'] = [];
  const seenS = new Set<string>();
  for (const f of q('transportation')) {
    const cls = String(f.properties?.class ?? 'minor');
    if (['rail', 'transit', 'ferry', 'aerialway', 'pier'].includes(cls)) continue;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const coords of lines) {
      if ((coords as number[][]).length < 2) continue;
      const ln = turf.lineString(coords as number[][]);
      if (!within(ln)) continue;
      const k = JSON.stringify((coords as number[][])[0]) + cls + (f.properties?.brunnel ?? '');
      if (seenS.has(k)) continue; seenS.add(k);
      const bridge = f.properties?.brunnel === 'bridge';
      streets.push(turf.lineString(coords as number[][], { name: '', width: CLASS_WIDTH[cls] ?? 5, cls, bridge, nh: cls === 'trunk' || cls === 'motorway', ref: '' }) as Feature<LineString, StreetProps>);
    }
  }
  // Names come from the separate transportation_name layer
  const names = q('transportation_name').filter((f) => (f.properties?.name || f.properties?.ref) && within(f as Feature));
  for (const s of streets) {
    let best: { d: number; name: string; ref: string } | null = null;
    for (const n of names) {
      const geom = n.geometry.type === 'LineString' ? n.geometry.coordinates : n.geometry.type === 'MultiLineString' ? n.geometry.coordinates[0] : null;
      if (!geom || geom.length < 2) continue;
      const d = turf.pointToLineDistance(turf.point(s.geometry.coordinates[0]), turf.lineString(geom), { units: 'meters' });
      if (d < 15 && (!best || d < best.d)) best = { d, name: String(n.properties.name ?? ''), ref: String(n.properties.ref ?? '') };
    }
    s.properties.name = best?.name || (best?.ref ? best.ref : `Unnamed ${s.properties.cls} street`);
    s.properties.ref = best?.ref ?? '';
    if (/^NH\s?\d/i.test(s.properties.ref) || /national highway/i.test(s.properties.name)) s.properties.nh = true;
  }

  // Drains and green
  const drains = q('waterway').filter((f) => ['drain', 'ditch', 'canal', 'stream'].includes(String(f.properties?.class)) && within(f as Feature))
    .flatMap((f) => (f.geometry.type === 'LineString' ? [turf.lineString(f.geometry.coordinates)] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates.map((c) => turf.lineString(c)) : [])) as Feature<LineString>[];
  const greens = [...q('park'), ...q('landcover').filter((f) => ['grass', 'wood', 'farmland'].includes(String(f.properties?.class)))]
    .flatMap((f) => (f.geometry.type === 'Polygon' ? [safePoly(f.geometry.coordinates)] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((c) => safePoly(c)) : []))
    .filter((p): p is NonNullable<typeof p> => !!p && within(p)) as Feature<Polygon>[];

  // Fire stations from POIs anywhere in loaded tiles
  const stations: AreaData['stations'] = q('poi')
    .filter((f) => f.properties?.subclass === 'fire_station' || f.properties?.class === 'fire_station')
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => turf.point((f.geometry as { coordinates: number[] }).coordinates, { name: String(f.properties?.name ?? 'Fire station') }));

  // Measurements
  const sum = (fs: Feature<Polygon>[]) => fs.reduce((a, f) => { try { const i = turf.intersect(turf.featureCollection([f, circle])); return a + (i ? turf.area(i) : 0); } catch { return a; } }, 0);
  const pick = studyStreet({ center, streets });
  const levels = buildings.map((b) => b.properties.levels).filter((x): x is number => x !== null);
  const sorted = [...levels].sort((a, b) => a - b);
  let nearest: { km: number; name: string } | null = null;
  for (const s of stations) { const km = turf.distance(cpt, s); if (!nearest || km < nearest.km) nearest = { km, name: s.properties.name }; }

  return {
    center, buildings, streets, drains, greens, stations,
    features: {
      radiusM: radius,
      narrowestWidthM: pick?.properties.width ?? 4,
      narrowestName: pick?.properties.name ?? 'Nearest street',
      widthSource: 'class-default',
      streetCount: streets.length,
      buildingCount: buildings.length,
      buildingCoverage: Math.min(1, sum(buildings) / circleArea),
      medianLevels: sorted.length >= 5 ? sorted[Math.floor(sorted.length / 2)] : null,
      levelsTaggedShare: buildings.length ? levels.length / buildings.length : 0,
      drainCount: drains.length,
      greenShare: Math.min(1, sum(greens) / circleArea),
      nearestFireStationKm: nearest?.km ?? null,
      nearestFireStationName: nearest?.name ?? null,
      ...gradeSeparation(streets),
    },
  };
}
