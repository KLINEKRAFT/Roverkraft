/* Bump this whenever anomaly generation, the terrain the filters read, or the
   mission list changes. save() writes anomaly state as a bare positional array
   with no id and no coordinates, so a one-slot shift silently marks the wrong
   object as taken — and there is no version field inside the blob to catch it.
   The key IS the version.

   v1  upstream REGOLITH / Anaxagoras
   v2  Philolaus: vein/horizon/deep taxonomy, veins centred on the pit,
       five missions reordered, flags derived from mission position */
const KEY = 'roverkraft.philolaus.v2';

export const Save = {
  read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  },
  write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { return false; }
  },
  clear() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
  settings() {
    try { return JSON.parse(localStorage.getItem(KEY + '.set') || 'null') || {}; }
    catch { return {}; }
  },
  saveSettings(s) {
    try { localStorage.setItem(KEY + '.set', JSON.stringify(s)); } catch { /* ignore */ }
  }
};
