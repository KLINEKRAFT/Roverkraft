# Measuring the phone

The phone is the design target, so the phone's quality tier is the product.
Desktop ULTRA is a bonus, not the reference build. Everything in this file
exists because of that one inversion.

**Thermal throttling, not peak framerate, is the limit.** A phone holds 60 fps
for ninety seconds and then falls off a cliff as the SoC heats. A benchmark
that samples the first thirty seconds is measuring the wrong thing, and a
change tuned against it can make minute ten worse while making minute zero
look better.

So the unit of measurement here is not a frame rate. It is a **trace**: one row
every ten seconds, for at least ten minutes, on the actual device, held in a
hand, at the screen brightness you actually use.

---

## Taking a baseline

1. Open the game on the phone. Do not change any settings yet — the tier the
   game guessed is part of what you are measuring.
2. `SYSTEMS` → `FRAME TRACE` → `START`. The overlay appears; the row counter
   starts moving.
3. **Drive.** Not idle, not parked looking at the sky — drive the way a player
   drives, with dust and ruts and the radar going. Idling under-reports heat
   by a long way.
4. Ten minutes. Not two. The interesting part of the curve is after minute
   four, and on a cool device in a cold room it can be after minute eight.
5. `SYSTEMS` → `SAVE TRACE` → the CSV lands in Downloads.

Do it twice: once from cold (phone at room temperature, no other apps), once
back-to-back immediately after. The second run starts hot and is closer to how
the game will actually be played.

## Reading the CSV

```
t_s,frames,mean_ms,p50_ms,p95_ms,worst_ms,render_scale,tier
```

- **`p95_ms` is the number that matters.** Mean frame time hides exactly the
  stutter a player feels. If p95 is 26 ms while mean is 17, the game is not
  running at 58 fps, it is running at 38 fps with a nice average.
- **Read `p95_ms` and `render_scale` together.** Steady p95 with a falling
  render scale is the governor doing its job — you are paying in sharpness.
  Steady render scale with a rising p95 means the governor has bottomed out
  and there is nothing left to trade.
- **Thermal throttling has a shape**: flat, then a step down over twenty to
  forty seconds, then flat again lower. If you see that step, note the `t_s`
  it starts at. That number is your real session budget, and it is the thing
  to move.

## What counts as a pass

The target is **a steady frame time at minute ten**, not a high one at minute
one. Concretely, per device:

| | |
|---|---|
| p95 at minute 10 within 15 % of p95 at minute 1 | the build is thermally stable |
| render scale at minute 10 above 0.75 | the governor still has headroom |
| no single `worst_ms` over 120 after minute 2 | no hitching from uploads or rebuilds |

A build that hits 60 fps at minute one and 24 fps at minute ten has failed,
even if its opening number is better than the build that sits at 40 fps
throughout. Prefer the flat line.

## The governor and the soft-image trap

The resolution governor trades pixels for smoothness. Under sustained thermal
throttling it can fight the SoC in a way that reads, over a session, as the
image slowly going soft — the player never sees a stutter, they just notice
that the game looked better ten minutes ago.

If a trace shows `render_scale` ratcheting downward and never recovering, that
is the trap. The fix is not a smarter governor: cap the resolution lower and
hold it steady. **A stable soft image beats a decaying sharp one.** The
`FRAME PACING` setting exposes this directly.

## Levers, roughly in order of return

Measured on the phone tiers, most expensive first:

1. **Pixel count** (`pixels`, `maxDpr`) — the terrain shader ray-marches and
   triplanar-samples, so this is close to linear and dominates everything else.
2. **Clipmap rings** (`clipLevels`, `clipM`) — vertex-bound, and the outer
   rings cover the most screen for the least visible detail.
3. **Shadow map** (`shadow`) — a second full scene pass.
4. **Sun mask** (`sunRes`, `sunSteps`) — only re-marched when the sun moves,
   but it is a spike when it does.
5. **Excavation grid** (`dentRes`) — memory and upload bandwidth, not fill.
6. **Boulders** (`boulders`) and **dust** (`dust`) — draw calls and particles;
   cheap to cut and the first thing you miss.
7. **MSAA** (`msaa`) — already forced off above 3.2 Mpx, and it is never worth
   it on a phone GPU.

`bakeTerrain()` takes no quality argument, so none of the above re-bakes the
basin: tier changes are live and cheap, and A/B-ing two tiers inside one trace
is legitimate as long as you write down where you switched.

## Recording something other than the frame rate

The overlay only knows about frames. Two things it cannot see, that you should
note by hand in the run notes:

- **Case temperature.** "Warm at 4:00, uncomfortable at 9:00" is real data.
- **Battery drop** across the ten minutes. A build that is thermally stable
  because it is drawing 6 W is not stable, it is just slower to fail.
