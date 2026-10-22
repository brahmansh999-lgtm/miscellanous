import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

const QUERY = '(max-width: 768px)';
const SNAPS = ['collapsed', 'half', 'full'];

export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
  );
}

// The parameter panel. A plain column on desktop; below 768px a sheet that
// drags between collapsed (header only), half and full height.
export default function BottomSheet({ head, children }) {
  const mobile = useIsMobile();
  const sheetRef = useRef(null);
  const headRef = useRef(null);
  const drag = useRef(null);
  const [snap, setSnap] = useState('collapsed');
  const [dragY, setDragY] = useState(null);
  const [size, setSize] = useState({ sheet: 0, head: 0, view: 0 });

  const measure = useCallback(() => {
    if (!sheetRef.current || !headRef.current) return;
    const view = window.innerHeight;
    // The sheet opens up to the bottom of the tab strip.
    const top = Math.round(document.querySelector('.stage')?.getBoundingClientRect().top ?? 92);
    const s = { sheet: view - top, head: headRef.current.offsetHeight, view };
    setSize(s);
    document.documentElement.style.setProperty('--sheet-peek', `${s.head}px`);
  }, []);

  useLayoutEffect(() => {
    if (!mobile) {
      document.documentElement.style.removeProperty('--sheet-peek');
      return;
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(headRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mobile, measure]);

  // Translate for each resting position.
  const offsets = {
    full: 0,
    half: Math.max(0, size.sheet - Math.round(size.view * 0.5)),
    collapsed: Math.max(0, size.sheet - size.head),
  };

  useEffect(() => {
    if (!mobile) setSnap('collapsed');
  }, [mobile]);

  if (!mobile) {
    return (
      <aside className="panel">
        {head}
        {children}
      </aside>
    );
  }

  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, t: performance.now(), base: offsets[snap], active: false, id: e.pointerId };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) < 6) return;
      d.active = true;
      headRef.current.setPointerCapture(d.id);
    }
    setDragY(Math.min(offsets.collapsed, Math.max(0, d.base + dy)));
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.active) {
      // A tap on the bare header (not a control) steps through the sizes.
      if (!e.target.closest('button, input') && e.type === 'pointerup') {
        setSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length]);
      }
      return;
    }
    const dt = Math.max(1, performance.now() - d.t);
    const v = (e.clientY - d.y) / dt;
    const projected = (dragY ?? d.base) + v * 180;
    let best = snap;
    let bestDist = Infinity;
    for (const s of SNAPS) {
      const dist = Math.abs(offsets[s] - projected);
      if (dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    setSnap(best);
    setDragY(null);
  };

  const y = dragY ?? offsets[snap];

  return (
    <aside
      ref={sheetRef}
      className={`panel panel-sheet is-${snap}${dragY != null ? ' is-dragging' : ''}`}
      style={{ transform: `translate3d(0, ${y}px, 0)`, height: size.sheet || undefined }}
    >
      <div
        ref={headRef}
        className="sheet-grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="grip-bar" aria-hidden="true" />
        {head}
      </div>
      <div className="sheet-scroll">{children}</div>
    </aside>
  );
}
