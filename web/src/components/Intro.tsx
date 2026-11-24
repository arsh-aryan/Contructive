// Startup sequence (~2.8 s): the three stripes reveal, the wordmark rises,
// a line runs between two markers while the real loading steps tick past,
// then the curtain lifts. Skippable.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { CITIES } from '../data/cities';
import { useT } from '../i18n/strings';

const DURATION = 2800;

export default function Intro({ onDone }: { onDone: () => void }) {
  const T = useT();
  const steps = [
    `${T.intro.cities} · ${CITIES.length}`,
    T.intro.tiles, T.intro.streets, T.intro.widths, T.intro.fire, T.intro.drains, T.intro.ready,
  ];
  const [p, setP] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION);
      setP(k);
      if (k < 1) raf = requestAnimationFrame(tick); else setLeaving(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const step = steps[Math.min(steps.length - 1, Math.floor(p * steps.length))];
  const word = 'CONSTRUCTIVE'.split('');

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div key="intro" className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
          style={{ background: 'radial-gradient(120% 90% at 50% 40%, #16213a 0%, #0b1220 60%, #070c16 100%)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}>
          {/* faint scan lines */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)' }} />

          <div className="relative w-[min(760px,88vw)] grid justify-items-center gap-7">
            <div className="flex items-center gap-5">
              <Logo size={76} reveal />
              <div className="flex overflow-hidden font-display font-extrabold text-[clamp(30px,6vw,64px)] tracking-[0.1em] text-[#eef2fa]">
                {word.map((ch, i) => (
                  <motion.span key={i} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ delay: 0.35 + i * 0.035, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className={i === 0 ? 'text-[#e8486c]' : ''}>{ch}</motion.span>
                ))}
              </div>
            </div>

            {/* the string: two markers, a drawn line, a travelling crimson node */}
            <div className="relative w-full h-6 flex items-center">
              <span className="w-4 h-4 rounded-full border border-[#8ca8e8]/60 grid place-items-center text-[7px] text-[#8ca8e8]">A</span>
              <div className="relative flex-1 mx-2 h-px bg-white/10">
                <motion.div className="absolute left-0 top-0 h-px origin-left" style={{ width: '100%', scaleX: p, background: 'linear-gradient(90deg, #8ca8e8, #e8486c)' }} />
                <motion.div className="absolute -top-[3px] w-[7px] h-[7px] rounded-full bg-[#e8486c] shadow-[0_0_12px_#e8486c]" style={{ left: `calc(${p * 100}% - 3px)` }} />
              </div>
              <span className="w-4 h-4 rounded-full border border-[#8ca8e8]/60 grid place-items-center text-[7px] text-[#8ca8e8]">B</span>
            </div>

            <div className="w-full flex justify-between font-mono text-[11px] tracking-[0.18em] uppercase text-[#9aa6bf]">
              <AnimatePresence mode="wait">
                <motion.span key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{step}</motion.span>
              </AnimatePresence>
              <span className="tabular-nums text-[#eef2fa]">{String(Math.round(p * 100)).padStart(3, '0')}%</span>
            </div>
          </div>

          <button onClick={() => setLeaving(true)} className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#64708a] hover:text-[#eef2fa] underline-offset-4 hover:underline">
            {T.intro.skip}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
