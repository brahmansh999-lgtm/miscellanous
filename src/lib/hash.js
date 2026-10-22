// The URL hash carries the whole specimen: #/<id>?seed=…&<param>=…
import { kindOf, sanitize } from './schema.js';

export function encodeHash({ id, seed, params }, gen) {
  const q = new URLSearchParams();
  q.set('seed', String(seed));
  for (const p of gen.params) {
    const v = params[p.key];
    q.set(p.key, kindOf(p) === 'toggle' ? (v ? '1' : '0') : String(v));
  }
  return `#/${id}?${q.toString()}`;
}

export function decodeHash(hash, byId) {
  const m = /^#\/?([\w-]+)(?:\?(.*))?$/.exec(hash || '');
  if (!m) return null;
  const gen = byId(m[1]);
  if (!gen) return null;
  const q = new URLSearchParams(m[2] || '');
  const raw = {};
  for (const [k, v] of q) raw[k] = v;
  const seed = parseInt(q.get('seed'), 10);
  return {
    id: gen.id,
    seed: Number.isFinite(seed) ? Math.abs(seed) % 1000000 : 0,
    params: sanitize(gen, raw),
  };
}
