import { describe, expect, test } from 'vitest';
import * as M from './model';
import { baselineFrom, observe, suggest, type AreaFeatures } from './diagnose';

const B = M.DEFAULT_BASELINE;

describe('model', () => {
  test('baseline clear width is 2.4 m', () => expect(M.clearWidth(B)).toBeCloseTo(2.4));
  test('fire response extremes', () => {
    expect(M.fireResponse(B)).toBeCloseTo(18);
    expect(M.fireResponse({ ...B, width: 8, encroach: 0 })).toBeCloseTo(4);
  });
  test('vendor zone takes 1.5 m', () => expect(M.clearWidth({ ...B, width: 5, encroach: 0, vendor: true })).toBeCloseTo(3.5));
  test('flood index clamps', () => {
    expect(M.floodIndex(B)).toBeCloseTo(88.2);
    expect(M.floodIndex({ ...B, drain: true, pits: 10, green: 40 })).toBe(5);
  });
  test('structural safety', () => {
    expect(M.structuralSafety(B, true)).toBe(32);
    expect(M.structuralSafety({ ...B, floors: 4, retrofit: true })).toBe(96);
  });
  test('presets', () => {
    const J = M.applyWorks(M.PRESETS.jaipur, B);
    expect(J.vendor).toBe(true);
    expect(M.clearWidth(J)).toBeCloseTo(6.5);
    expect(M.screeningChecks(M.applyWorks(M.PRESETS.ahmedabad, B)).every((c) => c.pass)).toBe(true);
  });
  test('displacement relative to area baseline', () => {
    const base = { ...B, width: 6 };
    const d = M.displacement(M.applyWorks([{ id: 'widen', value: 10 }], base), base);
    expect(d.setback).toBeCloseTo(2);
  });
  test('cost band ±40%', () => {
    const c = M.cost(M.applyWorks([{ id: 'widen', value: 14 }], B), B);
    expect(c.lowCr).toBeCloseTo(c.totalCr * 0.6);
    expect(c.items.land).toBeGreaterThan(c.items.road);
  });
});

describe('diagnose', () => {
  const f: AreaFeatures = {
    radiusM: 250, narrowestWidthM: 3, narrowestName: 'Test Gali', widthSource: 'class-default', streetCount: 12,
    buildingCount: 140, buildingCoverage: 0.55, medianLevels: null, levelsTaggedShare: 0, drainCount: 0,
    greenShare: 0.02, nearestFireStationKm: 4.2, nearestFireStationName: 'Fire Stn',
  };
  test('baseline from features', () => {
    const L = baselineFrom(f);
    expect(L.width).toBe(3); expect(L.floors).toBe(5); expect(L.drain).toBe(false); expect(L.green).toBe(2);
  });
  test('observations flag the narrow lane and missing drain', () => {
    const obs = observe(f, baselineFrom(f));
    expect(obs.find((o) => o.key === 'clear')?.sev).toBe('fails');
    expect(obs.find((o) => o.key === 'drain')?.sev).toBe('fails');
  });
  test('suggestions are ranked and include clearing the lane', () => {
    const s = suggest(f, baselineFrom(f));
    expect(s.length).toBeGreaterThan(3);
    expect(s.map((x) => x.work.id)).toContain('clearEnc');
    expect(s[0].score).toBeGreaterThanOrEqual(s[s.length - 1].score);
  });
});
