// =========================================================
// MABIJUFIT — SERVICE WORKER
// =========================================================

const CACHE_NAME = "mabijufit-v2";

const APP_FILES = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/app.js",
    "./manifest.json"
];


// =========================================================
// INSTALAÇÃO
// =========================================================

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(APP_FILES);
            })
    );

    self.skipWaiting();
});


// =========================================================
// ATIVAÇÃO
// =========================================================

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        return cacheName !== CACHE_NAME;
                    })
                    .map((cacheName) => {
                        return caches.delete(cacheName);
                    })
            );
        })
    );

    self.clients.claim();
});


// =========================================================
// REQUISIÇÕES
// =========================================================

self.addEventListener("fetch", (event) => {

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {

            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request)
                .then((networkResponse) => {

                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        networkResponse.type === "opaque"
                    ) {
                        return networkResponse;
                    }

                    const responseClone =
                        networkResponse.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(
                            event.request,
                            responseClone
                        );
                    });

                    return networkResponse;
                })
                .catch(() => {
                    return caches.match("./index.html");
                });
        })
    );
});
