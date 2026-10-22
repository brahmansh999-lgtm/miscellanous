// Seeded randomness. Every generator receives an rng built from the seed,
// so a seed always reproduces the same specimen.

export function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a, used to derive independent streams from a seed and a label.
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GRAD2 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

// Gradient noise in 2D, roughly in [-1, 1].
function makeNoise2(next) {
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const grad = (h, x, y) => {
    const g = GRAD2[h & 7];
    return g[0] * x + g[1] * y;
  };

  return function noise2(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;
    const xi = X & 255;
    const yi = Y & 255;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return Math.max(-1, Math.min(1, lerp(x1, x2, v) * 1.42));
  };
}

export function createRng(seed) {
  const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = mulberry32(s ^ 0x9e3779b9);
  let noise = null;

  const rng = {
    seed: s,
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // Approximately normal, mean 0, sd 1.
    gauss: () => {
      let u = 0;
      for (let i = 0; i < 6; i++) u += next();
      return (u - 3) / 0.7071;
    },
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    noise2: (x, y) => {
      if (!noise) noise = makeNoise2(mulberry32(s ^ 0x85ebca6b));
      return noise(x, y);
    },
    fbm2: (x, y, octaves = 4) => {
      let amp = 0.5;
      let freq = 1;
      let sum = 0;
      let norm = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * rng.noise2(x * freq, y * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return sum / norm;
    },
    // An independent stream, so one feature's randomness does not shift
    // when a slider changes how many numbers another feature consumes.
    fork: (label) => createRng((s ^ hashString(String(label))) >>> 0),
  };
  return rng;
}

export function randomSeed() {
  return Math.floor(Math.random() * 1000000);
}
