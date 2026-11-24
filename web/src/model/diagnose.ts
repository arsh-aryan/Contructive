// Turns measured area features (from OSM) into a baseline, sourced observations
// and a ranked list of suggested works. Rule-based and transparent: every rule
// is written here, nothing is "AI".
import { ASSUMPTIONS as A, DEFAULT_BASELINE, applyWorks, metrics, type Levers, type Work } from './model';

export interface AreaFeatures {
  radiusM: number;
  narrowestWidthM: number;       // narrowest street near the point
  narrowestName: string;
  widthSource: 'tagged' | 'class-default' | 'footprint-gap';
  streetCount: number;
  buildingCount: number;
  buildingCoverage: number;      // 0..1 of the circle
  medianLevels: number | null;   // from building:levels
  levelsTaggedShare: number;     // 0..1
  drainCount: number;
  greenShare: number;            // 0..1 park/garden/forest area
  nearestFireStationKm: number | null;
  nearestFireStationName: string | null;
  flyoverM?: number;            // length of elevated carriageway (bridges) in the area
  flyoverNames?: string[];
  nhRefs?: string[];            // national highways (NH refs / trunk roads) in the area
  nhM?: number;
}

export type Severity = 'fails' | 'marginal' | 'ok';
export interface Observation { key: string; where: string; text: string; sev: Severity; source: string; verified: boolean }

export function baselineFrom(f: AreaFeatures): Levers {
  const width = Math.max(2.5, Math.round(f.narrowestWidthM * 2) / 2);
  return {
    ...DEFAULT_BASELINE,
    width,
    encroach: width < 8 ? 0.6 : 0.3,
    green: Math.round(Math.min(40, f.greenShare * 100)),
    floors: Math.round(f.medianLevels ?? (f.buildingCoverage > 0.45 ? 5 : 3)),
    drain: f.drainCount > 0,
    pits: 0,
  };
}

export function observe(f: AreaFeatures, L: Levers): Observation[] {
  const m = metrics(L, L, true);
  const out: Observation[] = [];
  const src = { tagged: 'OSM width tag', 'class-default': 'Estimated from road class', 'footprint-gap': 'Measured between footprints' }[f.widthSource];
  out.push({
    key: 'clear', where: f.narrowestName,
    text: `Narrowest street ≈ ${L.width} m, clear ≈ ${m.clear.toFixed(1)} m after encroachment. ${m.clear < A.fireTenderClear ? `Below the ${A.fireTenderClear} m fire-tender assumption.` : 'Fire tender can pass.'}`,
    sev: m.clear < A.fireTenderClear ? 'fails' : m.clear < 5 ? 'marginal' : 'ok', source: src, verified: f.widthSource === 'tagged',
  });
  if (f.nearestFireStationKm !== null) {
    const km = f.nearestFireStationKm;
    out.push({
      key: 'station', where: f.nearestFireStationName ?? 'Nearest fire station',
      text: `Nearest mapped fire station ${km.toFixed(1)} km away (straight line).`,
      sev: km > 5 ? 'fails' : km > 3 ? 'marginal' : 'ok', source: 'OSM', verified: false,
    });
  } else {
    out.push({ key: 'station', where: `Within 8 km`, text: 'No fire station mapped nearby in OSM. Verify with the fire department.', sev: 'marginal', source: 'OSM', verified: false });
  }
  if (f.flyoverM && f.flyoverM > 20) {
    out.push({
      key: 'flyover', where: f.flyoverNames?.length ? f.flyoverNames.join(', ') : 'Flyover',
      text: `${f.flyoverM} m of elevated carriageway (flyover/bridge) in the area. Not widened by these works; ground-level road, drains and vending below it are treated separately. Check headroom for a fire tender (assumed ≥ 4.5 m).`,
      sev: 'marginal', source: 'OSM (bridge)', verified: false,
    });
  }
  if (f.nhRefs?.length || (f.nhM && f.nhM > 30)) {
    out.push({
      key: 'nh', where: f.nhRefs?.length ? f.nhRefs.join(', ') : 'National highway',
      text: `National highway / trunk road passes through (${f.nhM ?? 0} m). It is under NHAI / MoRTH, not the municipality: widening, BRT or encroachment drives on it need their approval. Proposed works here apply to municipal streets only.`,
      sev: 'marginal', source: 'OSM (ref / road class)', verified: false,
    });
  }
  out.push({
    key: 'drain', where: `${f.radiusM} m radius`,
    text: f.drainCount ? `${f.drainCount} drain segment(s) mapped; condition unknown.` : 'No storm-water drain mapped. Likely open or missing; waterlogging risk.',
    sev: f.drainCount ? 'marginal' : 'fails', source: 'OSM', verified: false,
  });
  out.push({
    key: 'density', where: `${f.buildingCount} buildings`,
    text: `Ground coverage ≈ ${Math.round(f.buildingCoverage * 100)}%. Typical height ${L.floors} floors${f.medianLevels === null ? ' (estimated — no height tags)' : ` (${Math.round(f.levelsTaggedShare * 100)}% tagged)`}.`,
    sev: L.floors > A.lowRiseMaxFloors && f.buildingCoverage > 0.4 ? 'fails' : f.buildingCoverage > 0.4 ? 'marginal' : 'ok',
    source: f.medianLevels === null ? 'Auto — verify' : 'OSM', verified: false,
  });
  out.push({
    key: 'green', where: `${f.radiusM} m radius`,
    text: `Green cover ≈ ${L.green}%. Heat-island excess ≈ ${m.heat.toFixed(1)} °C.`,
    sev: L.green < A.greenMin / 2 ? 'fails' : L.green < A.greenMin ? 'marginal' : 'ok', source: 'OSM', verified: false,
  });
  return out;
}

