/* ============================================================
   HUD — telemetry, instruments, codex, menus
   ============================================================ */
import { CODEX, MISSIONS } from '../game/lore.js';
import { HOME } from '../world/props.js';
import { STATION, PIT } from '../game/gameplay.js';
import { DRIVE } from '../game/rover.js';
import { PLAYABLE_R, MACRO_RES, MACRO_EXT } from '../world/terrain.js';
import { clamp, sstep } from '../core/rng.js';
import { UI, alpha, rgbOf, type } from './theme.js';
import { SOIL, MARE, EJECTA, TALUS, TRAP } from '../world/soil.js';

const $ = (id) => document.getElementById(id);
const MAP_EXT = 1020;                    // metres shown across the minimap base
const MAP_RGB = rgbOf(UI.bone);          // the hillshade is lit bone, not white

export class HUD {
  constructor(audio) {
    this.audio = audio;
    this.el = {
      hud: $('hud'), mission: $('missionBox'), tag: $('missionTag'), name: $('missionName'), obj: $('missionObj'),
      sunPhase: $('sunPhase'), met: $('met'), rangeHome: $('rangeHome'),
      batt: $('gBatt'), heat: $('gHeat'), hull: $('gHull'), chips: $('sysChips'),
      bay: $('baygrid'), bayCount: $('bayCount'), mapScale: $('mapScale'),
      prompt: $('prompt'), logfeed: $('logfeed'), vig: $('vig'),
      discovery: $('discovery'), gprState: $('gprState'),
      codexList: $('codexList'), codexRead: $('codexRead'),
      tilt: $('gTilt'), speed: $('gSpeed'), odo: $('odo'), camMode: $('camMode'), mapName: $('mapName'),
      tray: $('tray'), trayBody: $('trayBody'), trayGrip: $('trayGrip')
    };
    this.cv = {
      compass: $('compass').getContext('2d'),
      minimap: $('minimap').getContext('2d'),
      wheel: $('wheelmon').getContext('2d'),
      gpr: $('gprscope').getContext('2d')
    };
    this.mapDirty = true; this.bayDirty = true; this.missionDirty = true; this.codexDirty = true;
    this.logs = [];
    this.interactProgress = 0;
    this.gprTrace = new Float32Array(160);
    this.mapBase = null;
    this._t = 0;
    this._discT = 0;
    this._camLabel = '';
    /* ---------------- what moves, and where it came from ----------------
       A phone cannot carry mission control at any size that is still legible,
       so instruments come OFF the driving HUD. They do not disappear: they are
       re-parented into the status tray, where a thumb reaches them at a stop.

       The home anchor is recorded here, before anything has moved. Restoring
       walks the list in REVERSE so that each `next` sibling is already back in
       the document by the time it is used — several of these are each other's
       neighbours, and forward order throws NotFoundError on the first pair. */
    this.movable = ['.z-compass', '.z-clock', '#gHeat', '#sysChips', '.bay', '.wheels', '.gpr']
      .map(sel => document.querySelector(`#hud ${sel}`) || document.querySelector(sel))
      .filter(Boolean)
      .map(node => ({ node, parent: node.parentNode, next: node.nextSibling }));
    this._layout = null;
    this.trayOpen = false;
    /* True when the reference instruments are actually on screen. Everything
       gated by it is a canvas redraw per frame, and drawing a hidden A-scope
       into a hidden canvas is the cheapest thing on this list to stop doing. */
    this.refVisible = true;

    this.buildBay();
    this.buildCodexList();
    this.setLayout(matchMedia('(max-width:700px), (max-height:520px)').matches ? 'phone' : 'wide');
    this.el.tray.classList.add('hidden');    // shown with the HUD, at startGame
  }

  /* ---------------- layout ---------------- */
  setLayout(mode) {
    if (mode === this._layout) return;
    this._layout = mode;
    if (mode === 'phone') {
      for (const m of this.movable) this.el.trayBody.appendChild(m.node);
    } else {
      for (let i = this.movable.length - 1; i >= 0; i--) {
        const m = this.movable[i];
        m.parent.insertBefore(m.node, m.next);
      }
      this.setTray(false);
    }
    this.el.tray.classList.toggle('off', mode !== 'phone');
    this.refVisible = mode !== 'phone';
    this.bayDirty = true;
  }

