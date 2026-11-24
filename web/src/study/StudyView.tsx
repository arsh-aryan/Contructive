import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { useApp, type Scenario } from '../store/useApp';
import { useT } from '../i18n/strings';
import { ASSUMPTIONS, PRESETS, WORKS, applyWorks, metrics, type WorkId, type WorkGroup } from '../model/model';
import { observe } from '../model/diagnose';
import { Field, LottieIcon, Num, Pill, Section, workLabel } from '../components/ui';
import { sirenAnim, okAnim, rainAnim } from '../anim/anims';
import { exportDpr } from '../services/dpr';
import { saveProposal } from '../services/supabase';
import StudyScene from './StudyScene';
import { buildStudy } from './geometry';

const SIREN = sirenAnim(), OK = okAnim(), RAIN = rainAnim();

const METRIC_DEFS: [key: 'fire' | 'flood' | 'heat' | 'safety' | 'walk', unit: string, d: number, max: number, lowerBetter: boolean][] = [
  ['fire', 'min', 1, 18, true], ['flood', '/100', 0, 100, true], ['heat', '°C', 1, 7, true], ['safety', '/100', 0, 100, false], ['walk', '/100', 0, 100, false],
];

export default function StudyView() {
  const T = useT();
  const s = useApp();
  const { baseline, works, view, scenario, area, city } = s;
  const plan = useMemo(() => applyWorks(works, baseline), [works, baseline]);
  const mb = useMemo(() => metrics(baseline, baseline, true), [baseline]);
  const mp = useMemo(() => metrics(plan, baseline), [plan, baseline]);
  const shownL = view === 'today' ? baseline : plan;
  const shown = view === 'today' ? mb : mp;
  const geom = useMemo(() => (area ? buildStudy(area, baseline, plan, view === 'plan') : null), [area, baseline, plan, view]);
  const geomPlan = useMemo(() => (area ? buildStudy(area, baseline, plan, true) : null), [area, baseline, plan]);
  const place = geom?.laneName ?? area?.features.narrowestName ?? 'Representative lane';

  const groups = useMemo(() => {
    const g: Partial<Record<WorkGroup, { value: string; label: string }[]>> = {};
    (Object.keys(WORKS) as WorkId[]).forEach((id) => {
      const def = WORKS[id];
      const items = def.options ? def.options.map((v) => ({ value: `${id}:${v}`, label: workLabel(T, { id, value: v }) })) : [{ value: id, label: workLabel(T, { id }) }];
      (g[def.group] ??= []).push(...items);
    });
    return g;
  }, [T]);

  const blocked = shown.clear < ASSUMPTIONS.fireTenderClear;
  const status = scenario === 'fire'
    ? { anim: blocked ? SIREN : OK, title: blocked ? T.blocked : T.through, sub: `${T.metrics.fire} ${shown.fire.toFixed(1)} min · clear ${shown.clear.toFixed(1)} m`, bad: blocked, key: 'f' + blocked }
    : scenario === 'monsoon'
      ? { anim: RAIN, title: `~${(shown.flood / 2).toFixed(0)} cm`, sub: `${T.metrics.flood} ${shown.flood.toFixed(0)} / 100`, bad: shown.flood > 50, key: 'm' }
      : null;

  const share = async () => {
    const id = await saveProposal({ city: city.name, place, lat: area?.center[1] ?? city.lat, lng: area?.center[0] ?? city.lng, baseline, works });
    s.set({ proposalId: id });
    const link = `${location.origin}${location.pathname}#/p/${id}`;
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked */ }
    s.toast(`${T.saved}`);
  };

  return (
    <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="relative min-h-[50vh]">
        <StudyScene L={shownL} isPlan={view === 'plan'} scenario={scenario} geom={geom} labels={{ call: `${T.scenarios.fire} · Ch. 60`, blocked: T.blocked, through: T.through }} />
        <div className="glass absolute top-4 left-4 rounded-xl p-3 flex gap-3 flex-wrap">
          <Field label={T.state}>
            <select className="sel" value={view} onChange={(e) => s.set({ view: e.target.value as 'today' | 'plan' })}>
              <option value="today">{T.today}</option><option value="plan">{T.plan}</option>
            </select>
          </Field>
          <Field label={T.scenario}>
            <select className="sel" value={scenario} onChange={(e) => s.set({ scenario: e.target.value as Scenario })}>
              {Object.entries(T.scenarios).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="absolute top-4 right-4 text-[11px] text-muted glass rounded-lg px-3 py-2 max-w-[320px] leading-relaxed">
          {geom ? <>{T.realArea} <b className="text-ink">{place}</b>, {city.name}<br /><span className="text-faint">{area!.features.buildingCount} {T.realFootprints}</span></> : <>{T.representative} <b className="text-ink">{place}</b></>}
          {geom && view === 'plan' && <div className="mt-1.5 grid gap-1">
            <span className="flex items-center gap-2"><i className="w-3 h-2 rounded-sm bg-fail/60" />{T.legendCut}</span>
            <span className="flex items-center gap-2"><i className="w-3 h-2 rounded-sm bg-warn/50" />{T.legendCap}</span>
            <span className="flex items-center gap-2"><i className="w-3 h-2 rounded-sm bg-accent/70" />{T.legendRow}</span>
          </div>}
        </div>
        <AnimatePresence>
          {status && (
            <motion.div key={status.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className={`glass absolute left-4 bottom-4 rounded-xl pl-2 pr-4 py-2 flex items-center gap-3 border ${status.bad ? 'border-fail/40' : 'border-ok/40'}`}>
              <LottieIcon data={status.anim} className="w-10 h-10" />
              <div><div className={`display text-[18px] ${status.bad ? 'text-fail' : 'text-ok'}`}>{status.title}</div><div className="text-[11px] text-muted tnum">{status.sub}</div></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className="bg-panel border-l border-line overflow-y-auto px-5 pb-40">
        <Section title={T.works} aside={<span className="text-accent-text">{works.length || ''}</span>}>
          <div className="grid gap-2 mb-3">
            <select className="sel w-full" value="" onChange={(e) => {
              if (!e.target.value) return; const [id, v] = e.target.value.split(':');
              const w = { id: id as WorkId, value: v === undefined ? undefined : +v }; s.addWork(w); s.toast(`${T.added}: ${workLabel(T, w)}`);
            }}>
              <option value="">{T.addWork}</option>
              {(Object.keys(groups) as WorkGroup[]).map((g) => <optgroup key={g} label={T.groups[g]}>{groups[g]!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>)}
            </select>
            <select className="sel w-full" value="" onChange={(e) => {
              const k = e.target.value as keyof typeof PRESETS; if (!k) return;
              s.set({ works: PRESETS[k].map((w) => ({ ...w })), view: 'plan' }); s.toast(`${T.applied}: ${T.presets[k]}`);
            }}>
              <option value="">{T.streetType}</option>
              {Object.entries(T.presets).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {!works.length && <div className="text-muted text-center border border-dashed border-line rounded-lg p-4 leading-relaxed">{T.noWorks}</div>}
          <AnimatePresence initial={false}>
            {works.map((w, i) => (
              <motion.div key={w.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                className="flex items-center gap-3 bg-card border border-line rounded-lg px-3 py-2.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-accent/15 text-accent-text text-[11px] grid place-items-center font-semibold">{i + 1}</span>
                <span className="flex-1"><span className="block lbl !text-[9px]">{T.groups[WORKS[w.id].group]}</span>{workLabel(T, w)}</span>
                <button aria-label="remove" className="text-faint hover:text-fail hover:bg-fail/10 rounded px-1.5 text-lg leading-none" onClick={() => { s.removeWork(w.id); s.toast(`${T.removed}: ${workLabel(T, w)}`); }}>×</button>
              </motion.div>
            ))}
          </AnimatePresence>
        </Section>

        <Section title={view === 'today' ? T.today : `${T.today} → ${T.plan}`}>
          {METRIC_DEFS.map(([k, u, d, max, lower], mi) => {
            const good = (v: number) => Math.max(0, Math.min(100, (lower ? 1 - v / max : v / max) * 100));
            const worse = good(shown[k]) < good(mb[k]) - 0.01;
            return (
              <motion.div key={k} initial={{ opacity: 0, y: 14, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.75 + mi * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
                whileHover={{ y: -2 }} className="bg-card border-[1.5px] border-line rounded-xl p-3 mb-2 hover:border-ink transition-colors">
                <div className="flex justify-between items-baseline">
                  <span className="text-muted">{T.metrics[k]}</span>
                  <span>{view === 'plan' && Math.abs(mp[k] - mb[k]) > 1e-9 && <span className="text-faint text-[11px] mr-1.5 num-mono">{mb[k].toFixed(d)} →</span>}
                    <span className="display text-[17px]"><Num value={shown[k]} d={d} /></span> <span className="text-[11px] text-muted">{u}</span></span>
                </div>
                <div className="relative h-1.5 bg-line rounded mt-2 overflow-hidden">
                  <div className="absolute top-0 bottom-0 w-0.5 bg-faint z-10 transition-all duration-700" style={{ left: `${good(mb[k])}%` }} />
                  <div className={`absolute left-0 top-0 bottom-0 rounded transition-all duration-700 ${worse ? 'bg-fail' : ['bg-gradient-to-r from-blue to-accent', 'bg-gradient-to-r from-accent to-amber', 'bg-gradient-to-r from-crimson to-amber', 'bg-gradient-to-r from-blue to-crimson', 'bg-gradient-to-r from-accent to-blue'][mi]}`} style={{ width: `${good(shown[k])}%` }} />
                </div>
              </motion.div>
            );
          })}
        </Section>

        <Section title={T.checks} aside={<span>{shown.checks.filter((c) => c.pass).length}/{shown.checks.length}</span>}>
          {shown.checks.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2 border-t border-dotted border-line first:border-0">
              <span className="flex-1">{T.checkNames[c.id]}</span>
              <span className="text-muted text-[12px] num-mono">{c.unit ? `${c.value.toFixed(c.unit === 'm' ? 1 : 0)} ${c.unit}` : ''}</span>
              <Pill sev={c.pass ? 'ok' : 'fails'}>{c.pass ? T.pass : T.fail}</Pill>
            </div>
          ))}
        </Section>
        <p className="text-[11px] text-muted leading-relaxed bg-card/60 rounded-lg p-3">{T.disclaimer}</p>
      </motion.aside>

      <footer className="lg:col-span-2 absolute lg:static bottom-0 left-0 right-0" />
      <div className="fixed left-0 right-0 bottom-0 z-20 glass border-t border-line px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="text-muted mr-1">{T.effects}</span>
        {works.length ? <>
          <Chip good={mp.fire < mb.fire}>{T.metrics.fire} <b>{mb.fire.toFixed(1)} → {mp.fire.toFixed(1)} min</b></Chip>
          <Chip good={mp.flood < mb.flood}>{T.metrics.flood} <b>{mb.flood.toFixed(0)} → {mp.flood.toFixed(0)}</b></Chip>
          {mp.displacement.stallsRelocated > 0 && <Chip><b>{mp.displacement.stallsRelocated}</b> {T.stallsMoved}</Chip>}
          {mp.displacement.stallsLost > 0 && <Chip good={false}><b>{mp.displacement.stallsLost}</b> {T.stallsLost}</Chip>}
          {geomPlan ? (geomPlan.affectedCount > 0 && <Chip good={false}><b>{geomPlan.affectedCount}</b> {T.realCut} ({Math.round(geomPlan.removedAreaM2)} m²)</Chip>)
            : (mp.displacement.plotsAffected > 0 && <Chip><b>{mp.displacement.plotsAffected}</b> {T.plots} {mp.displacement.setback.toFixed(1)} m</Chip>)}
        </> : <Chip>—</Chip>}
        <div className="flex-1" />
        {works.length > 0 && <div className="text-right tnum"><div className="text-[11px] text-muted">{T.metrics.cost} (±40%)</div><div className="display text-[24px]">₹<Num value={mp.cost.totalCr} d={2} /> Cr</div></div>}
        <button onClick={share} className="btn-ghost px-4 py-2.5 font-semibold">{T.share}</button>
        <button onClick={() => exportDpr({ city: city.name, place, baseline, works, observations: area ? observe(area.features, baseline) : [], workLabel: (w) => workLabel(T, w) })}
          className="btn-metal px-4 py-2.5">{T.exportDpr}</button>
      </div>
    </div>
  );
}

function Chip({ children, good }: { children: React.ReactNode; good?: boolean }) {
  return <motion.span initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }}
    className={`px-2.5 py-1 rounded-full bg-card border border-line tnum ${good === true ? '[&_b]:text-ok' : good === false ? '[&_b]:text-fail' : ''}`}>{children}</motion.span>;
}
