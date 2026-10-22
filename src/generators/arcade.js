import { ExtrudeGeometry, Shape } from 'three';
import { createModel, matrix } from '../lib/model3d.js';
import { ARCH_PROFILES, archRise, archY } from '../lib/arch.js';

const ARCH_SEGS = 20;

export default {
  id: 'arcade',
  title: 'Arcade',
  number: 9,
  dimension: '3d',
  note: 'Openings in a wall, in a row; upper storeys halve the rhythm.',
  params: [
    { key: 'arches', label: 'Arches', min: 1, max: 12, step: 1, default: 5 },
    { key: 'span', label: 'Opening', min: 1, max: 6, step: 0.1, default: 3, unit: 'm' },
    { key: 'pier', label: 'Pier width', min: 0.2, max: 2.5, step: 0.05, default: 0.8, unit: 'm' },
    { key: 'pierHeight', label: 'Pier height', min: 1, max: 8, step: 0.1, default: 3.2, unit: 'm' },
    { key: 'profile', label: 'Arch', type: 'select', options: ARCH_PROFILES, default: 'round' },
    { key: 'depth', label: 'Wall depth', min: 0.2, max: 3, step: 0.05, default: 0.8, unit: 'm' },
    { key: 'storeys', label: 'Storeys', min: 1, max: 3, step: 1, default: 2 },
    { key: 'parapet', label: 'Parapet', min: 0.2, max: 2.5, step: 0.05, default: 0.9, unit: 'm' },
    { key: 'blind', label: 'Blind arches', min: 0, max: 1, step: 0.05, default: 0.15 },
    { key: 'irregular', label: 'Irregularity', min: 0, max: 1, step: 0.05, default: 0 },
  ],

  build(p, rng) {
    const m = createModel();
    const W = p.arches * p.span + (p.arches + 1) * p.pier;
    let y = 0;
    let openings = 0;
    let blinds = 0;

    for (let s = 0; s < p.storeys; s++) {
      const r = rng.fork(`storey-${s}`);
      const count = p.arches * Math.pow(2, s);
      const pier = p.pier / Math.pow(1.6, s);
      const span = (W - (count + 1) * pier) / count;
      if (span < 0.25) break; // no room left for another storey of openings
      const ph = p.pierHeight * Math.pow(0.62, s);
      const rise = archRise(span / 2, p.profile);
      const top = s === p.storeys - 1 ? p.parapet : 0.45;
      const H = ph + rise + Math.max(top, 0.3);

      // Opening edges along x, nudged by the irregularity.
      const edges = [];
      let x = pier;
      for (let i = 0; i < count; i++) {
        const j = p.irregular * span * 0.18;
        const a = x + r.range(-j, j) * (i > 0 ? 1 : 0);
        const b = x + span + r.range(-j, j) * (i < count - 1 ? 1 : 0);
        edges.push([a, b]);
        x += span + pier;
      }

      // One outline, openings as notches from the bottom edge.
      const shape = new Shape();
      shape.moveTo(0, 0);
      const blindSet = [];
      for (const [a, b] of edges) {
        const blind = r.chance(p.blind);
        blindSet.push(blind);
        shape.lineTo(a, 0);
        shape.lineTo(a, ph);
        const hs = (b - a) / 2;
        const rr = archRise(hs, p.profile);
        for (let k = 1; k < ARCH_SEGS; k++) {
          const t = (k / ARCH_SEGS) * 2 - 1;
          shape.lineTo(a + hs * (t + 1), ph + archY(t, rr, p.profile));
        }
        shape.lineTo(b, ph);
        shape.lineTo(b, 0);
      }
      shape.lineTo(W, 0);
      shape.lineTo(W, H);
      shape.lineTo(0, H);
      shape.closePath();

      const geo = new ExtrudeGeometry(shape, { depth: p.depth, bevelEnabled: false, curveSegments: 1 });
      m.geometry(geo, { tone: 'light', crease: 35, m: matrix({ at: [-W / 2, y, -p.depth / 2] }) });

      // Blind arches: a recessed infill panel, hatched.
      edges.forEach(([a, b], i) => {
        if (!blindSet[i]) {
          openings++;
          return;
        }
        blinds++;
        const hs = (b - a) / 2;
        const rr = archRise(hs, p.profile);
        const pts = [[a, 0]];
        for (let k = 0; k <= ARCH_SEGS; k++) {
          const t = (k / ARCH_SEGS) * 2 - 1;
          pts.push([a + hs * (t + 1), ph + archY(t, rr, p.profile)]);
        }
        pts.push([b, 0]);
        const zf = p.depth * 0.15;
        m.poly(pts.map(([px, py]) => [px - W / 2, y + py, zf]), { tone: 'hatch', crease: 80 });
      });

      // String course between storeys.
      m.box({ size: [W + 0.3, 0.18, p.depth + 0.2], at: [0, y + H + 0.09, 0], tone: 'mid' });
      y += H + 0.18;
    }

    m.dim([-W / 2, 0, p.depth / 2], [W / 2, 0, p.depth / 2], [0, 0, 1.5]);
    m.stat('Length', `${W.toFixed(1)} m`);
    m.stat('Open', openings);
    m.stat('Blind', blinds);
    return m.build();
  },
};
