import { useEffect, useRef, useState, type ReactNode } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store/useApp';
import { WORKS, type Work } from '../model/model';
import type { T } from '../i18n/strings';

export function workLabel(T: T, w: Work) {
  const def = WORKS[w.id], name = T.workNames[w.id];
  if (w.value === undefined) return name;
  if (w.id === 'drain') return `${name}, ${w.value} mm`;
  if (w.id === 'heightCap') return `${name} G+${w.value - 1}`;
  if (w.id === 'pits') return `${name} × ${w.value}`;
  return `${name} ${w.value}${def.unit === '%' ? '%' : ' ' + (def.unit ?? '')}`;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="lbl">{label}</span>{children}</label>;
}

export function LottieIcon({ data, className = 'w-9 h-9', loop = true }: { data: object; className?: string; loop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop, autoplay: true, animationData: data });
    return () => a.destroy();
  }, [data, loop]);
  return <div ref={ref} className={className} aria-hidden />;
}

/** Number that tweens to its new value. */
export function Num({ value, d = 1 }: { value: number; d?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value]);
  return <span className="tnum">{shown.toFixed(d)}</span>;
}

export function Pill({ sev, children }: { sev: 'fails' | 'marginal' | 'ok'; children: ReactNode }) {
  const c = { fails: 'text-fail bg-fail/12', marginal: 'text-warn bg-warn/12', ok: 'text-ok bg-ok/12' }[sev];
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c}`}>{children}</span>;
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="lbl font-semibold flex justify-between items-center mb-2 sticky top-0 py-2 bg-panel/95 backdrop-blur z-10"><span>{title}</span>{aside}</h3>
      {children}
    </section>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="fixed right-5 bottom-24 z-50 grid gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
            className="glass rounded-lg px-4 py-2.5 shadow-2xl max-w-sm">{t.text}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
