// Building footprints + heights from Overture Maps (OSM + Google + Microsoft
// footprints merged; ODbL / CDLA). Much denser coverage of Indian cities than
// OSM alone. Streamed straight from Overture's public PMTiles (HTTP range reads).
import { addProtocol } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

export const OVERTURE_RELEASE = '2026-11-18.0';
export const OVERTURE_URL = `pmtiles://https://tiles.overturemaps.org/${OVERTURE_RELEASE}/buildings.pmtiles`;
export const OVERTURE_SRC = 'overture';
export const FLOOR_M = 3.2;

let registered = false;
/** True once Overture building tiles have actually loaded in this session. */
export const overture = { ok: false };
export function registerPmtiles() {
  if (registered) return; registered = true;
  addProtocol('pmtiles', new Protocol().tile);
}

const HEX = '0123456789abcdef';
/** Deterministic 0..1 from an Overture id, so untagged buildings get varied, stable heights. */
export const idRand = (id: unknown) => {
  const s = String(id ?? ''); let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
};

/** Height in metres + whether it is measured (height / floors) or estimated. */
export function heightOf(p: Record<string, unknown> | null | undefined): { h: number; levels: number | null } {
  const h = Number(p?.height), f = Number(p?.num_floors);
  if (h > 0) return { h, levels: f > 0 ? f : Math.max(1, Math.round(h / FLOOR_M)) };
  if (f > 0) return { h: f * FLOOR_M + 0.6, levels: f };
  // Typical Indian dense-core stock: G+1 to G+4
  const fl = 2 + Math.floor(Math.max(0, HEX.indexOf(String(p?.id ?? '').charAt(0).toLowerCase())) / 4);
  return { h: fl * FLOOR_M + 0.6, levels: null };
}

// MapLibre expression twin of heightOf (first hex char of the id spreads 2–5 floors).
const idFloors = ['+', 2, ['floor', ['/', ['max', 0, ['index-of', ['downcase', ['slice', ['to-string', ['get', 'id']], 0, 1]], HEX]], 4]]];
export const HEIGHT_EXPR = ['case',
  ['>', ['to-number', ['get', 'height'], 0], 0], ['to-number', ['get', 'height']],
  ['>', ['to-number', ['get', 'num_floors'], 0], 0], ['+', ['*', ['to-number', ['get', 'num_floors']], FLOOR_M], 0.6],
  ['+', ['*', idFloors, FLOOR_M], 0.6]];
export const BASE_EXPR = ['to-number', ['coalesce', ['get', 'min_height'], 0]];
