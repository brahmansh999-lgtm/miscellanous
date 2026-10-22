// Param schema helpers. A param is one of:
//   { key, label, min, max, step, default, unit? }          number slider
//   { key, label, type: 'select', options: [...], default } segmented choice
//   { key, label, type: 'toggle', default }                 on / off

export const kindOf = (p) => p.type || 'number';

export function decimalsOf(step) {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

export function snap(p, v) {
  const n = Math.round((v - p.min) / p.step);
  const out = p.min + n * p.step;
  return Number(Math.min(p.max, Math.max(p.min, out)).toFixed(decimalsOf(p.step)));
}

export function optionValues(p) {
  return p.options.map((o) => (typeof o === 'string' ? o : o.value));
}

export function optionLabel(p, value) {
  const o = p.options.find((x) => (typeof x === 'string' ? x : x.value) === value);
  return o == null ? String(value) : typeof o === 'string' ? o : o.label;
}

export function defaults(gen) {
  const out = {};
  for (const p of gen.params) out[p.key] = p.default;
  return out;
}

// Coerce anything (e.g. a value read from the URL) into a valid param value.
export function coerce(p, raw) {
  const kind = kindOf(p);
  if (kind === 'toggle') {
    if (typeof raw === 'boolean') return raw;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return p.default;
  }
  if (kind === 'select') {
    return optionValues(p).includes(raw) ? raw : p.default;
  }
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? snap(p, n) : p.default;
}

export function sanitize(gen, raw = {}) {
  const out = {};
  for (const p of gen.params) out[p.key] = raw[p.key] === undefined ? p.default : coerce(p, raw[p.key]);
  return out;
}

export function randomParams(gen, random = Math.random) {
  const out = {};
  for (const p of gen.params) {
    const kind = kindOf(p);
    if (kind === 'toggle') out[p.key] = random() < 0.5;
    else if (kind === 'select') {
      const vals = optionValues(p);
      out[p.key] = vals[Math.floor(random() * vals.length)];
    } else out[p.key] = snap(p, p.min + random() * (p.max - p.min));
  }
  return out;
}

export function formatValue(p, v) {
  const kind = kindOf(p);
  if (kind === 'toggle') return v ? 'on' : 'off';
  if (kind === 'select') return optionLabel(p, v);
  return v.toFixed(decimalsOf(p.step));
}
