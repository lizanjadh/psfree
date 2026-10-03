const CACHE_NAME = 'v1_cache_pagina_sencilla';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './serve.py',
  './src/firmware.js',
  './src/kexp.js',
  './src/main.js',
  './src/relapse_exploit.js',
  './src/rop.js',
  './src/site.js',
  './src/utils/int64.js',
  './src/utils/mem.js',
  './src/utils/rop_slave.js',
  './src/utils/syscalls.js',
  './payloads/elfldr-ps5-1360.elf',
  './payloads/kexp_2026_05_25.bin',
  './payloads/kstuff.elf',
  './payloads/shadowmountplus.elf',
  './offsets/13.20.js', 
];

// Evento de instalación: Guarda los archivos en la caché local
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Archivos cacheados con éxito');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Evento de activación: Limpia cachés antiguas si se actualiza el Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Borrando caché antigua');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Evento fetch: Intercepta las peticiones y busca en la caché antes de ir a Internet
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si está en la caché, lo devuelve. Si no, lo busca en internet.
                return response || fetch(event.request);
            })
    );
});
