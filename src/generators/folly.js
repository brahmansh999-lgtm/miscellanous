import { createModel } from '../lib/model3d.js';

// Six face directions: normal, and the four corners of that face of a unit cube.
const FACES = [
  [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
  [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
  [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];

export default {
  id: 'folly',
  title: 'Voxel folly',
  number: 10,
  dimension: '3d',
  note: 'Random cubes, smoothed by their neighbours, then left to fall.',
  params: [
    { key: 'size', label: 'Grid', min: 4, max: 16, step: 1, default: 9 },
    { key: 'height', label: 'Height', min: 2, max: 16, step: 1, default: 8 },
    { key: 'fill', label: 'Fill probability', min: 0.05, max: 0.9, step: 0.01, default: 0.45 },
    { key: 'steps', label: 'Automaton steps', min: 0, max: 8, step: 1, default: 3 },
    { key: 'threshold', label: 'Birth threshold', min: 8, max: 20, step: 1, default: 14 },
    {
      key: 'symmetry',
      label: 'Symmetry',
      type: 'select',
      options: [
        { value: 'none', label: 'None' },
        { value: 'x', label: 'Mirror' },
        { value: 'xz', label: 'Quarter' },
      ],
      default: 'x',
    },
    { key: 'gravity', label: 'Gravity', type: 'toggle', default: true },
    { key: 'grid', label: 'Show cubes', type: 'toggle', default: false },
  ],

  build(p, rng) {
    const m = createModel();
    const N = p.size;
    const Hh = p.height;
    const idx = (x, y, z) => (y * N + z) * N + x;
    let cells = new Uint8Array(N * N * Hh);

    for (let y = 0; y < Hh; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          // Denser near the ground, as things tend to be.
          const bias = 1.15 - (0.3 * y) / Math.max(1, Hh - 1);
          cells[idx(x, y, z)] = rng.next() < p.fill * bias ? 1 : 0;
        }
      }
    }

    const mirror = () => {
      if (p.symmetry === 'none') return;
      for (let y = 0; y < Hh; y++) {
        for (let z = 0; z < N; z++) {
          for (let x = 0; x < N; x++) {
            const mx = x < N / 2 ? x : N - 1 - x;
            const mz = p.symmetry === 'xz' ? (z < N / 2 ? z : N - 1 - z) : z;
            cells[idx(x, y, z)] = cells[idx(mx, y, mz)];
          }
        }
      }
    };
    mirror();

    const at = (x, y, z) => {
      if (y < 0) return 1; // the ground counts as solid
      if (x < 0 || z < 0 || x >= N || z >= N || y >= Hh) return 0;
      return cells[idx(x, y, z)];
    };

    for (let s = 0; s < p.steps; s++) {
      const next = new Uint8Array(cells.length);
      for (let y = 0; y < Hh; y++) {
        for (let z = 0; z < N; z++) {
          for (let x = 0; x < N; x++) {
            let c = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dz = -1; dz <= 1; dz++)
                for (let dx = -1; dx <= 1; dx++) if (dx || dy || dz) c += at(x + dx, y + dy, z + dz);
            const alive = cells[idx(x, y, z)];
            next[idx(x, y, z)] = alive ? (c >= p.threshold - 4 ? 1 : 0) : c >= p.threshold ? 1 : 0;
          }
        }
      }
      cells = next;
    }

    if (p.gravity) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          let count = 0;
          for (let y = 0; y < Hh; y++) count += cells[idx(x, y, z)];
          for (let y = 0; y < Hh; y++) cells[idx(x, y, z)] = y < count ? 1 : 0;
        }
      }
    }

    let n = 0;
    let top = 0;
    const off = N / 2;
    for (let y = 0; y < Hh; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          if (!cells[idx(x, y, z)]) continue;
          n++;
          top = Math.max(top, y + 1);
          for (const [[nx, ny, nz], quad] of FACES) {
            const yy = y + ny;
            const exposed = yy < 0 ? false : !at(x + nx, yy, z + nz);
            if (!exposed) continue;
            const pts = quad.map(([a, b, c]) => [x + a - off, y + b, z + c - off]);
            m.quad(pts[0], pts[1], pts[2], pts[3], { tone: 'light', crease: 10 });
            if (p.grid) m.polyline(pts, 'thin', true);
          }
        }
      }
    }

    m.dim([-off, 0, off], [off, 0, off], [0, 0, 1.2]);
    m.stat('Cubes', n);
    m.stat('Solid', `${Math.round((100 * n) / (N * N * Hh))}%`);
    m.stat('Top', `${top}`);
    return m.build();
  },
};
