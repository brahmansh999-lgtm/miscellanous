import { createModel } from '../lib/model3d.js';
import { ARCH_PROFILES, archY } from '../lib/arch.js';

// (r, s) -> (u, v): r from the bay centre out to an edge, s along that edge.
const SECTORS = [
  (r, s) => [r, s * r],
  (r, s) => [-r, s * r],
  (r, s) => [s * r, r],
  (r, s) => [s * r, -r],
];

export default {
  id: 'vault',
  title: 'Vault',
  number: 4,
  dimension: '3d',
  note: 'A covered bay, repeated. Ribs where the surfaces meet, and some where they do not.',
  params: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'barrel', label: 'Barrel' },
        { value: 'groin', label: 'Groin' },
        { value: 'cloister', label: 'Cloister' },
      ],
      default: 'groin',
    },
    {
      key: 'profile',
      label: 'Section',
      type: 'select',
      options: ARCH_PROFILES.filter((o) => o.value !== 'flat'),
      default: 'round',
    },
    { key: 'span', label: 'Span', min: 2, max: 12, step: 0.1, default: 6, unit: 'm' },
    { key: 'rise', label: 'Rise / half span', min: 0.2, max: 1.6, step: 0.05, default: 1, unit: '×' },
    { key: 'bays', label: 'Bays', min: 1, max: 8, step: 1, default: 3 },
    { key: 'springing', label: 'Springing height', min: 0, max: 8, step: 0.1, default: 3.2, unit: 'm' },
    { key: 'ribs', label: 'Extra ribs per bay', min: 0, max: 9, step: 1, default: 2 },
    { key: 'pier', label: 'Pier size', min: 0.2, max: 1.4, step: 0.05, default: 0.6, unit: 'm' },
    { key: 'wobble', label: 'Bay irregularity', min: 0, max: 0.5, step: 0.01, default: 0.08 },
  ],

  build(p, rng) {
    const m = createModel();
    const S = p.span;
    const rise = (S / 2) * p.rise;
    const y0 = p.springing;
    const res = 28;

    // Bay lengths: nominally square, nudged by the seed.
    const lengths = [];
    for (let b = 0; b < p.bays; b++) lengths.push(S * (1 + p.wobble * rng.range(-1, 1)));
    const total = lengths.reduce((a, b) => a + b, 0);

    let z0 = -total / 2;
    const piers = new Set();
    for (let b = 0; b < p.bays; b++) {
      const L = lengths[b];
      const zc = z0 + L / 2;
      // Height of the soffit at (u, v) in [-1, 1]^2 across one bay.
      const h = (u, v) => {
        const a = archY(u, rise, p.profile);
        const c = archY(v, rise * (p.type === 'barrel' ? 0 : 1), p.profile);
        if (p.type === 'barrel') return a;
        if (p.type === 'groin') return Math.max(a, c);
        return Math.min(a, c);
      };
      const pt = (u, v) => [u * (S / 2), y0 + h(u, v), zc + v * (L / 2)];
      if (p.type === 'barrel') {
        m.surface((i, j) => pt(i * 2 - 1, j * 2 - 1), res, res, { tone: 'light', crease: 85 });
      } else {
        // Four triangular sectors meeting on the diagonals, so the groins
        // fall on mesh edges instead of cutting across the grid. Surface
        // creases are left to the drawn ribs.
        for (const sector of SECTORS) {
          m.surface((i, j) => pt(...sector(j, i * 2 - 1)), res, res / 2, { tone: 'light', crease: 85 });
        }
      }

      // Transverse arches at both ends, diagonal ribs, and extra ribs.
      const rib = (f, tone = 'ink') => {
        const pts = [];
        for (let k = 0; k <= 40; k++) pts.push(f(k / 40));
        const lifted = pts.map(([x, y, z]) => [x, y - 0.01, z]);
        m.polyline(lifted, tone);
      };
      rib((t) => pt(t * 2 - 1, -1));
      rib((t) => pt(t * 2 - 1, 1));
      if (p.type !== 'barrel') {
        rib((t) => pt(t * 2 - 1, t * 2 - 1));
        rib((t) => pt(t * 2 - 1, 1 - t * 2));
      }
      for (let r = 1; r <= p.ribs; r++) {
        const v = (r / (p.ribs + 1)) * 2 - 1;
        rib((t) => pt(t * 2 - 1, v), 'thin');
      }
      // Wall ribs (formerets) along the sides.
      rib((t) => pt(-1, t * 2 - 1), 'thin');
      rib((t) => pt(1, t * 2 - 1), 'thin');

      piers.add(z0.toFixed(4));
      piers.add((z0 + L).toFixed(4));
      z0 += L;
    }

    for (const zs of piers) {
      const z = parseFloat(zs);
      for (const x of [-S / 2, S / 2]) {
        if (y0 > 0) m.box({ size: [p.pier, y0, p.pier], at: [x, y0 / 2, z], tone: 'mid' });
        m.box({ size: [p.pier * 1.2, 0.12, p.pier * 1.2], at: [x, y0 + 0.06, z], tone: 'dark' });
      }
    }

    m.dim([-S / 2, 0, z0], [S / 2, 0, z0], [0, 0, 1.4]);
    m.stat('Span', `${S.toFixed(1)} m`);
    m.stat('Crown', `${(y0 + rise).toFixed(2)} m`);
    m.stat('Length', `${total.toFixed(1)} m`);
    return m.build();
  },
};
