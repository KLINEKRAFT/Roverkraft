/* ============================================================
   INPUT — keyboard, mouse, gamepad, touch
   ============================================================ */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // edge-triggered, cleared each frame
    // `clicked` latches a press until a frame consumes it. `down` alone drops a
    // quick tap whose touchstart and touchend both land between two frames —
    // which is most taps on a phone, and is why the drill was unusable there.
    this.mouse = { dx: 0, dy: 0, wheel: 0, locked: false, down: false, clicked: false, rdown: false };
    this.touch = { lx: 0, ly: 0, rx: 0, ry: 0, active: false, btn: {} };
    this.pad = null;
    this.enabled = true;
    /* One-handed drive. Twin thumbsticks presume two hands, and a meaningful
       share of phone sessions are one-handed — on a train, holding something
       else. With this on there is a single stick doing steer and throttle, the
       look stick is gone (the camera auto-centres instead) and the buttons
       stack above the stick on the same side. */
    this.oneHand = false;
    this._transient = [];          // keys pressed by UI this frame

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(c)) e.preventDefault();
      this.keys.add(c); this.pressed.add(c);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.rdown = true;
      if (this.enabled && !this.mouse.locked && !this.touch.active) canvas.requestPointerLock?.();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.mouse.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === canvas;
    });

    addEventListener('gamepadconnected', (e) => { this.pad = e.gamepad.index; });
    addEventListener('gamepaddisconnected', () => { this.pad = null; });

    this.buildTouch();
  }

  lock() {
    // Pointer lock does not exist on touch, and asking for it there throws a
    // permission prompt at the player for no benefit.
    if (this.enabled && !this.touch.active) this.canvas.requestPointerLock?.();
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock?.(); }

  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }

  /** Fire a key from a UI control — a tray button, a context prompt. Held for
      exactly one frame, so it behaves like a tap and never like a stuck key.
      Edge-triggered reads only see it between poll() and endFrame(), which is
      where every `hit()` in the frame loop lives. */
  press(code) {
    this.keys.add(code);
    this.pressed.add(code);
    this._transient.push(code);
  }

  /* ---------------- touch ----------------
     The bottom third of a phone belongs to the thumbs. What sits there is only
     what you press while the rover is moving; everything else — camera, array,
     photo, HUD toggle — is in the status tray, one reach away at a stop.

     Two buttons are CONTEXTUAL and appear only when they can do something:
     righting the chassis, and the interact hold. Neither had a touch control
     at all, which meant a phone player who rolled over could not recover and
     could not open the station's local store. A control you cannot reach is
     not a control.

     The right stick is a LOOK stick, not a position stick: it feeds a rate, so
     you can keep panning past the edge of its travel. Buttons that map to a
     held key (brake, drill, interact) latch on touchstart and release on
     touchend; the rest are momentary. */
  buildTouch() {
    if (!matchMedia('(pointer: coarse)').matches && !('ontouchstart' in window)) return;
    if (this.touchEl) { this.touchEl.remove(); this.touchEl = null; }

    const one = this.oneHand;
    const btn = (attr, label, cls) => `<button class="tb${cls ? ' ' + cls : ''}" ${attr}>${label}</button>`;
    // science on one column, drive and systems on the other — grouped by what
    // the control does, so position teaches the function without a legend
    const sci = btn('data-k="KeyG"', 'SCAN', 'sci') + btn('data-k="KeyR"', 'ARM', 'sci') +
                btn('data-lmb="1"', 'DRILL', 'sci big');
    const sys = btn('data-k="KeyF"', 'LAMP') + btn('data-k="KeyB"', 'RELAY') +
                btn('data-k="Space" data-hold="1"', 'BRAKE', 'big');

    const wrap = document.createElement('div');
    wrap.id = 'touch';
    wrap.className = 'hidden' + (one ? ' one-hand' : '');
    wrap.innerHTML = `
      <div class="stick ${one ? 'right' : 'left'} drive"><div class="nub"></div><span>DRIVE</span></div>
      ${one ? '' : '<div class="stick right look"><div class="nub"></div><span>LOOK</span></div>'}
      <div class="tbtns">${sci}</div>
      <div class="tbtns2">${sys}</div>
      <div class="tctx">
        ${btn('data-k="KeyX"', 'RIGHT', 'danger hidden')}
        ${btn('data-k="KeyE" data-hold="1"', 'HOLD', 'hidden')}
      </div>`;
    document.body.appendChild(wrap);
    // the stylesheet keeps the HUD clear of the thumb zone off this class, so
    // it is set by the code that puts the sticks on screen and nothing else
    document.body.classList.add('touch-controls');
    document.body.classList.toggle('one-hand', one);
    this.touchEl = wrap;
    this.ctxEl = wrap.querySelector('.tctx');
    this.touch.active = true;

    wrap.querySelectorAll('.stick').forEach((s) => {
      const look = s.classList.contains('look');
      const nub = s.querySelector('.nub');
      let id = null;
      const set = (x, y) => {
        const r = s.getBoundingClientRect();
        let dx = (x - r.left - r.width / 2) / (r.width / 2);
        let dy = (y - r.top - r.height / 2) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        nub.style.transform = `translate(${dx * r.width * 0.25}px, ${dy * r.width * 0.25}px)`;
        if (look) { this.touch.rx = dx; this.touch.ry = dy; }
        else { this.touch.lx = dx; this.touch.ly = dy; }
      };
      const clear = () => {
        id = null; nub.style.transform = '';
        if (look) { this.touch.rx = this.touch.ry = 0; } else { this.touch.lx = this.touch.ly = 0; }
      };
      s.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0]; id = t.identifier; set(t.clientX, t.clientY); e.preventDefault();
      }, { passive: false });
      s.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) if (t.identifier === id) set(t.clientX, t.clientY);
        e.preventDefault();
      }, { passive: false });
      s.addEventListener('touchend', clear);
      s.addEventListener('touchcancel', clear);
    });

    wrap.querySelectorAll('.tb').forEach((b) => {
      const k = b.dataset.k, lmb = b.dataset.lmb, hold = b.dataset.hold;
      const down = (e) => {
        e.preventDefault(); b.classList.add('on');
        if (lmb) { this.mouse.down = true; this.mouse.clicked = true; }
        else { this.keys.add(k); this.pressed.add(k); }
      };
      const up = () => {
        b.classList.remove('on');
        if (lmb) this.mouse.down = false;
        else if (hold || !k) this.keys.delete(k);
        else this.keys.delete(k);          // momentary: the edge already fired
      };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up);
      b.addEventListener('touchcancel', up);
    });
  }

  /** Rebuild the thumb furniture for the other grip. Cheap — the overlay is
      nine elements — and rebuilding is the only honest way to change which
      sticks exist. */
  setOneHand(on) {
    if (!!on === this.oneHand) return;
    this.oneHand = !!on;
    const wasVisible = this.touchEl && !this.touchEl.classList.contains('hidden');
    this.touch.lx = this.touch.ly = this.touch.rx = this.touch.ry = 0;
    this.buildTouch();
    if (wasVisible) this.showTouch(true);
  }

  /** Show a contextual thumb button only while it can actually do something.
      @param o {right, interact} */
  setContext(o) {
    if (!this.ctxEl) return;
    const set = (sel, on) => {
      const b = this.ctxEl.querySelector(sel);
      if (b && b.classList.contains('hidden') === !!on) b.classList.toggle('hidden', !on);
    };
    set('[data-k="KeyX"]', o.right);
    set('[data-k="KeyE"]', o.interact);
  }

  /** Touch overlay only belongs on screen while you are actually driving. */
  showTouch(on) {
    if (this.touchEl) this.touchEl.classList.toggle('hidden', !on);
  }

  /* ---------------- per-frame ---------------- */
  poll() {
    const out = {
      throttle: 0, steer: 0, brake: 0,
      lookX: 0, lookY: 0, zoom: 0,
      // Whether the operator is actively aiming the view. The camera used to
      // infer this from the magnitude of lookX/lookY, but that number is in
      // mouse pixels — a thumbstick pushed a third of the way produces a
      // smaller value than a nudge of the mouse, so auto-centre never stood
      // down and dragged the view back while you were still pushing.
      looking: false
    };
    // keyboard
    if (this.down('KeyW', 'ArrowUp')) out.throttle += 1;
    if (this.down('KeyS', 'ArrowDown')) out.throttle -= 1;
    if (this.down('KeyA', 'ArrowLeft')) out.steer -= 1;
    if (this.down('KeyD', 'ArrowRight')) out.steer += 1;
    if (this.down('Space')) out.brake = 1;

    // mouse look
    out.lookX = this.mouse.dx; out.lookY = this.mouse.dy;
    out.zoom = this.mouse.wheel;
    if (this.mouse.dx || this.mouse.dy) out.looking = true;
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;

    // touch
    if (this.touch.active) {
      out.throttle += -this.touch.ly;
      out.steer += this.touch.lx;
      // rate, not position: hold it over and the view keeps turning
      out.lookX += this.touch.rx * Math.abs(this.touch.rx) * 17;
      out.lookY += this.touch.ry * Math.abs(this.touch.ry) * 14;
      if (Math.hypot(this.touch.rx, this.touch.ry) > 0.06) out.looking = true;
    }

    // gamepad
    if (this.pad !== null && navigator.getGamepads) {
      const gp = navigator.getGamepads()[this.pad];
      if (gp) {
        const dz = (v) => Math.abs(v) < 0.14 ? 0 : (v - Math.sign(v) * 0.14) / 0.86;
        out.steer += dz(gp.axes[0] || 0);
        out.throttle += (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
        if (Math.abs(dz(gp.axes[1] || 0)) > 0.01 && !(gp.buttons[7]?.value)) out.throttle += -dz(gp.axes[1]);
        out.lookX += dz(gp.axes[2] || 0) * 13;
        out.lookY += dz(gp.axes[3] || 0) * 13;
        if (Math.abs(dz(gp.axes[2] || 0)) + Math.abs(dz(gp.axes[3] || 0)) > 0.02) out.looking = true;
        if (gp.buttons[0]?.pressed) out.brake = 1;
        const map = { 2: 'KeyG', 3: 'KeyR', 1: 'KeyF', 9: 'Escape', 8: 'Tab', 4: 'KeyC', 5: 'KeyB' };
        for (const [b, code] of Object.entries(map)) {
          const p = gp.buttons[b]?.pressed;
          this._gpPrev ||= {};
          if (p && !this._gpPrev[b]) { this.keys.add(code); this.pressed.add(code); }
          if (!p && this._gpPrev[b]) this.keys.delete(code);
          this._gpPrev[b] = p;
        }
      }
    }

    out.throttle = Math.max(-1, Math.min(1, out.throttle));
    out.steer = Math.max(-1, Math.min(1, out.steer));
    return out;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    if (this._transient.length) {
      for (const c of this._transient) this.keys.delete(c);
      this._transient.length = 0;
    }
  }
}
