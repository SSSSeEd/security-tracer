"use strict";
/* Offline support. Network first (so lessons and news stay current), falling back to the cached copy when offline.
   Same-origin GET only; web fonts from other origins are not cached (system fonts are used offline). */
const CACHE = "sectracer-v2";
const SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "manifest.webmanifest",
  "icon.svg",
  "icon-180.png",
  "js/core.js",
  "js/data/sources.js",
  "js/data/terms.js",
  "js/data/scenarios.js",
  "js/data/courses.js",
  "js/data/quiz.js",
  "js/data/news.js",
  "js/widgets/_kit.js",
  "js/widgets/net.js",
  "js/widgets/net-lan.js",
  "js/widgets/crypto-keyx.js",
  "js/widgets/crypto-pwstore.js",
  "js/widgets/crypto.js",
  "js/widgets/auth.js",
  "js/widgets/web.js",
  "js/widgets/web-server.js",
  "js/widgets/web-sql.js",
  "vendor/sqljs/sql-wasm.js",
  "vendor/sqljs/sql-wasm.wasm",
  "js/widgets/malware.js",
  "js/widgets/vuln.js",
  "js/widgets/defense.js",
  "js/widgets/mobile.js",
  "js/widgets/cloud.js",
  "js/widgets/ai.js",
  "js/widgets/packetsim.js",
  "js/views.js",
  "js/app.js"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
