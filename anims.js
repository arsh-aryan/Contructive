// Constructive — Lottie animations, authored in code (no third-party files, no licence questions).
// Rendered with lottie-web. Each builder returns Lottie JSON (bodymovin format).

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, 1];
const S = (v) => ({ a: 0, k: v });
const ease = { i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } };
const K = (frames) => ({ a: 1, k: frames.map(([t, s], i) => (i < frames.length - 1 ? { t, s, ...ease } : { t, s })) });

function tr({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  const v = (x) => (x && x.a !== undefined ? x : S(x));
  return { ty: 'tr', p: v(p), a: v(a), s: v(s), r: v(r), o: v(o), sk: S(0), sa: S(0) };
}

function layer(ind, shapes, ks = {}, op = 60) {
  const v = (x, d) => (x === undefined ? S(d) : x.a !== undefined ? x : S(x));
  return {
    ddd: 0, ind, ty: 4, nm: 'l' + ind, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
    ks: { o: v(ks.o, 100), r: v(ks.r, 0), p: v(ks.p, [50, 50, 0]), a: v(ks.a, [0, 0, 0]), s: v(ks.s, [100, 100, 100]) },
    shapes,
  };
}

const rect = (w, h, color, r = 1.5) => ({ ty: 'gr', it: [{ ty: 'rc', d: 1, p: S([0, 0]), s: S([w, h]), r: S(r) }, { ty: 'fl', c: S(rgb(color)), o: S(100), r: 1 }, tr()] });
const ring = (d, color, w = 4) => ({ ty: 'gr', it: [{ ty: 'el', d: 1, p: S([0, 0]), s: S([d, d]) }, { ty: 'st', c: S(rgb(color)), o: S(100), w: S(w), lc: 2, lj: 2 }, tr()] });
const dot = (d, color) => ({ ty: 'gr', it: [{ ty: 'el', d: 1, p: S([0, 0]), s: S([d, d]) }, { ty: 'fl', c: S(rgb(color)), o: S(100), r: 1 }, tr()] });

const doc = (layers, op = 60, w = 100, h = 100) => ({ v: '5.7.4', fr: 30, ip: 0, op, w, h, nm: 'c', ddd: 0, assets: [], layers });

// Buildings rising, staggered — used by the loader.
export function loaderAnim() {
  const cols = [0x0f8b8d, 0x23221f, 0x0f8b8d, 0x9b968f, 0x0f8b8d];
  const heights = [34, 52, 26, 60, 40];
  const layers = heights.map((h, i) => {
    const x = 18 + i * 16, t0 = i * 4;
    return layer(i + 1, [{ ty: 'gr', it: [{ ty: 'rc', d: 1, p: S([0, -h / 2]), s: S([11, h]), r: S(1) }, { ty: 'fl', c: S(rgb(cols[i])), o: S(100), r: 1 }, tr()] }], {
      p: [x, 82, 0],
      s: K([[t0, [100, 0, 100]], [t0 + 16, [100, 100, 100]], [40 + t0 / 2, [100, 100, 100]], [56, [100, 0, 100]]]),
    });
  });
  layers.push(layer(9, [rect(90, 2, 0xc9c2b4, 0)], { p: [50, 83, 0] }));
  return doc(layers, 60);
}

// Expanding siren ring — fire tender blocked.
export function sirenAnim(color = 0xb4472f) {
  const ringL = (ind, delay) => layer(ind, [ring(30, color, 5)], {
    s: K([[delay, [40, 40, 100]], [delay + 30, [100, 100, 100]]]),
    o: K([[delay, 100], [delay + 30, 0]]),
  }, 60);
  return doc([layer(1, [dot(22, color)]), ringL(2, 0), ringL(3, 20)], 60);
}

// Check pulse — fire tender through.
export function okAnim(color = 0x3d7a4a) {
  const tick = { ty: 'gr', it: [
    { ty: 'sh', d: 1, ks: S({ i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-12, 0], [-3, 9], [13, -9]], c: false }) },
    { ty: 'tm', s: S(0), e: K([[4, 0], [20, 100]]), o: S(0), m: 1 },
    { ty: 'st', c: S(rgb(0xffffff)), o: S(100), w: S(6), lc: 2, lj: 2 }, tr()] };
  return doc([
    layer(1, [tick], { s: S([100, 100, 100]) }, 60),
    layer(2, [dot(52, color)], { s: K([[0, [0, 0, 100]], [12, [110, 110, 100]], [18, [100, 100, 100]]]) }, 60),
  ], 60);
}

// Falling drops — monsoon.
export function rainAnim(color = 0x4a86b5) {
  const drops = [[30, 0], [50, 8], [70, 4], [40, 14], [60, 18]];
  return doc(drops.map(([x, d], i) => layer(i + 1, [{ ty: 'gr', it: [{ ty: 'rc', d: 1, p: S([0, 0]), s: S([4, 14]), r: S(2) }, { ty: 'fl', c: S(rgb(color)), o: S(100), r: 1 }, tr()] }], {
    p: K([[d, [x, 10, 0]], [d + 24, [x, 90, 0]]]),
    o: K([[d, 0], [d + 4, 100], [d + 20, 100], [d + 24, 0]]),
  })), 48);
}
