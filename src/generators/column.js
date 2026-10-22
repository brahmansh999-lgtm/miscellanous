import { createModel, matrix } from '../lib/model3d.js';

const TAU = Math.PI * 2;

export default {
  id: 'column',
  title: 'Column',
  number: 2,
  dimension: '3d',
  note: 'Shaft, swelling and channels. Drums may have been robbed.',
  params: [
    { key: 'count', label: 'Columns', min: 1, max: 7, step: 1, default: 3 },
    { key: 'spacing', label: 'Intercolumniation', min: 1.5, max: 5, step: 0.25, default: 2.5, unit: 'D' },
    { key: 'height', label: 'Height', min: 2, max: 10, step: 0.1, default: 6, unit: 'm' },
    { key: 'diameter', label: 'Diameter', min: 0.3, max: 1.4, step: 0.05, default: 0.7, unit: 'm' },
    { key: 'entasis', label: 'Entasis', min: 0, max: 0.12, step: 0.005, default: 0.04 },
    { key: 'taper', label: 'Taper', min: 0, max: 0.35, step: 0.01, default: 0.15 },
    { key: 'flutes', label: 'Flutes', min: 0, max: 36, step: 1, default: 20 },
    { key: 'fluteDepth', label: 'Flute depth', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'drums', label: 'Drums', min: 1, max: 12, step: 1, default: 5 },
    { key: 'ruin', label: 'Ruin', min: 0, max: 1, step: 0.05, default: 0 },
    {
      key: 'capital',
      label: 'Capital',
      type: 'select',
      options: [
        { value: 'block', label: 'Block' },
        { value: 'disc', label: 'Disc' },
        { value: 'splay', label: 'Splay' },
        { value: 'stack', label: 'Stack' },
        { value: 'none', label: 'None' },
      ],
      default: 'block',
    },
    {
      key: 'base',
      label: 'Base',
      type: 'select',
      options: [
        { value: 'plinth', label: 'Plinth' },
        { value: 'torus', label: 'Torus' },
        { value: 'none', label: 'None' },
      ],
      default: 'plinth',
    },
    { key: 'lintel', label: 'Lintel', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = createModel();
    const D = p.diameter;
    const R0 = D / 2;
    const baseH = p.base === 'none' ? 0 : D * 0.32;
    const capH = p.capital === 'none' ? 0 : D * 0.45;
    const shaftH = Math.max(p.height - baseH - capH, D);
    const y0 = baseH;
    const pitch = p.spacing * D;
    const x0 = (-(p.count - 1) * pitch) / 2;

    const radiusAt = (y) => {
      const t = Math.min(1, Math.max(0, (y - y0) / shaftH));
      return R0 * (1 - p.taper * t) * (1 + p.entasis * Math.sin(Math.PI * Math.min(1, t * 1.25)));
    };
    const flute = (theta, y, r) => {
      if (!p.flutes) return r;
      const phase = ((((theta * p.flutes) / TAU) % 1) + 1) % 1;
      return r * (1 - p.fluteDepth * 0.11 * Math.pow(Math.sin(Math.PI * phase), 0.7));
    };
    const segs = p.flutes ? Math.min(p.flutes * 6, 180) : 48;
    let standing = 0;
    let tallest = 0;

    for (let c = 0; c < p.count; c++) {
      const r = rng.fork(`col-${c}`);
      const cx = x0 + c * pitch;
      const lost = p.ruin > 0 ? Math.floor(Math.pow(r.next(), 1.6) * p.ruin * (p.drums + 0.999)) : 0;
      const kept = p.drums - lost;
      const whole = kept === p.drums;
      if (whole) standing++;

      if (p.base === 'plinth') {
        m.box({ size: [D * 1.38, baseH, D * 1.38], at: [cx, baseH / 2, 0], tone: 'mid' });
      } else if (p.base === 'torus') {
        const prof = [];
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI;
          prof.push([R0 * 1.12 + Math.sin(a) * baseH * 0.45, baseH * (i / 8)]);
        }
        m.lathe([[0, 0], ...prof, [0, baseH]], 40, { tone: 'mid', crease: 50, m: matrix({ at: [cx, 0, 0] }) });
      }

      const drumH = shaftH / p.drums;
      let topY = y0;
      for (let d = 0; d < kept; d++) {
        const ya = y0 + d * drumH;
        const yb = ya + drumH;
        const ox = p.ruin * r.gauss() * 0.012 * D * d;
        const oz = p.ruin * r.gauss() * 0.012 * D * d;
        const prof = [];
        const rings = 6;
        for (let k = 0; k <= rings; k++) {
          const yy = ya + (k / rings) * drumH;
          prof.push([radiusAt(yy), yy]);
        }
        const twist = p.ruin * r.range(-0.15, 0.15);
        const mm = { tone: 'light', crease: 70 };
        const shift = (fn) => (t, y, rr) => fn(t + twist, y, rr);
        const tm = shiftTo(cx + ox, oz);
        m.lathe(prof, segs, { ...mm, m: tm }, shift(flute));
        m.lathe([[0, yb], [radiusAt(yb), yb]], segs, { ...mm, m: tm }, shift(flute));
        m.lathe([[radiusAt(ya), ya], [0, ya]], segs, { ...mm, m: tm }, shift(flute));
        // Arrises or meridians, drawn as linework for the curved surface.
        const lines = p.flutes || 16;
        for (let k = 0; k < lines; k++) {
          const th = (k / lines) * TAU + twist;
          const pts = prof.map(([rr, yy]) => [cx + ox + Math.cos(th) * flute(th - twist, yy, rr), yy, oz + Math.sin(th) * flute(th - twist, yy, rr)]);
          m.polyline(pts, p.flutes ? 'ink' : 'thin');
        }
        topY = yb;
      }
      tallest = Math.max(tallest, topY);

      if (!whole) continue;
      const rt = radiusAt(y0 + shaftH);
      const yc = y0 + shaftH;
      const tm = shiftTo(cx, 0);
      if (p.capital === 'block') {
        m.lathe(curve(rt, R0 * 1.3, yc, yc + capH * 0.55, 0.5), 48, { tone: 'mid', crease: 60, m: tm });
        m.box({ size: [D * 1.42, capH * 0.45, D * 1.42], at: [cx, yc + capH * 0.775, 0], tone: 'mid' });
      } else if (p.capital === 'disc') {
        let yy = yc;
        for (let k = 0; k < 3; k++) {
          const hh = capH / 3;
          const rr = R0 * (1.05 + k * 0.18);
          m.lathe([[0, yy], [rr, yy], [rr, yy + hh], [0, yy + hh]], 48, { tone: 'mid', crease: 40, m: tm });
          yy += hh;
        }
      } else if (p.capital === 'splay') {
        m.lathe(curve(rt, R0 * 1.75, yc, yc + capH, 2.2), 48, { tone: 'mid', crease: 60, m: tm });
        m.lathe([[0, yc + capH], [R0 * 1.75, yc + capH]], 48, { tone: 'mid', m: tm });
      } else if (p.capital === 'stack') {
        const cr = rng.fork('stack');
        let yy = yc;
        const n = cr.int(2, 5);
        for (let k = 0; k < n; k++) {
          const hh = capH / n;
          const w = R0 * cr.range(0.9, 1.6) * 2;
          if (cr.chance(0.5)) m.box({ size: [w, hh, w], at: [cx, yy + hh / 2, 0], rot: [0, cr.range(0, 1.5), 0], tone: 'mid' });
          else m.lathe([[0, yy], [w / 2, yy], [w / 2, yy + hh], [0, yy + hh]], 40, { tone: 'mid', crease: 40, m: tm });
          yy += hh;
        }
      }
    }

    if (p.lintel && p.count > 1 && standing === p.count) {
      const span = (p.count - 1) * pitch + D * 1.6;
      m.box({ size: [span, D * 0.7, D * 1.3], at: [0, p.height + D * 0.35, 0], tone: 'hatch' });
      tallest = p.height + D * 0.7;
    }

    m.dim([x0 - D, 0, 0], [x0 - D, p.height, 0], [-D * 1.2, 0, 0]);
    m.stat('H', `${p.height.toFixed(1)} m`);
    m.stat('H/D', (p.height / D).toFixed(1));
    m.stat('Standing', `${standing}/${p.count}`);
    return m.build();
  },
};

function shiftTo(x, z) {
  return matrix({ at: [x, 0, z] });
}

// Profile of a concave or convex flare from r0 to r1 between y0 and y1,
// closed back to the axis at the top.
function curve(r0, r1, y0, y1, power) {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    out.push([r0 + (r1 - r0) * Math.pow(t, power), y0 + (y1 - y0) * t]);
  }
  return out;
}
