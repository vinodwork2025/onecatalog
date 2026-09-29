/* Colour and layout themes. Pick one per client in config.json.
   Add new ones freely — the only rule is that every key below is present.
   Derived tokens (readable accent text, text on accent, glass header,
   shadows) are computed in buildCss, so a new theme needs only these keys. */

export const THEMES = {
  warm: {
    bg: '#FAF7F2', card: '#FFFFFF', text: '#231F1B',
    muted: '#72685E', line: '#E8E0D6', radius: '14px'
  },
  cool: {
    bg: '#F5F7FA', card: '#FFFFFF', text: '#151C24',
    muted: '#626E7C', line: '#E1E7EE', radius: '14px'
  },
  dark: {
    bg: '#15171B', card: '#1E2126', text: '#F2F3F5',
    muted: '#A0A7B1', line: '#2C3038', radius: '14px'
  },
  sharp: {
    bg: '#FFFFFF', card: '#FFFFFF', text: '#111111',
    muted: '#6A6A6A', line: '#DCDCDC', radius: '4px'
  }
};

export const DEFAULT_THEME = 'warm';

const rgb = hex => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null;
};
const toHex = arr => '#' + arr.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Darken a hex colour by `amount` (0-1). Used for the accent-dark token. */
export function darken(hex, amount = 0.2) {
  const c = rgb(hex);
  return c ? toHex(c.map(v => v * (1 - amount))) : hex;
}

/** Lighten a hex colour towards white by `amount` (0-1). */
export function lighten(hex, amount = 0.2) {
  const c = rgb(hex);
  return c ? toHex(c.map(v => v + (255 - v) * amount)) : hex;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex) {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/** Step the accent darker (light themes) or lighter (dark themes) until it reads as text on the card colour. */
function readableAccent(accent, card, dark) {
  let c = dark ? lighten(accent, 0.1) : darken(accent, 0.18);
  for (let i = 0; i < 12 && contrast(c, card) < 4.6; i++) c = dark ? lighten(c, 0.12) : darken(c, 0.12);
  return c;
}

const rgba = (hex, a) => { const c = rgb(hex) || [255, 255, 255]; return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

export function buildCss(rawCss, cfg) {
  const theme = THEMES[cfg.theme] || THEMES[DEFAULT_THEME];
  const accent = cfg.accent || '#C0392B';
  const dark = luminance(theme.bg) < 0.2;
  const map = {
    ACCENT: accent,
    ACCENT_DARK: readableAccent(accent, theme.card, dark),
    // Black or white text on the accent, whichever reads better.
    ON_ACCENT: contrast('#FFFFFF', accent) >= contrast('#111111', accent) ? '#FFFFFF' : '#111111',
    ACCENT_SOFT: rgba(accent, dark ? 0.18 : 0.1),
    BG: theme.bg,
    CARD: theme.card,
    TEXT: theme.text,
    MUTED: theme.muted,
    LINE: theme.line,
    RADIUS: theme.radius,
    GLASS: rgba(theme.card, 0.96),
    // "In stock" green that passes contrast on light and dark cards.
    OK: dark ? '#4ADE80' : '#15803D',
    SHADOW: dark ? 'rgba(0,0,0,.45)' : rgba(darken(theme.bg, 0.6), 0.16),
    SCHEME: dark ? 'dark' : 'light'
  };
  return minify(rawCss.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? ''));
}

// The stylesheet is inlined into every page, so strip comments and whitespace.
// Safe for this file: it has no strings containing braces or semicolons.
function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}
