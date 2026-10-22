// Title block contents, shared by the on-screen sheet and the exports.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function drawingDate(d = new Date()) {
  return `${d.getDate()}·${ROMAN[d.getMonth()]}·${d.getFullYear()}`;
}

export const padSeed = (seed) => String(seed).padStart(6, '0');

export const padNumber = (n) => `No. ${String(n).padStart(2, '0')}`;

export function sheetMeta(gen, seed, projection, stats = []) {
  const scale =
    gen.dimension === '3d' ? (projection === 'persp' ? 'Persp. · NTS' : 'Axon. · NTS') : gen.scale || 'NTS';
  return {
    number: padNumber(gen.number),
    title: gen.title,
    note: gen.note,
    seed: padSeed(seed),
    scale,
    date: drawingDate(),
    stats,
  };
}