export interface Suggestion { work: Work; why: string; gain: string; score: number }

export function suggest(f: AreaFeatures, base: Levers): Suggestion[] {
  const m0 = metrics(base, base, true);
  const s: Suggestion[] = [];
  const add = (work: Work, why: string) => {
    const m1 = metrics(applyWorks([work], base), base);
    const gains: string[] = [];
    if (m1.fire < m0.fire - 0.05) gains.push(`fire ${m0.fire.toFixed(0)}→${m1.fire.toFixed(0)} min`);
    if (m1.flood < m0.flood - 0.5) gains.push(`waterlogging ${m0.flood.toFixed(0)}→${m1.flood.toFixed(0)}`);
    if (m1.heat < m0.heat - 0.05) gains.push(`heat −${(m0.heat - m1.heat).toFixed(1)} °C`);
    if (m1.walk > m0.walk) gains.push(`walkability +${m1.walk - m0.walk}`);
    const score = (m0.fire - m1.fire) * 4 + (m0.flood - m1.flood) * 0.6 + (m0.heat - m1.heat) * 5 + (m1.walk - m0.walk) * 0.3 - m1.cost.totalCr * 0.05;
    s.push({ work, why, gain: gains.join(' · ') || 'screening check', score });
  };
  if (m0.clear < A.fireTenderClear) {
    add({ id: 'clearEnc' }, 'Clear width is below the fire-tender assumption.');
    if (base.width - 0 < A.fireTenderClear + 0.5) add({ id: 'widen', value: Math.min(14, Math.ceil(A.fireTenderClear + 1.5)) }, 'Even without stalls the lane is too narrow.');
  }
  if (!base.drain) add({ id: 'drain', value: 600 }, 'No covered drain mapped.');
  add({ id: 'pits', value: 20 }, 'Recharge reduces runoff and refills groundwater.');
  if (base.green < A.greenMin) add({ id: 'trees', value: A.greenMin }, `Green cover below ${A.greenMin}%.`);
  if (base.floors > A.lowRiseMaxFloors) add({ id: 'heightCap', value: A.lowRiseMaxFloors }, 'Tall, dense blocks on narrow streets.');
  add({ id: 'retrofit' }, 'Unknown structural condition in an old fabric.');
  if (base.width >= 7) add({ id: 'shade' }, 'Room for a shaded walkway.');
  if (base.encroach > 0) add({ id: 'vendor' }, 'Keep livelihoods: relocate stalls into a marked zone.');
  if (base.width >= 10 && f.streetCount > 6) add({ id: 'brt' }, 'Wide corridor in a dense network.');
  add({ id: 'solar' }, 'Rooftops available for solar.');
  return s.sort((a, b) => b.score - a.score);
}
