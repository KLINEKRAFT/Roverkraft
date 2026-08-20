/* ============================================================
   MISSION LOGIC
   ------------------------------------------------------------
   Radar, drill, power, thermal, samples, relays, story beats.
   ============================================================ */
import * as THREE from 'three';
import { makeRNG, clamp, sstep, lerp } from '../core/rng.js';
import { PLAYABLE_R } from '../world/terrain.js';
import { HOME } from '../world/props.js';
import { CODEX, SAMPLES, MISSIONS } from './lore.js';
import { POWER_FLOOR, POWER_KNEE } from './rover.js';
import { UI, hexOf } from '../ui/theme.js';

export const STATION = { x: -236, z: 140 };
/* The collapse. Phase 7 carves the hole; this is the point everything —
   missions, map, compass, the vein drainage — agrees it is at. */
export const PIT = { x: 0, z: 0 };

/* Named points the mission data refers to. A mission says `poi: 'STATION'`
   rather than importing a coordinate, which is what lets lore.js be text and
   data with no reach into the world. */
export const POI = { HOME, STATION, PIT };

const BAY_MAX = 6;
const SCAN_RANGE = 78;
const SCAN_COST = 4.0;
const SCAN_TIME = 2.1;
const SCAN_COOL = 1.4;
/* Consumables profile. ARCADE is the tuned-for-tension original; REALISTIC
   trades power panic for patience.

   Drill: an Apollo ALSD core took minutes of real work, not seconds. 45 s is
   still compressed — a truthful figure would be most of a session — but it is
   long enough that you park, commit, and watch the bit go down.

   Power: this is the one place where being realistic makes the game WORSE, so
   it is worth writing down rather than quietly fudging. An LRV pack is 8.7 kWh
   and ~57 km of range; this map is 864 m across, so a real pack would cross it
   66 times. Even VIPER's much smaller 450 Wh is hours. There is no honest
   capacity that leaves power as a source of tension at this scale.
   So realistic mode does not pretend: it slows the drain by 8x, which takes a
   full pack from ~2.5 minutes of hard driving through shadow to ~19. (Not 8x
   the wall clock: the survival-heater term only arms once heat falls past -30,
   about 25 s in, and that crossover is not scaled.) Power stops
   being a panic and becomes planning — which is what it actually is on a real
   rover — and the pressure moves to time instead, where the slow drive, the
   slow drill and the 2.6 s delay already put it. */
