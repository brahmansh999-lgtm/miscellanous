// Builder for 2D specimens. Coordinates are drawing units, y pointing down.
// Each item carries a style name that Viewport2D maps to fill/stroke:
//   'poche' 'paper' 'paper-line' 'light' 'mid' 'dark' 'hatch'
//   'ink' 'heavy' 'thin' 'dash' 'accent' 'accent-fill'
//   'text' 'text-accent' 'text-faint'

const r3 = (n) => Math.round(n * 1000) / 1000;

export function createDrawing(bounds) {
  const items = [];
  const stats = [];

  const d = {
    stats,
    stat(label, value) {
      stats.push([label, value]);
    },
    rect(x, y, w, h, s = 'ink', rot = 0) {
      items.push({ k: 'rect', x: r3(x), y: r3(y), w: r3(w), h: r3(h), s, rot });
    },
    poly(pts, s = 'ink') {
      items.push({ k: 'poly', pts: pts.map((p) => `${r3(p[0])},${r3(p[1])}`).join(' '), s });
    },
    polyline(pts, s = 'ink') {
      items.push({ k: 'polyline', pts: pts.map((p) => `${r3(p[0])},${r3(p[1])}`).join(' '), s });
    },
    line(x1, y1, x2, y2, s = 'ink') {
      items.push({ k: 'line', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
    },
    path(dstr, s = 'ink') {
      items.push({ k: 'path', d: dstr, s });
    },
    circle(cx, cy, r, s = 'ink') {
      items.push({ k: 'circle', cx: r3(cx), cy: r3(cy), r: r3(r), s });
    },
    text(x, y, str, { size = 1, anchor = 'start', s = 'text', rotate = 0 } = {}) {
      items.push({ k: 'text', x: r3(x), y: r3(y), str: String(str), size, anchor, s, rotate });
    },

    // Horizontal dimension between x1 and x2 at height y, with ticks.
    dimH(x1, x2, y, label, size, tick) {
      const t = tick ?? size * 0.5;
      d.line(x1 - t * 0.6, y, x2 + t * 0.6, y, 'accent');
      for (const x of [x1, x2]) {
        d.line(x - t * 0.5, y + t * 0.5, x + t * 0.5, y - t * 0.5, 'accent');
        d.line(x, y - t, x, y + t * 0.6, 'accent');
      }
      if (label != null) d.text((x1 + x2) / 2, y - size * 0.45, label, { size, anchor: 'middle', s: 'text-accent' });
    },

    // Vertical dimension between y1 and y2 at x, label rotated.
    dimV(y1, y2, x, label, size, tick) {
      const t = tick ?? size * 0.5;
      d.line(x, y1 - t * 0.6, x, y2 + t * 0.6, 'accent');
      for (const y of [y1, y2]) {
        d.line(x - t * 0.5, y + t * 0.5, x + t * 0.5, y - t * 0.5, 'accent');
        d.line(x - t * 0.6, y, x + t, y, 'accent');
      }
      if (label != null) d.text(x - size * 0.45, (y1 + y2) / 2, label, { size, anchor: 'middle', s: 'text-accent', rotate: -90 });
    },

    // A graphic scale bar: `n` segments of `step` units each.
    scaleBar(x, y, step, n, h, label, size) {
      for (let i = 0; i < n; i++) d.rect(x + i * step, y, step, h, i % 2 ? 'paper-line' : 'poche');
      d.text(x, y + h + size * 1.2, '0', { size, s: 'text-faint' });
      d.text(x + n * step, y + h + size * 1.2, label, { size, anchor: 'end', s: 'text-faint' });
    },

    build() {
      return { kind: '2d', bounds, items, stats };
    },
  };
  return d;
}
