<div align="center">

# ROVERKRAFT

### The Philolaus Descent

**A lunar rover survey game built for the phone first.**
No engine, no build step, no `npm install`, no asset files, nothing fetched
from anywhere. One vendored library: three.js.

![WebGL2](https://img.shields.io/badge/WebGL2-no_build_step-1a1a1a)
![PWA](https://img.shields.io/badge/PWA-installable_·_offline-1a1a1a)
![Dependencies](https://img.shields.io/badge/npm_deps-0-1a1a1a)
![Assets](https://img.shields.io/badge/third--party_assets-0-1a1a1a)
![Licence](https://img.shields.io/badge/licence-MIT-1a1a1a)

</div>

> Two hundred and fourteen days ago the prospecting station **KEEL-4** sent
> nine seconds of unmodulated carrier and stopped.
>
> You operate **K6 MERIDIAN**, a 900 kg six-wheel survey rover put down by
> descent sled on the floor of Philolaus at 72° north. Survey the basin,
> restore the relay chain, and go down into the collapse the crew were working
> when they stopped.
>
> It is a cold trap. What a cold trap does is keep things.

> **Screenshots:** the ones under `docs/` are upstream's, from before the
> restyle, and no longer show this build. They are kept because the technical
> notes reference them. New ones need taking on a phone.

---

## A fork, and what it is a fork *of*

This is a fork of [`winchxyz/moon-rover`](https://github.com/winchxyz/moon-rover)
(REGOLITH, MIT), which is an excellent piece of work and is where all 6,325
lines of the simulation came from. Read its README for how the physics, the
clipmap terrain and the procedural audio actually work; almost all of it is
still true here.

**What this fork changes is the design target.** Upstream is a desktop game
with a phone fallback. Its own README says so: on a phone it *cuts* the
compass strip, sample bay, thermal panel, status chips, wheel monitor, radar
scope and mission clock outright — they do not move to a menu, nothing brings
them back, and in landscape the speed dial goes too.

If the phone is your primary platform that is backwards. You are not shipping
a degraded desktop build; you are designing a phone game that happens to also
run on a desktop. Everything below follows from that one inversion, and it
touches pacing, information architecture, performance budget and mission
design — not just CSS.

Three consequences, taken seriously:

1. **The phone's quality tier is the real game.** Upstream guesses a tier from
   device memory and core count, and a touch screen costs a tier on top. So
   whatever LOW and MEDIUM look like *is* the product. Desktop ULTRA is a
   bonus, not the reference build.
2. **Session length changes the pacing.** Phone sessions are three to eight
   minutes. Mission granularity has to be re-cut or the game is only ever
   played in fragments that do not resolve.
3. **Thermal throttling, not peak framerate, is the limit.** A phone holds
   60 fps for ninety seconds and then falls off a cliff as the SoC heats. Any
   performance work that optimises for the first thirty seconds is measuring
   the wrong thing. See [docs/PERF.md](docs/PERF.md).

---

## Play

```bash
npm start          # then http://localhost:5173
```

Any static server works; it has to be HTTP rather than `file://` because the
game uses ES modules. Node 18+. There is nothing to build and nothing to
install.

On a phone, open it and use **Add to Home Screen**. It installs, runs
full-screen and works with the network off — the basin is baked from code at
load, so once the source is cached there is nothing left to fetch.

### Controls

| | |
|---|---|
| **Drive** | left stick, or `W` `A` `S` `D`; `SPACE` brakes |
| **Look** | right stick, or the mouse |
| **Zoom** | wheel, or `−` and `+` — 2.6 m to 120 m, far enough to read the basin you are standing in |
| **Science** | `SCAN` radar · `ARM` deploy · `DRILL` — `G`, `R`, left mouse |
| **Systems** | `LAMP` · `RELAY` — `F`, `B` |
| **Contextual** | `RIGHT` to recover a rollover, `HOLD` to interact. Both appear only when they can do something |
| **STATUS** | the tray at the bottom edge: sample bay, thermal, wheel loads, radar scope, compass, clock, camera, codex |

`SYSTEMS` → **AWAY MESSAGE** stands the survey down behind your own text with the
basin still on view: the clock stops, nothing drains, and the camera keeps a slow
orbit around the parked rover. Any key resumes.

`SYSTEMS` → **ONE-HANDED** drops to a single stick for steer and throttle and
centres the camera for you. `SYSTEMS` → **FRAME LIMIT** is the setting that
decides whether the game is still smooth at minute ten.

---

## What is different from upstream

### Information architecture, not a restyle

Instruments are triaged by the question they answer while the wheels are
turning:

| Question | On the driving HUD? |
| --- | --- |
| Where am I going? | yes — objective, map, heading |
| Can I make it back? | yes — power, range to the sled |
| Am I about to break something? | yes — integrity, **attitude** |
| How fast am I going? | marginal — the motor and the camera dolly already say it |
| What have I collected? | no — that is a between-runs question |
| What is the mission clock at? | no |

**ATTITUDE is new.** "Am I about to be on my roof" is a driving question that
had no instrument at all, and at one sixth of a gravity it arrives well before
the terrain looks alarming.

Everything cut is **re-parented into the status tray**, not hidden. The tray
is not a panel: it takes no state, does not unlock the pointer and does not
pause. You open it at a stop and the drive controls are underneath it where
you left them.

Two controls that did not exist on touch at all now do: **righting the
chassis** and the **interact hold**. Without them a phone player who rolled
over could not recover, and could not open the station's local store. A
control you cannot reach is not a control.

Every touch target is at least 44×44, and the two you press while the vehicle
is moving are larger. That is measured across seven viewports rather than
asserted — it found two collisions, and they are fixed.

### The interface is Dieter Rams, in the register Braun used for instruments

Black body, neutral grey controls, colour reserved entirely for function.
Braun moved to a black base when it moved into hi-fi — the Studio 1000, the
ET66 calculator — so black is not a departure from that language, it is the
half of it that fits something you read in the dark.

The rule, which is the whole system:

| Function class | Treatment |
| --- | --- |
| Drive — throttle, steer, brake | no colour at all. The sticks are the body of the instrument |
| Science — radar, arm, drill | one signal colour, consistently. The game's verb set |
| Systems — relay, array, lamps | neutral grey. Found by position |
| Emergency — righting the chassis, critical power | signal red, and **nothing else in the interface may be red** |
| Live data — speed, power, integrity, traces | type. No bezels, no needles, no gauge chrome |

The discipline that makes this read as Rams rather than as "minimal" is that
the signal colours are **scarce**. If three things are yellow, none of them
are.

One grotesque, two roles: labels in the grotesque, values in the same
grotesque with tabular figures so digits do not jitter as they change. No
webfont — the zero-fetched-assets property is the project's most distinctive
claim and it costs almost nothing to keep.

A deletion pass removed the scanline overlay (a CRT filter over a scene with
no CRT in it), the rotating crest, the blinking menu alert, the corner
brackets on the mission card, the coloured tab on every panel — and the speed
dial, which drew a bezel and a needle around a number that was already
printed in its middle.

### A soil map, and sinkage that grows with slip

Upstream states the limitation plainly: sinkage is a function of wheel load
alone, there is no soil map, so **every square metre of the basin digs the
same**. That is not merely a fidelity gap — it is why the basin has no
*places*. Terrain that behaves identically everywhere is terrain you stop
reading.

There are now four units, painted over the basin and read by the wheels:

| Unit | What it is | Model sinkage at nominal load | Share of the drivable basin |
| --- | --- | --: | --: |
| **MARE** | mature basin floor — the baseline | 16 mm | 34 % |
| **EJECTA** | fresh crater ejecta: coarse, firm, better traction | 5 mm | 30 % |
| **TALUS** | the rim wall, its terraces, and crater walls past 26° | 39 mm | 33 % |
| **TRAP** | soft fill ponded in old depressions. Deceptively flat | 121 mm | 2 % |

Talus is where material rests *loose*, so the threshold is set near lunar
regolith's angle of repose rather than at an arbitrary slope — at 20° a third
of the basin came back as talus, which is not what talus means, it is what a
cratered plain means. Slope is measured over a 12 m baseline for the same
reason: at texel scale the surface's own metre-scale crater pitting reads past
16° over 55 % of the basin, and those walls are texture, not landform.

Sinkage uses Bekker's form, `z = (p/K)^(1/n)`, with MARE calibrated so the
rover sinks about 16 mm — which is what Apollo's LRV actually did. The moduli
are effective rather than bevameter-derived, and [`src/world/soil.js`](src/world/soil.js)
says so and says why.

**Sinkage also grows with slip**, and that is the change that matters. A
spinning wheel excavates itself deeper. Upstream simulates the *visual*
digging already — hold the throttle and you cut a 48 cm hole — but not
causally, and burial with no rescue mechanic is a dead end rather than a
hazard. Here the slip term integrates: it accumulates while the wheel is
slipping and relaxes when it stops, so easing off is a real move.

Measured, on a rover held in place at full throttle with traction control off:

| Unit | settled | after 3 s of wheelspin | 3 s after lifting off |
| --- | --: | --: | --: |
| MARE | 15 mm | 78 mm | 20 mm |
| EJECTA | 6 mm | 38 mm | 7 mm |
| TALUS | 29 mm | 153 mm | 46 mm |
| TRAP | 45 mm | 219 mm | 115 mm |

Traction control cuts the soft-fill case from 219 mm to 132 mm, which is the
difference between a rut and the axles.

The radar earns a second job from this: the band under the map reads the soil
for the next forty metres along the heading, plus the ground's own profile.
A soft patch you can see coming is a hazard; one you cannot is a load screen.

You can also hear it. The tyre bed's filter moves with the material: coarse
ejecta rattles, soft fill hisses and is *quieter*, which is why you can drive
into a trap without noticing until the machine stops going anywhere.

### The collapse

The setting moved to **Philolaus**, at 72.1° north, because it is real and
because of what is actually in it: candidate pits, small rimless depressions
strung along a buried lava channel, whose interiors at that latitude never see
the sun. Cold traps.

The pit in the game is 116 m across and 64 m deep, and **the depth is derived
rather than chosen**. The Moon's axial tilt is 1.54°, so the maximum solar
elevation at 72.1° north is about 19.4°; for the floor to be dark even at
peak sun the far rim has to subtend more than that from the floor, which puts
the depth past 40 m. Verified: the floor reads zero illumination at every
azimuth at maximum elevation, and the rim reads full.

(Upstream ran the sun between 17° and 31°, which is not reachable at this
latitude. That is corrected, and everything downstream of it — shadow lengths,
how deep a hole has to be — now follows from a number that is true.)

There is one way in: a bench the talus cut into the wall, entering at the
north lip and spiralling once to the floor. 335 m of path, a mean grade of
8.8°, flat-topped to about twelve metres wide. It takes roughly three minutes
to drive down and three to drive back up, and that is the mission: below the
rim the array does nothing, so the drive in and the drive out are one power
budget.

Two other things stop working down there, and both use systems that already
existed:

- **No line of sight to Earth.** The map is a telemetry product, not a window
  — without the relay chain from the previous mission the position on it is
  the last one that got out. That is why the chain is a mission and not a
  chore.
- **No cold, once you turn the lamps on.** The pit is a cold trap and your
  lamps warm the working face. You cannot drive in darkness and you cannot
  read the column you came for with the lights on. The ending tells you how
  much of it survived.

### Performance

Every lever is exposed in `SYSTEMS`, because the number that matters is the
one at minute ten on the player's own device and it cannot be measured here:

- **FRAME LIMIT** — the only lever that reduces heat rather than reacting to
  it. Skips whole rAF callbacks so the SoC idles between draws. Menus and
  panels run at 20 Hz regardless.
- **FRAME PACING** — `SMOOTH` chases the budget both ways, `STEADY` ratchets
  down and holds what it finds, `FIXED` pins it. A stable soft image beats a
  sharp one that decays over ten minutes, and the decay is what a player reads
  as "it looked better earlier".
- **RESOLUTION**, **TERRAIN DETAIL**, **GROUND CLUTTER**, **SHADOWS** — tier
  overrides, applied without re-baking the basin.
- **FRAME TRACE** — records mean/p50/p95/worst frame time in ten-second rows
  and exports CSV. Thermal throttling is a shape you can only see across
  minutes. [docs/PERF.md](docs/PERF.md) has the procedure and what counts as
  a pass.

One real bug fixed on the way: with shadows off — the phone tier —
`aimShadow` returned early and left the sun's target parked wherever the last
shadowed frame put it. A directional light's direction is position minus
target, and only the position was being written, so the rover and every prop
were lit from up to 29° off the sun.

### Missions are data now

`docs/ARCHITECTURE.md` says to fix this before writing story content, and it
is right. Nine objective ids were wired by hand in `gameplay.js` and gated by
comparisons against `missionIdx` — `< 4`, `=== 4`, `>= 3` — so inserting a
mission in the middle silently pointed the deep-drill gate and the station
prompt at the wrong one.

Missions now declare what they `reveal` and what they `grant`. Objectives
declare a `watch` for states of the world; events call `complete()` from the
code that raises them, because an event is not a state you can test for.
`complete()` and `bump()` are scoped to the active mission — unscoped, docking
with a full bay in mission one pre-ticked an objective in mission two.

The five-mission spine is unchanged in length and re-cut in order, because the
relay chain has to come *before* the descent: there is no line of sight out of
a pit, and that is the reason the chain exists.

---

## Development

```bash
npm start                     # http://localhost:5173
node server.js 5173 --shots   # adds POST /__shot for frame capture
```

`window.ROVERKRAFT` (also `REGOLITH`, so every note in `docs/` still applies)
exposes the live app. `ROVERKRAFT.tick(dt)` advances one frame by hand — call
it at roughly 1/60 per tick; it applies no dt clamp, and a coarse driver will
report the physics as broken when it is fine.

**Read [`CLAUDE.md`](CLAUDE.md) before touching anything**, and the relevant
section of [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for whatever you are
about to change. The invariants in there are the ones that have already been
broken at least once. The shortest version:

- The wheels and the shader read the same height field. Change how height is
  computed and you change it on both sides in the same commit.
- Never replace a uniform wrapper object; only mutate `.value`.
- Run `node --check` on every file you changed before you say it works.
- Verify in the running game, not by reasoning.
- Measure before and after, and put both numbers in the commit message.

Two invariants this fork adds:

- **The soil map is nearest-sampled on both sides.** A filtered soil index is
  a soil that does not exist. It carries no height, so it is outside the
  physics/pixels contract entirely — but the wheel model and the tint must
  still read the same cell.
- **`sw.js` has no crawler.** Adding a source file means adding it to the
  shell list, or the first offline load pays for it.

---

## Licence

MIT, as upstream. See [LICENCE](LICENSE) — the copyright line for the original
work stands, and this fork is under the same terms.

Upstream: [`winchxyz/moon-rover`](https://github.com/winchxyz/moon-rover).
