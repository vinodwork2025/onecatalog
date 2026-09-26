/* Colour and layout themes. Pick one per client in config.json.
   Add new ones freely — the only rule is that every key below is present. */

export const THEMES = {
  warm: {
    bg: '#FAF7F2', card: '#FFFFFF', text: '#231F1B',
    muted: '#7C7268', line: '#E8E0D6', radius: '12px'
  },
  cool: {
    bg: '#F5F7FA', card: '#FFFFFF', text: '#151C24',
    muted: '#6B7785', line: '#E1E7EE', radius: '12px'
  },
  dark: {
    bg: '#16181C', card: '#1E2126', text: '#F2F3F5',
    muted: '#9AA1AB', line: '#2C3038', radius: '12px'
  },
  sharp: {
    bg: '#FFFFFF', card: '#FFFFFF', text: '#111111',
    muted: '#6E6E6E', line: '#DCDCDC', radius: '4px'
  }
};

export const DEFAULT_THEME = 'warm';

/** Darken a hex colour by `amount` (0-1). Used for the accent-dark token. */
export function darken(hex, amount = 0.2) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const out = [1, 2, 3].map(i => {
    const v = Math.round(parseInt(m[i], 16) * (1 - amount));
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  });
  return '#' + out.join('');
}

export function buildCss(rawCss, cfg) {
  const theme = THEMES[cfg.theme] || THEMES[DEFAULT_THEME];
  const accent = cfg.accent || '#C0392B';
  const map = {
    ACCENT: accent,
    ACCENT_DARK: darken(accent, 0.22),
    BG: theme.bg,
    CARD: theme.card,
    TEXT: theme.text,
    MUTED: theme.muted,
    LINE: theme.line,
    RADIUS: theme.radius
  };
  return rawCss.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? '');
}
