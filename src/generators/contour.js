import { createDrawing } from '../lib/draw2d.js';

const RES = 96;

// Marching squares on a height grid: one SVG path per level.
function contourPaths(grid, n, cell, levels) {
  const out = [];
  const at = (i, j) => grid[j * (n + 1) + i];
  for (const lv of levels) {
    let dstr = '';
    let segs = 0;
    let mid = null;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const e = at(i, j + 1);
        const pts = [];
        const cross = (h0, h1, x0, y0, x1, y1) => {
          if ((h0 < lv) !== (h1 < lv)) {
            const t = (lv - h0) / (h1 - h0);
            pts.push([(x0 + (x1 - x0) * t) * cell, (y0 + (y1 - y0) * t) * cell]);
          }
        };
        cross(a, b, i, j, i + 1, j);
        cross(b, c, i + 1, j, i + 1, j + 1);
        cross(e, c, i, j + 1, i + 1, j + 1);
        cross(a, e, i, j, i, j + 1);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          const [p, q] = [pts[k], pts[k + 1]];
          dstr += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
          segs++;
          if (!mid && i > n * 0.25 && j > n * 0.2 && segs > 6) mid = { p, q };
        }
      }
    }
    if (dstr) out.push({ level: lv, d: dstr, mid });
  }
  return out;
}

export default {
  id: 'contour',
  title: 'Site, contoured',
  number: 13,
  dimension: '2d',
  scale: '1:1000',
  note: 'Ground that was never surveyed, levelled where something wants to stand.',
  params: [
    { key: 'size', label: 'Site', min: 40, max: 400, step: 10, default: 160, unit: 'm' },
    { key: 'relief', label: 'Relief', min: 2, max: 60, step: 1, default: 18, unit: 'm' },
    { key: 'interval', label: 'Interval', min: 0.25, max: 5, step: 0.25, default: 1, unit: 'm' },
    { key: 'index', label: 'Index every', min: 2, max: 10, step: 1, default: 5 },
    { key: 'scale', label: 'Feature scale', min: 0.5, max: 4, step: 0.1, default: 1.6 },
    { key: 'octaves', label: 'Roughness', min: 1, max: 6, step: 1, default: 4 },
    { key: 'terrace', label: 'Terracing', min: 0, max: 1, step: 0.05, default: 0 },
    { key: 'building', label: 'Platform', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const n = RES;
    const cell = p.size / n;
    const grid = new Float32Array((n + 1) * (n + 1));
    const tilt = [rng.range(-1, 1), rng.range(-1, 1)];

    let pad = null;
    if (p.building) {
      const br = rng.fork('platform');
      const w = p.size * br.range(0.14, 0.26);
      const h = w * br.range(0.45, 0.9);
      pad = { cx: p.size * br.range(0.35, 0.65), cy: p.size * br.range(0.35, 0.65), w, h, rot: br.range(-0.6, 0.6) };
    }
    const local = (x, y) => {
      const dx = x - pad.cx;
      const dy = y - pad.cy;
      const c = Math.cos(-pad.rot);
      const s = Math.sin(-pad.rot);
      return [dx * c - dy * s, dx * s + dy * c];
    };

    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const v = j / n;
        let h = p.relief * (0.5 + rng.fbm2(u * p.scale + 3.1, v * p.scale + 7.7, p.octaves));
        h += p.relief * 0.25 * (tilt[0] * u + tilt[1] * v);
        const step = p.interval * 3;
        h += (Math.round(h / step) * step - h) * p.terrace;
        grid[j * (n + 1) + i] = h;
      }
    }
    if (pad) {
      // Level the platform to the ground at its centre, feathering out.
      const ci = Math.round(pad.cx / cell);
      const cj = Math.round(pad.cy / cell);
      const level = grid[cj * (n + 1) + ci];
      const feather = Math.max(pad.w, pad.h) * 0.6;
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const [lx, ly] = local(i * cell, j * cell);
          const ox = Math.max(0, Math.abs(lx) - pad.w / 2);
          const oy = Math.max(0, Math.abs(ly) - pad.h / 2);
          const dist = Math.hypot(ox, oy);
          const k = Math.max(0, 1 - dist / feather);
          const s = k * k * (3 - 2 * k);
          const idx = j * (n + 1) + i;
          grid[idx] += (level - grid[idx]) * s;
        }
      }
      pad.level = level;
    }
    for (const h of grid) {
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }

    const levels = [];
    for (let l = Math.ceil(lo / p.interval) * p.interval; l <= hi; l += p.interval) levels.push(Number(l.toFixed(3)));
    const paths = contourPaths(grid, n, cell, levels);

    const S = p.size;
    const m = S * 0.1;
    const d = createDrawing([-m, -m, S + 2 * m, S + 2 * m]);
    const fs = S / 60;
    d.rect(0, 0, S, S, 'paper-line');
    for (const c of paths) {
      const isIndex = Math.round(c.level / p.interval) % p.index === 0;
      d.path(c.d, isIndex ? 'ink' : 'thin');
      if (isIndex && c.mid) {
        const [a, b] = [c.mid.p, c.mid.q];
        let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        const x = (a[0] + b[0]) / 2;
        const y = (a[1] + b[1]) / 2;
        d.circle(x, y, fs * 1.3, 'paper');
        d.text(x, y, c.level.toFixed(c.level % 1 ? 1 : 0), { size: fs * 0.9, anchor: 'middle', rotate: ang });
      }
    }

    if (pad) {
      const c = Math.cos(pad.rot);
      const s = Math.sin(pad.rot);
      const corners = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
      ].map(([a, b]) => {
        const x = (a * pad.w) / 2;
        const y = (b * pad.h) / 2;
        return [pad.cx + x * c - y * s, pad.cy + x * s + y * c];
      });
      d.poly(corners, 'hatch');
      const top = Math.min(...corners.map((q) => q[1]));
      d.text(pad.cx, top - fs * 1.2, `FFL +${pad.level.toFixed(2)}`, { size: fs * 0.9, anchor: 'middle', s: 'text-accent' });
    }

    // Spot heights.
    const sr = rng.fork('spots');
    for (let k = 0; k < 5; k++) {
      const i = sr.int(4, n - 4);
      const j = sr.int(4, n - 4);
      const x = i * cell;
      const y = j * cell;
      d.line(x - fs * 0.4, y - fs * 0.4, x + fs * 0.4, y + fs * 0.4, 'accent');
      d.line(x - fs * 0.4, y + fs * 0.4, x + fs * 0.4, y - fs * 0.4, 'accent');
      d.text(x + fs * 0.6, y - fs * 0.6, `+${grid[j * (n + 1) + i].toFixed(2)}`, { size: fs * 0.7, s: 'text-accent' });
    }

    d.dimH(0, S, -fs * 2, `${S} m`, fs);
    const bar = S >= 200 ? 50 : S >= 80 ? 20 : 10;
    d.scaleBar(0, S + fs * 2, bar, 4, fs * 0.4, `${bar * 4} m`, fs * 0.8);
    d.text(S, S + fs * 2.6, `${p.interval} m contours`, { size: fs * 0.8, anchor: 'end', s: 'text-faint' });

    d.stat('Fall', `${(hi - lo).toFixed(1)} m`);
    d.stat('Contours', paths.length);
    return d.build();
  },
};
