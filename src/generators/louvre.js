import { createDrawing } from '../lib/draw2d.js';

const DEG = Math.PI / 180;

export default {
  id: 'louvre',
  title: 'Louvre field',
  number: 12,
  dimension: '2d',
  scale: '1:50',
  note: 'Pivoting blades in plan, each turned by a field. Closed is parallel to the wall.',
  params: [
    { key: 'cols', label: 'Blades across', min: 4, max: 60, step: 1, default: 26 },
    { key: 'rows', label: 'Banks', min: 1, max: 40, step: 1, default: 14 },
    {
      key: 'field',
      label: 'Field',
      type: 'select',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'radial', label: 'Radial' },
        { value: 'noise', label: 'Noise' },
        { value: 'attract', label: 'Attractors' },
        { value: 'shear', label: 'Shear' },
      ],
      default: 'sine',
    },
    { key: 'amplitude', label: 'Amplitude', min: 0, max: 90, step: 1, default: 70, unit: '°' },
    { key: 'frequency', label: 'Frequency', min: 0.2, max: 4, step: 0.05, default: 1.1 },
    { key: 'phase', label: 'Phase', min: 0, max: 360, step: 5, default: 0, unit: '°' },
    { key: 'noise', label: 'Noise', min: 0, max: 45, step: 1, default: 6, unit: '°' },
    { key: 'blade', label: 'Blade length', min: 0.3, max: 1.2, step: 0.01, default: 0.86 },
    { key: 'thick', label: 'Blade thickness', min: 0.02, max: 0.25, step: 0.01, default: 0.08 },
    { key: 'pivots', label: 'Pivots', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const pitch = 1;
    const W = p.cols * pitch;
    const Hh = p.rows * pitch;
    const pad = Math.max(W, Hh) * 0.1;
    const d = createDrawing([-pad, -pad, W + pad * 2, Hh + pad * 2]);
    const fs = Math.max(W, Hh) / 50;
    const attractors = Array.from({ length: rng.int(2, 4) }, () => [rng.range(0, 1), rng.range(0, 1), rng.sign()]);
    const ph = p.phase * DEG;
    const asp = Hh / W;

    const angle = (u, v) => {
      let a;
      switch (p.field) {
        case 'radial':
          a = p.amplitude * Math.sin(p.frequency * Math.PI * 2 * Math.hypot(u - 0.5, (v - 0.5) * asp) + ph);
          break;
        case 'noise':
          a = p.amplitude * rng.noise2(u * p.frequency * 3 + p.phase / 90, v * asp * p.frequency * 3);
          break;
        case 'attract': {
          let fx = 0;
          let fy = 0;
          for (const [ax, ay, s] of attractors) {
            const dx = ax - u;
            const dy = (ay - v) * asp;
            const r2 = dx * dx + dy * dy + 0.01;
            fx += (s * dx) / r2;
            fy += (s * dy) / r2;
          }
          a = (Math.atan2(fy, fx) / DEG) * (p.amplitude / 90) + p.phase;
          break;
        }
        case 'shear':
          a = p.amplitude * Math.sin(p.frequency * (u - v * asp) * Math.PI + ph);
          break;
        default:
          a = p.amplitude * Math.sin(p.frequency * Math.PI * 2 * u + ph) * Math.cos(p.frequency * Math.PI * v * asp);
      }
      return a + p.noise * rng.noise2(u * 9.1 + 40, v * 9.1 * asp);
    };

    // The wall line each bank hangs from, with fixing ticks.
    for (let r = 0; r <= p.rows; r++) {
      d.line(0, r * pitch, W, r * pitch, 'thin');
    }
    d.rect(0, 0, W, Hh, 'ink');

    let open = 0;
    const L = p.blade * pitch;
    const t = p.thick * pitch;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        const cx = (c + 0.5) * pitch;
        const cy = (r + 0.5) * pitch;
        const a = angle((c + 0.5) / p.cols, (r + 0.5) / p.rows);
        open += Math.abs(Math.sin(a * DEG));
        d.rect(cx - L / 2, cy - t / 2, L, t, 'poche', -a);
        if (p.pivots) d.circle(cx, cy, Math.min(t * 0.32, 0.05), 'paper');
      }
    }
    const pct = Math.round((100 * open) / (p.rows * p.cols));

    d.dimH(0, pitch, -fs * 1.8, `${pitch * 1000}`, fs * 0.8);
    d.dimH(0, W, -fs * 4, `${W.toFixed(0)} × ${pitch * 1000} c/c`, fs * 0.8);
    d.text(W, Hh + fs * 2, `field: ${p.field} · open ${pct}%`, { size: fs, anchor: 'end', s: 'text-faint' });
    d.scaleBar(0, Hh + fs * 1.5, 1, 3, fs * 0.35, '3 m', fs * 0.7);

    d.stat('Blades', p.rows * p.cols);
    d.stat('Open', `${pct}%`);
    return d.build();
  },
};
