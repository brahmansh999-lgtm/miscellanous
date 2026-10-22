# Specimens

A parametric architectural miscellany. A cabinet of small seeded generators,
one per tab, each drawing an abstract architectural specimen on a drawing
sheet, with a title block, dimension lines and survey ticks.

Live: https://brahmansh999-lgtm.github.io/miscellanous/

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Everything runs in the browser. There is no backend and there are no API calls.

The build uses relative asset paths, so `dist/` works at a domain root (Vercel,
configured in `vercel.json`) and under a subpath (GitHub Pages, via
`.github/workflows/deploy.yml`).

## The cabinet

| No. | Specimen          | Kind | Notes |
| --- | ----------------- | ---- | ----- |
|     | Wild card         |      | a random specimen with random parameters and seed |
| 01  | Voxel folly       | 3D   | fill, cellular automaton, symmetry, gravity |
| 02  | Louvre field      | 2D   | blades turned by sine, radial, noise, attractor or shear fields |
| 03  | Site, contoured   | 2D   | marching-squares contours, terracing, a levelled platform |
| 04  | Arcade            | 3D   | five arch profiles, storeys halving the rhythm, blind arches |
| 05  | Tower massing     | 3D   | floors, plan shape, setbacks, twist, taper, podium |
| 06  | Stair             | 3D   | flights, rise/going, turn per landing, wander, waist/spine/mass |
| 07  | Plan subdivision  | 2D   | recursive splits, corridors, doors on a spanning tree |
| 08  | Vault             | 3D   | barrel / groin / cloister, four sections, ribs, bay wobble |
| 09  | Column            | 3D   | entasis, taper, flutes, drums, ruin, five abstract capitals |
| 10  | Brick bond        | 2D   | seven bonds, mortar, hit-and-miss gaps, opening + soldier course |
| 11  | Roof              | 3D   | gable / hip / pyramid / mansard / shed / sawtooth, dormers |
| 12  | Facade fins       | 3D   | bays, floors, fin depth, rotation gradient, noise |
| 13  | Truss             | 3D   | Pratt / Howe / Warren / random, flat / pitched / bowstring |

Every tab has a seed (Reroll), Randomise params, Reset and export: SVG for 2D,
PNG for everything, OBJ for 3D. The tab, seed and parameters live in the URL
hash, so a link reproduces the specimen exactly.

On phones the controls sit in a bottom sheet (drag or tap the header). One
finger orbits and two fingers pinch and pan in 3D. In 2D one finger pans and
two pinch. Double-click or double-tap resets the 2D view.

## Adding a generator

1. Create `src/generators/<name>.js`:

```js
import { createModel } from '../lib/model3d.js'; // or createDrawing from '../lib/draw2d.js'

export default {
  id: 'plinth',
  title: 'Plinth',
  number: 14, // position in the tab strip
  dimension: '3d', // or '2d'
  note: 'One line, written like a catalogue entry.',
  params: [
    { key: 'height', label: 'Height', min: 0.2, max: 2, step: 0.05, default: 0.6, unit: 'm' },
    { key: 'kind', label: 'Kind', type: 'select', options: ['square', 'round'], default: 'square' },
    { key: 'chamfer', label: 'Chamfer', type: 'toggle', default: false },
  ],
  build(p, rng) {
    const m = createModel();
    m.box({ size: [1, p.height, 1], at: [0, p.height / 2, 0], tone: 'light' });
    m.stat('H', `${p.height} m`);
    return m.build();
  },
};
```

2. Import it and add it to the list in `src/generators/index.js`.

The controls, title block, URL state and exports all come from the schema.
`build` must be pure: take every random number from `rng` (`rng.next()`,
`range`, `int`, `chance`, `pick`, `noise2`, `fbm2`, `fork(label)`), so the
seed fully reproduces the output.

- 3D (`lib/model3d.js`): `box`, `strut`, `prism`, `lathe`, `surface`, `poly`,
  `quad`, `geometry`, plus `seg`, `polyline` and `dim` for linework. Solid
  tones are `paper`, `light`, `mid`, `dark` and `hatch`.
- 2D (`lib/draw2d.js`): `rect`, `poly`, `line`, `path`, `circle`, `text`,
  `dimH`, `dimV` and `scaleBar`. Styles include `poche`, `hatch`, `light`,
  `ink`, `thin` and `accent`.

## Notes

- Rendering uses only `MeshBasicMaterial` and `LineBasicMaterial`. There are
  no lights. Depth comes from edges and three flat tones chosen by face
  direction. Geometry and materials are disposed on every rebuild.
- The device pixel ratio is capped at 2. Drawing pauses while the canvas is
  off-screen or the tab is hidden.
- Fonts (IBM Plex Mono, Instrument Serif) are bundled with the build and
  embedded in exported sheets.
