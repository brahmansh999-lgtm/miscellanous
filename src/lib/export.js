// Exports: the specimen placed on a drawing sheet with its title block,
// as SVG (2D), PNG (all) and OBJ (3D).

import monoUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import monoBoldUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import serifUrl from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import serifItalicUrl from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import { FONT_MONO, FONT_SERIF } from './palette.js';

const SHEET_W = 1600;
const SHEET_H = 1131;
const M = 28;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function filename(meta, id, ext) {
  return `specimen-${meta.number.replace(/\D/g, '')}-${id}-s${meta.seed}.${ext}`;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Fonts are embedded so the sheet looks the same wherever it is opened.
let fontCss = null;
async function embeddedFonts() {
  if (fontCss) return fontCss;
  const faces = [
    ['IBM Plex Mono', monoUrl, 400, 'normal'],
    ['IBM Plex Mono', monoBoldUrl, 500, 'normal'],
    ['Instrument Serif', serifUrl, 400, 'normal'],
    ['Instrument Serif', serifItalicUrl, 400, 'italic'],
  ];
  const rules = await Promise.all(
    faces.map(async ([family, url, weight, style]) => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
      } catch {
        return '';
      }
    }),
  );
  fontCss = rules.join('');
  return fontCss;
}

function titleBlock(meta, pal) {
  const w = 360;
  const h = meta.stats.length ? 150 : 124;
  const x = SHEET_W - M - w;
  const y = SHEET_H - M - h;
  const t = (tx, ty, s, size, opts = '') =>
    `<text x="${x + tx}" y="${y + ty}" font-size="${size}" ${opts}>${esc(s)}</text>`;
  const mono = `font-family="${esc(FONT_MONO)}"`;
  const label = `${mono} fill="${pal.ink2}" letter-spacing="1.4"`;
  const cell = w / 3;
  let out = `<g>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${pal.surface}" stroke="${pal.ink}" stroke-width="1"/>`;
  out += t(12, 22, meta.number, 14, `${mono} font-weight="500" fill="${pal.active}"`);
  out += t(w - 12, 22, 'SPECIMEN', 10, `${label} text-anchor="end"`);
  out += t(12, 58, meta.title, 32, `font-family="${esc(FONT_SERIF)}" fill="${pal.active}"`);
  out += `<line x1="${x}" y1="${y + 72}" x2="${x + w}" y2="${y + 72}" stroke="${pal.grid}"/>`;
  [
    ['SEED', meta.seed],
    ['SCALE', meta.scale],
    ['DATE', meta.date],
  ].forEach(([k, v], i) => {
    out += t(12 + i * cell, 90, k, 9, label);
    out += t(12 + i * cell, 110, v, 12, `${mono} font-weight="500" fill="${pal.ink}"`);
    if (i) out += `<line x1="${x + i * cell}" y1="${y + 72}" x2="${x + i * cell}" y2="${y + 124}" stroke="${pal.grid}"/>`;
  });
  if (meta.stats.length) {
    out += `<line x1="${x}" y1="${y + 124}" x2="${x + w}" y2="${y + 124}" stroke="${pal.grid}"/>`;
    out += t(12, 141, meta.stats.map(([k, v]) => `${k} ${v}`).join('  ·  '), 11, `${mono} fill="${pal.ink2}"`);
  }
  return `${out}</g>`;
}

// A whole sheet. `drawing` is markup placed in the frame (an <svg> or <image>).
async function sheetSVG(meta, pal, drawing, transparent = false) {
  const css = await embeddedFonts();
  const zones = ['A', 'B', 'C', 'D', 'E', 'F']
    .map((z, i) => `<text x="${M + ((i + 0.5) * (SHEET_W - 2 * M)) / 6}" y="${M - 9}" font-size="10" text-anchor="middle" font-family="${esc(FONT_MONO)}" fill="${pal.faint}">${z}</text>`)
    .join('');
  const rows = ['1', '2', '3', '4']
    .map((z, i) => `<text x="${M / 2}" y="${M + ((i + 0.5) * (SHEET_H - 2 * M)) / 4}" font-size="10" text-anchor="middle" font-family="${esc(FONT_MONO)}" fill="${pal.faint}">${z}</text>`)
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHEET_W}" height="${SHEET_H}" viewBox="0 0 ${SHEET_W} ${SHEET_H}">`,
    `<style>${css}</style>`,
    transparent ? '' : `<rect width="100%" height="100%" fill="${pal.paper}"/>`,
    transparent ? '' : drawing,
    `<rect x="${M}" y="${M}" width="${SHEET_W - 2 * M}" height="${SHEET_H - 2 * M}" fill="none" stroke="${pal.ink}"/>`,
    `<rect x="${M + 5}" y="${M + 5}" width="${SHEET_W - 2 * M - 10}" height="${SHEET_H - 2 * M - 10}" fill="none" stroke="${pal.grid}"/>`,
    zones,
    rows,
    `<text x="${M + 18}" y="${M + 34}" font-size="20" font-style="italic" font-family="${esc(FONT_SERIF)}" fill="${pal.ink2}"><tspan font-style="normal" font-family="${esc(FONT_MONO)}" font-size="12" fill="${pal.faint}">${esc(meta.number)}. </tspan>${esc(meta.note)}</text>`,
    titleBlock(meta, pal),
    `</svg>`,
  ].join('');
}

const FRAME = { x: M + 12, y: M + 50, w: SHEET_W - 2 * M - 24, h: SHEET_H - 2 * M - 62 };

export async function svg2d(meta, pal, markup) {
  const [vx, vy, vw, vh] = markup.viewBox;
  const drawing = `<svg x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">${markup.defs}${markup.body}</svg>`;
  return sheetSVG(meta, pal, drawing);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not rasterise the sheet.'));
    img.src = src;
  });
}

async function svgToCanvas(svg, scale) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const cv = document.createElement('canvas');
    cv.width = SHEET_W * scale;
    cv.height = SHEET_H * scale;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return { cv, g };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toPng = (cv) => new Promise((resolve) => cv.toBlob(resolve, 'image/png'));

export async function png2d(meta, pal, markup) {
  const { cv } = await svgToCanvas(await svg2d(meta, pal, markup), 2);
  return toPng(cv);
}

// 3D: paper, then the WebGL frame fitted into the drawing area, then the
// sheet furniture drawn over it from a transparent SVG.
export async function png3d(meta, pal, snap) {
  const scale = 2;
  const cv = document.createElement('canvas');
  cv.width = SHEET_W * scale;
  cv.height = SHEET_H * scale;
  const g = cv.getContext('2d');
  g.fillStyle = pal.paper;
  g.fillRect(0, 0, cv.width, cv.height);
  const img = await loadImage(snap.url);
  const k = Math.min((FRAME.w * scale) / snap.w, (FRAME.h * scale) / snap.h);
  const w = snap.w * k;
  const h = snap.h * k;
  g.drawImage(img, FRAME.x * scale + (FRAME.w * scale - w) / 2, FRAME.y * scale + (FRAME.h * scale - h) / 2, w, h);
  const over = await svgToCanvas(await sheetSVG(meta, pal, '', true), scale);
  g.drawImage(over.cv, 0, 0);
  return toPng(cv);
}

export async function obj3d(group) {
  const { OBJExporter } = await import('three/addons/exporters/OBJExporter.js');
  const text = new OBJExporter().parse(group);
  return new Blob([text], { type: 'model/obj' });
}
