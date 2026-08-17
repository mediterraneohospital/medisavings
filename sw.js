const CACHE = 'medisavings-v1';
const ASSETS = [
  '/medisavings/',
  '/medisavings/index.html',
  '/medisavings/detail.html',
  '/medisavings/add.html',
  '/medisavings/stats.html',
  '/medisavings/css/style.css',
  '/medisavings/js/supabase.js',
  '/medisavings/js/list.js',
  '/medisavings/js/form.js',
  '/medisavings/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
