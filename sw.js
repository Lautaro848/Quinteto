/* ========== service worker: la app funciona sin señal ==========
   Estrategia stale-while-revalidate: responde desde caché al instante
   y actualiza en segundo plano, así los deploys nuevos llegan solos. */
"use strict";

const CACHE = "quinteto-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/util.js",
  "./js/geometry.js",
  "./js/store.js",
  "./js/stats.js",
  "./js/court.js",
  "./js/setup.js",
  "./js/game.js",
  "./js/analysis.js",
  "./js/report.js",
  "./js/season.js",
  "./js/training.js",
  "./js/app.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fetched = fetch(e.request)
        .then(res => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
