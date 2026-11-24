import { describe, expect, test } from 'vitest';
import * as M from './model';

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
