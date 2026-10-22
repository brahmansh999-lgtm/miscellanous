import { createModel } from '../lib/model3d.js';

const DEG = Math.PI / 180;
const fwd = (h) => [Math.cos(h), -Math.sin(h)];
const side = (h) => [Math.sin(h), Math.cos(h)];

export default {
  id: 'stair',
  title: 'Stair',
  number: 1,
  dimension: '3d',
  note: 'Flights and landings, turning by a fixed angle; it may wander.',
  params: [
    { key: 'flights', label: 'Flights', min: 1, max: 8, step: 1, default: 3 },
    { key: 'steps', label: 'Steps per flight', min: 3, max: 18, step: 1, default: 9 },
    { key: 'rise', label: 'Rise', min: 0.14, max: 0.22, step: 0.005, default: 0.175, unit: 'm' },
    { key: 'going', label: 'Going', min: 0.22, max: 0.36, step: 0.01, default: 0.28, unit: 'm' },
    { key: 'width', label: 'Width', min: 0.7, max: 2, step: 0.05, default: 1.1, unit: 'm' },
    { key: 'landing', label: 'Landing depth', min: 0.6, max: 2.5, step: 0.05, default: 1.1, unit: 'm' },
    { key: 'twist', label: 'Turn per landing', min: -180, max: 180, step: 5, default: 90, unit: '°' },
    { key: 'wander', label: 'Wander', min: 0, max: 1, step: 0.05, default: 0.15 },
    {
      key: 'structure',
      label: 'Structure',
      type: 'select',
      options: [
        { value: 'waist', label: 'Waist' },
        { value: 'spine', label: 'Spine' },
        { value: 'mass', label: 'Mass' },
      ],
      default: 'waist',
    },
    { key: 'balustrade', label: 'Balustrade', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = createModel();
    let x = 0;
    let z = 0;
    let y = 0;
    let h = 0;
    let totalSteps = 0;

    for (let f = 0; f < p.flights; f++) {
      const r = rng.fork(`flight-${f}`);
      const n = Math.max(2, p.steps + Math.round(p.wander * r.range(-3, 3)));
      const [fx, fz] = fwd(h);
      const [sx, sz] = side(h);
      const L = n * p.going;
      const H = n * p.rise;
      const at = (s, lat, yy) => [x + fx * s + sx * lat, yy, z + fz * s + sz * lat];

      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) * p.going;
        if (p.structure === 'mass') {
          const hh = y + (i + 1) * p.rise;
          m.box({ size: [p.going, hh, p.width], at: at(s, 0, hh / 2), rot: [0, h, 0], tone: 'light' });
        } else if (p.structure === 'waist') {
          m.box({ size: [p.going, p.rise, p.width], at: at(s, 0, y + (i + 0.5) * p.rise), rot: [0, h, 0], tone: 'light' });
        } else {
          const t = 0.06;
          m.box({ size: [p.going + 0.03, t, p.width], at: at(s, 0, y + (i + 1) * p.rise - t / 2), rot: [0, h, 0], tone: 'light' });
        }
      }

      if (p.structure === 'waist') {
        const a = Math.atan2(H, L);
        const len = Math.hypot(L, H);
        const thick = 0.14;
        const mid = at(L / 2, 0, y + H / 2);
        mid[1] -= thick / 2 / Math.cos(a);
        m.box({ size: [len, thick, p.width], at: mid, rot: [0, h, a], tone: 'hatch' });
      } else if (p.structure === 'spine') {
        m.strut(at(0, 0, y - 0.1), at(L, 0, y + H - 0.1), 0.16, { tone: 'dark' });
      }

      if (p.balustrade) {
        for (const lat of [-p.width / 2 + 0.04, p.width / 2 - 0.04]) {
          const tops = [];
          for (let i = 0; i < n; i++) {
            const s = (i + 0.5) * p.going;
            const yy = y + (i + 1) * p.rise;
            m.seg(at(s, lat, yy), at(s, lat, yy + 0.9));
            tops.push(at(s, lat, yy + 0.9));
          }
          m.polyline(tops);
        }
      }

      x += fx * L;
      z += fz * L;
      y += H;
      totalSteps += n;

      if (f < p.flights - 1) {
        const t = (p.twist + p.wander * r.range(-40, 40)) * DEG;
        const h2 = h + t;
        const k = (1 - Math.cos(t)) / 2;
        const sgn = t > 0 ? -1 : 1;
        const W = p.width * (1 + k);
        const lo = (sgn * k * p.width) / 2;
        const c = [x + fx * (p.landing / 2) + sx * lo, z + fz * (p.landing / 2) + sz * lo];
        m.box({ size: [p.landing, 0.18, W], at: [c[0], y - 0.09, c[1]], rot: [0, h, 0], tone: 'mid' });

        // Leave the landing through whichever edge the new heading faces.
        const [gx, gz] = fwd(h2);
        const ext = (p.landing / 2) * Math.abs(gx * fx + gz * fz) + (W / 2) * Math.abs(gx * sx + gz * sz);
        const v = [sx * lo, sz * lo];
        const along = v[0] * gx + v[1] * gz;
        x = c[0] + gx * ext + (v[0] - along * gx);
        z = c[1] + gz * ext + (v[1] - along * gz);
        h = h2;
      }
    }

    m.dim([0, 0, p.width / 2], [0, y, p.width / 2], [-0.9, 0, 0.5]);
    m.stat('H', `${y.toFixed(2)} m`);
    m.stat('Steps', totalSteps);
    m.stat('2R+G', `${Math.round((2 * p.rise + p.going) * 1000)} mm`);
    return m.build();
  },
};
