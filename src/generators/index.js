// The cabinet. To add a specimen, write one file in this folder that
// exports { id, title, number, note, dimension, params, build } and add
// it to this list.

import { createRng } from '../lib/rng.js';
import stair from './stair.js';
import column from './column.js';
import facade from './facade.js';
import vault from './vault.js';
import tower from './tower.js';
import truss from './truss.js';
import arcade from './arcade.js';
import folly from './folly.js';
import roof from './roof.js';
import brick from './brick.js';
import plan from './plan.js';
import louvre from './louvre.js';
import contour from './contour.js';

export const GENERATORS = [
  stair,
  column,
  facade,
  vault,
  tower,
  truss,
  arcade,
  folly,
  roof,
  brick,
  plan,
  louvre,
  contour,
].sort((a, b) => a.number - b.number);

export const byId = (id) => GENERATORS.find((g) => g.id === id);

// (params, seed) -> geometry description
export function runGenerator(gen, params, seed) {
  return gen.build(params, createRng(seed));
}
