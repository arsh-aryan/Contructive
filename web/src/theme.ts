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
    buildingRamp: ['#e9ecf2', '#dde2eb', '#cdd4e0'],
    sky: { sky: '#eef1f6', horizon: '#f4f5f8', fog: '#f4f5f8' },
    narrow: [176, 20, 60], tight: [190, 128, 32], clear: [27, 42, 74], drain: [44, 110, 170], station: [176, 20, 60], scan: [27, 42, 74],
    flyover: [96, 108, 140], nh: [176, 20, 60],
    bldLow: [236, 239, 245], bldHigh: [150, 165, 195], bldEdge: [27, 42, 74, 50],
    scene: {
      bg: '#f4f5f8', ground: '#e6e9ef', disc: '#eceff4', street: '#cfd5df', laneToday: '#ecb6c3', lanePlan: '#b9c6e2', row: '#cdd8ee',
      bld: '#fbfcfe', bldEst: '#f1f3f7', bldChanged: '#dbe4f5', cut: '#b0143c', cap: '#be8020', ring: '#1b2a4a', drainOpen: '#3e4656', drainSlab: '#9aa3b2',
      flyover: '#aeb6c6', pillar: '#c3c9d4', nh: '#e4e0ea', hemiSky: '#ffffff', hemiGround: '#d6dbe4', hemi: 1.3, sun: 2.4,
    },
  },
  dark: {
    name: 'dark',
    mapStyle: 'https://tiles.openfreemap.org/styles/dark',
    buildingRamp: ['#1c2740', '#24314f', '#2f3f63'],
    sky: { sky: '#0b1220', horizon: '#16213a', fog: '#0b1220' },
    narrow: [232, 72, 108], tight: [232, 170, 70], clear: [140, 168, 232], drain: [90, 160, 230], station: [232, 72, 108], scan: [140, 168, 232],
    flyover: [150, 162, 196], nh: [232, 72, 108],
    bldLow: [40, 54, 86], bldHigh: [120, 140, 190], bldEdge: [200, 210, 235, 40],
    scene: {
      bg: '#0b1220', ground: '#111a2c', disc: '#131d31', street: '#2a3654', laneToday: '#6b2438', lanePlan: '#30487f', row: '#253a66',
      bld: '#c9d0de', bldEst: '#a9b2c4', bldChanged: '#9fb4e0', cut: '#e8486c', cap: '#e8aa46', ring: '#8ca8e8', drainOpen: '#06090f', drainSlab: '#6c7488',
      flyover: '#59647e', pillar: '#4a5470', nh: '#33304a', hemiSky: '#9fb0d6', hemiGround: '#0b1220', hemi: 0.75, sun: 1.6,
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
