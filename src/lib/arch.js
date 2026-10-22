// Arch heights. t runs from -1 to 1 across the opening; returns the height
// above the springing line, with `rise` the height at the crown.

export const ARCH_PROFILES = [
  { value: 'round', label: 'Round' },
  { value: 'pointed', label: 'Pointed' },
  { value: 'segmental', label: 'Segmental' },
  { value: 'parabolic', label: 'Parabolic' },
  { value: 'flat', label: 'Flat' },
];

export function archY(t, rise, profile) {
  const a = Math.min(1, Math.abs(t));
  switch (profile) {
    case 'pointed': {
      // Two-centred: each half is an arc centred beyond the opposite side.
      const c = 0.6;
      const R = 1 + c;
      return (rise * Math.sqrt(Math.max(0, R * R - (a + c) * (a + c)))) / Math.sqrt(R * R - c * c);
    }
    case 'segmental': {
      // A shallow arc of a larger circle, rise is 45% of the half span.
      const k = 0.45;
      const R = (1 + k * k) / (2 * k);
      return (rise * (Math.sqrt(Math.max(0, R * R - a * a)) - (R - k))) / k;
    }
    case 'parabolic':
      return rise * (1 - a * a);
    case 'flat':
      return 0;
    default:
      return rise * Math.sqrt(Math.max(0, 1 - a * a));
  }
}

// Natural crown height for an opening of half span s.
export function archRise(s, profile) {
  switch (profile) {
    case 'pointed':
      return s * 1.25;
    case 'segmental':
      return s * 0.45;
    case 'parabolic':
      return s * 1.6;
    case 'flat':
      return 0;
    default:
      return s;
  }
}
