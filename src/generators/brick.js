import { createDrawing } from '../lib/draw2d.js';

// Work sizes in millimetres.
const S = 215;
const H = 102.5;
const Q = 46;
const T = 65;

// Unit sequence for course c, as widths tagged by kind.
function courseUnits(bond, c) {
  const odd = c % 2 === 1;
  switch (bond) {
    case 'stretcher':
      return odd ? ['h', 'S*'] : ['S*'];
    case 'header':
      return odd ? ['q', 'H*'] : ['H*'];
    case 'english':
      return odd ? ['H', 'q', 'H*'] : ['S*'];
    case 'flemish':
      return odd ? ['H', 'q', 'S', 'H', 'SH*'] : ['S', 'H', 'SH*'];
    case 'monk': {
      const shift = c % 3;
      return [...['H', 'S', 'S'].slice(shift), 'HSS*'];
    }
    case 'stack':
      return ['S*'];
    default:
      return [odd ? 'h' : 'S', 'R*'];
  }
}

// Expand a sequence (last token repeats) into units until the wall is full.
function layCourse(seq, width, m, rng, headerRatio) {
  const units = [];
  const sizes = { S, H, h: H, q: Q };
  let x = 0;
  let i = 0;
  const pattern = seq[seq.length - 1].replace('*', '');
  const head = seq.slice(0, -1);
  let r = 0;
  while (x < width - 1) {
    let kind;
    if (i < head.length) kind = head[i];
    else if (pattern === 'R') kind = rng.chance(headerRatio) ? 'H' : 'S';
    else kind = pattern[r++ % pattern.length];
    const w = sizes[kind];
    const cut = x + w > width;
    units.push({ x, w: cut ? width - x : w, kind: cut ? 'cut' : kind });
    x += w + m;
    i++;
  }
  return units;
}

