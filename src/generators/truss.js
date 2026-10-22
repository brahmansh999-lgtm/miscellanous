import { createModel } from '../lib/model3d.js';

export default {
  id: 'truss',
  title: 'Truss',
  number: 6,
  dimension: '3d',
  note: 'Chords, posts and diagonals; the random kind is not recommended.',
  params: [
    {
      key: 'type',
      label: 'Web',
      type: 'select',
      options: [
        { value: 'pratt', label: 'Pratt' },
        { value: 'howe', label: 'Howe' },
        { value: 'warren', label: 'Warren' },
        { value: 'random', label: 'Random' },
      ],
      default: 'pratt',
    },
    {
      key: 'chord',
      label: 'Top chord',
      type: 'select',
      options: [
        { value: 'flat', label: 'Flat' },
        { value: 'pitched', label: 'Pitched' },
        { value: 'bowstring', label: 'Bowstring' },
      ],
      default: 'flat',
    },
    { key: 'span', label: 'Span', min: 6, max: 60, step: 1, default: 24, unit: 'm' },
    { key: 'depth', label: 'Depth', min: 1, max: 8, step: 0.1, default: 3, unit: 'm' },
    { key: 'panels', label: 'Panels', min: 2, max: 24, step: 1, default: 8 },
    { key: 'trusses', label: 'Trusses', min: 1, max: 6, step: 1, default: 3 },
    { key: 'spacing', label: 'Spacing', min: 2, max: 10, step: 0.5, default: 5, unit: 'm' },
    { key: 'member', label: 'Member size', min: 0.05, max: 0.5, step: 0.01, default: 0.16, unit: 'm' },
    { key: 'bracing', label: 'Plan bracing', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = createModel();
    const n = p.panels;
    const L = p.span;
    const X = (i) => -L / 2 + (i / n) * L;
    const top = (i) => {
      const u = (2 * i) / n - 1;
      if (p.chord === 'pitched') return Math.max(p.depth * (1 - Math.abs(u)), p.depth * 0.12);
      if (p.chord === 'bowstring') return Math.max(p.depth * Math.sqrt(Math.max(0, 1 - u * u)), p.depth * 0.12);
      return p.depth;
    };
    const w = p.member;
    // Panel directions are drawn once, so every truss in the row matches.
    const dirs = Array.from({ length: n }, () => (rng.chance(0.18) ? 'x' : rng.chance(0.5) ? 'up' : 'down'));
    let members = 0;

    const z0 = (-(p.trusses - 1) * p.spacing) / 2;
    for (let t = 0; t < p.trusses; t++) {
      const z = z0 + t * p.spacing;
      const B = (i) => [X(i), 0, z];
      const T = (i) => [X(i), top(i), z];
      const strut = (a, b, tone) => {
        m.strut(a, b, w, { tone });
        members++;
      };

      for (let i = 0; i < n; i++) {
        strut(B(i), B(i + 1), 'dark');
        strut(T(i), T(i + 1), 'dark');
      }
      for (let i = 0; i <= n; i++) {
        const end = i === 0 || i === n;
        if (p.type === 'warren' && !end) continue;
        strut(B(i), T(i), 'light');
      }
      for (let i = 0; i < n; i++) {
        const leftHalf = i < n / 2;
        let d;
        if (p.type === 'pratt') d = leftHalf ? 'down' : 'up';
        else if (p.type === 'howe') d = leftHalf ? 'up' : 'down';
        else if (p.type === 'warren') d = i % 2 ? 'down' : 'up';
        else d = dirs[i];
        // 'up' rises from left bottom to right top; 'down' falls.
        if (d === 'up' || d === 'x') strut(B(i), T(i + 1), 'light');
        if (d === 'down' || d === 'x') strut(T(i), B(i + 1), 'light');
      }

      // Bearings.
      for (const i of [0, n]) m.box({ size: [w * 3, w * 1.5, w * 3], at: [X(i), -w * 1.25, z], tone: 'mid' });
    }

    // Purlins at every top node, and cross bracing in alternate bays.
    if (p.trusses > 1) {
      const zl = z0 + (p.trusses - 1) * p.spacing;
      for (let i = 0; i <= n; i++) m.seg([X(i), top(i) + w / 2, z0], [X(i), top(i) + w / 2, zl]);
      if (p.bracing) {
        for (let t = 0; t < p.trusses - 1; t++) {
          const za = z0 + t * p.spacing;
          const zb = za + p.spacing;
          for (let i = t % 2; i < n; i += 2) {
            m.seg([X(i), top(i) + w / 2, za], [X(i + 1), top(i + 1) + w / 2, zb], 'thin');
            m.seg([X(i + 1), top(i + 1) + w / 2, za], [X(i), top(i) + w / 2, zb], 'thin');
          }
        }
      }
    }

    const zl = z0 + (p.trusses - 1) * p.spacing;
    m.dim([-L / 2, 0, zl], [L / 2, 0, zl], [0, 0, Math.max(2, L * 0.08)]);
    m.stat('Span/depth', (L / p.depth).toFixed(1));
    m.stat('Members', members);
    return m.build();
  },
};