export const OPS = { drillTime: 4.2, drainScale: 1 };
const DRILL_COST = 9.0;
const RELAY_MIN_H = 10;
const RELAY_SPACING = 95;

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);          // {terrain, rover, props, dust, sky, audio, hud, engine, rig}
    this.reset();
  }

  reset(freeRoam = false) {
    // tear down anything a previous run left in the scene
    if (this.anoms) for (const a of this.anoms) if (a.marker) this.scene.remove(a.marker);
    if (this.props) this.props.clearDeployables();
    this.freeRoam = freeRoam;
    this.t = 0;
    this.met = 0;
    this.power = 100; this.heat = 12; this.hull = 100;
    this.bay = [];
    this.unlocked = new Set(CODEX.filter(c => c.start).map(c => c.id));
    this.missionIdx = 0;
    this.objDone = {};
    this.counts = {};
    this.relaysPlaced = 0;
    this.excavated = 0;
    this.stationVisited = false;
    this.coreTaken = false;
    this.transmitted = false;
    /* Capabilities and revealed points of interest, by name.
       These replace the `missionIdx < 4` / `=== 4` / `>= 3` comparisons that
       used to gate content by POSITION in the campaign. Those comparisons are
       why inserting a mission in the middle silently pointed the deep-drill
       gate and the station prompt at the wrong one. A mission now says what it
       reveals and what it grants; nothing counts. */
    this.flags = new Set();
    this.scan = { active: false, r: 0, t: 0, cool: 0, x: 0, z: 0 };
    this.drill = { active: false, t: 0, target: null };
    this.interact = { key: null, t: 0 };
    this.msgQueue = [];
    this.autoRecover = 0;
    this.flipTimer = 0;
    this.dangerTone = 0;
    this.buildAnomalies();
    if (freeRoam) {
      this.missionIdx = MISSIONS.length;
      for (const c of CODEX) this.unlocked.add(c.id);
    }
    this.syncFlags();
  }

  /* ============================================================
     mission state, by name rather than by index
     ============================================================ */

  /** Re-derive flags from the campaign position. Idempotent, so reset(),
      advance() and load() can all just call it. In free survey everything is
      revealed and granted — there is no campaign left to gate against. */
  syncFlags() {
    this.flags.clear();
    const upTo = this.freeRoam ? MISSIONS.length : Math.min(this.missionIdx + 1, MISSIONS.length);
    for (let i = 0; i < upTo; i++) {
      const m = MISSIONS[i];
      for (const p of m.reveals || []) this.flags.add('poi:' + p);
      for (const g of m.grants || []) this.flags.add(g);
    }
    if (this.freeRoam) {
      for (const k of Object.keys(POI)) this.flags.add('poi:' + k);
      this.flags.add('deepString');
    }
    // somewhere you have already been is somewhere you know about
    if (this.stationVisited) this.flags.add('poi:STATION');
  }

  /** Is this capability available? */
  can(flag) { return this.flags.has(flag); }
  /** Should the map and the compass admit this place exists? */
  revealed(poi) { return this.flags.has('poi:' + poi); }
  /** Is this objective part of the CURRENT mission and still outstanding? */
  objActive(id) {
    const m = this.mission;
    return !!m && !this.objDone[id] && m.objectives.some(o => o.id === id);
  }

  /* ============================================================
     buried things
     ============================================================ */
  buildAnomalies() {
    const rng = makeRNG(0x5EED17);
    this.anoms = [];
    const push = (x, z, type, depth, special) => {
      this.anoms.push({
        x, z, type, depth, special: special || null,
        found: false, taken: false, marker: null
      });
    };

    // the drainage: volatile veins running downhill toward the collapse
    for (let ring = 1; ring <= 5; ring++) {
      const n = 4 + ring * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.31;
        const r = 58 + ring * 62 + (rng() - 0.5) * 26;
        const x = PIT.x + Math.cos(a) * r, z = PIT.z + Math.sin(a) * r;
        if (Math.hypot(x, z) > PLAYABLE_R - 26) continue;
        if (this.terrain.slopeAt(x, z) > 26) continue;
        push(x, z, 'vein', 3.4 + rng() * 1.4);
      }
    }
    // ordinary science, scattered
    const kinds = ['regolith', 'breccia', 'ilmenite', 'agglutinate', 'pyroclast', 'meteoritic'];
    // (unchanged order and count — buildAnomalies feeds a POSITIONAL save
    // array, so any reshuffle here has to come with a save.js KEY bump)
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, r = 40 + rng() * (PLAYABLE_R - 70);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.terrain.slopeAt(x, z) > 28) continue;
      const t = kinds[Math.floor(Math.pow(rng(), 1.6) * kinds.length)];
      push(x, z, t, 1.2 + rng() * 2.2);
    }
    // the deep core off the pit floor — needs the 11 m string, which the last
    // mission grants; before that the drill refuses rather than lying
    push(PIT.x + 6, PIT.z - 4, 'deep', 11.0, 'deep');
    // the horizon layer, at the station's own dig site
    push(STATION.x + 14, STATION.z + 9, 'horizon', 4.1, 'horizon');
  }

  /* ============================================================
     helpers
     ============================================================ */
  get mission() { return MISSIONS[this.missionIdx] || null; }
  get bayFull() { return this.bay.length >= BAY_MAX; }
  distTo(x, z) { return Math.hypot(this.rover.pos.x - x, this.rover.pos.z - z); }
  get atHome() { return this.distTo(HOME.x, HOME.z) < 9.5; }

  log(text, kind) { this.hud.log(text, kind); }

  unlock(id) {
    if (this.unlocked.has(id)) return;
    const e = CODEX.find(c => c.id === id);
    if (!e) return;
    this.unlocked.add(id);
    this.hud.codexDirty = true;
    this.log(`CODEX · ${e.title}`, 'good');
    this.audio.discovery();
    this.hud.flashDiscovery('CODEX UPDATED', e.title, e.meta);
  }

  /** Complete an objective of the CURRENT mission.

      Scoped deliberately. Unscoped, docking with a full bay during mission one
      set `home1`, so mission two opened with one of its two objectives already
      ticked and no way to un-tick it. An objective belongs to the mission that
      asked for it. */
  complete(objId) {
    const m = this.mission;
    if (!m || this.objDone[objId]) return;
    const o = m.objectives.find(x => x.id === objId);
    if (!o) return;
    this.objDone[objId] = true;
    this.audio.ui('ok');
    this.hud.missionDirty = true;
    this._fire(o.on);
    if (m.objectives.every(x => this.objDone[x.id])) {
      setTimeout(() => this.advance(), 1400);
    }
  }
  bump(objId, n = 1) {
    const m = this.mission;
    const o = m && m.objectives.find(x => x.id === objId);
    if (!o) return;
    this.counts[objId] = (this.counts[objId] || 0) + n;
    this.hud.missionDirty = true;
    if (o.count && this.counts[objId] >= o.count) this.complete(objId);
  }

  /** Side effects an objective declares in its `on` block. */
  _fire(on) {
    if (!on) return;
    for (const id of [].concat(on.unlock || [])) this.unlock(id);
    if (on.log) this.log(on.log[0], on.log[1]);
  }

  /** Objectives that watch the world rather than waiting to be told.
      `watch` handles STATES — where you are, how far. Events (a sample
      stowed, a relay planted, a sweep run) call complete() from the code that
      raises them, because an event is not a state you can test for. */
  _watchObjectives() {
    const m = this.mission;
    if (!m) return;
    for (const o of m.objectives) {
      const w = o.watch;
      if (!w || this.objDone[o.id]) continue;
      const p = POI[w.poi];
      if (!p) continue;
      const d = this.distTo(p.x, p.z);
      if (w.kind === 'far' && d > w.m) this.complete(o.id);
      else if (w.kind === 'near' && d < w.m) {
        // optional height gate: "inside the pit" is not the same place as
        // "standing on its rim", and both are within 40 m of the centre
        const h = this.terrain.heightAt(this.rover.pos.x, this.rover.pos.z);
        if (w.maxH !== undefined && h > w.maxH) continue;
        if (w.minH !== undefined && h < w.minH) continue;
        this.complete(o.id);
      }
    }
  }

  advance() {
    const done = this.mission;
    if (!done) return;
    this.missionIdx++;
    this.syncFlags();
    this.log(`${done.tag} COMPLETE — ${done.name}`, 'good');
    this.audio.discovery();
    if (this.mission) {
      this.hud.showCard(this.mission);
      this.hud.missionDirty = true;
    } else {
      this.hud.showCard({
        tag: 'OPERATION NORTHFIELD', name: 'TRANSMITTED',
        brief: `The uplink closed forty seconds ago. Whatever happens to the record now happens on Earth, in a building with a lobby and a receptionist and a legal department.\n\nYou are still here. The basin is still here. Four hundred metres west, under ninety metres of permanent shadow, a cold trap that has kept its post for three and a half million years is losing three quarters of a kelvin a decade from underneath.\n\nEleven months.`,
        objectives: [{ id: '_', text: 'Free survey unlocked — the basin is yours' }]
      });
      this.freeRoam = true;
    }
    this.save();
  }

  /* ============================================================
     actions
     ============================================================ */
  doScan() {
    if (this.scan.active || this.scan.cool > 0) return;
    if (this.power < SCAN_COST) { this.log('INSUFFICIENT POWER FOR RADAR SWEEP', 'warn'); this.audio.ui('bad'); return; }
    this.power -= SCAN_COST;
    this.scan.active = true; this.scan.t = 0; this.scan.r = 0;
    this.scan.x = this.rover.pos.x; this.scan.z = this.rover.pos.z;
    this.audio.chirp();
    this.log('GPR SWEEP — 400 MHz, 78 m aperture');
    this.complete('scan');
  }

  _finishScan() {
    let hits = 0, deep = 0;
    for (const a of this.anoms) {
      if (a.found || a.taken) continue;
      // a return you cannot reach is a return you should not be shown
      if (a.special === 'deep' && !this.can('deepString')) continue;
      const d = Math.hypot(a.x - this.scan.x, a.z - this.scan.z);
      if (d > SCAN_RANGE) continue;
      a.found = true; hits++;
      if (a.type === 'vein' || a.special) deep++;
      this.addMarker(a);
    }
    if (hits) {
      this.audio.echo();
      this.log(`${hits} SUBSURFACE RETURN${hits > 1 ? 'S' : ''}${deep ? ` · ${deep} COHERENT` : ''}`, deep ? 'good' : null);
      if (deep && !this.unlocked.has('first-return')) this.unlock('first-return');
    } else {
      this.log('NO RETURN — homogeneous regolith to 12 m');
    }
    this.hud.mapDirty = true;
  }

  addMarker(a) {
    const g = new THREE.Group();
    /* A radar return standing in the world is a reading, not a control, so it
       takes the data colour — except the ones that are mission targets, which
       take the science colour the map and the compass give them. Same palette
       as the HUD, from the same file, so a marker and its map dot can never
       disagree about what they are. */
    const col = hexOf(a.special || a.type === 'vein' ? UI.science : UI.data);
    const post0 = hexOf(UI.data);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 26),
      new THREE.MeshBasicMaterial({ color: col,
        transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6),
      new THREE.MeshBasicMaterial({ color: post0, transparent: true, opacity: 0.35, depthWrite: false }));
    post.position.y = 1.1; g.add(post);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: col }));
    cap.position.y = 2.3; g.add(cap);
    g.position.set(a.x, this.terrain.heightAt(a.x, a.z) + 0.04, a.z);
    g.userData.cap = cap;
    this.scene.add(g);
    a.marker = g;
  }

  /** Nearest un-taken return to the DRILL BIT, not to the chassis — the whole
      point of an aimable arm is that where you point it is what you sample. */
  nearestAnom(maxD = 2.6) {
    const p = this.rover.armOut ? this.rover.armTarget : null;
    let best = null, bd = maxD;
    for (const a of this.anoms) {
      if (!a.found || a.taken) continue;
      const d = p ? Math.hypot(p.x - a.x, p.z - a.z) : this.distTo(a.x, a.z);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** Stow / deploy the sampling arm. Deployed, the drive keys aim it. */
  toggleArm() {
    if (this.drill.active) return;
    this.rover.armOut = !this.rover.armOut;
    this.audio.ui('tick');
    this.log(this.rover.armOut
      ? 'ARM DEPLOYED — W/S REACH · A/D SWING · LMB DRILL'
      : 'ARM STOWED');
  }

  startDrill() {
    if (this.drill.active) return;
    if (!this.rover.armOut) { this.toggleArm(); return; }
    if (this.bayFull) { this.log('SAMPLE BAY FULL — RETURN TO SLED', 'warn'); this.audio.ui('bad'); return; }
    if (this.power < DRILL_COST) { this.log('INSUFFICIENT POWER FOR DRILL CYCLE', 'warn'); this.audio.ui('bad'); return; }
    if (this.rover.vel.length() > 1.1) { this.log('BRAKE BEFORE DRILLING', 'warn'); return; }
    const a = this.nearestAnom();
    if (a && a.special === 'deep' && !this.can('deepString')) {
      this.log('DRILL STRING TOO SHORT — 11 m TARGET', 'warn'); this.audio.ui('bad'); return;
    }
    this.drill.active = true; this.drill.t = 0; this.drill.target = a;
    this.rover.drilling = true;
    this.log(a ? `DRILLING · TARGET AT ${a.depth.toFixed(1)} m` : 'DRILLING · BLIND CORE');
  }

  _finishDrill() {
    const a = this.drill.target;
    const type = a ? a.type : 'regolith';
    const def = SAMPLES[type];
    this.bay.push({ type, name: def.name, rare: def.rare });
    this.hud.bayDirty = true;
    if (a) {
      a.taken = true;
      if (a.marker) { this.scene.remove(a.marker); a.marker = null; }
      this.excavated++;
      this.bump('find3');
      if (a.special === 'deep') { this.coreTaken = true; this.complete('deep'); }
      this.hud.mapDirty = true;
    }
    if (def.unlock) this.unlock(def.unlock);
    this.audio.discovery();
    this.hud.flashDiscovery('SAMPLE SECURED', def.name, def.desc);
    this.log(`SAMPLE ${String(this.bay.length).padStart(2, '0')} · ${def.name}`, def.rare ? 'good' : null);
    // the excavation stays in the ground, right where the bit went in
    this.terrain.excavate(this.rover.armTarget.x, this.rover.armTarget.z, 1.4, 0.85);
  }

  deployRelay() {
    const p = this.rover.pos;
    const h = this.terrain.heightAt(p.x, p.z);
    if (h < RELAY_MIN_H) {
      this.log(`TOO LOW — ${h.toFixed(0)} m, NEED ${RELAY_MIN_H} m FOR LINE OF SIGHT`, 'warn');
      this.audio.ui('bad'); return;
    }
    if (this.props.relays) {
      for (const r of this.props.relays) {
        if (Math.hypot(r.position.x - p.x, r.position.z - p.z) < RELAY_SPACING) {
          this.log('RELAY SPACING TOO TIGHT — MOVE 95 m', 'warn'); this.audio.ui('bad'); return;
        }
      }
    }
    if (this.relaysPlaced >= 3) { this.log('NO RELAYS REMAINING', 'warn'); return; }
    const bx = p.x - this.rover.forward.x * 2.6, bz = p.z - this.rover.forward.z * 2.6;
    this.props.buildRelay(bx, bz);
    this.relaysPlaced++;
    this.dust.spawn(60, bx, this.terrain.heightAt(bx, bz), bz, 1.4, 0.6);
    this.audio.ui('ok'); this.audio.radio();
    this.log(`RELAY ${this.relaysPlaced}/3 DEPLOYED AT ${h.toFixed(0)} m`, 'good');
    this.bump('relays');
    if (this.relaysPlaced >= 3) this.unlock('memo');
    this.hud.mapDirty = true;
  }

  togglePanel() {
    this.rover.panelTarget = this.rover.panelTarget > 0.5 ? 0 : 1;
    this.log(this.rover.panelTarget > 0.5 ? 'SOLAR ARRAY DEPLOYING' : 'SOLAR ARRAY STOWED');
    this.audio.ui('tick');
    if (this.rover.panelTarget > 0.5) this.complete('deploy');
  }

  /* ============================================================
     per-frame
     ============================================================ */
  update(dt, ctl, input) {
    this.t += dt; this.met += dt;

    /* ---- radar ---- */
    if (this.scan.active) {
      this.scan.t += dt;
      this.scan.r = (this.scan.t / SCAN_TIME) * SCAN_RANGE;
      const fade = 1 - sstep(0.7, 1.0, this.scan.t / SCAN_TIME);
      this.terrain.uniforms.uScanC.value.set(this.scan.x, fade, this.scan.z);
      this.terrain.uniforms.uScanR.value = this.scan.r;
      this.rover.gprGlow.material.opacity = 0.55 * fade;
      if (this.scan.t >= SCAN_TIME) {
        this.scan.active = false; this.scan.cool = SCAN_COOL;
        this.terrain.uniforms.uScanR.value = -1;
        this.rover.gprGlow.material.opacity = 0;
        this._finishScan();
      }
    } else if (this.scan.cool > 0) this.scan.cool -= dt;

    /* ---- drill ---- */
    if (this.drill.active) {
      this.drill.t += dt;
      this.power -= DRILL_COST / OPS.drillTime * dt;
      const fx = this.rover.armTarget.x, fz = this.rover.armTarget.z;
      const fy = this.terrain.heightAt(fx, fz);
      if (Math.random() < dt * 55) {
        this.dust.spawn(3, fx, fy, fz, 0.9 + Math.random() * 0.7, 0.35,
          0, 0, this.drill.target && (this.drill.target.type === 'vein' || this.drill.target.special) ? 0.85 : 0);
      }
      this.rig.addShake(dt * 0.6);
      this.terrain.excavate(fx, fz, 0.9, dt * 0.55);
      if (this.rover.vel.length() > 1.2) {
        this.drill.active = false; this.rover.drilling = false;
        this.log('DRILL CYCLE ABORTED — CHASSIS MOVED', 'warn'); this.audio.ui('bad');
      } else if (this.drill.t >= OPS.drillTime) {
        this.drill.active = false; this.rover.drilling = false;
        this._finishDrill();
      }
    }
    this.rover.panelDeploy += ((this.rover.panelTarget || 0) - this.rover.panelDeploy) * Math.min(1, dt * 1.5);

    /* ---- power & thermal ---- */
    const sunUp = this.sky.sunDir.y;
    const lit = this.rover.sunVis * clamp(sunUp * 6, 0, 1);
    const panelFace = this.rover.panelDeploy * clamp(this.rover.up.dot(this.sky.sunDir) * 1.5 + 0.35, 0, 1);
    // Percent of pack per second. A full charge is about two and a half minutes
    // of hard driving through shadow — the heaters below take a third of that —
    // or indefinite driving in the sun with the array out, which is the whole
    // reason to care where the terminator is.
    const charge = lit * panelFace * 1.35;
    let drain = 0.06;                                   // avionics floor
    drain += this.rover.motorLoad * 0.42;
    drain += this.rover.lampPower * 0.14;
    if (this.heat < -30) drain += 0.22;                 // survival heaters
    drain *= OPS.drainScale;
    this.power = clamp(this.power + (charge - drain) * dt, 0, 100);
    // A flat pack now costs you the drive, not just the instruments.
    this.rover.powerScale = POWER_FLOOR + (1 - POWER_FLOOR) * clamp(this.power / POWER_KNEE, 0, 1);
    if (this.rover.powerScale < 0.99 && !this._brownWarned) {
      this._brownWarned = true;
      this.log('PACK LOW — HUB TORQUE REDUCED', 'warn'); this.audio.ui('warn');
    }
    if (this.power > POWER_KNEE + 4) this._brownWarned = false;
    if (this.atHome) this.power = clamp(this.power + 6 * dt, 0, 100);

    const targetHeat = lerp(-58, 28, lit) + this.rover.motorLoad * 14 + (this.drill.active ? 10 : 0);
    this.heat += (targetHeat - this.heat) * Math.min(1, dt * 0.055);

    if (this.power < 12 && !this._lowWarned) {
      this._lowWarned = true; this.log('POWER CRITICAL — SEEK SUNLIGHT OR RETURN TO SLED', 'bad'); this.audio.ui('warn');
    }
    if (this.power > 30) this._lowWarned = false;
    this.dangerTone = clamp((1 - this.power / 40) * 0.6 + (1 - this.hull / 100) * 0.6, 0, 1);

    /* ---- home services ---- */
    if (this.atHome) {
      if (this.bay.length) {
        const n = this.bay.length;
        const rare = this.bay.filter(b => b.rare).length;
        this.bay.length = 0; this.hud.bayDirty = true;
        this.log(`${n} SAMPLE${n > 1 ? 'S' : ''} STOWED${rare ? ` · ${rare} FLAGGED` : ''}`, 'good');
        this.audio.ui('ok');
        this.complete('home1');
        if (this.coreTaken && this.objActive('transmit')) {
          this.transmitted = true;
          this.unlock('lasthour'); this.unlock('transmission');
          this.complete('transmit');
        }
      }
      if (this.hull < 100) this.hull = Math.min(100, this.hull + 9 * dt);
    }

    /* ---- objectives that watch the world ----
       One loop over the current mission's `watch` declarations, instead of a
       hand-written distance test per objective with its unlock and its log
       line inlined next to it. Adding "drive to X" is now a data change. */
    this._watchObjectives();

    /* ---- context prompt ---- */
    let prompt = null, key = null;
    const dStation = this.distTo(STATION.x, STATION.z);
    if (dStation < 12 && !this.stationVisited && this.objActive('recover')) {
      prompt = 'HOLD <kbd>E</kbd> — INTERROGATE LOCAL STORE'; key = 'station';
    } else {
      const a = this.nearestAnom();
      if (this.drill.active) {
        prompt = 'DRILLING…';
      } else if (this.rover.armOut) {
        prompt = a
          ? `<kbd>LMB</kbd> — DRILL · ${SAMPLES[a.type].name} @ ${a.depth.toFixed(1)} m &nbsp; <kbd>R</kbd> stow`
          : 'ARM OUT — <kbd>W</kbd><kbd>S</kbd> reach · <kbd>A</kbd><kbd>D</kbd> swing · <kbd>LMB</kbd> drill · <kbd>R</kbd> stow';
      } else if (this.nearestAnom(6.0)) {
        prompt = '<kbd>R</kbd> — DEPLOY SAMPLING ARM';
      } else if (this.atHome) {
        prompt = 'SLED — RECHARGING · SAMPLES OFFLOADED';
      }
    }
    this.hud.setPrompt(prompt);

    if (key && input.down('KeyE')) {
      this.interact.t += dt;
      if (this.interact.t > 1.6) {
        this.interact.t = 0;
        this.stationVisited = true;
        this.flags.add('poi:STATION');
        this.complete('recover');
        this.unlock('log6'); this.unlock('log11');
        this.log('LOCAL STORE RECOVERED — 3 LOG FRAGMENTS', 'good');
        this.audio.radio();
      }
    } else this.interact.t = 0;
    this.hud.interactProgress = key ? this.interact.t / 1.6 : 0;

    /* ---- rollover rescue ---- */
    let canRight = false;
    if (this.rover.flipped && this.rover.vel.length() < 1.2) {
      this.flipTimer += dt;
      if (this.flipTimer > 2.4) {
        canRight = true;
        this.hud.setPrompt('<kbd>X</kbd> — RIGHT THE CHASSIS');
        if (input.hit('KeyX')) {
          this.rover.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0),
            Math.atan2(this.rover.forward.x, this.rover.forward.z));
          this.rover.pos.y = this.terrain.heightAt(this.rover.pos.x, this.rover.pos.z) + 1.4;
          this.rover.vel.set(0, 0, 0); this.rover.omega.set(0, 0, 0);
          this.hull = Math.max(5, this.hull - 4);
          this.flipTimer = 0;
          this.dust.spawn(90, this.rover.pos.x, this.rover.pos.y - 1, this.rover.pos.z, 2.2, 1.6);
          this.audio.thud(1.4);
          this.log('CHASSIS RIGHTED — 4 % INTEGRITY LOST', 'warn');
        }
      }
    } else this.flipTimer = 0;

    /* ---- contextual thumb controls ----
       Righting the chassis and the interact hold are the two actions a phone
       player could not perform at all: neither had a touch binding, so a
       rollover was unrecoverable and the station's local store was
       unreadable. They appear only when they can do something, which keeps
       the thumb furniture to what you press while moving. */
    input.setContext?.({ right: canRight, interact: !!key });

    /* ---- markers ---- */
    for (const a of this.anoms) {
      if (a.marker) {
        a.marker.userData.cap.rotation.y += dt * 1.6;
        a.marker.userData.cap.position.y = 2.3 + Math.sin(this.t * 2 + a.x) * 0.09;
      }
    }

    /* ---- fence warning ---- */
    const r = Math.hypot(this.rover.pos.x, this.rover.pos.z);
    if (r > PLAYABLE_R + 40 && !this._fenceWarn) {
      this._fenceWarn = true;
      this.log('APPROACHING RIM WALL — GRADE EXCEEDS 30°', 'warn');
    }
    if (r < PLAYABLE_R) this._fenceWarn = false;

    void ctl;
  }

  damage(amount, reason) {
    if (amount < 0.4) return;
    this.hull = clamp(this.hull - amount, 0, 100);
    this.hud.hit(clamp(amount / 12, 0.15, 1));
    this.audio.thud(clamp(amount / 6, 0.4, 2));
    if (amount > 4) this.log(`IMPACT — ${amount.toFixed(0)} % INTEGRITY${reason ? ' · ' + reason : ''}`, 'bad');
    if (this.hull <= 0) this.strand();
  }

  strand() {
    this.hull = 22;
    this.log('CRITICAL DAMAGE — SLED WINCH RECOVERY', 'bad');
    this.rover.placeAt(HOME.x - 9, HOME.z - 9, 2.2);
    this.power = Math.max(this.power, 35);
    this.audio.ui('bad');
  }

  /* ============================================================
     persistence
     ============================================================ */
  save() {
    return {
      missionIdx: this.missionIdx,
      objDone: this.objDone, counts: this.counts,
      unlocked: [...this.unlocked],
      anoms: this.anoms.map(a => (a.taken ? 1 : a.found ? 2 : 0)),
      relays: this.props.relays ? this.props.relays.map(r => [r.position.x, r.position.z]) : [],
      relaysPlaced: this.relaysPlaced,
      power: this.power, hull: this.hull, met: this.met,
      pos: [this.rover.pos.x, this.rover.pos.z],
      stationVisited: this.stationVisited, coreTaken: this.coreTaken,
      odo: this.rover.odo
    };
  }

  load(d) {
    if (!d) return false;
    this.missionIdx = d.missionIdx || 0;
    this.objDone = d.objDone || {};
    this.counts = d.counts || {};
    this.unlocked = new Set(d.unlocked || []);
    this.relaysPlaced = d.relaysPlaced || 0;
    this.power = d.power ?? 100; this.hull = d.hull ?? 100; this.met = d.met || 0;
    this.stationVisited = !!d.stationVisited; this.coreTaken = !!d.coreTaken;
    // flags are derived, never stored: the campaign position is the truth and
    // a stored copy is one more thing that can disagree with it
    this.syncFlags();
    if (d.anoms) d.anoms.forEach((v, i) => {
      const a = this.anoms[i]; if (!a) return;
      if (v === 1) a.taken = true;
      else if (v === 2) { a.found = true; this.addMarker(a); }
    });
    if (d.relays) for (const [x, z] of d.relays) this.props.buildRelay(x, z);
    if (d.pos) this.rover.placeAt(d.pos[0], d.pos[1], 0);
    this.rover.odo = d.odo || 0;
    this.hud.mapDirty = this.hud.bayDirty = this.hud.missionDirty = this.hud.codexDirty = true;
    return true;
  }
}
