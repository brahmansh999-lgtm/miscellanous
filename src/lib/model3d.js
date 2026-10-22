// A small, renderer-agnostic builder for 3D specimens. Generators push
// triangles and line segments into tonal buckets; Viewport3D turns the
// result into flat MeshBasicMaterial fills, edges and linework.
//
// Tones for solids: 'paper' | 'light' | 'mid' | 'dark' | 'hatch'
// Tones for lines:  'ink' | 'thin' | 'accent'

import { Euler, Matrix4, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';

const _v = new Vector3();

// Build a transform: translate `at`, rotate by Euler `rot` (radians), scale.
export function matrix({ at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], order = 'YXZ' } = {}) {
  const q = new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2], order));
  return new Matrix4().compose(new Vector3(...at), q, new Vector3(...scale));
}

export function createModel() {
  const solids = new Map();
  const lines = new Map();
  const stats = [];

  const bucket = (opts = {}) => {
    const tone = opts.tone || 'light';
    const crease = opts.crease ?? 20;
    const key = `${tone}|${crease}`;
    if (!solids.has(key)) solids.set(key, { tone, crease, pos: [] });
    return solids.get(key).pos;
  };

  const lineBucket = (tone = 'ink') => {
    if (!lines.has(tone)) lines.set(tone, []);
    return lines.get(tone);
  };

  const xf = (p, m) => {
    if (!m) return p;
    _v.set(p[0], p[1], p[2]).applyMatrix4(m);
    return [_v.x, _v.y, _v.z];
  };

  const model = {
    stats,
    stat(label, value) {
      stats.push([label, value]);
    },

    tri(a, b, c, opts = {}) {
      const pos = bucket(opts);
      const m = opts.m;
      pos.push(...xf(a, m), ...xf(b, m), ...xf(c, m));
    },

    quad(a, b, c, d, opts = {}) {
      model.tri(a, b, c, opts);
      model.tri(a, c, d, opts);
    },

    // Convex or concave planar polygon in 3D, triangulated in its own plane.
    poly(pts, opts = {}) {
      if (pts.length < 3) return;
      const n = new Vector3();
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        n.x += (a[1] - b[1]) * (a[2] + b[2]);
        n.y += (a[2] - b[2]) * (a[0] + b[0]);
        n.z += (a[0] - b[0]) * (a[1] + b[1]);
      }
      const ax = Math.abs(n.x);
      const ay = Math.abs(n.y);
      const az = Math.abs(n.z);
      const proj =
        ax >= ay && ax >= az ? (p) => new Vector2(p[1], p[2]) : ay >= az ? (p) => new Vector2(p[0], p[2]) : (p) => new Vector2(p[0], p[1]);
      const faces = ShapeUtils.triangulateShape(pts.map(proj), []);
      for (const [a, b, c] of faces) model.tri(pts[a], pts[b], pts[c], opts);
    },

    // Axis-aligned box centred on the origin, then transformed by opts.m
    // or by { at, rot }.
    box({ size = [1, 1, 1], at, rot, m, ...opts }) {
      const mm = m || matrix({ at, rot });
      const [w, h, d] = size.map((s) => s / 2);
      const P = [
        [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
        [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d],
      ].map((p) => xf(p, mm));
      const o = { ...opts, m: null };
      model.quad(P[0], P[1], P[2], P[3], o);
      model.quad(P[5], P[4], P[7], P[6], o);
      model.quad(P[4], P[0], P[3], P[7], o);
      model.quad(P[1], P[5], P[6], P[2], o);
      model.quad(P[3], P[2], P[6], P[7], o);
      model.quad(P[4], P[5], P[1], P[0], o);
    },

    // A square-section member between two points.
    strut(a, b, w, opts = {}) {
      const A = new Vector3(...a);
      const B = new Vector3(...b);
      const len = A.distanceTo(B);
      if (len < 1e-6) return;
      const x = B.clone().sub(A).normalize();
      const ref = Math.abs(x.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const z = new Vector3().crossVectors(x, ref).normalize();
      const y = new Vector3().crossVectors(z, x).normalize();
      const m = new Matrix4().makeBasis(x, y, z).setPosition(A.add(B).multiplyScalar(0.5));
      const { depth, ...rest } = opts;
      model.box({ ...rest, size: [len, w, depth ?? w], m });
    },

    // Extrude a 2D polygon (points as [x, z]) between heights y0 and y1.
    prism(pts, y0, y1, opts = {}) {
      const m = opts.m;
      const o = { ...opts, m: null };
      const bot = pts.map(([x, z]) => xf([x, y0, z], m));
      const top = pts.map(([x, z]) => xf([x, y1, z], m));
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        model.quad(bot[i], bot[j], top[j], top[i], o);
      }
      const faces = ShapeUtils.triangulateShape(
        pts.map(([x, z]) => new Vector2(x, z)),
        [],
      );
      for (const [a, b, c] of faces) {
        model.tri(top[a], top[b], top[c], o);
        model.tri(bot[a], bot[c], bot[b], o);
      }
    },

    // Revolve a profile [[r, y], ...] about Y. radius(theta, y, r) may
    // modulate the radius (flutes, lumps).
    lathe(profile, segs, opts = {}, radius = null) {
      const m = opts.m;
      const o = { ...opts, m: null };
      const ring = (k) => {
        const [r, y] = profile[k];
        const out = [];
        for (let i = 0; i <= segs; i++) {
          const t = (i / segs) * Math.PI * 2;
          const rr = radius ? radius(t, y, r) : r;
          out.push(xf([Math.cos(t) * rr, y, Math.sin(t) * rr], m));
        }
        return out;
      };
      let prev = ring(0);
      for (let k = 1; k < profile.length; k++) {
        const cur = ring(k);
        for (let i = 0; i < segs; i++) model.quad(prev[i], prev[i + 1], cur[i + 1], cur[i], o);
        prev = cur;
      }
    },

    // Parametric sheet: fn(u, v) -> [x, y, z] over [0,1]^2.
    surface(fn, nu, nv, opts = {}) {
      const g = [];
      for (let j = 0; j <= nv; j++) {
        const row = [];
        for (let i = 0; i <= nu; i++) row.push(xf(fn(i / nu, j / nv), opts.m));
        g.push(row);
      }
      const o = { ...opts, m: null };
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) model.quad(g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i], o);
      }
      return g;
    },

    // Append triangles from a three.js BufferGeometry.
    geometry(geo, opts = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const a = g.getAttribute('position');
      for (let i = 0; i < a.count; i += 3) {
        model.tri([a.getX(i), a.getY(i), a.getZ(i)], [a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)], [a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)], opts);
      }
      if (g !== geo) g.dispose();
      geo.dispose();
    },

    seg(a, b, tone = 'ink', m = null) {
      lineBucket(tone).push(...xf(a, m), ...xf(b, m));
    },

    polyline(pts, tone = 'ink', closed = false, m = null) {
      for (let i = 0; i < pts.length - 1; i++) model.seg(pts[i], pts[i + 1], tone, m);
      if (closed && pts.length > 2) model.seg(pts[pts.length - 1], pts[0], tone, m);
    },

    // A dimension line from a to b, displaced by `off`, with extension
    // lines and oblique ticks. Drawn in the accent colour.
    dim(a, b, off) {
      const A = new Vector3(...a);
      const B = new Vector3(...b);
      const O = new Vector3(...off);
      const a2 = A.clone().add(O);
      const b2 = B.clone().add(O);
      const ext = O.clone().normalize().multiplyScalar(O.length() * 0.18);
      const gap = O.clone().normalize().multiplyScalar(O.length() * 0.2);
      model.seg(A.clone().add(gap).toArray(), a2.clone().add(ext).toArray(), 'accent');
      model.seg(B.clone().add(gap).toArray(), b2.clone().add(ext).toArray(), 'accent');
      model.seg(a2.toArray(), b2.toArray(), 'accent');
      const dir = B.clone().sub(A).normalize();
      const t = dir.clone().add(O.clone().normalize()).normalize().multiplyScalar(A.distanceTo(B) * 0.025 + 0.04);
      for (const p of [a2, b2]) model.seg(p.clone().sub(t).toArray(), p.clone().add(t).toArray(), 'accent');
    },

    build() {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const grow = (arr) => {
        for (let i = 0; i < arr.length; i += 3) {
          for (let k = 0; k < 3; k++) {
            if (arr[i + k] < min[k]) min[k] = arr[i + k];
            if (arr[i + k] > max[k]) max[k] = arr[i + k];
          }
        }
      };
      const s = [...solids.values()].filter((b) => b.pos.length).map((b) => ({ tone: b.tone, crease: b.crease, positions: new Float32Array(b.pos) }));
      const l = [...lines.entries()].filter(([, p]) => p.length).map(([tone, p]) => ({ tone, positions: new Float32Array(p) }));
      s.forEach((b) => grow(b.positions));
      l.forEach((b) => grow(b.positions));
      if (!Number.isFinite(min[0])) {
        min.fill(-1);
        max.fill(1);
      }
      return { kind: '3d', solids: s, lines: l, bounds: { min, max }, stats };
    },
  };
  return model;
}
