/* ============================================================
   SERVICE WORKER — the whole game, offline
   ------------------------------------------------------------
   The project fetches no third-party assets and has no build step, so the
   install list below IS the application: a vendored three.js, seventeen source
   files, a stylesheet, an icon set and one HTML page. Nothing is generated,
   nothing is bundled, and nothing has to be kept in sync with a manifest a
   tool wrote — which is why the list can sit here in plain sight and be read.

   ADDING A FILE MEANS ADDING IT HERE. There is no crawler and no build to
   catch it for you. The runtime handler below will still serve a missed file
   from the network and cache it on the way past, so a forgotten entry costs
   the first offline load rather than breaking the game — but it does cost it,
   and a cold install with the tab offline would fail outright.

   Strategy is cache-first for everything same-origin. The basin is baked from
   code at load, so there is no data to go stale; the only thing that changes
   is the code itself, and that is what VERSION is for. Bump it and the old
   cache is deleted on the next activation.
   ============================================================ */

const VERSION = 'roverkraft-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/ui/styles.css',
  './src/main.js',
  './src/core/engine.js',
  './src/core/input.js',
  './src/core/audio.js',
  './src/core/save.js',
  './src/core/rng.js',
  './src/core/perf.js',
  './src/world/terrain.js',
  './src/world/soil.js',
  './src/world/props.js',
  './src/world/sky.js',
  './src/world/dust.js',
  './src/world/textures.js',
  './src/game/rover.js',
  './src/game/gameplay.js',
  './src/game/lore.js',
  './src/game/camera.js',
  './src/ui/hud.js',
  './src/ui/theme.js',
  './vendor/three/three.module.js',
  './vendor/three/examples/jsm/postprocessing/EffectComposer.js',
  './vendor/three/examples/jsm/postprocessing/RenderPass.js',
  './vendor/three/examples/jsm/postprocessing/ShaderPass.js',
  './vendor/three/examples/jsm/postprocessing/MaskPass.js',
  './vendor/three/examples/jsm/postprocessing/Pass.js',
  './vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js',
  './vendor/three/examples/jsm/postprocessing/OutputPass.js',
  './vendor/three/examples/jsm/shaders/CopyShader.js',
  './vendor/three/examples/jsm/shaders/OutputShader.js',
  './vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js',
  './vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
  './assets/icon/icon-192.png',
  './assets/icon/icon-512.png',
  './assets/icon/icon-maskable-512.png',
  './assets/icon/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    /* Added one at a time rather than through addAll(), which rejects the
       whole install if any single request fails. One missing file should cost
       that file, not the entire offline capability. */
    await Promise.all(SHELL.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] not cached:', url, err && err.message); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // nothing else exists

  e.respondWith((async () => {
    /* The stylesheet carries a ?v= cache buster, and the source files may too
       after a deploy, so match ignoring the query — otherwise every bump is a
       cold load even though the bytes are already here under the old URL. */
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Offline and not in the cache. A navigation still gets the page, which
      // is the difference between a dead icon and a game that starts.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

/* The page asks for this after the user accepts an update. */
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
