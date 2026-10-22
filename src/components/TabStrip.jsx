import { useEffect, useRef } from 'react';

// Deliberately uneven gaps, as if the list were typed up by hand.
const GAPS = [0, 19, 13, 24, 15, 11, 21, 17, 26, 12, 18, 23, 14, 20, 16];

export default function TabStrip({ generators, activeId, onSelect, onWildCard }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  return (
    <nav className="tabstrip" ref={ref} role="tablist" aria-label="Specimens">
      {generators.map((g, i) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={g.id === activeId}
          className="tab"
          style={{ marginLeft: GAPS[i % GAPS.length] }}
          onClick={() => onSelect(g.id)}
        >
          <span className="num tab-no">{String(g.number).padStart(2, '0')}</span>
          <span className="tab-name">{g.title}</span>
          <span className="tab-dim">{g.dimension}</span>
        </button>
      ))}
      <button type="button" className="tab tab-wild" style={{ marginLeft: 28 }} onClick={onWildCard}>
        <span className="num tab-no">??</span>
        <span className="tab-name">Wild card</span>
      </button>
    </nav>
  );
}
