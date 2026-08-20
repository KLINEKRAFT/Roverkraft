/* ============================================================
   PERF — frame-time trace, recorded over minutes rather than seconds
   ------------------------------------------------------------
   A phone holds 60 fps for ninety seconds and then falls off a cliff as the
   SoC heats. Anything that samples the first thirty seconds is measuring the
   wrong thing, so this records BUCKETS — one row per BUCKET_S of wall clock,
   each carrying the mean, the median, the 95th percentile and the worst frame
   inside it, plus the render scale the governor had settled on.

   Read down the p95 column and thermal throttling is a shape you can see:
   flat, then a step, then flat again lower. Read down renderScale next to it
   and you can tell whether the governor traded pixels for that steadiness or
   simply gave up.

   The recorder itself must not show up in its own trace. It writes into a
   preallocated ring per bucket and touches the DOM twice a second, never
   per frame.
   ============================================================ */

const BUCKET_S = 10;          // seconds of wall clock per row
const MAX_BUCKETS = 360;      // one hour at 10 s, then it stops growing
const RING = 4096;            // frames held for percentiles inside one bucket

/** Percentile of a filled Float32Array slice. Sorts a copy — called once per
    bucket, not per frame. */
function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

export class Perf {
  constructor() {
    this.on = false;                       // overlay visible
    this.recording = false;
    this.buckets = [];                     // {t0, n, mean, p50, p95, worst, scale, tier}
    this._ring = new Float32Array(RING);
    this._n = 0;
    this._t0 = 0;                          // wall clock at the start of the run
    this._bt = 0;                          // seconds accumulated into this bucket
    this._uiT = 0;
    this._live = { fps: 0, ms: 0, p95: 0 };
    this._liveRing = new Float32Array(120);
    this._liveN = 0;
    this.el = null;
    this.note = '';                        // free text stamped into the export
  }

  /* ---------------- lifecycle ---------------- */
  start(note) {
    this.buckets.length = 0;
    this._n = 0; this._bt = 0; this._t0 = 0;
    this.note = note || '';
    this.recording = true;
  }
  stop() { this.recording = false; }

  /** Call once per frame with the real frame delta, before or after the draw —
      consistently, either way. */
  sample(dt, engine) {
    const ms = dt * 1000;

    // live readout: a short ring, so the number on screen reacts in about two
    // seconds rather than averaging the whole session into uselessness
    this._liveRing[this._liveN % this._liveRing.length] = ms;
    this._liveN++;

    if (this.recording) {
      this._t0 += dt;
      this._bt += dt;
      if (this._n < RING) this._ring[this._n++] = ms;
      if (this._bt >= BUCKET_S) this._closeBucket(engine);
    }
  }

  _closeBucket(engine) {
    const n = this._n;
    const slice = Array.prototype.slice.call(this._ring.subarray(0, n)).sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += slice[i];
    this.buckets.push({
      t0: Math.round(this._t0 - this._bt),
      n,
      mean: n ? sum / n : 0,
      p50: pct(slice, 0.50),
      p95: pct(slice, 0.95),
      worst: n ? slice[n - 1] : 0,
      scale: engine ? engine.renderScale : 1,
      tier: engine ? engine.quality.name : '—'
    });
    if (this.buckets.length > MAX_BUCKETS) { this.recording = false; }
    this._n = 0; this._bt = 0;
  }

  /* ---------------- readout ---------------- */
  liveStats() {
    const n = Math.min(this._liveN, this._liveRing.length);
    if (!n) return { fps: 0, ms: 0, p95: 0 };
    const s = Array.prototype.slice.call(this._liveRing.subarray(0, n)).sort((a, b) => a - b);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += s[i];
    const mean = sum / n;
    return { fps: mean > 0 ? 1000 / mean : 0, ms: mean, p95: pct(s, 0.95) };
  }

  /** The whole trace as CSV. Deliberately CSV and not JSON: this ends up in a
      spreadsheet next to a second run, which is the only way the numbers mean
      anything. */
  csv() {
    const head = [
      `# roverkraft frame trace`,
      `# ${this.note}`,
      `# ua=${navigator.userAgent}`,
      `# dpr=${window.devicePixelRatio} viewport=${window.innerWidth}x${window.innerHeight}`,
      `# cores=${navigator.hardwareConcurrency || '?'} memGB=${navigator.deviceMemory || '?'}`,
      `t_s,frames,mean_ms,p50_ms,p95_ms,worst_ms,render_scale,tier`
    ].join('\n');
    const rows = this.buckets.map(b =>
      [b.t0, b.n, b.mean.toFixed(2), b.p50.toFixed(2), b.p95.toFixed(2),
        b.worst.toFixed(2), b.scale.toFixed(3), b.tier].join(','));
    return head + '\n' + rows.join('\n') + '\n';
  }

  /** Save the trace. A phone has no console you can copy out of, so the only
      route off the device that works everywhere is a download. */
  download() {
    const blob = new Blob([this.csv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `roverkraft-trace-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------------- overlay ----------------
     Type only. A frame-time graph drawn every frame would be the single most
     expensive thing on screen on the device this is meant to measure, so the
     history is a column of numbers that updates twice a second. */
  mount() {
    if (this.el) return;
    const d = document.createElement('div');
    d.id = 'perf';
    d.className = 'hidden';
    document.body.appendChild(d);
    this.el = d;
  }

  toggle(on) {
    this.mount();
    this.on = on === undefined ? !this.on : !!on;
    this.el.classList.toggle('hidden', !this.on);
  }

  update(dt, engine) {
    if (!this.on || !this.el) return;
    this._uiT += dt;
    if (this._uiT < 0.5) return;
    this._uiT = 0;
    const L = this.liveStats();
    // last six buckets, newest first — one minute of history at a glance
    const tail = this.buckets.slice(-6).reverse().map(b =>
      `<div><i>${b.t0}s</i>${b.p50.toFixed(1)}<b>${b.p95.toFixed(1)}</b><u>${(b.scale * 100).toFixed(0)}%</u></div>`
    ).join('');
    this.el.innerHTML =
      `<div class="perf-now">${L.fps.toFixed(0)} FPS<b>${L.ms.toFixed(1)}</b><b>${L.p95.toFixed(1)}</b></div>` +
      `<div class="perf-sub">MEAN · P95 ms &nbsp; ${engine.quality.name} &nbsp; ${(engine.renderScale * 100).toFixed(0)} %</div>` +
      (this.recording
        ? `<div class="perf-rows"><div class="perf-hd"><i>T</i>P50<b>P95</b><u>SCALE</u></div>${tail}</div>` +
          `<div class="perf-sub">RECORDING · ${Math.round(this._t0)} s · ${this.buckets.length} rows</div>`
        : `<div class="perf-sub">IDLE — start a trace from SYSTEMS</div>`);
  }
}
