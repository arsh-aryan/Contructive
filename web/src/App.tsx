import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import CityMap from './components/CityMap';
import AreaPanel from './components/AreaPanel';
import StudyView from './study/StudyView';
import { Toasts } from './components/ui';
import Intro from './components/Intro';
import StudyTransition from './components/StudyTransition';
import { useThemeSync } from './theme';
import { useApp } from './store/useApp';

import { loadProposal } from './services/supabase';
import { CITIES } from './data/cities';
import { useT } from './i18n/strings';

export default function App() {
  const T = useT();
  const mode = useApp((s) => s.mode);
  const [booting, setBooting] = useState(true);
  const place = useApp((s) => s.area?.features.narrowestName ?? s.city.name);
  const [sweep, setSweep] = useState(0);
  const prevMode = useRef(mode);
  useEffect(() => { if (prevMode.current === 'city' && mode === 'study') setSweep((n) => n + 1); prevMode.current = mode; }, [mode]);

  useThemeSync();

  // Shared proposal links: #/p/<id>
  useEffect(() => {
    const m = location.hash.match(/^#\/p\/(.+)$/);
    if (!m) return;
    loadProposal(m[1]).then((p) => {
      if (!p) return;
      const city = CITIES.find((c) => c.name === p.city) ?? useApp.getState().city;
      useApp.setState({ city, baseline: p.baseline, works: p.works, view: 'plan', mode: 'study', proposalId: m[1] });
    });
  }, []);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <TopBar />
      <main className="relative overflow-hidden">
        <div className={`absolute inset-0 transition-opacity duration-500 ${mode === 'city' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <CityMap />
          <AreaPanel />
          <div className="absolute z-20 left-4 bottom-8 glass rounded-lg px-3 py-2 text-[11px] text-muted grid gap-1">
            <Legend c="var(--crimson)" t={T.legend.narrow} /><Legend c="var(--warn)" t={T.legend.tight} /><Legend c="var(--accent)" t={T.legend.ok} />
            <Legend c="var(--blue)" t={T.legend.drain} /><Legend c="var(--crimson)" t={T.legend.station} /><Legend c="var(--faint)" t={T.legend.flyover} /><Legend c="color-mix(in srgb, var(--crimson) 35%, transparent)" t={T.legend.nh} />
          </div>
        </div>
        <AnimatePresence>
          {mode === 'study' && (
            <motion.div key="study" className="absolute inset-0 bg-bg" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }} transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              <StudyView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Toasts />
      <StudyTransition trigger={sweep} place={place} />
      {booting && <Intro onDone={() => setBooting(false)} />}
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <div className="flex items-center gap-2"><i className="w-3 h-1.5 rounded" style={{ background: c }} />{t}</div>;
}
