import { createModel } from '../lib/model3d.js';

const DEG = Math.PI / 180;

// Unit plan outlines, roughly within [-0.5, 0.5]^2.
function planOutline(shape, rng) {
  const ring = (n, r = 0.5, a0 = 0) => Array.from({ length: n }, (_, i) => [r * Math.cos(a0 + (i / n) * Math.PI * 2), r * Math.sin(a0 + (i / n) * Math.PI * 2)]);
  switch (shape) {
    case 'tri':
      return ring(3, 0.58, Math.PI / 2);
    case 'hex':
      return ring(6, 0.52);
    case 'cross': {
      const a = 0.18;
      return [
        [-a, -0.5], [a, -0.5], [a, -a], [0.5, -a], [0.5, a], [a, a],
        [a, 0.5], [-a, 0.5], [-a, a], [-0.5, a], [-0.5, -a], [-a, -a],
      ];
    }
    case 'found': {
      const n = rng.int(5, 9);
      return Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const r = 0.5 * rng.range(0.62, 1);
        return [Math.cos(t) * r, Math.sin(t) * r];
      });
    }
    default:
      return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  }
}

export default {
  id: 'tower',
  title: 'Tower massing',
  number: 5,
  dimension: '3d',
  note: 'Floor plates stacked, turned, narrowed, and set back where the seed says.',
  params: [
    { key: 'floors', label: 'Floors', min: 4, max: 80, step: 1, default: 32 },
    { key: 'floorHeight', label: 'Floor to floor', min: 2.8, max: 5, step: 0.1, default: 3.6, unit: 'm' },
    { key: 'width', label: 'Plate width', min: 10, max: 50, step: 1, default: 26, unit: 'm' },
    { key: 'ratio', label: 'Depth / width', min: 0.4, max: 1, step: 0.05, default: 0.8 },
    {
      key: 'plan',
      label: 'Plan',
      type: 'select',
      options: [
        { value: 'rect', label: 'Rect' },
        { value: 'tri', label: 'Tri' },
        { value: 'hex', label: 'Hex' },
        { value: 'cross', label: 'Cross' },
        { value: 'found', label: 'Found' },
      ],
      default: 'rect',
    },
    { key: 'setbacks', label: 'Setbacks', min: 0, max: 6, step: 1, default: 2 },
    { key: 'setbackAmount', label: 'Setback depth', min: 0, max: 0.3, step: 0.01, default: 0.12 },
    { key: 'twist', label: 'Rotation per floor', min: -6, max: 6, step: 0.1, default: 1.2, unit: '°' },
    { key: 'taper', label: 'Taper', min: 0, max: 0.7, step: 0.01, default: 0.15 },
    { key: 'podium', label: 'Podium', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = createModel();
    const outline = planOutline(p.plan, rng.fork('plan'));
    const sr = rng.fork('setbacks');
    const breaks = new Set();
    for (let i = 0; i < p.setbacks; i++) breaks.add(sr.int(Math.ceil(p.floors * 0.2), p.floors - 2));
    const mech = rng.fork('mech').int(8, 16);

    let base = 0;
    if (p.podium) {
      const ph = p.floorHeight * 1.2;
      for (let k = 0; k < 3; k++) {
        const pts = outline.map(([x, z]) => [x * p.width * 1.45, z * p.width * p.ratio * 1.45]);
        m.prism(pts, k * ph, (k + 1) * ph, { tone: 'mid' });
      }
      base = 3 * p.floorHeight * 1.2;
    }

    let scale = 1;
    for (let f = 0; f < p.floors; f++) {
      if (breaks.has(f)) scale *= 1 - p.setbackAmount;
      const t = f / Math.max(1, p.floors - 1);
      const s = scale * (1 - p.taper * t);
      const a = f * p.twist * DEG;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const pts = outline.map(([x, z]) => {
        const X = x * p.width * s;
        const Z = z * p.width * p.ratio * s;
        return [X * ca - Z * sa, X * sa + Z * ca];
      });
      const y0 = base + f * p.floorHeight;
      const tone = f > 0 && f % mech === 0 ? 'hatch' : 'light';
      m.prism(pts, y0, y0 + p.floorHeight, { tone, crease: 10 });
    }

    const H = base + p.floors * p.floorHeight;
    const r = (p.width / 2) * (p.podium ? 1.45 : 1);
    m.dim([-r, 0, r + 2], [-r, H, r + 2], [-2, 0, 2]);
    m.stat('H', `${H.toFixed(0)} m`);
    m.stat('Turn', `${(p.twist * (p.floors - 1)).toFixed(0)}°`);
    m.stat('Plant every', `${mech} fl.`);
    return m.build();
  },
};
