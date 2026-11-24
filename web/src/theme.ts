// Theme: Pantone-style navy with crimson accents, light and dark.
// UI colours live in CSS variables (index.css); this file holds the colours
// that canvas renderers (map, deck.gl, three.js) need as numbers.
import { useEffect } from 'react';
import { useApp } from './store/useApp';

export type ThemePref = 'light' | 'dark' | 'system';
export type ThemeName = 'light' | 'dark';

type RGB = [number, number, number];
export interface Palette {
  name: ThemeName;
  mapStyle: string;
  buildingRamp: [string, string, string];
  sky: { sky: string; horizon: string; fog: string };
  narrow: RGB; tight: RGB; clear: RGB; drain: RGB; station: RGB; scan: RGB; flyover: RGB; nh: RGB;
  bldLow: RGB; bldHigh: RGB; bldEdge: [number, number, number, number];
  scene: {
    bg: string; ground: string; disc: string; street: string; laneToday: string; lanePlan: string; row: string;
    bld: string; bldEst: string; bldChanged: string; cut: string; cap: string; ring: string; drainOpen: string; drainSlab: string;
    flyover: string; pillar: string; nh: string; hemiSky: string; hemiGround: string; hemi: number; sun: number;
  };
}

export const PALETTES: Record<ThemeName, Palette> = {
  light: {
    name: 'light',
    mapStyle: 'https://tiles.openfreemap.org/styles/positron',
    buildingRamp: ['#efe9da', '#e4ddca', '#d6cdb5'],
    sky: { sky: '#f3eee2', horizon: '#f6f2e7', fog: '#f6f2e7' },
    narrow: [229, 18, 63], tight: [217, 138, 0], clear: [110, 160, 0], drain: [47, 91, 234], station: [229, 18, 63], scan: [14, 14, 22],
    flyover: [120, 116, 140], nh: [229, 18, 63],
    bldLow: [248, 244, 233], bldHigh: [47, 91, 234], bldEdge: [14, 14, 22, 55],
    scene: {
      bg: '#f6f2e7', ground: '#ebe5d6', disc: '#efe9dc', street: '#d8d0bc', laneToday: '#f6b3c1', lanePlan: '#d9f08a', row: '#ecf7c4',
      bld: '#fffdf7', bldEst: '#f3eee2', bldChanged: '#e3f5a8', cut: '#e5123f', cap: '#d98a00', ring: '#0e0e16', drainOpen: '#2a2a36', drainSlab: '#a39d8c',
      flyover: '#b9b3a3', pillar: '#cbc4b2', nh: '#efe1e4', hemiSky: '#ffffff', hemiGround: '#e0d8c4', hemi: 1.35, sun: 2.4,
    },
  },
  dark: {
    name: 'dark',
    mapStyle: 'https://tiles.openfreemap.org/styles/dark',
    buildingRamp: ['#1c1c2b', '#25253a', '#30304b'],
    sky: { sky: '#0b0b14', horizon: '#1a1a2c', fog: '#0b0b14' },
    narrow: [255, 59, 92], tight: [255, 181, 71], clear: [200, 240, 60], drain: [91, 140, 255], station: [255, 59, 92], scan: [200, 240, 60],
    flyover: [150, 148, 180], nh: [255, 59, 92],
    bldLow: [40, 40, 62], bldHigh: [91, 140, 255], bldEdge: [244, 241, 232, 40],
    scene: {
      bg: '#0b0b14', ground: '#12121d', disc: '#161624', street: '#2a2a3d', laneToday: '#6a1f31', lanePlan: '#4d5f16', row: '#2f3a12',
      bld: '#d9d6cc', bldEst: '#b5b2a8', bldChanged: '#d8f27a', cut: '#ff3b5c', cap: '#ffb547', ring: '#c8f03c', drainOpen: '#05050a', drainSlab: '#6d6b7c',
      flyover: '#4a4a62', pillar: '#3d3d52', nh: '#2e2236', hemiSky: '#b8b4d6', hemiGround: '#0b0b14', hemi: 0.8, sun: 1.6,
    },
  },
};

export function resolveTheme(pref: ThemePref): ThemeName {
  if (pref !== 'system') return pref;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const usePalette = () => PALETTES[useApp((s) => s.theme)];

/** Keeps <html data-theme> in sync with the preference (and the OS for 'system'). */
export function useThemeSync() {
  const pref = useApp((s) => s.themePref);
  const set = useApp((s) => s.set);
  useEffect(() => {
    const apply = () => {
      const name = resolveTheme(pref);
      document.documentElement.dataset.theme = name;
      set({ theme: name });
    };
    apply();
    try { localStorage.setItem('constructive:theme', pref); } catch { /* private mode */ }
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref, set]);
}

export function initialThemePref(): ThemePref {
  try { const v = localStorage.getItem('constructive:theme'); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch { /* */ }
  return 'system';
}
