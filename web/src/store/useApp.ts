import { create } from 'zustand';
import type { City } from '../data/cities';
import { CITIES } from '../data/cities';
import type { AreaData } from '../services/overpass';
import { DEFAULT_BASELINE, type Levers, type Work } from '../model/model';
import { baselineFrom } from '../model/diagnose';

export type Lang = 'en' | 'hi';
export type Role = 'officer' | 'planner' | 'rwa';
export type Scenario = 'normal' | 'monsoon' | 'fire';
export type Mode = 'city' | 'study';

interface Toast { id: number; text: string }

interface AppState {
  lang: Lang; role: Role; mode: Mode;
  city: City;
  point: [number, number] | null;
  area: AreaData | null; areaStatus: 'idle' | 'loading' | 'error' | 'ready'; areaError?: string;
  baseline: Levers; works: Work[];
  view: 'today' | 'plan'; scenario: Scenario;
  proposalId: string | null;
  toasts: Toast[];
  set: (p: Partial<AppState>) => void;
  setArea: (a: AreaData) => void;
  addWork: (w: Work) => void;
  removeWork: (id: Work['id']) => void;
  toast: (text: string) => void;
}

let tid = 0;
export const useApp = create<AppState>((set, get) => ({
  lang: 'en', role: 'officer', mode: 'city',
  city: CITIES.find((c) => c.name === 'Chandni Chowk')!,
  point: null, area: null, areaStatus: 'idle',
  baseline: DEFAULT_BASELINE, works: [], view: 'today', scenario: 'normal', proposalId: null,
  toasts: [],
  set: (p) => set(p),
  setArea: (a) => set({ area: a, areaStatus: 'ready', baseline: baselineFrom(a.features), works: [], view: 'today', proposalId: null }),
  addWork: (w) => set({ works: get().works.filter((x) => x.id !== w.id).concat(w), view: 'plan' }),
  removeWork: (id) => set({ works: get().works.filter((x) => x.id !== id) }),
  toast: (text) => {
    const id = ++tid;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
}));
