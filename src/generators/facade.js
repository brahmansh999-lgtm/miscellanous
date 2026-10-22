import { createModel } from '../lib/model3d.js';

const DEG = Math.PI / 180;

export default {
  id: 'facade',
  title: 'Facade fins',
  number: 12,
  dimension: '3d',
  note: 'Vertical fins on a glazed face, turned by a gradient and a little weather.',
  params: [
    { key: 'bays', label: 'Bays', min: 2, max: 24, step: 1, default: 10 },
    { key: 'floors', label: 'Floors', min: 1, max: 14, step: 1, default: 5 },
    { key: 'finsPerBay', label: 'Fins per bay', min: 1, max: 5, step: 1, default: 2 },
    { key: 'bayWidth', label: 'Bay width', min: 1.2, max: 4, step: 0.1, default: 2.4, unit: 'm' },
    { key: 'floorHeight', label: 'Floor to floor', min: 2.8, max: 4.5, step: 0.1, default: 3.4, unit: 'm' },
    { key: 'depth', label: 'Fin depth', min: 0.1, max: 1.4, step: 0.05, default: 0.6, unit: 'm' },
    { key: 'thick', label: 'Fin thickness', min: 0.03, max: 0.3, step: 0.01, default: 0.08, unit: 'm' },
    { key: 'gradient', label: 'Rotation gradient', min: -90, max: 90, step: 1, default: 55, unit: '°' },
    {
      key: 'axis',
      label: 'Gradient runs',
      type: 'select',
      options: [
        { value: 'x', label: 'Across' },
        { value: 'y', label: 'Up' },
        { value: 'xy', label: 'Diagonal' },
        { value: 'radial', label: 'From a point' },
      ],
      default: 'x',
    },
    { key: 'noise', label: 'Noise amplitude', min: 0, max: 60, step: 1, default: 12, unit: '°' },
    { key: 'noiseScale', label: 'Noise scale', min: 0.05, max: 1, step: 0.05, default: 0.3 },
    { key: 'slabs', label: 'Slab edges', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = createModel();
    const W = p.bays * p.bayWidth;
    const H = p.floors * p.floorHeight;
    const slab = 0.25;
    const attractor = [rng.range(0.15, 0.85), rng.range(0.15, 0.85)];

    // Glazing plane and its mullion grid.
    m.quad([0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], { tone: 'mid' });
    for (let b = 1; b < p.bays; b++) m.seg([b * p.bayWidth, 0, 0.002], [b * p.bayWidth, H, 0.002], 'thin');
    for (let f = 0; f < p.floors; f++) {
      const y = f * p.floorHeight + 1.1;
      m.seg([0, y, 0.002], [W, y, 0.002], 'thin');
    }

    if (p.slabs) {
      for (let f = 0; f <= p.floors; f++) {
        m.box({ size: [W + 0.3, slab, p.depth + 0.5], at: [W / 2, f * p.floorHeight, (p.depth + 0.5) / 2 - 0.3], tone: 'light' });
      }
    }

    const n = p.bays * p.finsPerBay;
    const pitch = W / n;
    let maxAngle = 0;
    for (let f = 0; f < p.floors; f++) {
      const y0 = f * p.floorHeight + (p.slabs ? slab / 2 : 0);
      const y1 = (f + 1) * p.floorHeight - (p.slabs ? slab / 2 : 0);
      for (let i = 0; i <= n; i++) {
        const x = i * pitch;
        const u = x / W;
        const v = (f + 0.5) / p.floors;
        let g;
        if (p.axis === 'x') g = u * 2 - 1;
        else if (p.axis === 'y') g = v * 2 - 1;
        else if (p.axis === 'xy') g = u + v - 1;
        else g = 1 - 2 * Math.min(1, Math.hypot(u - attractor[0], (v - attractor[1]) * (H / W)) * 1.6);
        const a = p.gradient * g + p.noise * rng.noise2(i * p.noiseScale, f * p.noiseScale * 1.7);
        maxAngle = Math.max(maxAngle, Math.abs(a));
        const z = p.depth / 2 + 0.05;
        m.box({ size: [p.thick, y1 - y0, p.depth], at: [x, (y0 + y1) / 2, z], rot: [0, a * DEG, 0], tone: 'paper' });
      }
    }

    m.dim([0, 0, p.depth + 0.4], [W, 0, p.depth + 0.4], [0, 0, 1.2]);
    m.stat('Fins', (n + 1) * p.floors);
    m.stat('W', `${W.toFixed(1)} m`);
    m.stat('Max turn', `${Math.round(maxAngle)}°`);
    return m.build();
  },
};
