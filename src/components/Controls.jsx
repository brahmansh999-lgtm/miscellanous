import { kindOf } from '../lib/schema.js';
import { padNumber, padSeed } from '../lib/meta.js';
import { EditableValue, Segmented, Slider, Toggle } from './fields.jsx';

const FIELD = { number: Slider, toggle: Toggle, select: Segmented };

// Header: what is always visible, even when the mobile sheet is collapsed.
export function ControlsHead({ gen, seed, onSeed, onReroll }) {
  return (
    <div className="ctl-head">
      <div className="ctl-title">
        <span className="num ctl-no">{padNumber(gen.number)}</span>
        <h2 className="serif">{gen.title}</h2>
      </div>
      <div className="seed-row">
        <span className="label">Seed</span>
        <EditableValue
          className="seed-value"
          display={padSeed(seed)}
          label="Seed"
          onCommit={(s) => {
            const n = parseInt(s, 10);
            if (Number.isFinite(n)) onSeed(Math.abs(n) % 1000000);
          }}
        />
        <button type="button" className="btn" onClick={onReroll}>
          Reroll
        </button>
      </div>
    </div>
  );
}

export default function Controls({ gen, params, onParam, onRandomise, onReset, children }) {
  return (
    <div className="ctl-body">
      <p className="ctl-note serif">{gen.note}</p>
      <div className="ctl-actions">
        <button type="button" className="btn" onClick={onRandomise}>
          Randomise params
        </button>
        <button type="button" className="btn btn-quiet" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="params">
        {gen.params.map((p) => {
          const F = FIELD[kindOf(p)];
          return <F key={p.key} p={p} value={params[p.key]} onChange={(v) => onParam(p.key, v)} />;
        })}
      </div>
      {children}
    </div>
  );
}
