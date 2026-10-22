import { createDrawing } from '../lib/draw2d.js';

const EPS = 1e-6;

// Shared edge between two rectangles, or null.
function sharedEdge(a, b) {
  if (Math.abs(a.x1 - b.x0) < EPS || Math.abs(b.x1 - a.x0) < EPS) {
    const x = Math.abs(a.x1 - b.x0) < EPS ? a.x1 : a.x0;
    const y0 = Math.max(a.y0, b.y0);
    const y1 = Math.min(a.y1, b.y1);
    return y1 - y0 > EPS ? { axis: 'v', at: x, from: y0, to: y1 } : null;
  }
  if (Math.abs(a.y1 - b.y0) < EPS || Math.abs(b.y1 - a.y0) < EPS) {
    const y = Math.abs(a.y1 - b.y0) < EPS ? a.y1 : a.y0;
    const x0 = Math.max(a.x0, b.x0);
    const x1 = Math.min(a.x1, b.x1);
    return x1 - x0 > EPS ? { axis: 'h', at: y, from: x0, to: x1 } : null;
  }
  return null;
}

export default {
  id: 'plan',
  title: 'Plan subdivision',
  number: 7,
  dimension: '2d',
  scale: '1:100',
  note: 'A rectangle divided, and divided again, until the rooms object.',
  params: [
    { key: 'width', label: 'Width', min: 8, max: 40, step: 0.5, default: 20, unit: 'm' },
    { key: 'depth', label: 'Depth', min: 6, max: 30, step: 0.5, default: 13, unit: 'm' },
    { key: 'levels', label: 'Split depth', min: 1, max: 8, step: 1, default: 5 },
    { key: 'minRoom', label: 'Min room', min: 2, max: 30, step: 0.5, default: 7, unit: 'm²' },
    { key: 'jitter', label: 'Split jitter', min: 0, max: 0.4, step: 0.01, default: 0.22 },
    { key: 'corridor', label: 'Corridor bias', min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: 'corridorWidth', label: 'Corridor width', min: 1, max: 2.4, step: 0.1, default: 1.4, unit: 'm' },
    { key: 'wall', label: 'Wall', min: 0.1, max: 0.4, step: 0.01, default: 0.15, unit: 'm' },
    { key: 'loops', label: 'Extra doors', min: 0, max: 1, step: 0.05, default: 0.2 },
    { key: 'labels', label: 'Room labels', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const W = p.width;
    const D = p.depth;
    const minSide = Math.sqrt(p.minRoom) * 0.7;
    const rooms = [];

    const split = (r, level) => {
      const w = r.x1 - r.x0;
      const h = r.y1 - r.y0;
      const area = w * h;
      if (level >= p.levels || area < p.minRoom * 2) {
        rooms.push(r);
        return;
      }
      const vertical = w > h ? rng.chance(0.85) : rng.chance(0.15);
      const len = vertical ? w : h;
      const corridor = rng.chance(p.corridor) && len > p.corridorWidth + 2 * minSide && level < p.levels - 1;
      const cw = corridor ? p.corridorWidth : 0;
      const t = 0.5 + p.jitter * rng.range(-1, 1);
      let a = len * t - cw / 2;
      a = Math.max(minSide, Math.min(len - minSide - cw, a));
      if (a < minSide - EPS || len - a - cw < minSide - EPS) {
        rooms.push(r);
        return;
      }
      const o = vertical ? r.x0 : r.y0;
      const mk = (s, e, extra = {}) =>
        vertical ? { x0: s, x1: e, y0: r.y0, y1: r.y1, ...extra } : { x0: r.x0, x1: r.x1, y0: s, y1: e, ...extra };
      split(mk(o, o + a), level + 1);
      if (corridor) rooms.push(mk(o + a, o + a + cw, { corridor: true }));
      split(mk(o + a + cw, o + len), level + 1);
    };
    split({ x0: 0, y0: 0, x1: W, y1: D }, 0);

    // Doors: a random spanning tree over adjacent rooms, plus a few loops.
    const dw = 0.9;
    const edges = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const e = sharedEdge(rooms[i], rooms[j]);
        if (e && e.to - e.from > dw + 0.5) edges.push({ i, j, e, w: rng.next() - (rooms[i].corridor || rooms[j].corridor ? 0.5 : 0) });
      }
    }
    edges.sort((a, b) => a.w - b.w);
    const parent = rooms.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const doors = [];
    for (const ed of edges) {
      const a = find(ed.i);
      const b = find(ed.j);
      if (a !== b) {
        parent[a] = b;
        doors.push(ed.e);
      } else if (rng.chance(p.loops * 0.5)) doors.push(ed.e);
    }

    const pad = Math.max(W, D) * 0.16;
    const d = createDrawing([-pad, -pad, W + pad * 2, D + pad * 2]);
    const fs = Math.max(W, D) / 55;
    const ow = p.wall * 1.8;

    d.rect(-ow, -ow, W + 2 * ow, D + 2 * ow, 'poche');
    rooms.forEach((r) => {
      const k = p.wall / 2;
      const x0 = r.x0 + (r.x0 < EPS ? 0 : k);
      const y0 = r.y0 + (r.y0 < EPS ? 0 : k);
      const x1 = r.x1 - (r.x1 > W - EPS ? 0 : k);
      const y1 = r.y1 - (r.y1 > D - EPS ? 0 : k);
      d.rect(x0, y0, x1 - x0, y1 - y0, r.corridor ? 'light' : 'paper-line');
    });

    // Openings through the wall, a leaf and its swing.
    const door = (e, thick) => {
      const span = e.to - e.from - dw - 0.3;
      const s = e.from + 0.15 + rng.range(0, Math.max(0, span));
      const flip = rng.chance(0.5);
      const side = rng.chance(0.5) ? 1 : -1;
      if (e.axis === 'v') {
        d.rect(e.at - thick, s, thick * 2, dw, 'paper');
        const hy = flip ? s : s + dw;
        const ty = flip ? s + dw : s;
        const tx = e.at + side * dw;
        d.line(e.at, hy, tx, hy, 'ink');
        d.path(`M ${tx} ${hy} A ${dw} ${dw} 0 0 ${(side > 0) === flip ? 1 : 0} ${e.at} ${ty}`, 'thin');
      } else {
        d.rect(s, e.at - thick, dw, thick * 2, 'paper');
        const hx = flip ? s : s + dw;
        const tx = flip ? s + dw : s;
        const ty = e.at + side * dw;
        d.line(hx, e.at, hx, ty, 'ink');
        d.path(`M ${hx} ${ty} A ${dw} ${dw} 0 0 ${(side > 0) !== flip ? 1 : 0} ${tx} ${e.at}`, 'thin');
      }
    };
    doors.forEach((e) => door(e, p.wall * 0.6));
    // One way in, through the outer wall of whichever room touches the bottom.
    const front = rooms.filter((r) => r.y1 > D - EPS && r.x1 - r.x0 > dw + 0.6);
    const entry = front.find((r) => r.corridor) || front[Math.floor(rng.next() * front.length)];
    if (entry) {
      const x = (entry.x0 + entry.x1) / 2 - dw / 2;
      d.rect(x, D - 0.01, dw, ow + 0.02, 'paper');
      d.line(x - 0.05, D + ow + 0.35, x + dw + 0.05, D + ow + 0.35, 'accent');
      d.text(x + dw / 2, D + ow + 0.35 + fs * 0.9, 'ENTRY', { size: fs * 0.7, anchor: 'middle', s: 'text-accent' });
    }

    if (p.labels) {
      let n = 1;
      rooms.forEach((r) => {
        const w = r.x1 - r.x0;
        const h = r.y1 - r.y0;
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        if (r.corridor) {
          if (Math.max(w, h) > fs * 8) d.text(cx, cy, 'CORR.', { size: fs * 0.7, anchor: 'middle', s: 'text-faint', rotate: h > w ? -90 : 0 });
          return;
        }
        if (w < fs * 3.2 || h < fs * 2.4) return;
        d.text(cx, cy - fs * 0.55, String(n++).padStart(2, '0'), { size: fs, anchor: 'middle' });
        d.text(cx, cy + fs * 0.65, `${(w * h).toFixed(1)} m²`, { size: fs * 0.7, anchor: 'middle', s: 'text-faint' });
      });
    }

    // Running dimensions along the top, from walls that reach it.
    const xs = [...new Set(rooms.filter((r) => r.y0 < EPS).flatMap((r) => [r.x0, r.x1]).map((x) => x.toFixed(3)))].map(Number).sort((a, b) => a - b);
    const yd = -ow - fs * 2.2;
    for (let i = 0; i < xs.length - 1; i++) d.dimH(xs[i], xs[i + 1], yd, (xs[i + 1] - xs[i]).toFixed(2), fs * 0.7, fs * 0.4);
    d.dimH(0, W, yd - fs * 2.2, W.toFixed(2), fs * 0.8, fs * 0.4);
    d.dimV(0, D, -ow - fs * 2.2, D.toFixed(2), fs * 0.8, fs * 0.4);

    // North point and scale bar.
    const na = rng.range(-35, 35);
    const nx = W + pad * 0.9;
    const ny = -pad * 0.35;
    const nr = fs * 1.6;
    d.circle(nx, ny + nr * 1.8, nr, 'ink');
    const rad = (na * Math.PI) / 180;
    d.poly(
      [
        [nx + Math.sin(rad) * nr * 1.25, ny + nr * 1.8 - Math.cos(rad) * nr * 1.25],
        [nx + Math.cos(rad) * nr * 0.35, ny + nr * 1.8 + Math.sin(rad) * nr * 0.35],
        [nx - Math.cos(rad) * nr * 0.35, ny + nr * 1.8 - Math.sin(rad) * nr * 0.35],
      ],
      'poche',
    );
    d.text(nx + Math.sin(rad) * nr * 2, ny + nr * 1.8 - Math.cos(rad) * nr * 2, 'N', { size: fs * 0.9, anchor: 'middle' });
    const step = W > 24 ? 2 : 1;
    d.scaleBar(0, D + ow + fs * 3.4, step, 5, fs * 0.35, `${step * 5} m`, fs * 0.7);

    d.stat('Rooms', rooms.filter((r) => !r.corridor).length);
    d.stat('Doors', doors.length + (entry ? 1 : 0));
    d.stat('GIA', `${(W * D).toFixed(0)} m²`);
    return d.build();
  },
};
