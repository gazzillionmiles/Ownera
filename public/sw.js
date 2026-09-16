/**
 * Production Service Worker
 * Auto-generated build version: app-pwa-v1-mu4lfm7t
 */

const CACHE_VERSION = 'app-pwa-v1-mu4lfm7t';
const PRECACHE_NAME = 'app-precache-' + CACHE_VERSION;
const RUNTIME_CACHE = 'app-runtime-' + CACHE_VERSION;
const API_CACHE = 'app-api-' + CACHE_VERSION;
const IMAGE_CACHE = 'app-images-' + CACHE_VERSION;

const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512x512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
  "/_next/static/chunks/02goyli1wd1ny.js",
  "/_next/static/chunks/0cyw7itlx-me4.js",
  "/_next/static/chunks/0cz1d0mv5g_q7.js",
  "/_next/static/chunks/0e62i9sediz_z.js",
  "/_next/static/chunks/0h2qsuyze9ds1.js",
  "/_next/static/chunks/0nlh76z6v_i6x.js",
  "/_next/static/chunks/0oeds6xg-zier.js",
  "/_next/static/chunks/0oyyf_3ujtpsj.js",
  "/_next/static/chunks/0qaquzo0gb2fv.js",
  "/_next/static/chunks/0vjpld0tahd7i.js",
  "/_next/static/chunks/0x3rh6wnec78r.js",
  "/_next/static/chunks/11tetfpmpkm81.js",
  "/_next/static/chunks/1615rjdha8p0v.js",
  "/_next/static/chunks/16pk1m1w7g4jr.js",
  "/_next/static/chunks/17uu5w-u5_ij-.js",
  "/_next/static/chunks/1892ppgbfp4u_.js",
  "/_next/static/chunks/19yugq-c47dp_.js",
  "/_next/static/chunks/1bizefod7zksd.js",
  "/_next/static/chunks/1j7bvp5v951c0.js",
  "/_next/static/chunks/1k97o0zktasy6.js",
  "/_next/static/chunks/1mzq-mb8j54lj.js",
  "/_next/static/chunks/1pemvxtuhtxo1.js",
  "/_next/static/chunks/1u7y5425dhkft.js",
  "/_next/static/chunks/1vvf2nxgncqa7.js",
  "/_next/static/chunks/1y3pj1gx8l3qt.js"
];

// Install Event: Precache Core App Shell and Offline Page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell and offline assets...');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Non-critical precache failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Claim Clients & Purge Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('app-') &&
              !cacheName.endsWith(CACHE_VERSION)
            );
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check Network-Only Exclusions
function isNetworkOnlyRequest(url, request) {
  // Method checks: non-GET requests are strictly Network Only
  if (request.method !== 'GET') return true;

  const pathname = url.pathname;

  // Never-cached sensitive endpoint patterns
  const networkOnlyPatterns = [
    /\/api\/payment\//i,
    /\/api\/generate\//i,
    /\/api\/auth\//i,
    /\/auth\//i,
    /\/login/i,
    /\/session/i,
    /\/api\/history/i, // User history contains sensitive conversation context
    /\/api\/profile/i,
    /\/api\/promo\/claim/i,
    /\/api\/referral\/claim/i,
  ];

  if (networkOnlyPatterns.some((pattern) => pattern.test(pathname))) {
    return true;
  }

  // Cloud storage / S3 uploads / Presigned S3 URLs
  if (
    url.hostname.includes('s3.amazonaws.com') ||
    url.hostname.includes('amazonaws.com') ||
    url.hostname.includes('r2.cloudflarestorage.com') ||
    url.searchParams.has('X-Amz-Signature') ||
    url.searchParams.has('X-Amz-Algorithm')
  ) {
    return true;
  }

  return false;
}

// Fetch Interceptor with Secure Caching Strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-http/https
  if (!url.protocol.startsWith('http')) return;

  // 1. NETWORK ONLY: Non-GET, Auth, Payments, AI Generation, Uploads, Sensitive endpoints
  if (isNetworkOnlyRequest(url, request)) {
    event.respondWith(
      fetch(request).catch((err) => {
        console.warn('[SW] Network Only fetch failed for:', url.pathname, err);
        return new Response(
          JSON.stringify({
            error: 'Network connection required for this operation.',
            offline: true,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. CACHE FIRST: Static JS, CSS, Fonts, Icons, Manifest
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico' ||
    /\.(js|css|woff2?|ttf|otf|eot|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(PRECACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. STALE WHILE REVALIDATE: Images & Public Media
  const isImageOrMedia =
    url.pathname.startsWith('/_next/image') ||
    /\.(png|jpe?g|svg|webp|gif|avif)$/i.test(url.pathname);

  if (isImageOrMedia) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 4. NETWORK FIRST: Non-sensitive Public API GET requests (e.g., /api/credit-packs)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !networkResponse.headers.get('Cache-Control')?.includes('no-store')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: 'You are offline.', offline: true }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 5. NAVIGATION REQUESTS: App Pages (HTML Navigation)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Check cached page
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Fallback to pre-cached /offline page
            return caches.match('/offline').then((offlineFallback) => {
              return (
                offlineFallback ||
                caches.match('/') ||
                new Response('<h1>Offline</h1><p>Please check your connection.</p>', {
                  headers: { 'Content-Type': 'text/html' },
                })
              );
            });
          });
        })
    );
    return;
  }

  // Default fallback to Network
  event.respondWith(fetch(request));
});
