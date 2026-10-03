const CACHE_NAME = 'sitio-offline-v1';
const urlsToCache = [
  '/index.html',
  '/serve.py',
  '/src/firmware.js',
  '/src/kexp.js',
  '/src/main.js',
  '/src/relapse_exploit.js',
  '/src/rop.js',
  '/src/site.js',
  '/src/utils/int64.js',
  '/src/utils/mem.js',
  '/src/utils/rop_slave.js',
  '/src/utils/syscalls.js',
  '/payloads/elfldr-ps5-1360.elf',
  '/payloads/kexp_2026_05_25.bin',
  '/payloads/kstuff.elf',
  '/payloads/shadowmountplus.elf',
  '/offsets/13.20.js',
  // Agrega aquí todas las rutas o recursos que quieras guardar
];

// Instalación: Guarda los recursos en la caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activación: Limpia cachés antiguas si actualizas la versión
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepta peticiones y sirve el contenido desde la caché si no hay red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, lo devuelve; si no, va a la red
        return response || fetch(event.request);
      })
  );
});