  setTray(open) {
    this.trayOpen = !!open && this._layout === 'phone';
    this.el.tray.classList.toggle('closed', !this.trayOpen);
    this.el.trayGrip.setAttribute('aria-expanded', this.trayOpen ? 'true' : 'false');
    this.refVisible = this._layout !== 'phone' || this.trayOpen;
    if (this.refVisible) this.bayDirty = true;
    if (this.audio) this.audio.ui('tick');
  }
  toggleTray() { this.setTray(!this.trayOpen); }

  /* ---------------- minimap base: hillshade the real height field ---------------- */
  bakeMap(terrain) {
    const N = 300;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const sample = (x, z) => {
      const u = clamp((x / MACRO_EXT + 0.5) * MACRO_RES, 0, MACRO_RES - 1) | 0;
      const v = clamp((z / MACRO_EXT + 0.5) * MACRO_RES, 0, MACRO_RES - 1) | 0;
      return terrain.macro[v * MACRO_RES + u];
    };
    const step = MAP_EXT / N;
    let mn = 1e9, mx = -1e9;
    const H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * MAP_EXT, z = (j / N - 0.5) * MAP_EXT;
      const h = sample(x, z);
      H[j * N + i] = h;
      if (h < mn) mn = h; if (h > mx) mx = h;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h = H[j * N + i];
      const hl = H[j * N + Math.max(i - 1, 0)], hr = H[j * N + Math.min(i + 1, N - 1)];
      const hu = H[Math.max(j - 1, 0) * N + i], hd = H[Math.min(j + 1, N - 1) * N + i];
      // light from the north-west, the cartographer's convention
      const nx = (hl - hr) / (2 * step), nz = (hu - hd) / (2 * step);
      const shade = clamp(0.5 + (nx * 0.62 + nz * 0.62) * 2.4, 0, 1);
      const t = (h - mn) / Math.max(mx - mn, 1e-4);
      const base = 0.10 + t * 0.30;
      let v = base * (0.45 + 0.85 * shade);
      const x = (i / N - 0.5) * MAP_EXT, z = (j / N - 0.5) * MAP_EXT;
      const r = Math.hypot(x, z);
      if (r > PLAYABLE_R) v *= 0.42;                  // outside the fence reads dead
      const o = (j * N + i) * 4;
      img.data[o] = v * MAP_RGB[0]; img.data[o + 1] = v * MAP_RGB[1]; img.data[o + 2] = v * MAP_RGB[2];
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // fence ring
    g.strokeStyle = alpha(UI.science, 0.30); g.lineWidth = 1;
    g.beginPath(); g.arc(N / 2, N / 2, PLAYABLE_R / MAP_EXT * N, 0, 6.2832); g.stroke();
    this.mapBase = c;
  }

