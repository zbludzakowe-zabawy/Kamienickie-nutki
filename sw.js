/* Kamienickie Nutki – service worker (działanie offline).
 * Przy publikacji (workflow publikacji → tools/build-sw.mjs) VERSION
 * dostaje skrót wszystkich plików, a ASSETS ich pełną listę. Nowa wersja czeka,
 * aż użytkownik stuknie „Odśwież” – bez niespodziewanych przeładowań. */
const VERSION = 'dev';
// Wersja testowa (podfolder test/) podmienia przedrostek na 'test-kamienickie-nutki-' (tools/build-test.mjs) –
// ten sam adres = wspólne schowki, a każdy service worker przy aktywacji kasuje stare schowki ze swoim przedrostkiem.
const PREFIX = 'kamienickie-nutki-';
const CACHE = `${PREFIX}${VERSION}`;
// Podfoldery z osobną aplikacją (wersja testowa) – ten service worker ich nie obsługuje.
const SKIP = ['test/'].map((p) => new URL(p, self.registration.scope).pathname);
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/config.js',
  './js/mode.js',
  './js/store.js',
  './js/drive.js',
  './js/catalog.js',
  './js/zip.js',
  './js/songlist.js',
  './js/matcher.js',
  './js/songs.js',
  './js/dups.js',
  './js/crypto.js',
  './js/pdfbuild.js',
  './js/programs.js',
  './js/publish.js',
  './js/guest.js',
  './js/vendor/pdf-lib.min.js',
  './js/app.js',
  './js/pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  // `cache: 'reload'` omija pamięć HTTP, żeby nowa wersja nie zapisała starych plików
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SKIP.some((p) => url.pathname.startsWith(p))) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./');
        if (shell) return shell;
      }
      return fetch(req);
    }),
  );
});
