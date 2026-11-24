import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from './model.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('baseline clear width is 2.4 m', () => near(M.clearWidth(M.BASELINE), 2.4));

test('fire response: baseline worst case, wide lane best case', () => {
  near(M.fireResponse(M.BASELINE), 18);
  near(M.fireResponse({ ...M.BASELINE, width: 8, encroach: 0 }), 4);
});

test('vendor zone takes 1.5 m of clear width', () => {
  const L = { ...M.BASELINE, width: 5, encroach: 0, vendor: true };
  near(M.clearWidth(L), 3.5);
});

test('flood index clamps and responds to drain, pits, green', () => {
  near(M.floodIndex(M.BASELINE), 88.2);
  near(M.floodIndex({ ...M.BASELINE, drain: true, pits: 10, green: 40 }), 5);
});

test('heat excess clamps', () => {
  near(M.heatExcess({ ...M.BASELINE, green: 40, shade: true, solar: true }), 0.7);
  near(M.heatExcess({ ...M.BASELINE, green: 100, shade: true, solar: true }), 0.5);
});

test('structural safety: baseline fixed, retrofit + low-rise is high', () => {
  assert.equal(M.structuralSafety(M.BASELINE, true), 32);
  assert.equal(M.structuralSafety({ ...M.BASELINE, floors: 4, retrofit: true }), 96);
  assert.equal(M.structuralSafety({ ...M.BASELINE, floors: 8, retrofit: true }), 68);
});

test('works apply on top of baseline; presets produce expected levers', () => {
  const L = M.applyWorks(M.PRESETS.chandigarh);
  assert.equal(L.width, 12); assert.equal(L.green, 22); assert.equal(L.floors, 3); assert.equal(L.drain, true);
  const J = M.applyWorks(M.PRESETS.jaipur);
  assert.equal(J.vendor, true); near(M.clearWidth(J), 6.5);
});

test('displacement: widening takes land; vendor zone relocates stalls', () => {
  const d = M.displacement(M.applyWorks([{ id: 'widen', value: 7 }, { id: 'clearEnc' }]));
  near(d.setback, 2); assert.equal(d.stallsLost, 18);
  const d2 = M.displacement(M.applyWorks([{ id: 'clearEnc' }, { id: 'vendor' }]));
  assert.equal(d2.stallsRelocated, 18); assert.equal(d2.stallsLost, 0);
});

test('cost is positive with +/-40% band, and land dominates big widening', () => {
  const c = M.cost(M.applyWorks([{ id: 'widen', value: 14 }]));
  assert.ok(c.totalCr > 0);
  near(c.lowCr, c.totalCr * 0.6); near(c.highCr, c.totalCr * 1.4);
  assert.ok(c.items.land > c.items.road);
});

test('screening checks', () => {
  const base = M.screeningChecks(M.BASELINE);
  assert.ok(base.every((c) => !c.pass));
  const plan = M.screeningChecks(M.applyWorks(M.PRESETS.ahmedabad));
  assert.ok(plan.every((c) => c.pass));
});
