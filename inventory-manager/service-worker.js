// Service Worker for the Inventory Manager PWA
const CACHE_NAME = 'inventory-manager-v1';

// Files to cache
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/barcode-scanner.js',
  '/js/database.js',
  '/js/excel-handler.js',
  '/js/ui-controller.js',
  '/manifest.json'
];

// External resources to cache
const EXTERNAL_FILES_TO_CACHE = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js',
  'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Pre-caching resources');
        return Promise.all([
          cache.addAll(FILES_TO_CACHE),
          // Try to cache external resources, but don't fail installation if they fail
          cache.addAll(EXTERNAL_FILES_TO_CACHE).catch(err => {
            console.log('[ServiceWorker] Some external resources failed to cache', err);
          })
        ]);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
    .then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (event.request.url.startsWith(self.location.origin) || 
      EXTERNAL_FILES_TO_CACHE.includes(event.request.url)) {
    
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Don't cache non-successful responses
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response as it can only be consumed once
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(err => {
              // Fall back to offline page if we can't fetch
              console.log('[ServiceWorker] Fetch error:', err);
              
              // If the request is for an HTML page, show offline page
              if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
              }
              
              // Otherwise just return the error
              throw err;
            });
        })
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
