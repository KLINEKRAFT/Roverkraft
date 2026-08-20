/* ============================================================
   SOIL — what the ground under each wheel is made of
   ------------------------------------------------------------
   Upstream's sinkage is a function of wheel load alone. There is no soil map,
   so every square metre of the basin digs identically — which is not merely a
   fidelity gap, it is why the basin has no PLACES. Terrain that behaves the
   same everywhere is terrain you stop reading.

   The classical framework is Bekker's pressure-sinkage relation, where the
   pressure the ground supports grows with sinkage:

       p(z) = (k_c / b + k_phi) * z^n

   with b the smaller dimension of the contact patch, n the sinkage exponent
   and k_c, k_phi the soil's cohesive and frictional moduli. Paired with the
   Janosi-Hanamoto shear relation for traction, that is the standard rover
   mobility model — ESA's ExoMars work and NASA's ARTEMIS simulator for the
   MER rovers both sit on it.

   WHAT IS ACTUALLY IMPLEMENTED, and why it is not the textbook form:

   Bekker's relation assumes a flat RIGID PLATE. Small curved rover wheels
   deviate from it measurably, which is the whole reason Meirion-Griffith and
   Spenko's modified model exists. Rather than pretend to a precision the
   game cannot use, each unit carries an EFFECTIVE modulus K and an exponent
   n in the same functional form:

       z = (p / K) ^ (1/n)

   and MARE is calibrated so a 900 kg rover at one sixth g sinks about 16 mm,
   which is what Apollo's LRV actually did. Every other unit is placed
   relative to that. The form is Bekker's; the numbers are anchored to a
   measurement and then tuned until the basin reads. That is the honest
   description and it is the right trade — the soil map earns its complexity
   because it changes route choice, and a bevameter-derived solver would not.

   The units are painted in bakeTerrain(). They are also the reason the radar
   has a second job, the drill's sample varies by where you park, and the
   rim is somewhere you think about before you drive up it.
   ============================================================ */

export const MARE = 0, EJECTA = 1, TALUS = 2, TRAP = 3;

export const SOIL = [
  {
    id: MARE, name: 'MARE', label: 'BASIN FLOOR',
    /* The baseline, and what upstream models everywhere. Mature basin-floor
       regolith: four billion years of impact gardening, packed to about 40 %
       void, and firm enough a metre down that Apollo's core tubes stopped. */
    K: 120, n: 1.00, mu: 1.00, dig: 1.00, grit: 0.50,
    tint: [1.00, 1.00, 1.00]
  },
  {
    id: EJECTA, name: 'EJECTA', label: 'FRESH EJECTA',
    /* Thrown out of a young crater and not yet gardened: coarser, blockier,
       and noticeably firmer. This is the surface you want under you, and
       reading the crater rays to find it is the point. */
    K: 240, n: 0.90, mu: 1.14, dig: 0.55, grit: 0.25,
    tint: [1.16, 1.14, 1.10]
  },
  {
    id: TALUS, name: 'TALUS', label: 'RIM TALUS',
    /* Loose material resting at its angle of repose on the rim slopes. Sinks,
       slips, and is on a gradient, which is a combination that compounds. */
    K: 80, n: 1.15, mu: 0.84, dig: 1.55, grit: 0.80,
    tint: [0.94, 0.92, 0.90]
  },
  {
    id: TRAP, name: 'TRAP', label: 'SOFT FILL',
    /* Deep, low-density fill ponded in old depressions. Deceptively FLAT —
       there is no relief to warn you and the albedo difference is small, so
       the first sign is the machine going down at the axles. Getting out is
       a matter of easing off until the slip drops, not of more throttle. */
    K: 30, n: 1.30, mu: 0.70, dig: 2.30, grit: 1.00,
    tint: [0.84, 0.82, 0.81]
  }
];

/* The map is baked over the same extent as the macro height field, at one
   texel per 1.17 m. Nearest-sampled on both sides, so the CPU wheel model and
   the GPU tint read the same cell — unlike height, nothing here needs to be
   filtered, and a filtered soil index would be a soil that does not exist. */
export const SOIL_EXT = 1200, SOIL_RES = 1024;

/** Unit index at a world position. Nearest, clamped. */
export function soilAt(arr, x, z) {
  const u = ((x / SOIL_EXT + 0.5) * SOIL_RES) | 0;
  const v = ((z / SOIL_EXT + 0.5) * SOIL_RES) | 0;
  const i = (v < 0 ? 0 : v > SOIL_RES - 1 ? SOIL_RES - 1 : v) * SOIL_RES +
            (u < 0 ? 0 : u > SOIL_RES - 1 ? SOIL_RES - 1 : u);
  return arr[i];
}

/** Bekker-form static sinkage, in metres, for a contact pressure in pascals.

    Pressure arrives in Pa because that is what a force over a patch gives
    you; K is quoted in kPa per m^n because that is how the terramechanics
    literature quotes it, and converting here rather than in the table keeps
    the table readable against a paper. */
export function sinkageFor(unit, pressurePa) {
  const s = SOIL[unit] || SOIL[MARE];
  const p = Math.max(0, pressurePa) * 0.001;          // kPa
  return Math.pow(p / s.K, 1 / s.n);
}
