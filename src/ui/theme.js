/* ============================================================
   THEME — one source of truth for colour and type
   ------------------------------------------------------------
   The instruments are canvases, so their colours cannot come from CSS
   cascade. They come from the same custom properties instead: this module
   reads the tokens off :root once at load and hands them to the drawing code.
   Change the palette in styles.css and the compass, the map, the wheel
   monitor and the radar scope follow it, because there is nowhere else for
   them to get a colour from.

   The function classes are documented at the top of styles.css. In short:
   controls are coded by what they do, values by how they are doing, and the
   signal colours are scarce enough to mean something.
   ============================================================ */

const CS = typeof getComputedStyle === 'function'
  ? getComputedStyle(document.documentElement) : null;

/* Fallbacks are the same values styles.css declares. They exist for the case
   where the stylesheet has not parsed yet — not as a second palette. */
const read = (name, fallback) => {
  const v = CS ? (CS.getPropertyValue(name) || '').trim() : '';
  return v || fallback;
};

export const UI = {
  void: read('--void', '#0A0A0A'),
  bone: read('--bone', '#F0EDE5'),
  grey: read('--grey', '#8A8A87'),
  greyDim: read('--grey-dim', '#5A5A58'),
  science: read('--science', '#E8A33D'),
  emergency: read('--emergency', '#C02820'),
  confirm: read('--confirm', '#6F9E52'),
  data: read('--data', '#6EA4C4'),
  dataDim: read('--data-dim', '#3C5C70'),
  /* One grotesque, two roles — labels and values. Canvas has no
     font-variant-numeric, so instrument numerals are laid out by hand where
     column alignment matters rather than trusted to the font. */
  font: read('--grot', 'Helvetica, Arial, sans-serif')
};

/** `rgba()` over a token. Accepts #rgb, #rrggbb or an existing rgb()/rgba(). */
export function alpha(color, a) {
  const c = color.trim();
  if (c[0] === '#') {
    const h = c.length === 4
      ? c.slice(1).split('').map(x => x + x).join('')
      : c.slice(1, 7);
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : c;
}

/** Numeric triple, for the places that write into an ImageData buffer. */
export function rgbOf(color) {
  const m = alpha(color, 1).match(/(\d+),(\d+),(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
}

/** three.js takes an integer; keep the palette the single source for it too. */
export function hexOf(color) {
  const [r, g, b] = rgbOf(color);
  return (r << 16) | (g << 8) | b;
}

/** Instrument type: one family, sized in canvas pixels. */
export const type = (px, weight = 400) => `${weight} ${px}px ${UI.font}`;
