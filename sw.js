// Service worker: deixa o app funcionar offline.
// Arquivos do app: rede primeiro (pega atualizações), cache como reserva.
// Fontes do Google: cache na primeira visita, para aparecerem offline depois.

const CACHE = 'guitarra-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/store.js',
  'js/tab.js',
  'js/chord-diagram.js',
  'js/metronome.js',
  'js/tab-player.js',
  'js/merge.js',
  'js/sync-core.js',
  'js/sync.js',
  'js/config.js',
  'js/data/chords.js',
  'js/data/exercises.js',
  'js/data/plans.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
    );
    return;
  }

  // Fontes e SDK do Supabase (jsdelivr): guardados na primeira visita para funcionar offline.
  // As chamadas à API do Supabase (outro domínio) nunca passam pelo cache.
  if (['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })),
    );
  }
});