export default {
  id: 'brick',
  title: 'Brick bond',
  number: 10,
  dimension: '2d',
  scale: '1:20',
  note: 'An elevation of coursed brickwork. Some bricks are missing, on purpose.',
  params: [
    {
      key: 'bond',
      label: 'Bond',
      type: 'select',
      options: [
        { value: 'stretcher', label: 'Stretcher' },
        { value: 'english', label: 'English' },
        { value: 'flemish', label: 'Flemish' },
        { value: 'header', label: 'Header' },
        { value: 'monk', label: 'Monk' },
        { value: 'stack', label: 'Stack' },
        { value: 'random', label: 'Random' },
      ],
      default: 'flemish',
    },
    { key: 'courses', label: 'Courses', min: 4, max: 40, step: 1, default: 18 },
    { key: 'length', label: 'Length', min: 4, max: 30, step: 1, default: 12, unit: 'st' },
    { key: 'mortar', label: 'Mortar joint', min: 2, max: 20, step: 1, default: 10, unit: 'mm' },
    { key: 'headerRatio', label: 'Header ratio', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'gaps', label: 'Hit and miss', min: 0, max: 0.6, step: 0.01, default: 0.04 },
    { key: 'wobble', label: 'Hand-made', min: 0, max: 1, step: 0.05, default: 0.25 },
    { key: 'opening', label: 'Opening', type: 'toggle', default: true },
  ],

  build(p, rng) {
    const m = p.mortar;
    const width = p.length * (S + m) - m;
    const ch = T + m;
    const height = p.courses * ch - m;
    const pad = Math.max(width, height) * 0.12;
    const d = createDrawing([-pad, -pad * 0.9, width + pad * 1.4, height + pad * 2]);
    const fs = Math.max(width, height) / 52;
    const lay = rng.fork('lay');
    const holes = rng.fork('gaps');
    const hand = rng.fork('hand');

    // A window: some stretchers wide, some courses high, a soldier course over.
    let win = null;
    if (p.opening && p.length >= 5 && p.courses >= 9) {
      const or = rng.fork('opening');
      const wSt = or.int(2, Math.max(2, Math.floor(p.length / 2.5)));
      const wC = or.int(4, Math.max(4, p.courses - 6));
      const x0 = (or.int(1, p.length - wSt - 1) + 0.5) * (S + m);
      const c0 = or.int(1, Math.max(1, p.courses - wC - 4));
      win = { x0, x1: x0 + wSt * (S + m) - m, c0, c1: c0 + wC, s0: c0 + wC, s1: c0 + wC + 3 };
    }
    const yOf = (c) => height - (c + 1) * ch + m;

    d.rect(0, 0, width, height, 'paper-line');
    let laid = 0;
    let missing = 0;

    for (let c = 0; c < p.courses; c++) {
      const units = layCourse(courseUnits(p.bond, c), width, m, lay, p.headerRatio);
      const y = yOf(c);
      const inWin = win && c >= win.c0 && c < win.c1;
      const inSoldier = win && c >= win.s0 && c < win.s1;
      for (const u of units) {
        let pieces = [[u.x, u.x + u.w]];
        if (inWin || inSoldier) {
          const a = inSoldier ? win.x0 - 2 * m : win.x0;
          const b = inSoldier ? win.x1 + 2 * m : win.x1;
          pieces = pieces.flatMap(([s, e]) => {
            if (e <= a || s >= b) return [[s, e]];
            const out = [];
            if (s < a - m) out.push([s, a - m]);
            if (e > b + m) out.push([b + m, e]);
            return out;
          });
        }
        for (const [s, e] of pieces) {
          const cut = e - s < u.w - 0.5 || u.kind === 'cut';
          if (holes.chance(p.gaps) && !cut) {
            d.rect(s, y, e - s, T, 'poche');
            missing++;
            continue;
          }
          const j = p.wobble * 3;
          const style = cut ? 'hatch' : u.kind === 'S' ? 'light' : u.kind === 'q' ? 'dark' : 'mid';
          d.rect(s + hand.range(-j, j) * 0.3, y + hand.range(-j, j) * 0.5, e - s + hand.range(-j, j), T + hand.range(-j, j) * 0.6, style);
          laid++;
        }
      }
    }

    if (win) {
      const yTop = yOf(win.c1 - 1);
      const yBot = yOf(win.c0) + T;
      d.rect(win.x0, yTop, win.x1 - win.x0, yBot - yTop, 'paper-line');
      d.line(win.x0, yTop, win.x1, yBot, 'thin');
      d.line(win.x1, yTop, win.x0, yBot, 'thin');
      // Soldier course: bricks on end, across the head of the opening.
      const sy = yOf(win.s1 - 1);
      const sh = yTop - m - sy;
      const a = win.x0 - 2 * m;
      const n = Math.max(1, Math.round((win.x1 - win.x0 + 4 * m + m) / (T + m)));
      const sw = (win.x1 - win.x0 + 4 * m - (n - 1) * m) / n;
      for (let k = 0; k < n; k++) d.rect(a + k * (sw + m), sy, sw, sh, 'mid');
      d.dimH(win.x0, win.x1, yBot + fs * 2.6, `${Math.round(win.x1 - win.x0)}`, fs);
    }

    d.dimH(0, width, -fs * 2.2, `${Math.round(width)}`, fs);
    const g = Math.min(4, p.courses);
    d.dimV(height - g * ch + m, height, -fs * 2.2, `${g}C = ${g * ch}`, fs);
    d.scaleBar(0, height + fs * 4.5, 250, 4, fs * 0.5, '1 m', fs * 0.9);
    d.text(width, height + fs * 5.2, `${p.bond} bond · ${m} mm joints`, { size: fs, anchor: 'end', s: 'text-faint' });

    d.stat('Bricks', laid);
    d.stat('Missing', missing);
    d.stat('Gauge', `${ch} mm`);
    return d.build();
  },
};
