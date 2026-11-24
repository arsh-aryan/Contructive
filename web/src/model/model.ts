// Constructive — metric model. Pure functions only.
// Every number shown in the app or the DPR comes from here.
// All coefficients are PLACEHOLDERS: replace with the local schedule of rates
// and validate with a planner before any real use.

export interface Levers {
  width: number;      // right-of-way, m
  encroach: number;   // m of carriageway taken by stalls/ramps
  green: number;      // % green cover
  floors: number;     // typical building floors
  drain: boolean;     // covered drain
  pits: number;       // rainwater recharge pits
  vendor: boolean;    // designated 1.5 m vending zone
  brt: boolean;
  solar: boolean;
  shade: boolean;
  retrofit: boolean;
}

export const ASSUMPTIONS = {
  corridorLength: 120,
  plotsPerSide: 12,
  plotFrontage: 10,
  plotDepth: 12,
  baseStalls: 18,
  fireTenderClear: 3.5, // working assumption (2.5 m body + 1 m); verify vs NBC 2016 Part 4 & local bye-laws
  footpathMin: 1.8,
  lowRiseMaxFloors: 4,  // G+3
  greenMin: 15,
  rates: {
    land: 45000, road: 3500, footpath: 2500, drain: 9000, pit: 60000, tree: 5000,
    solarPerBuilding: 300000, shade: 8000, brt: 20000, vendorZone: 5000, rebuild: 22000,
  },
  rebuildShare: 0.35,
  costUncertainty: 0.4,
};
export type Assumptions = typeof ASSUMPTIONS;

export const DEFAULT_BASELINE: Levers = {
  width: 3, encroach: 0.6, green: 2, floors: 5, drain: false, pits: 0,
  vendor: false, brt: false, solar: false, shade: false, retrofit: false,
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clearWidth = (L: Levers) => Math.max(0, L.width - (L.vendor ? 1.5 : 0) - (L.encroach || 0));
export const footpathWidth = (L: Levers) => (L.width >= 7 ? 1.8 : 0);
export const fireResponse = (L: Levers) => 4 + 14 * clamp((5.5 - clearWidth(L)) / 3.1, 0, 1);
export const floodIndex = (L: Levers) => clamp(90 - 35 * +L.drain - 20 * +(L.pits > 0) - 0.9 * L.green, 5, 95);
export const floodDepth = (L: Levers) => (floodIndex(L) / 100) * 0.5;
export const heatExcess = (L: Levers) => clamp(6.5 - 0.12 * L.green - 0.7 * +L.shade - 0.3 * +L.solar, 0.5, 7);

export function structuralSafety(L: Levers, isBaseline = false) {
  if (isBaseline) return 32;
  const s = 96 - 7 * Math.max(0, L.floors - 4);
  return clamp(L.retrofit ? s : Math.min(s, 60), 30, 96);
}

export function walkability(L: Levers) {
  const fp = footpathWidth(L) >= 1.8 ? 35 : 0;
  const clear = clamp(clearWidth(L) / 5.5, 0, 1) * 25;
  return Math.round(clamp(fp + clear + (L.shade ? 15 : 0) + clamp(L.green, 0, 25), 0, 100));
}

export function displacement(L: Levers, base: Levers = DEFAULT_BASELINE, A: Assumptions = ASSUMPTIONS) {
  const setback = Math.max(0, (L.width - base.width) / 2);
  const plotsAffected = setback > 0 ? A.plotsPerSide * 2 : 0;
  const landTake = setback * 2 * A.corridorLength;
  const stallsRemoved = L.encroach < base.encroach ? A.baseStalls : 0;
  const stallsRelocated = L.vendor ? stallsRemoved : 0;
  return { setback, plotsAffected, landTake, stallsRemoved, stallsRelocated, stallsLost: stallsRemoved - stallsRelocated };
}

export const treeCount = (L: Levers, A: Assumptions = ASSUMPTIONS) => Math.round((A.corridorLength / 8) * (L.green / 15));

export function cost(L: Levers, base: Levers = DEFAULT_BASELINE, A: Assumptions = ASSUMPTIONS) {
  const r = A.rates, len = A.corridorLength;
  const d = displacement(L, base, A);
  const buildings = A.plotsPerSide * 2;
  const items: Record<string, number> = {
    land: d.landTake * r.land,
    road: L.width * len * r.road,
    footpath: footpathWidth(L) * 2 * len * r.footpath,
    drain: L.drain && !base.drain ? len * r.drain : 0,
    pits: Math.max(0, L.pits - base.pits) * r.pit,
    trees: Math.max(0, treeCount(L, A) - treeCount(base, A)) * r.tree,
    solar: L.solar ? buildings * r.solarPerBuilding : 0,
    shade: L.shade ? len * 1.8 * r.shade : 0,
    brt: L.brt ? len * r.brt : 0,
    vendor: L.vendor ? len * r.vendorZone : 0,
    rebuild: A.rebuildShare * buildings * A.plotFrontage * A.plotDepth * L.floors * r.rebuild,
  };
  const total = Object.values(items).reduce((a, b) => a + b, 0);
  const cr = (x: number) => x / 1e7;
  return {
    items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, cr(v)])) as Record<string, number>,
    totalCr: cr(total), lowCr: cr(total * (1 - A.costUncertainty)), highCr: cr(total * (1 + A.costUncertainty)),
  };
}

