// JS mirror of the CSS tokens, for WebGL materials and exported SVG.

// Black only. Greys for linework and text, never brighter than #D0D0D0;
// no hue anywhere. "accent" is kept as a name for dimension linework.
export const PALETTE = {
  paper: '#000000',
  surface: '#0A0A0A',
  ink: '#8A8A8A', // primary lines
  ink2: '#6E6E6E', // labels
  faint: '#6E6E6E',
  construction: '#3A3A3A', // secondary lines
  grid: '#1C1C1C', // faint grid
  active: '#C8C8C8',
  accent: '#6E6E6E',
  light: '#161616',
  mid: '#1E1E1E',
  dark: '#262626',
  hatchBg: '#161616',
  hatchLine: '#3A3A3A',
  shadow: '#000000',
  shade: [0, 0.22, 0.4],
};

export const FONT_MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
export const FONT_SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