  /* ---------------- sample bay ---------------- */
  buildBay() {
    this.el.bay.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div'); d.className = 'slot';
      this.el.bay.appendChild(d);
    }
  }
  refreshBay(game) {
    const slots = this.el.bay.children;
    for (let i = 0; i < slots.length; i++) {
      const s = game.bay[i];
      slots[i].className = 'slot' + (s ? ' full' : '') + (s && s.rare ? ' rare' : '');
      slots[i].title = s ? s.name : 'EMPTY';
    }
    this.el.bayCount.textContent = `${game.bay.length}/6`;
    this.bayDirty = false;
  }

  /* ---------------- log feed ---------------- */
  log(text, kind) {
    const d = document.createElement('div');
    d.className = 'logline' + (kind ? ' ' + kind : '');
    d.textContent = text;
    this.el.logfeed.prepend(d);
    this.logs.push({ el: d, t: performance.now() });
    while (this.el.logfeed.children.length > 6) this.el.logfeed.lastChild.remove();
    if (this.audio) this.audio.ui(kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'tick');
  }

  setPrompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); this._prompt = null; return; }
    if (html !== this._prompt) { this.el.prompt.innerHTML = html; this._prompt = html; }
    this.el.prompt.classList.remove('hidden');
  }

  flashDiscovery(kicker, name, sub) {
    const d = this.el.discovery;
    d.querySelector('.d-kicker').textContent = kicker;
    d.querySelector('.d-name').textContent = name;
    d.querySelector('.d-sub').textContent = sub || '';
    d.classList.remove('hidden');
    d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
    this._discT = 3.4;
  }

  hit(k) {
    this.el.vig.classList.add('hit');
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => this.el.vig.classList.remove('hit'), 120 + k * 260);
  }

  /* ---------------- mission panel ---------------- */
  refreshMission(game) {
    const m = game.mission;
    if (!m) {
      this.el.tag.textContent = 'FREE SURVEY';
      this.el.name.textContent = 'PHILOLAUS';
      this.el.obj.innerHTML = `<div>${game.excavated} excavations · ${(game.rover.odo / 1000).toFixed(2)} km driven</div>`;
      this.missionDirty = false; return;
    }
    this.el.tag.textContent = m.tag;
    this.el.name.textContent = m.name;
    this.el.obj.innerHTML = m.objectives.map(o => {
      const done = game.objDone[o.id];
      const cnt = o.count ? ` ${Math.min(game.counts[o.id] || 0, o.count)}/${o.count}` : '';
      const hint = !done && o.hint ? `<small>${o.hint}</small>` : '';
      return `<div class="${done ? 'done' : ''}"><i>${done ? '✓' : '▸'}</i><span>${o.text}${cnt}${hint}</span></div>`;
    }).join('');
    this.missionDirty = false;
  }

  showCard(m) {
    $('cardKicker').textContent = m.tag;
    $('cardTitle').textContent = m.name;
    $('cardText').innerHTML = (m.brief || '').split('\n\n').map(p => `<span>${p}</span>`).join('<br><br>');
    $('cardObj').innerHTML = m.objectives.map(o => `<div>${o.text}</div>`).join('');
    $('cardOverlay').classList.remove('hidden');
    this.cardOpen = true;
  }
  hideCard() { $('cardOverlay').classList.add('hidden'); this.cardOpen = false; }

  /* ---------------- codex ---------------- */
  buildCodexList() {
    this.el.codexList.innerHTML = '';
    for (const e of CODEX) {
      const li = document.createElement('li');
      li.dataset.id = e.id;
      li.innerHTML = `<small>${e.tag}</small>${e.title}`;
      li.addEventListener('click', () => { if (!li.classList.contains('locked')) this.readCodex(e.id); });
      this.el.codexList.appendChild(li);
    }
  }
  refreshCodex(game) {
    for (const li of this.el.codexList.children) {
      const open = game.unlocked.has(li.dataset.id);
      li.classList.toggle('locked', !open);
      if (!open) {
        const e = CODEX.find(c => c.id === li.dataset.id);
        li.innerHTML = `<small>${e.tag}</small>[ SEALED ]`;
      } else {
        const e = CODEX.find(c => c.id === li.dataset.id);
        li.innerHTML = `<small>${e.tag}</small>${e.title}`;
      }
    }
    this.codexDirty = false;
  }
  readCodex(id) {
    const e = CODEX.find(c => c.id === id);
    if (!e) return;
    for (const li of this.el.codexList.children) li.classList.toggle('on', li.dataset.id === id);
    this.el.codexRead.innerHTML =
      `<h3>${e.title}</h3><div class="meta">${e.meta}</div>` +
      e.body.map((p, i) => `<p class="${i === e.body.length - 1 && e.tag === 'STATION LOG' ? 'sig' : ''}">${p}</p>`).join('');
    this.el.codexRead.scrollTop = 0;
    if (this.audio) this.audio.ui('tick');
  }

  /* ============================================================
     instruments
     ============================================================ */
  drawCompass(rover, game, sky) {
    const g = this.cv.compass, W = 660, H = 42;
    g.clearRect(0, 0, W, H);
    // Map convention: north is −Z (up on the minimap), east is +X.
    const heading = (Math.atan2(rover.forward.x, -rover.forward.z) * 180 / Math.PI + 360) % 360;
    const span = 140;                                  // degrees across the strip
    const pxPerDeg = W / span;
    g.font = type(10);
    g.textAlign = 'center';
    const marks = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    // Step over ABSOLUTE bearings, not offsets from the current heading —
    // otherwise no tick ever lands exactly on a multiple of 45 and the
    // cardinal labels never appear.
    for (let a = 0; a < 360; a += 5) {
      const rel = ((a - heading + 540) % 360) - 180;
      if (Math.abs(rel) > span / 2) continue;
      const x = W / 2 + rel * pxPerDeg;
      const major = a % 45 === 0;
      const mid = a % 15 === 0;
      g.strokeStyle = major ? alpha(UI.bone, 0.75) : mid ? alpha(UI.bone, 0.38) : alpha(UI.bone, 0.16);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, H - 1); g.lineTo(x, H - (major ? 13 : mid ? 8 : 4)); g.stroke();
      if (major) {
        const lab = marks[a];
        g.fillStyle = lab.length <= 2 ? UI.bone : alpha(UI.bone, 0.60);
        g.fillText(lab, x, H - 18);
      }
    }
    // objective bearing
    /* Only bearings you have a live reason to steer by. Asking the mission
       whether an objective is OUTSTANDING, rather than which number it is,
       means a reordered campaign cannot point the needle at the wrong place. */
    const targets = [];
    if (game.objActive('reach')) targets.push([STATION.x, STATION.z, UI.science, 'KEEL-4']);
    if (game.objActive('enter')) targets.push([PIT.x, PIT.z, UI.science, 'PIT']);
    if (game.bay.length >= 6 || game.objDone.deep || game.power < 25) targets.push([HOME.x, HOME.z, UI.data, 'SLED']);
    for (const a of game.anoms) if (a.found && !a.taken && game.distTo(a.x, a.z) < 190)
      targets.push([a.x, a.z, a.special || a.type === 'vein' ? UI.science : UI.data, null]);
    for (const [tx, tz, col, lab] of targets) {
      const b = (Math.atan2(tx - rover.pos.x, -(tz - rover.pos.z)) * 180 / Math.PI + 360) % 360;
      const rel = ((b - heading + 540) % 360) - 180;
      if (Math.abs(rel) > span / 2) continue;
      const x = W / 2 + rel * pxPerDeg;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x, 4); g.lineTo(x - 4, -3); g.lineTo(x + 4, -3); g.closePath();
      g.beginPath(); g.moveTo(x, 12); g.lineTo(x - 5, 3); g.lineTo(x + 5, 3); g.closePath(); g.fill();
      if (lab) { g.font = type(8); g.fillText(lab, x, 22); g.font = type(10); }
    }
    // sun bearing
    const sb = (Math.atan2(sky.sunDir.x, -sky.sunDir.z) * 180 / Math.PI + 360) % 360;
    const srel = ((sb - heading + 540) % 360) - 180;
    if (Math.abs(srel) <= span / 2) {
      const x = W / 2 + srel * pxPerDeg;
      g.fillStyle = alpha(UI.bone, 0.85);
      g.beginPath(); g.arc(x, 8, 3.4, 0, 6.2832); g.fill();
    }
    // centre index
    g.strokeStyle = UI.data; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, H - 17); g.stroke();
    g.fillStyle = UI.data; g.font = type(10);
    g.fillText(String(Math.round(heading)).padStart(3, '0'), W / 2, 10);
  }

  drawMinimap(rover, game) {
    const g = this.cv.minimap, S = 300;
    g.clearRect(0, 0, S, S);
    if (!this.mapBase) return;
    const zoom = this.mapZoom || 1.9;
    const span = MAP_EXT / zoom;
    /* The map is a telemetry product, not a window. Below the rim with no
       relay chain there is no line of sight to anything, so the position on
       it is the last one that got out — which is exactly why the chain is a
       mission and not a chore. The ground-ahead band underneath keeps
       working, because that one is the rover's own radar. */
    if (game.uplink) { this._fix = { x: rover.pos.x, z: rover.pos.z }; }
    const fix = game.uplink ? rover.pos : (this._fix || rover.pos);
    const px = fix.x, pz = fix.z;
    const src = this.mapBase.width;
    const sx = ((px / MAP_EXT + 0.5) * src) - (span / MAP_EXT * src) / 2;
    const sy = ((pz / MAP_EXT + 0.5) * src) - (span / MAP_EXT * src) / 2;
    const sw = span / MAP_EXT * src;
    g.save();
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.mapBase, sx, sy, sw, sw, 0, 0, S, S);

    const w2s = (x, z) => [(x - px) / span * S + S / 2, (z - pz) / span * S + S / 2];

    // relay coverage
    if (game.props.relays) for (const r of game.props.relays) {
      const [ux, uy] = w2s(r.position.x, r.position.z);
      g.strokeStyle = alpha(UI.data, 0.22); g.lineWidth = 1;
      g.beginPath(); g.arc(ux, uy, 95 / span * S, 0, 6.2832); g.stroke();
      g.fillStyle = UI.data; g.fillRect(ux - 2.5, uy - 2.5, 5, 5);
    }
    // POIs
    const poi = (x, z, col, label, shape) => {
      const [ux, uy] = w2s(x, z);
      if (ux < -20 || uy < -20 || ux > S + 20 || uy > S + 20) return;
      g.fillStyle = col;
      if (shape === 'home') {
        g.beginPath(); g.moveTo(ux, uy - 6); g.lineTo(ux + 5, uy + 4); g.lineTo(ux - 5, uy + 4); g.closePath(); g.fill();
      } else if (shape === 'x') {
        g.strokeStyle = col; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(ux - 4, uy - 4); g.lineTo(ux + 4, uy + 4);
        g.moveTo(ux + 4, uy - 4); g.lineTo(ux - 4, uy + 4); g.stroke();
      } else {
        g.beginPath(); g.arc(ux, uy, 3.2, 0, 6.2832); g.fill();
      }
      if (label) {
        g.font = type(8); g.textAlign = 'center';
        g.fillStyle = col; g.fillText(label, ux, uy - 9);
      }
    };
    poi(HOME.x, HOME.z, UI.data, 'SLED', 'home');
    if (game.revealed('STATION')) poi(STATION.x, STATION.z, UI.science, 'KEEL-4', 'x');
    if (game.revealed('PIT')) poi(PIT.x, PIT.z, UI.science, 'PIT', 'x');
    for (const a of game.anoms) if (a.found && !a.taken)
      poi(a.x, a.z, a.special || a.type === 'vein' ? UI.science : UI.data, null, 'dot');

    // rover
    const dHome = Math.hypot(rover.pos.x - HOME.x, rover.pos.z - HOME.z);
    const hd = Math.atan2(rover.forward.x, -rover.forward.z);
    g.save(); g.translate(S / 2, S / 2); g.rotate(hd);
    g.fillStyle = game.uplink ? UI.bone : alpha(UI.bone, 0.30);
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    // scan pulse
    if (game.scan.active) {
      const [ux, uy] = w2s(game.scan.x, game.scan.z);
      g.strokeStyle = alpha(UI.data, 0.8 - game.scan.t / 2.1 * 0.7); g.lineWidth = 1.4;
      g.beginPath(); g.arc(ux, uy, game.scan.r / span * S, 0, 6.2832); g.stroke();
    }
    g.restore();
    g.strokeStyle = alpha(UI.bone, 0.16); g.lineWidth = 1;
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
    if (!game.uplink) {
      g.fillStyle = alpha(UI.void, 0.62); g.fillRect(0, 0, S, S - 17);
      g.fillStyle = UI.emergency; g.font = type(13); g.textAlign = 'center';
      g.fillText('NO UPLINK', S / 2, S / 2 - 4);
      g.fillStyle = alpha(UI.bone, 0.55); g.font = type(9);
      g.fillText('LAST FIX', S / 2, S / 2 + 12);
      g.textAlign = 'left';
    }

    this._drawAhead(rover, game, g, S);

    /* The map header is two slots, and on a phone they carry the two questions
       the compass strip and the clock used to answer: which way am I pointed,
       and how far is the sled. The basin name and the scale bar are reference,
       and reference lives in the tray. Written through a cache — textContent
       on every frame is a layout pass nobody asked for. */
    const phone = this._layout === 'phone';
    const name = phone
      ? `HDG ${String(Math.round(hd * 57.29578 + 360) % 360).padStart(3, '0')}°`
      : 'PHILOLAUS BASIN';
    const scale = phone
      ? (dHome > 999 ? `SLED ${(dHome / 1000).toFixed(2)} km` : `SLED ${Math.round(dHome)} m`)
      : `${Math.round(span)} m`;
    if (name !== this._mapName) { this._mapName = name; this.el.mapName.textContent = name; }
    if (scale !== this._mapScale) { this._mapScale = scale; this.el.mapScale.textContent = scale; }
  }

  /* ---------------- the ground ahead ----------------
     The radar's second job, and it lives with the MAP rather than with the
     A-scope because it answers a navigation question, not a depth one — and
     because the map is the one instrument that stays on the driving HUD on
     every device. A soft patch you can see coming is a hazard; one you cannot
     is a load screen.

     Two readings in one band: the fill is the soil unit for the next forty
     metres along the heading, and the trace over it is the ground's own
     profile. The trace is what gets you down the bench and across the pit
     floor with the lamps off, which is the only way to read the column
     without destroying it. */
  _drawAhead(rover, game, g, S) {
    if (!rover || !game.terrain) return;
    const AHEAD = 40, BH = 17, y0 = S - BH, n = 40;
    const fx = rover.forward.x, fz = rover.forward.z;
    const h0 = game.terrain.heightAt(rover.pos.x, rover.pos.z);
    g.fillStyle = alpha(UI.void, 0.86);
    g.fillRect(0, y0, S, BH);
    let worst = MARE;
    for (let i = 0; i < n; i++) {
      const d = (i / n) * AHEAD;
      const u = game.terrain.soilAt(rover.pos.x + fx * d, rover.pos.z + fz * d);
      if (u === TRAP) worst = TRAP; else if (u === TALUS && worst !== TRAP) worst = TALUS;
      g.fillStyle = u === MARE ? alpha(UI.bone, 0.12)
                  : u === TRAP ? alpha(UI.emergency, 0.80)
                  : u === EJECTA ? alpha(UI.bone, 0.34) : alpha(UI.science, 0.34);
      g.fillRect(i / n * S, y0, S / n + 0.7, BH);
    }
    // profile: +-6 m of relief across the band, clipped
    g.strokeStyle = UI.data; g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const d = (i / n) * AHEAD;
      const dh = game.terrain.heightAt(rover.pos.x + fx * d, rover.pos.z + fz * d) - h0;
      const y = y0 + BH * 0.5 - clamp(dh / 6, -1, 1) * (BH * 0.42);
      i ? g.lineTo(i / n * S, y) : g.moveTo(0, y);
    }
    g.stroke();
    g.strokeStyle = alpha(UI.bone, 0.20); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y0 + 0.5); g.lineTo(S, y0 + 0.5); g.stroke();
    g.font = type(8); g.textAlign = 'left';
    g.fillStyle = worst === TRAP ? UI.emergency : alpha(UI.bone, 0.38);
    g.fillText(worst === TRAP ? 'SOFT FILL AHEAD' : `${AHEAD} m AHEAD`, 4, y0 - 4);
  }

  drawWheels(rover) {
    const g = this.cv.wheel, W = 236, H = 130;
    g.clearRect(0, 0, W, H);
    g.font = type(8); g.textAlign = 'left';
    const cols = [42, 118, 194], rows = [36, 96];
    rover.wheels.forEach((w) => {
      const cx = cols[w.axle], cy = rows[w.side < 0 ? 0 : 1];
      const load = clamp(w.load / 700, 0, 1.4);
      g.strokeStyle = w.contact ? alpha(UI.bone, 0.35) : alpha(UI.emergency, 0.75);
      g.lineWidth = 1;
      g.strokeRect(cx - 26, cy - 15, 52, 30);
      g.fillStyle = w.slipLong > 0.25 ? alpha(UI.science, 0.25 + w.slipLong * 0.6)
                                      : alpha(UI.data, 0.16 + load * 0.5);
      g.fillRect(cx - 25, cy + 14 - Math.max(2, load * 28), 50, Math.max(2, load * 28));
      /* Sinkage, in two parts, because they mean different things. The dim
         bar is the static Bekker term — how far this wheel sits into this
         soil under this load, which you cannot do anything about. The bright
         one is what SLIP dug, which you can: ease off and it relaxes. A
         player who learns to read the second bar has learned the mechanic. */
      const st = clamp((w.sink - w.slipSink) / 0.30, 0, 1);
      const sl = clamp(w.sink / 0.30, 0, 1);
      g.fillStyle = alpha(UI.bone, 0.22);
      g.fillRect(cx - 25, cy + 14, 50 * sl, 2);
      g.fillStyle = w.slipSink > 0.05 ? UI.science : alpha(UI.bone, 0.45);
      g.fillRect(cx - 25, cy + 14, 50 * st, 2);
      if (w.slipSink > 0.005) {
        g.fillStyle = w.sink > 0.22 ? UI.emergency : UI.science;
        g.fillRect(cx - 25 + 50 * st, cy + 13, 50 * (sl - st), 4);
      }
      g.fillStyle = alpha(UI.bone, 0.55);
      g.fillText(['F', 'M', 'A'][w.axle] + (w.side < 0 ? 'L' : 'R'), cx - 24, cy - 6);
      // the unit under THIS wheel: six wheels can be in three materials at once
      g.fillStyle = w.soil === MARE ? alpha(UI.bone, 0.30)
                  : w.soil === TRAP ? UI.emergency : alpha(UI.science, 0.85);
      g.textAlign = 'right';
      g.fillText((SOIL[w.soil] || SOIL[MARE]).name[0], cx + 24, cy - 6);
      g.textAlign = 'left';
    });
  }

  drawGPR(game, rover) {
    const g = this.cv.gpr, W = 290, H = 130;
    g.clearRect(0, 0, W, H);

    // depth grid
    const TOP = 0, DH = H;
    void rover;
    g.strokeStyle = alpha(UI.data, 0.12); g.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = TOP + i / 6 * DH;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.fillStyle = alpha(UI.data, 0.42); g.font = type(7.5); g.textAlign = 'left';
    for (let i = 1; i < 6; i++) g.fillText(`${i * 2} m`, 3, TOP + i / 6 * DH - 2);

    // A-scope trace: noise, plus a real reflector where an anomaly sits below
    const N = this.gprTrace.length;
    const near = game.anoms.filter(a => a.found && !a.taken && game.distTo(a.x, a.z) < 30);
    const scanning = game.scan.active;
    for (let i = 0; i < N; i++) {
      const depth = i / N * 12;
      let v = (Math.random() - 0.5) * (scanning ? 0.30 : 0.10);
      for (const a of near) {
        const d = game.distTo(a.x, a.z);
        const amp = (1 - d / 30) * (a.special ? 1.5 : a.type === 'vein' ? 1.1 : 0.7);
        v += Math.exp(-Math.pow((depth - a.depth) / 0.34, 2)) * amp * Math.sin(this._t * 22 + i * 0.4);
      }
      this.gprTrace[i] = this.gprTrace[i] * 0.55 + v * 0.45;
    }
    g.strokeStyle = near.length ? UI.data : alpha(UI.data, 0.42);
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const y = TOP + i / N * DH;
      const x = W / 2 + this.gprTrace[i] * W * 0.34;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    this.el.gprState.textContent = scanning ? 'SWEEPING' : game.scan.cool > 0 ? 'RECHARGING'
      : near.length ? `${near.length} RETURN` : 'IDLE';
  }

  /* ============================================================
     per-frame
     ============================================================ */
  update(dt, game, rover, sky, rig) {
    this._t += dt;
    this._camLabel = rig.modeName;

    if (this.missionDirty) this.refreshMission(game);
    if (this.bayDirty && this.refVisible) this.refreshBay(game);
    if (this.codexDirty) this.refreshCodex(game);

    // gauges
    const setG = (el, frac, label, warn, crit) => {
      el.querySelector('i').style.transform = `scaleX(${clamp(frac, 0, 1)})`;
      el.querySelector('b').textContent = label;
      el.classList.toggle('warn', frac < warn && frac >= crit);
      el.classList.toggle('crit', frac < crit);
    };
    /* Speed is a value, so it is type and a bar like every other value. It
       stays on the driving HUD despite being marginal to any decision, because
       it costs one row here and reading it is free. */
    const kmh = Math.abs(rover.speed) * 3.6;
    setG(this.el.speed, Math.abs(rover.speed) / (DRIVE.maxSpeed || 8.4),
      rover.airborne ? 'AIRBORNE' : `${kmh.toFixed(1)} km/h${rover.speed < -0.15 ? ' R' : ''}`, -1, -1);
    setG(this.el.batt, game.power / 100, `${Math.round(game.power)}%`, 0.35, 0.15);
    setG(this.el.hull, game.hull / 100, `${Math.round(game.hull)}%`, 0.45, 0.20);
    /* Attitude, not slope-under-the-wheels: what decides whether you are about
       to be on your roof is how far the CHASSIS is off level, and at one sixth
       of a gravity that arrives well before the terrain looks alarming. The
       bar fills toward the rollover angle rather than toward 90°. */
    const tilt = Math.acos(clamp(rover.up.y, -1, 1)) * 57.29578;
    const tf = clamp(tilt / 34, 0, 1);
    this.el.tilt.querySelector('i').style.transform = `scaleX(${tf})`;
    this.el.tilt.querySelector('b').textContent = `${tilt.toFixed(0)}°`;
    this.el.tilt.classList.toggle('warn', tilt > 18 && tilt <= 27);
    this.el.tilt.classList.toggle('crit', tilt > 27);

    if (this.refVisible) {
      const ht = clamp((game.heat + 60) / 120, 0, 1);
      this.el.heat.querySelector('i').style.transform = `scaleX(${ht})`;
      this.el.heat.querySelector('b').textContent = `${game.heat > 0 ? '+' : ''}${Math.round(game.heat)}°`;
      this.el.heat.classList.toggle('warn', game.heat < -35 || game.heat > 55);
      this.el.heat.classList.toggle('crit', game.heat < -55 || game.heat > 75);
    }

    // system chips
    if (this.refVisible) this._chipsAndClock(game, rover, sky);

    // instruments
    this.drawMinimap(rover, game);
    if (this.refVisible) {
      this.drawCompass(rover, game, sky);
      this.drawWheels(rover);
      this.drawGPR(game, rover);
    }

    // discovery banner
    if (this._discT > 0) {
      this._discT -= dt;
      if (this._discT <= 0) this.el.discovery.classList.add('hidden');
    }
    // log fade
    const now = performance.now();
    for (const l of this.logs) {
      if (!l.faded && now - l.t > 9000) { l.faded = true; l.el.classList.add('fade'); }
      if (l.faded && now - l.t > 10200 && l.el.parentNode) l.el.remove();
    }
    this.logs = this.logs.filter(l => l.el.parentNode);

    // interaction ring
    if (this.interactProgress > 0.001) {
      const p = this.interactProgress * 100;
      this.el.prompt.style.background =
        `linear-gradient(90deg, ${alpha(UI.bone, 0.24)} ${p}%, ${alpha(UI.void, 0.78)} ${p}%)`;
    } else this.el.prompt.style.background = '';
    void sstep; void MISSIONS;
  }

  /** Reference readouts: only worth writing while they are on screen. On a
      phone they live in the tray and are hidden for most of a session. */
  _chipsAndClock(game, rover, sky) {
    const chips = [
      [`UPLINK ${DRIVE.commsDelay > 0 ? DRIVE.commsDelay.toFixed(1) + 's' : 'LOCAL'}`, DRIVE.commsDelay > 0],
      ['ARM', rover.armOut],
      ['ARRAY', rover.panelDeploy > 0.6],
      ['LAMPS', rover.lampPower > 0.1],
      ['GPR', game.scan.active],
      ['DRILL', game.drill.active],
      ['TC', game.tc !== false],
      [`RELAY ${game.relaysPlaced}/3`, game.relaysPlaced > 0],
      [game.uplink ? 'UPLINK' : 'NO UPLINK', game.uplink],
      [`RECORD ${Math.max(0, 100 - Math.round(game.recordLoss))}%`, game.recordLoss < 1],
      // what the loaded wheels are standing in; lit when it is not the baseline
      [`GROUND ${(SOIL[rover.soilUnit] || SOIL[MARE]).name}`, rover.soilUnit !== MARE]
    ];
    const sig = chips.map(c => c[0] + c[1]).join('|');
    if (sig !== this._chipSig) {
      this._chipSig = sig;
      this.el.chips.innerHTML = chips.map(([t, on]) => `<span class="chip${on ? ' on' : ''}">${t}</span>`).join('');
    }

    // clocks
    const s = Math.floor(game.met);
    this.el.met.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const alt = Math.asin(clamp(sky.sunDir.y, -1, 1)) * 180 / Math.PI;
    const az = (Math.atan2(sky.sunDir.x, sky.sunDir.z) * 180 / Math.PI + 360) % 360;
    this.el.sunPhase.textContent = `${alt.toFixed(1)}° / ${Math.round(az)}°`;
    const dh = game.distTo(HOME.x, HOME.z);
    this.el.rangeHome.textContent = dh > 999 ? `${(dh / 1000).toFixed(2)} km` : `${Math.round(dh)} m`;
    // both of these used to be printed inside the speed dial
    this.el.odo.textContent = `${(rover.odo / 1000).toFixed(2)} km`;
    this.el.camMode.textContent = this._camLabel;
  }

  /* The tray is part of the HUD, so it comes and goes with it — a status
     tray over the main menu would be a panel with nothing to report. */
  showHUD() {
    this.el.hud.classList.remove('hidden');
    this.el.tray.classList.remove('hidden');
  }
  hideHUD() {
    this.el.hud.classList.add('hidden');
    this.el.tray.classList.add('hidden');
    this.setTray(false);
  }
}