export type CheckId = 'fire' | 'footpath' | 'lowrise' | 'green' | 'drain' | 'recharge';
export interface Check { id: CheckId; pass: boolean; value: number; need: number; unit: string }

export function screeningChecks(L: Levers, A: Assumptions = ASSUMPTIONS): Check[] {
  return [
    { id: 'fire', pass: clearWidth(L) >= A.fireTenderClear, value: clearWidth(L), need: A.fireTenderClear, unit: 'm' },
    { id: 'footpath', pass: footpathWidth(L) >= A.footpathMin, value: footpathWidth(L), need: A.footpathMin, unit: 'm' },
    { id: 'lowrise', pass: L.floors <= A.lowRiseMaxFloors, value: L.floors, need: A.lowRiseMaxFloors, unit: 'floors' },
    { id: 'green', pass: L.green >= A.greenMin, value: L.green, need: A.greenMin, unit: '%' },
    { id: 'drain', pass: L.drain, value: +L.drain, need: 1, unit: '' },
    { id: 'recharge', pass: L.pits > 0, value: L.pits, need: 1, unit: 'pits' },
  ];
}

export function metrics(L: Levers, base: Levers, isBaseline = false) {
  return {
    clear: clearWidth(L), fire: fireResponse(L), flood: floodIndex(L), heat: heatExcess(L),
    safety: structuralSafety(L, isBaseline), walk: walkability(L),
    displacement: displacement(L, base), cost: cost(L, base), checks: screeningChecks(L),
  };
}
export type Metrics = ReturnType<typeof metrics>;

// ---- Proposed works -------------------------------------------------------
export type WorkId = 'widen' | 'clearEnc' | 'drain' | 'pits' | 'heightCap' | 'retrofit' | 'trees' | 'shade' | 'vendor' | 'solar' | 'brt';
export type WorkGroup = 'roads' | 'drainage' | 'buildings' | 'public' | 'energy';
export interface Work { id: WorkId; value?: number }
interface WorkDef { group: WorkGroup; apply: (L: Levers, v?: number) => Levers; options?: number[]; unit?: string }

export const WORKS: Record<WorkId, WorkDef> = {
  widen:     { group: 'roads', apply: (L, v = L.width) => ({ ...L, width: Math.max(L.width, v) }), options: [4, 5, 6, 7, 8, 9, 10, 12, 14], unit: 'm' },
  clearEnc:  { group: 'roads', apply: (L) => ({ ...L, encroach: 0 }) },
  drain:     { group: 'drainage', apply: (L) => ({ ...L, drain: true }), options: [450, 600, 900], unit: 'mm' },
  pits:      { group: 'drainage', apply: (L, v = 10) => ({ ...L, pits: Math.max(L.pits, v) }), options: [10, 20, 40] },
  heightCap: { group: 'buildings', apply: (L, v = L.floors) => ({ ...L, floors: Math.min(L.floors, v) }), options: [3, 4, 5, 6, 8], unit: 'floors' },
  retrofit:  { group: 'buildings', apply: (L) => ({ ...L, retrofit: true }) },
  trees:     { group: 'public', apply: (L, v = L.green) => ({ ...L, green: Math.max(L.green, v) }), options: [10, 12, 15, 22, 30, 40], unit: '%' },
  shade:     { group: 'public', apply: (L) => ({ ...L, shade: true }) },
  vendor:    { group: 'public', apply: (L) => ({ ...L, vendor: true }) },
  solar:     { group: 'energy', apply: (L) => ({ ...L, solar: true }) },
  brt:       { group: 'energy', apply: (L) => ({ ...L, brt: true }) },
};

export const applyWorks = (works: Work[], base: Levers) =>
  works.reduce<Levers>((L, w) => (WORKS[w.id] ? WORKS[w.id].apply(L, w.value) : L), { ...base });

export const PRESETS: Record<'chandigarh' | 'jaipur' | 'ahmedabad', Work[]> = {
  chandigarh: [{ id: 'widen', value: 12 }, { id: 'clearEnc' }, { id: 'trees', value: 22 }, { id: 'heightCap', value: 3 }, { id: 'retrofit' }, { id: 'drain', value: 600 }],
  jaipur: [{ id: 'widen', value: 8 }, { id: 'clearEnc' }, { id: 'trees', value: 12 }, { id: 'heightCap', value: 4 }, { id: 'retrofit' }, { id: 'drain', value: 600 }, { id: 'vendor' }, { id: 'shade' }],
  ahmedabad: [{ id: 'widen', value: 10 }, { id: 'clearEnc' }, { id: 'trees', value: 15 }, { id: 'heightCap', value: 4 }, { id: 'retrofit' }, { id: 'drain', value: 600 }, { id: 'pits', value: 20 }, { id: 'brt' }, { id: 'solar' }],
};
