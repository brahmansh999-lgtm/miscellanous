import { useEffect, useMemo, useRef, useState } from 'react';
import { GENERATORS, byId, runGenerator } from './generators/index.js';
import { defaults, randomParams } from './lib/schema.js';
import { randomSeed } from './lib/rng.js';
import { PALETTE as palette } from './lib/palette.js';
import { sheetMeta } from './lib/meta.js';
import { decodeHash, encodeHash } from './lib/hash.js';
import { download, filename, obj3d, png2d, png3d, svg2d } from './lib/export.js';
import TabStrip from './components/TabStrip.jsx';
import Sheet from './components/Sheet.jsx';
import Controls, { ControlsHead } from './components/Controls.jsx';
import Viewport3D from './components/Viewport3D.jsx';
import Viewport2D from './components/Viewport2D.jsx';
import BottomSheet from './components/BottomSheet.jsx';

const initialSpec = () => {
  const fromUrl = decodeHash(window.location.hash, byId);
  if (fromUrl) return fromUrl;
  const gen = GENERATORS[0];
  return { id: gen.id, seed: 4213, params: defaults(gen) };
};

export default function App() {
  const [spec, setSpec] = useState(initialSpec);
  const [status, setStatus] = useState('');
  const [projection, setProjection] = useState('axon');
  const memory = useRef({});
  const viewApi = useRef(null);

  const gen = byId(spec.id);

  const result = useMemo(() => {
    try {
      return { model: runGenerator(gen, spec.params, spec.seed) };
    } catch (error) {
      return { error };
    }
  }, [gen, spec.params, spec.seed]);

  const meta = sheetMeta(gen, spec.seed, projection, result.model?.stats);

  // Keep the URL hash in step with the specimen, and follow it when edited.
  useEffect(() => {
    const h = encodeHash(spec, gen);
    if (window.location.hash !== h) history.replaceState(null, '', h);
  }, [spec, gen]);

  useEffect(() => {
    const onHash = () => {
      const next = decodeHash(window.location.hash, byId);
      if (next) setSpec(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2400);
    return () => clearTimeout(t);
  }, [status]);

  const exportAs = async (kind) => {
    const api = viewApi.current;
    if (!api || !result.model) return;
    if (kind === 'obj' && !result.model.solids.length) {
      setStatus('Nothing solid to export');
      return;
    }
    setStatus('Drawing…');
    try {
      let blob;
      if (kind === 'svg') blob = new Blob([await svg2d(meta, palette, api.markup())], { type: 'image/svg+xml' });
      else if (kind === 'png') blob = gen.dimension === '3d' ? await png3d(meta, palette, api.snapshot()) : await png2d(meta, palette, api.markup());
      else blob = await obj3d(api.exportable());
      download(blob, filename(meta, gen.id, kind));
      setStatus('Saved');
    } catch {
      setStatus('Export failed');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus('Link copied');
    } catch {
      setStatus('Copy the address bar');
    }
  };

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
            <div className="ctl-group">
              <span className="label">Export</span>
              <div className="btn-row">
                {gen.dimension === '2d' && (
                  <button type="button" className="btn" onClick={() => exportAs('svg')}>
                    SVG
                  </button>
                )}
                <button type="button" className="btn" onClick={() => exportAs('png')}>
                  PNG
                </button>
                {gen.dimension === '3d' && (
                  <button type="button" className="btn" onClick={() => exportAs('obj')}>
                    OBJ
                  </button>
                )}
                <button type="button" className="btn btn-quiet" onClick={copyLink}>
                  Link
                </button>
              </div>
            </div>
            <p className="status label" role="status" aria-live="polite">
              {status}
            </p>
          </Controls>
        </BottomSheet>
      </main>
    </div>
  );
}
