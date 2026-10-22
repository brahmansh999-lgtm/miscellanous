import { useEffect, useMemo, useRef, useState } from 'react';
import { FONT_MONO } from '../lib/palette.js';

const PAD = 0.07;
const MIN_Z = 0.5;
const MAX_Z = 24;

// Style name -> SVG presentation attributes. Plain attributes (not CSS
// classes) so the serialised markup stands alone when exported.
function styleAttrs(s, pal) {
  const nss = { vectorEffect: 'non-scaling-stroke' };
  switch (s) {
    case 'poche':
      return { fill: pal.dark, stroke: pal.ink, strokeWidth: 1, ...nss };
    case 'paper':
      return { fill: pal.paper, stroke: 'none' };
    case 'paper-line':
      return { fill: pal.paper, stroke: pal.ink, strokeWidth: 1, ...nss };
    case 'light':
    case 'mid':
    case 'dark':
      return { fill: pal[s], stroke: pal.ink, strokeWidth: 1, ...nss };
    case 'hatch':
      return { fill: 'url(#spc-hatch)', stroke: pal.ink, strokeWidth: 1, ...nss };
    case 'hatch-open':
      return { fill: 'url(#spc-hatch)', stroke: 'none' };
    case 'heavy':
      return { fill: 'none', stroke: pal.ink, strokeWidth: 2, strokeLinecap: 'square', ...nss };
    case 'thin':
      return { fill: 'none', stroke: pal.construction, strokeWidth: 0.8, ...nss };
    case 'dash':
      return { fill: 'none', stroke: pal.construction, strokeWidth: 0.8, strokeDasharray: '4 3', ...nss };
    case 'accent':
      return { fill: 'none', stroke: pal.accent, strokeWidth: 1, ...nss };
    case 'accent-fill':
      return { fill: pal.accent, stroke: 'none' };
    case 'text':
      return { fill: pal.ink };
    case 'text-accent':
      return { fill: pal.accent };
    case 'text-faint':
      return { fill: pal.faint };
    default:
      return { fill: 'none', stroke: pal.ink, strokeWidth: 1, ...nss };
  }
}

function Item({ it, pal }) {
  const a = styleAttrs(it.s, pal);
  switch (it.k) {
    case 'rect': {
      const t = it.rot ? `rotate(${it.rot} ${it.x + it.w / 2} ${it.y + it.h / 2})` : undefined;
      return <rect x={it.x} y={it.y} width={it.w} height={it.h} transform={t} {...a} />;
    }
    case 'poly':
      return <polygon points={it.pts} {...a} />;
    case 'polyline':
      return <polyline points={it.pts} {...a} fill="none" />;
    case 'line':
      return <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} {...a} />;
    case 'path':
      return <path d={it.d} {...a} />;
    case 'circle':
      return <circle cx={it.cx} cy={it.cy} r={it.r} {...a} />;
    case 'text':
      return (
        <text
          x={it.x}
          y={it.y}
          fontSize={it.size}
          textAnchor={it.anchor}
          dominantBaseline="middle"
          fontFamily={FONT_MONO}
          letterSpacing={it.size * 0.04}
          transform={it.rotate ? `rotate(${it.rotate} ${it.x} ${it.y})` : undefined}
          {...a}
        >
          {it.str}
        </text>
      );
    default:
      return null;
  }
}

export default function Viewport2D({ drawing, palette, fitKey, apiRef }) {
  const svgRef = useRef(null);
  const contentRef = useRef(null);
  const [view, setView] = useState({ z: 1, px: 0, py: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  const [bx, by, bw, bh] = drawing.bounds;
  const base = useMemo(() => {
    const p = Math.max(bw, bh) * PAD;
    // Extra room right and below keeps the drawing clear of the title block.
    return { x: bx - p, y: by - p, w: bw * 1.1 + 2 * p, h: bh * 1.12 + 2 * p };
  }, [bx, by, bw, bh]);

  useEffect(() => setView({ z: 1, px: 0, py: 0 }), [fitKey]);

  const vb = {
    w: base.w / view.z,
    h: base.h / view.z,
  };
  vb.x = base.x + base.w / 2 + view.px - vb.w / 2;
  vb.y = base.y + base.h / 2 + view.py - vb.h / 2;

  // Client pixel -> drawing units, honouring preserveAspectRatio "meet".
  const toUnits = (clientX, clientY, v = viewRef.current) => {
    const r = svgRef.current.getBoundingClientRect();
    const w = base.w / v.z;
    const h = base.h / v.z;
    const k = Math.max(w / r.width, h / r.height);
    const ox = (r.width - w / k) / 2;
    const oy = (r.height - h / k) / 2;
    const x0 = base.x + base.w / 2 + v.px - w / 2;
    const y0 = base.y + base.h / 2 + v.py - h / 2;
    return { x: x0 + (clientX - r.left - ox) * k, y: y0 + (clientY - r.top - oy) * k, k };
  };

  // Zoom by factor f keeping the drawing point under (cx, cy) fixed.
  const zoomAt = (v, f, clientX, clientY) => {
    const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * f));
    const before = toUnits(clientX, clientY, v);
    const mid = { x: base.x + base.w / 2 + v.px, y: base.y + base.h / 2 + v.py };
    const ratio = v.z / z;
    return {
      z,
      px: before.x + (mid.x - before.x) * ratio - (base.x + base.w / 2),
      py: before.y + (mid.y - before.y) * ratio - (base.y + base.h / 2),
    };
  };

  useEffect(() => {
    const svg = svgRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  const onPointerDown = (e) => {
    svgRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = null;
  };

  const onPointerMove = (e) => {
    const pts = pointers.current;
    if (!pts.has(e.pointerId)) return;
    const prev = [...pts.values()];
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cur = [...pts.values()];
    if (cur.length === 1) {
      const { k } = toUnits(e.clientX, e.clientY);
      const dx = (e.clientX - prev[0].x) * k;
      const dy = (e.clientY - prev[0].y) * k;
      setView((v) => ({ ...v, px: v.px - dx, py: v.py - dy }));
    } else if (cur.length === 2) {
      const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mid = (p) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const m0 = mid(prev);
      const m1 = mid(cur);
      const f = dist(cur) / Math.max(dist(prev), 1);
      setView((v) => {
        const z = zoomAt(v, f, m1.x, m1.y);
        const { k } = toUnits(m1.x, m1.y, z);
        return { ...z, px: z.px - (m1.x - m0.x) * k, py: z.py - (m1.y - m0.y) * k };
      });
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
  };

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      fit: () => setView({ z: 1, px: 0, py: 0 }),
      // Markup of the drawing at its default framing, for export.
      markup: () => ({
        defs: svgRef.current.querySelector('defs').outerHTML,
        body: contentRef.current.innerHTML,
        viewBox: [base.x, base.y, base.w, base.h],
      }),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, base]);

  const hatchSize = Math.max(bw, bh) / 90;

  return (
    <div className="viewport viewport-2d">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setView({ z: 1, px: 0, py: 0 })}
      >
        <defs>
          <pattern id="spc-hatch" patternUnits="userSpaceOnUse" width={hatchSize} height={hatchSize} patternTransform="rotate(45)">
            <rect width={hatchSize} height={hatchSize} fill={palette.hatchBg} />
            <line x1="0" y1="0" x2="0" y2={hatchSize} stroke={palette.hatchLine} strokeWidth={hatchSize * 0.14} />
          </pattern>
        </defs>
        <g ref={contentRef}>
          {drawing.items.map((it, i) => (
            <Item key={i} it={it} pal={palette} />
          ))}
        </g>
      </svg>
    </div>
  );
}
