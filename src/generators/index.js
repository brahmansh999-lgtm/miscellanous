// The cabinet. To add a specimen, write one file in this folder that
// exports { id, title, number, note, dimension, params, build } and add
// it to this list.

import { createRng } from '../lib/rng.js';
import stair from './stair.js';
import column from './column.js';
import facade from './facade.js';

export const GENERATORS = [stair, column, facade].sort((a, b) => a.number - b.number);

export const byId = (id) => GENERATORS.find((g) => g.id === id);

// (params, seed) -> geometry description
export function runGenerator(gen, params, seed) {
  return gen.build(params, createRng(seed));
}
