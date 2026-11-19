// Service worker (module): makes the game playable offline after the first visit.
// UPDATING: bump CACHE_VERSION on every deploy, then re-upload (see DEPLOY.md).
import { PRECACHE } from './src/assets.js';

const CACHE_VERSION = 'v1';
const CACHE = `stand-${CACHE_VERSION}`;

self.addEventListener('install', event => {
  // Paths in PRECACHE are relative to the site root, which is where sw.js lives.
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('stand-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Navigations (including index.html?scene=...) are matched ignoring the query string.
  const opts = req.mode === 'navigate' ? { ignoreSearch: true } : undefined;
  event.respondWith(
    caches.match(req, opts).then(hit => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return fetch(req);
    }),
  );
});
