import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { useApp } from '../store/useApp';
import { useT } from '../i18n/strings';
import { observe, suggest } from '../model/diagnose';
import { LottieIcon, Pill, Section, workLabel } from './ui';
import { loaderAnim } from '../anim/anims';

export default function AreaPanel() {
  const T = useT();
  const { area, areaStatus, baseline, works, addWork, removeWork, set, toast } = useApp();

  const obs = useMemo(() => (area ? observe(area.features, baseline) : []), [area, baseline]);
  const sugg = useMemo(() => (area ? suggest(area.features, baseline) : []), [area, baseline]);
  const chosen = new Set(works.map((w) => w.id));

  return (
    <AnimatePresence mode="wait">
      {areaStatus === 'idle' && (
        <motion.div key="hint" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          className="glass z-20 absolute left-1/2 -translate-x-1/2 bottom-8 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl">
          <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" /></span>
          {T.pickHint}
        </motion.div>
      )}
      {areaStatus === 'loading' && (
        <motion.div key="load" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
          className="glass z-20 absolute right-4 top-4 w-[380px] rounded-2xl p-6 flex flex-col items-center gap-2 shadow-2xl">
          <LottieIcon data={loaderAnim()} className="w-24 h-24" />
          <div className="text-muted">{T.analysing}</div>
        </motion.div>
      )}
      {areaStatus === 'ready' && area && (
        <motion.aside key="panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          className="glass z-20 absolute right-4 top-4 bottom-4 w-[400px] max-w-[calc(100%-2rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-line">
            <div className="lbl">{area.features.buildingCount} buildings · {area.features.streetCount} street segments · 250 m</div>
            <div className="text-[17px] font-semibold mt-1 truncate">{area.features.narrowestName}</div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pt-1 bg-panel/40">
            <Section title={T.observations}>
              {obs.map((o, i) => (
                <motion.div key={o.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`relative bg-card border border-line rounded-lg p-3 pl-4 mb-2 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded ${o.sev === 'fails' ? 'before:bg-fail' : o.sev === 'marginal' ? 'before:bg-warn' : 'before:bg-ok'}`}>
                  <div className="flex justify-between gap-2 text-[11px] text-muted"><span className="truncate">{o.where}</span><Pill sev={o.sev}>{T.sev[o.sev]}</Pill></div>
                  <p className="my-1.5 leading-relaxed">{o.text}</p>
                  <div className="text-[11px] text-faint flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${o.verified ? 'bg-ok' : 'bg-faint'}`} />{o.source} · {o.verified ? T.verified : T.unverified}</div>
                </motion.div>
              ))}
            </Section>
            <Section title={T.solutions} aside={
              <select className="sel !py-1 !text-[11px] normal-case tracking-normal" value="" onChange={(e) => {
                const n = +e.target.value; if (!n) return;
                sugg.slice(0, n).forEach((s) => addWork(s.work)); toast(`${T.applied}: ${n}`);
              }}>
                <option value="">{T.addAll}…</option><option value="3">Top 3</option><option value="5">Top 5</option><option value="99">All</option>
              </select>}>
              {sugg.map((s, i) => {
                const on = chosen.has(s.work.id);
                return (
                  <motion.label key={s.work.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
                    className={`flex gap-3 items-start p-3 mb-2 rounded-lg border cursor-pointer transition-colors ${on ? 'border-accent/60 bg-accent/8' : 'border-line bg-card hover:border-[#3c494d]'}`}>
                    <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={on}
                      onChange={() => { on ? removeWork(s.work.id) : addWork(s.work); toast(`${on ? T.removed : T.added}: ${workLabel(T, s.work)}`); }} />
                    <span className="flex-1">
                      <span className="block font-medium">{workLabel(T, s.work)}</span>
                      <span className="block text-[11px] text-muted mt-0.5">{s.why}</span>
                      <span className="block text-[11px] text-accent mt-1 tnum">{s.gain}</span>
                    </span>
                  </motion.label>
                );
              })}
            </Section>
          </div>
          <div className="p-4 border-t border-line">
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => set({ mode: 'study' })}
              className="w-full rounded-xl py-3 font-semibold text-[#06201f] bg-gradient-to-r from-accent to-[#7ee8d9] shadow-[0_8px_30px_rgba(45,212,191,.25)]">
              {T.openStudy} →
            </motion.button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
