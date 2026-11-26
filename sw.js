// Service worker (module) of the whole collection: makes the home and every game playable
// offline after the first visit. It lives at the site root so its scope covers jeux/*.
// UPDATING: bump CACHE_VERSION on every release, then merge into master (see DEPLOY.md).
import { HOME_PRECACHE, GAMES } from './jeux/registry.js';

const CACHE_VERSION = 'v10';
// A prefix of this collection only: on <account>.github.io every project site of the account
// shares one origin and its Cache Storage, so activate deletes only older 'ludeo-*' caches.
const CACHE = `ludeo-${CACHE_VERSION}`;
const PRECACHE = [...HOME_PRECACHE, ...GAMES.flatMap(g => g.precache)];

self.addEventListener('install', event => {
  // Paths in PRECACHE are relative to the site root, which is where sw.js lives.
  // cache: 'reload' bypasses the browser's HTTP cache: without it a new version can be filled
  // with the old files (static hosts send Last-Modified/Expires, so the HTTP cache answers).
  const requests = PRECACHE.map(u => new Request(u, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ludeo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Navigations (including jeux/<id>/index.html?scene=...) are matched ignoring the query string.
  const opts = req.mode === 'navigate' ? { ignoreSearch: true } : undefined;
  event.respondWith(
    caches.match(req, opts).then(hit => {
      if (hit) return hit;
      // Unknown page offline: the home.
      if (req.mode === 'navigate') return caches.match('index.html');
      return fetch(req);
    }),
  );
});
