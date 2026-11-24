// Transition shown when "Open 3D study" is clicked: three diagonal bands
// (lime / blue / crimson, echoing the logo's stripes) sweep in, the street name
// pops in a highlight tag while the study mounts underneath, then they sweep out.
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { useT } from '../i18n/strings';

const BANDS = ['#c8f03c', '#5b8cff', '#ff3b5c'];
const EASE = [0.76, 0, 0.24, 1] as const;

export default function StudyTransition({ trigger, place }: { trigger: number; place: string }) {
  const T = useT();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    setShow(true); setStep(0);
    const s1 = setTimeout(() => setStep(1), 380);
    const s2 = setTimeout(() => setStep(2), 700);
    const end = setTimeout(() => setShow(false), 1250);
    return () => { clearTimeout(s1); clearTimeout(s2); clearTimeout(end); };
  }, [trigger]);

  const steps = [T.toStudy.project, T.toStudy.cut, T.toStudy.place];

  return (
    <AnimatePresence>
      {show && (
        <motion.div key={trigger} className="fixed inset-0 z-[90] pointer-events-none overflow-hidden" exit={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          {BANDS.map((c, i) => (
            <motion.div key={c} className="absolute -inset-y-10 w-[160vw] -left-[30vw]"
              style={{ background: c, skewX: -18, zIndex: i }}
              initial={{ x: '-140%' }} animate={{ x: '0%' }} exit={{ x: '140%' }}
              transition={{ duration: 0.55, delay: i * 0.07, ease: EASE }} />
          ))}
          <motion.div className="absolute inset-0 grid place-items-center z-10"
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }}
            transition={{ delay: 0.22, duration: 0.3 }}>
            <div className="grid justify-items-center gap-4 text-[#0b0b14]">
              <Logo size={64} reveal delay={0.25} />
              <div className="font-display text-[clamp(28px,5vw,56px)]">{T.toStudy.title}</div>
              <span className="tag-hi font-display text-[clamp(18px,2.6vw,28px)] !bg-[#0b0b14] !text-[#c8f03c] !border-[#0b0b14] !shadow-[4px_4px_0_#c8f03c]">{place}</span>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] h-4">
                <AnimatePresence mode="wait">
                  <motion.span key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>{steps[step]}</motion.span>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
