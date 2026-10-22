import { useEffect, useRef, useState } from 'react';
import { formatValue, optionValues, optionLabel, snap } from '../lib/schema.js';

// A value that becomes a text input when tapped, for typing exact numbers.
export function EditableValue({ display, onCommit, label, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== '') onCommit(draft.trim());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`value-input num ${className}`}
        inputMode="decimal"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={`value num ${className}`}
      aria-label={`${label}: ${display}. Tap to type a value`}
      onClick={() => {
        setDraft(display.replace(/[^\d.-]/g, ''));
        setEditing(true);
      }}
    >
      {display}
    </button>
  );
}

const TICKS = 11;

export function Slider({ p, value, onChange }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [active, setActive] = useState(false);
  const t = (value - p.min) / (p.max - p.min || 1);

  const fromClient = (x) => {
    const r = trackRef.current.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (x - r.left) / r.width));
    return snap(p, p.min + u * (p.max - p.min));
  };

  // Mouse sets the value on press. Touch waits for a horizontal move (or a
  // tap) so a vertical scroll that starts on a slider does not change it.
  const onPointerDown = (e) => {
    trackRef.current.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType !== 'mouse' };
    setActive(true);
    if (!drag.current.touch) onChange(fromClient(e.clientX));
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) > 3) d.moved = true;
    if (d.moved || !d.touch) onChange(fromClient(e.clientX));
  };
  const end = (e, cancelled) => {
    const d = drag.current;
    if (d && d.touch && !d.moved && !cancelled) onChange(fromClient(e.clientX));
    drag.current = null;
    setActive(false);
  };

  const onKeyDown = (e) => {
    const big = Math.max(p.step, (p.max - p.min) / 10);
    const map = {
      ArrowLeft: value - p.step,
      ArrowDown: value - p.step,
      ArrowRight: value + p.step,
      ArrowUp: value + p.step,
      PageDown: value - big,
      PageUp: value + big,
      Home: p.min,
      End: p.max,
    };
    if (e.key in map) {
      e.preventDefault();
      onChange(snap(p, map[e.key]));
    }
  };

  return (
    <div className={`field slider${active ? ' is-active' : ''}`}>
      <div className="field-head">
        <span className="label">{p.label}</span>
        <span className="field-value">
          <EditableValue display={formatValue(p, value)} label={p.label} onCommit={(s) => onChange(snap(p, parseFloat(s) || p.default))} />
          {p.unit && <span className="unit">{p.unit}</span>}
        </span>
      </div>
      <div
        ref={trackRef}
        className="track"
        role="slider"
        tabIndex={0}
        aria-label={p.label}
        aria-valuemin={p.min}
        aria-valuemax={p.max}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onKeyDown={onKeyDown}
      >
        <span className="track-rule" />
        <span className="track-fill" style={{ width: `${t * 100}%` }} />
        <span className="track-ticks" aria-hidden="true">
          {Array.from({ length: TICKS }, (_, i) => (
            <i key={i} className={i % 5 === 0 ? 'major' : ''} />
          ))}
        </span>
        <span className="thumb" style={{ left: `${t * 100}%` }} />
      </div>
    </div>
  );
}

export function Toggle({ p, value, onChange }) {
  return (
    <button type="button" className="field toggle" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span className="label">{p.label}</span>
      <span className="toggle-box num">
        <span className={value ? 'on' : ''}>on</span>
        <span className={value ? '' : 'on'}>off</span>
      </span>
    </button>
  );
}

export function Segmented({ p, value, onChange }) {
  return (
    <div className="field segmented" role="radiogroup" aria-label={p.label}>
      <div className="field-head">
        <span className="label">{p.label}</span>
      </div>
      <div className="seg-options">
        {optionValues(p).map((v) => (
          <button
            type="button"
            key={v}
            role="radio"
            aria-checked={v === value}
            className={v === value ? 'on' : ''}
            onClick={() => onChange(v)}
          >
            {optionLabel(p, v)}
          </button>
        ))}
      </div>
    </div>
  );
}
