import { createModel } from '../lib/model3d.js';

const DEG = Math.PI / 180;

export default {
  id: 'roof',
  title: 'Roof',
  number: 11,
  dimension: '3d',
  note: 'A box with a hat. Dormers, a chimney, the usual negotiations.',
  params: [
    {
      key: 'type',
      label: 'Form',
      type: 'select',
      options: [
        { value: 'gable', label: 'Gable' },
        { value: 'hip', label: 'Hip' },
        { value: 'pyramid', label: 'Pyramid' },
        { value: 'mansard', label: 'Mansard' },
        { value: 'shed', label: 'Shed' },
        { value: 'sawtooth', label: 'Sawtooth' },
      ],
      default: 'hip',
    },
    { key: 'length', label: 'Length', min: 6, max: 30, step: 0.5, default: 14, unit: 'm' },
    { key: 'depth', label: 'Depth', min: 5, max: 16, step: 0.5, default: 8, unit: 'm' },
    { key: 'wall', label: 'Eaves height', min: 2, max: 8, step: 0.1, default: 3.2, unit: 'm' },
    { key: 'pitch', label: 'Pitch', min: 10, max: 60, step: 1, default: 38, unit: '°' },
    { key: 'overhang', label: 'Overhang', min: 0, max: 1.2, step: 0.05, default: 0.45, unit: 'm' },
    { key: 'dormers', label: 'Dormers', min: 0, max: 8, step: 1, default: 3 },
    { key: 'dormerWidth', label: 'Dormer width', min: 0.8, max: 2.5, step: 0.05, default: 1.3, unit: 'm' },
    { key: 'chimneys', label: 'Chimneys', min: 0, max: 3, step: 1, default: 1 },
    { key: 'teeth', label: 'Sawteeth', min: 2, max: 10, step: 1, default: 4 },
  ],

  build(p, rng) {
    const m = createModel();
    const L = p.length;
    const D = p.depth;
    const yE = p.wall;
    const t = Math.tan(p.pitch * DEG);
    const o = p.overhang;
    const roof = { tone: 'hatch', crease: 5 };
    const ex = L / 2 + o;
    const ez = D / 2 + o;
    const yo = yE - o * t;

    m.box({ size: [L, yE, D], at: [0, yE / 2, 0], tone: 'light' });

    // Height of the roof surface over a point on the front (z > 0) slope.
    let frontSlope = null;
    let ridgeY = yE;
    let ridgeX = 0;

    if (p.type === 'gable') {
      ridgeY = yE + (D / 2) * t;
      m.quad([-ex, yo, ez], [ex, yo, ez], [ex, ridgeY, 0], [-ex, ridgeY, 0], roof);
      m.quad([-ex, yo, -ez], [-ex, ridgeY, 0], [ex, ridgeY, 0], [ex, yo, -ez], roof);
      for (const s of [-1, 1]) m.tri([s * L / 2, yE, -D / 2], [s * L / 2, yE, D / 2], [s * L / 2, ridgeY, 0], { tone: 'light' });
      frontSlope = (z) => yE + (D / 2 - z) * t;
      ridgeX = L / 2;
    } else if (p.type === 'hip' || p.type === 'pyramid') {
      const short = Math.min(L, D) / 2;
      ridgeY = yE + short * t;
      const rx = p.type === 'pyramid' ? 0 : Math.max(0, L / 2 - short);
      const rz = p.type === 'pyramid' ? 0 : Math.max(0, D / 2 - short);
      m.poly([[-ex, yo, ez], [ex, yo, ez], [rx, ridgeY, rz], [-rx, ridgeY, rz]], roof);
      m.poly([[ex, yo, -ez], [-ex, yo, -ez], [-rx, ridgeY, -rz], [rx, ridgeY, -rz]], roof);
      m.poly([[ex, yo, ez], [ex, yo, -ez], [rx, ridgeY, -rz], [rx, ridgeY, rz]], roof);
      m.poly([[-ex, yo, -ez], [-ex, yo, ez], [-rx, ridgeY, rz], [-rx, ridgeY, -rz]], roof);
      if (p.type === 'hip' && L >= D) frontSlope = (z) => yE + (D / 2 - z) * t;
      ridgeX = rx;
    } else if (p.type === 'mansard') {
      // Steep lower slope to a curb, then a shallow hip above it.
      const steep = Math.tan(Math.min(78, p.pitch + 32) * DEG);
      const inset = Math.min(D, L) * 0.16;
      const yC = yE + inset * steep;
      const ix = L / 2 - inset;
      const iz = D / 2 - inset;
      const loC = (x, z) => [x, yC, z];
      const yl = yE - o * steep;
      const ring = [[-ex, yl, ez], [ex, yl, ez], [ex, yl, -ez], [-ex, yl, -ez]];
      const curb = [loC(-ix, iz), loC(ix, iz), loC(ix, -iz), loC(-ix, -iz)];
      for (let i = 0; i < 4; i++) m.poly([ring[i], ring[(i + 1) % 4], curb[(i + 1) % 4], curb[i]], roof);
      const shallow = Math.tan(p.pitch * 0.35 * DEG);
      const short = Math.min(ix, iz);
      ridgeY = yC + short * shallow;
      const rx = Math.max(0, ix - short);
      const rz = Math.max(0, iz - short);
      const top = [[-rx, ridgeY, rz], [rx, ridgeY, rz], [rx, ridgeY, -rz], [-rx, ridgeY, -rz]];
      for (let i = 0; i < 4; i++) m.poly([curb[i], curb[(i + 1) % 4], top[(i + 1) % 4], top[i]], { tone: 'mid', crease: 5 });
      frontSlope = (z) => (z > iz ? yE + (D / 2 - z) * steep : yC);
      ridgeX = ix;
    } else if (p.type === 'shed') {
      ridgeY = yE + D * t;
      const yHi = yE + (D + o) * t;
      m.quad([-ex, yo, ez], [ex, yo, ez], [ex, yHi, -ez], [-ex, yHi, -ez], roof);
      m.quad([-L / 2, yE, D / 2], [L / 2, yE, D / 2], [L / 2, yE, -D / 2], [-L / 2, yE, -D / 2], { tone: 'light' });
      m.quad([-L / 2, yE, -D / 2], [L / 2, yE, -D / 2], [L / 2, ridgeY, -D / 2], [-L / 2, ridgeY, -D / 2], { tone: 'light' });
      for (const s of [-1, 1]) m.tri([s * L / 2, yE, -D / 2], [s * L / 2, yE, D / 2], [s * L / 2, ridgeY, -D / 2], { tone: 'light' });
      frontSlope = (z) => yE + (D / 2 - z) * t;
      ridgeX = L / 2;
    } else {
      // Sawtooth: north lights along x.
      const n = p.teeth;
      const w = L / n;
      const hT = Math.min(w * t, D);
      ridgeY = yE + hT;
      for (let k = 0; k < n; k++) {
        const x0 = -L / 2 + k * w;
        const x1 = x0 + w;
        m.quad([x0, yE, ez], [x0, yE, -ez], [x0, yE + hT, -ez], [x0, yE + hT, ez], { tone: 'mid', crease: 5 });
        m.quad([x0, yE + hT, ez], [x0, yE + hT, -ez], [x1, yE, -ez], [x1, yE, ez], roof);
        for (const s of [-1, 1]) m.tri([x0, yE, (s * D) / 2], [x0, yE + hT, (s * D) / 2], [x1, yE, (s * D) / 2], { tone: 'light' });
        for (let g = 1; g < 4; g++) m.seg([x0 - 0.01, yE + (hT * g) / 4, ez], [x0 - 0.01, yE + (hT * g) / 4, -ez], 'thin');
      }
    }

    // Dormers on the front slope, spaced along the ridge.
    let placed = 0;
    if (frontSlope && p.dormers > 0) {
      const dr = rng.fork('dormers');
      const room = Math.max(0, Math.min(L / 2 - 0.8, ridgeX + D * 0.15));
      const zf = D / 2 - Math.min(1.1, D * 0.15);
      const yf = frontSlope(zf);
      const dh = Math.min(1.5, Math.max(0.6, (ridgeY - yf) * 0.6));
      for (let i = 0; i < p.dormers; i++) {
        const u = p.dormers === 1 ? 0 : (i / (p.dormers - 1)) * 2 - 1;
        const dw = p.dormerWidth * dr.range(0.9, 1.1);
        const cx = u * room + dr.range(-0.12, 0.12);
        if (Math.abs(cx) + dw / 2 > L / 2 - 0.3) continue;
        // Run back into the roof until the slope rises past the dormer top.
        let zb = zf;
        while (zb > -D / 2 && frontSlope(zb) < yf + dh) zb -= 0.05;
        const depth = zf - zb + 0.05;
        m.box({ size: [dw, dh, depth], at: [cx, yf + dh / 2, zf - depth / 2], tone: 'light' });
        m.box({ size: [dw * 0.55, dh * 0.6, 0.02], at: [cx, yf + dh * 0.45, zf + 0.011], tone: 'dark' });
        const ry = yf + dh + (dw / 2) * 0.8;
        const e = 0.12;
        m.quad([cx - dw / 2 - e, yf + dh - 0.08, zf + e], [cx, ry, zf + e], [cx, ry, zb], [cx - dw / 2 - e, yf + dh - 0.08, zb], roof);
        m.quad([cx, ry, zf + e], [cx + dw / 2 + e, yf + dh - 0.08, zf + e], [cx + dw / 2 + e, yf + dh - 0.08, zb], [cx, ry, zb], roof);
        m.tri([cx - dw / 2, yf + dh, zf], [cx + dw / 2, yf + dh, zf], [cx, ry, zf], { tone: 'light' });
        placed++;
      }
    }

    const cr = rng.fork('chimneys');
    for (let c = 0; c < p.chimneys; c++) {
      const x = cr.range(-L / 2 + 1, L / 2 - 1);
      const z = cr.range(-D / 3, 0);
      m.box({ size: [0.6, ridgeY + 1.1, 0.9], at: [x, (ridgeY + 1.1) / 2, z], tone: 'mid' });
      m.box({ size: [0.75, 0.12, 1.05], at: [x, ridgeY + 1.16, z], tone: 'dark' });
    }

    m.dim([-L / 2, 0, D / 2], [-L / 2, ridgeY, D / 2], [-1.4, 0, 0.8]);
    m.stat('Ridge', `${ridgeY.toFixed(2)} m`);
    m.stat('Pitch', `${p.pitch}°`);
    m.stat('Dormers', placed);
    return m.build();
  },
};
