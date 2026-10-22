import { useEffect, useMemo, useRef, useState } from 'react';
import { GENERATORS, byId, runGenerator } from './generators/index.js';
import { defaults, randomParams } from './lib/schema.js';
import { randomSeed } from './lib/rng.js';
import { PALETTES } from './lib/palette.js';
import { sheetMeta } from './lib/meta.js';
import TabStrip from './components/TabStrip.jsx';
import Sheet from './components/Sheet.jsx';
import Controls, { ControlsHead } from './components/Controls.jsx';
import Viewport3D from './components/Viewport3D.jsx';
import Viewport2D from './components/Viewport2D.jsx';
import BottomSheet from './components/BottomSheet.jsx';

const initialSpec = () => {
  const gen = GENERATORS[0];
  return { id: gen.id, seed: 4213, params: defaults(gen) };
};

export default function App() {
  const [spec, setSpec] = useState(initialSpec);
  const [theme, setTheme] = useState('day');
  const [projection, setProjection] = useState('axon');
  const memory = useRef({});
  const viewApi = useRef(null);

  const gen = byId(spec.id);
  const palette = PALETTES[theme];

  const result = useMemo(() => {
    try {
      return { model: runGenerator(gen, spec.params, spec.seed) };
    } catch (error) {
      return { error };
    }
  }, [gen, spec.params, spec.seed]);

  const meta = sheetMeta(gen, spec.seed, projection, result.model?.stats);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.paper);
  }, [theme, palette]);

  const selectTab = (id) => {
    if (id === spec.id) return;
    memory.current[spec.id] = spec;
    const next = byId(id);
    setSpec(memory.current[id] || { id, seed: spec.seed, params: defaults(next) });
  };

  const wildCard = () => {
    const pool = GENERATORS.filter((g) => g.id !== spec.id);
    const next = pool[Math.floor(Math.random() * pool.length)];
    memory.current[spec.id] = spec;
    setSpec({ id: next.id, seed: randomSeed(), params: randomParams(next) });
  };

  const setParam = (key, value) => setSpec((s) => ({ ...s, params: { ...s.params, [key]: value } }));
  const setSeed = (seed) => setSpec((s) => ({ ...s, seed }));

  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          Specimens<em>,</em>
        </h1>
        <span className="label sub">a parametric architectural miscellany</span>
        <button className="label night-toggle" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>
          {theme === 'day' ? 'Night sheet' : 'Day sheet'}
        </button>
      </header>

      <TabStrip generators={GENERATORS} activeId={spec.id} onSelect={selectTab} onWildCard={wildCard} />

      <main className="stage">
        <Sheet meta={meta}>
          {result.error ? (
            <div className="viewport viewport-error label">This specimen could not be drawn with these values.</div>
          ) : gen.dimension === '3d' ? (
            <Viewport3D model={result.model} palette={palette} projection={projection} fitKey={spec.id} apiRef={viewApi} />
          ) : (
            <Viewport2D drawing={result.model} palette={palette} fitKey={spec.id} apiRef={viewApi} />
          )}
        </Sheet>

        <BottomSheet head={<ControlsHead gen={gen} seed={spec.seed} onSeed={setSeed} onReroll={() => setSeed(randomSeed())} />}>
          <Controls
            gen={gen}
            params={spec.params}
            onParam={setParam}
            onRandomise={() => setSpec((s) => ({ ...s, params: randomParams(gen) }))}
            onReset={() => setSpec((s) => ({ ...s, params: defaults(gen) }))}
          >
            <div className="ctl-group">
              <span className="label">View</span>
              <div className="btn-row">
                {gen.dimension === '3d' && (
                  <div className="seg-options seg-inline" role="radiogroup" aria-label="Projection">
                    {[
                      ['axon', 'Axon'],
                      ['persp', 'Persp'],
                    ].map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={projection === v} className={projection === v ? 'on' : ''} onClick={() => setProjection(v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="btn" onClick={() => viewApi.current?.fit()}>
                  Fit
                </button>
              </div>
            </div>
          </Controls>
        </BottomSheet>
      </main>
    </div>
  );
}
