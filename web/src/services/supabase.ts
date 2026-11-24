// Supabase client + data access. Works without Supabase too: every call falls
// back to localStorage so the demo never depends on the network.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Levers, Work } from '../model/model';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const backendLabel = supabase ? 'Supabase' : 'Local only';

const local = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private mode */ } },
};

// ---- area cache ---------------------------------------------------------
export async function getCachedArea(k: string): Promise<unknown | null> {
  const l = local.get(`area:${k}`);
  if (l) return l;
  if (!supabase) return null;
  const { data } = await supabase.from('area_cache').select('data').eq('key', k).maybeSingle();
  if (data?.data) local.set(`area:${k}`, data.data);
  return data?.data ?? null;
}
export async function putCachedArea(k: string, data: unknown) {
  local.set(`area:${k}`, data);
  if (supabase) await supabase.from('area_cache').upsert({ key: k, data });
}

// ---- proposals ----------------------------------------------------------
export interface Proposal {
  id?: string; city: string; place: string; lat: number; lng: number;
  baseline: Levers; works: Work[]; created_at?: string;
}

export async function saveProposal(p: Proposal): Promise<string> {
  if (supabase) {
    const { data, error } = await supabase.from('proposals').insert(p).select('id').single();
    if (!error && data) return data.id as string;
  }
  const id = 'local-' + Math.random().toString(36).slice(2, 10);
  local.set(`proposal:${id}`, { ...p, id, created_at: new Date().toISOString() });
  return id;
}

export async function loadProposal(id: string): Promise<Proposal | null> {
  if (id.startsWith('local-')) return local.get<Proposal>(`proposal:${id}`);
  if (!supabase) return null;
  const { data } = await supabase.from('proposals').select('*').eq('id', id).maybeSingle();
  return (data as Proposal) ?? null;
}

// ---- votes (residents) --------------------------------------------------
export async function castVote(proposalId: string, workId: string, vote: 1 | -1) {
  const k = `votes:${proposalId}`;
  const mine = local.get<Record<string, number>>(k) ?? {};
  mine[workId] = vote; local.set(k, mine);
  if (supabase && !proposalId.startsWith('local-')) await supabase.from('votes').insert({ proposal_id: proposalId, work_id: workId, vote });
}

export async function tally(proposalId: string): Promise<Record<string, { up: number; down: number }>> {
  const out: Record<string, { up: number; down: number }> = {};
  const bump = (w: string, v: number) => { out[w] ??= { up: 0, down: 0 }; v > 0 ? out[w].up++ : out[w].down++; };
  if (supabase && !proposalId.startsWith('local-')) {
    const { data } = await supabase.from('votes').select('work_id, vote').eq('proposal_id', proposalId);
    data?.forEach((r) => bump(r.work_id, r.vote));
  } else {
    Object.entries(local.get<Record<string, number>>(`votes:${proposalId}`) ?? {}).forEach(([w, v]) => bump(w, v));
  }
  return out;
}
