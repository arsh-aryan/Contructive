// Constructive mark: a soft silver tile with a bluish-black border, cut by
// three bluish-black diagonal stripes. The stripes run past the tile and are
// clipped by its inner edge, so they flow into the border with no visible ends.
// `reveal` draws them in one after another (startup sequence).
import { motion } from 'framer-motion';
import { useId } from 'react';

const INK_HI = '#283250';
const INK_LO = '#0d1222';

export function Logo({ size = 36, reveal = false, delay = 0 }: { size?: number; reveal?: boolean; delay?: number }) {
  const id = useId().replace(/:/g, '');
  // Lines x + y = k, drawn from bottom-left to top-right and well past the tile.
  const ks = [64, 100, 136];
  const stripes = ks.map((k) => ({ x1: k - 110, y1: 110, x2: 110, y2: k - 110 }));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0" shapeRendering="geometricPrecision">
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef1f6" />
          <stop offset="1" stopColor="#d9dee8" />
        </linearGradient>
        <linearGradient id={`${id}-ink`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={INK_LO} />
          <stop offset="0.5" stopColor={INK_HI} />
          <stop offset="1" stopColor={INK_LO} />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* clip to the tile's inner edge so stripe ends disappear under the border */}
        <clipPath id={`${id}-clip`}><rect x="6" y="6" width="88" height="88" rx="21" /></clipPath>
      </defs>

      <rect x="6" y="6" width="88" height="88" rx="21" fill={`url(#${id}-tile)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {stripes.map((s, i) => (
          <motion.line key={i} {...s} stroke={`url(#${id}-ink)`} strokeWidth={13} strokeLinecap="butt"
            initial={reveal ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + i * 0.2, duration: 0.7, ease: [0.65, 0, 0.35, 1] }} />
        ))}
      </g>
      <rect x="6" y="6" width="88" height="88" rx="21" fill={`url(#${id}-gloss)`} />
      {/* border in the same ink, drawn over the stripe ends */}
      <rect x="6" y="6" width="88" height="88" rx="21" fill="none" stroke={`url(#${id}-ink)`} strokeWidth={7} />
    </svg>
  );
}
