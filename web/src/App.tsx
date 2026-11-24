import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import CityMap from './components/CityMap';
import AreaPanel from './components/AreaPanel';
import StudyView from './study/StudyView';
import { Brand, Toasts } from './components/ui';
import { useApp } from './store/useApp';
import { logoAnim } from './anim/anims';

const LOGO = logoAnim();
import { loadProposal } from './services/supabase';
import { CITIES } from './data/cities';
import { useT } from './i18n/strings';

export default function App() {
  const T = useT();
  const mode = useApp((s) => s.mode);
  const [booting, setBooting] = useState(true);

  useEffect(() => { const id = setTimeout(() => setBooting(false), 2600); return () => clearTimeout(id); }, []);

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
            <Legend c="#b93a2b" t={T.legend.narrow} /><Legend c="#c48c28" t={T.legend.tight} /><Legend c="#0f766e" t={T.legend.ok} />
            <Legend c="#2f6f9f" t={T.legend.drain} /><Legend c="#c46e1e" t={T.legend.station} />
          </div>
        </div>
        <AnimatePresence>
          {mode === 'study' && (
            <motion.div key="study" className="absolute inset-0 bg-bg" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.5 }}>
              <StudyView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Toasts />
      <AnimatePresence>
        {booting && (
          <motion.div className="fixed inset-0 z-[100] bg-bg grid place-items-center" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-center grid justify-items-center gap-4"><Brand size="lg" data={LOGO} /><div className="text-muted lbl !text-[11px]">{T.tagline}</div></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <div className="flex items-center gap-2"><i className="w-3 h-1.5 rounded" style={{ background: c }} />{t}</div>;
}
