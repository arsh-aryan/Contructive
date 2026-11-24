// Constructive mark: a navy tile cut by three diagonal stripes.
// `reveal` draws the stripes in one after another (used by the startup sequence).
import { motion } from 'framer-motion';
import { useId } from 'react';

export function Logo({ size = 36, reveal = false, delay = 0 }: { size?: number; reveal?: boolean; delay?: number }) {
  const id = useId().replace(/:/g, '');
  const stripes = [
    { x1: 14, y1: 62, x2: 62, y2: 14, color: `url(#${id}-crim)` },
    { x1: 26, y1: 74, x2: 74, y2: 26, color: `url(#${id}-silver)` },
    { x1: 38, y1: 86, x2: 86, y2: 38, color: `url(#${id}-crim)` },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-navy`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34477a" />
          <stop offset="0.5" stopColor="#1b2a4a" />
          <stop offset="1" stopColor="#0f1a31" />
        </linearGradient>
        <linearGradient id={`${id}-crim`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8e0f30" />
          <stop offset="0.5" stopColor="#d4234f" />
          <stop offset="1" stopColor="#9c1236" />
        </linearGradient>
        <linearGradient id={`${id}-silver`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#b9c2d4" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#aab4c8" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><rect x="4" y="4" width="92" height="92" rx="22" /></clipPath>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="22" fill={`url(#${id}-navy)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {stripes.map((s, i) => (
          <motion.line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={9} strokeLinecap="round"
            initial={reveal ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: delay + i * 0.18, duration: 0.55, ease: [0.65, 0, 0.35, 1] }} />
        ))}
      </g>
      <rect x="4" y="4" width="92" height="92" rx="22" fill={`url(#${id}-sheen)`} />
      <rect x="4.5" y="4.5" width="91" height="91" rx="21.5" fill="none" stroke="#ffffff" strokeOpacity="0.14" />
    </svg>
  );
}
