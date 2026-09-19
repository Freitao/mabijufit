// =========================================================
// MABIJUFIT — SERVICE WORKER
// =========================================================

const CACHE_NAME = "mabijufit-v3";

const APP_FILES = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/app.js",
    "./js/supabase.js",
    "./manifest.json",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png"
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

        caches
            .keys()
            .then((cacheNames) => {

                return Promise.all(

                    cacheNames
                        .filter(
                            (cacheName) =>
                                cacheName !== CACHE_NAME
                        )
                        .map(
                            (cacheName) =>
                                caches.delete(cacheName)
                        )

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


    const requestURL =
        new URL(event.request.url);


    // -----------------------------------------------------
    // Não interferir em requisições externas.
    // Ex.: Supabase, CDN etc.
    // -----------------------------------------------------

    if (
        requestURL.origin !== self.location.origin
    ) {
        return;
    }


    event.respondWith(

        fetch(event.request)

            .then((networkResponse) => {

                if (
                    !networkResponse ||
                    networkResponse.status !== 200
                ) {
                    throw new Error(
                        "Resposta de rede inválida."
                    );
                }


                const responseClone =
                    networkResponse.clone();


                caches
                    .open(CACHE_NAME)
                    .then((cache) => {

                        cache.put(
                            event.request,
                            responseClone
                        );

                    });


                return networkResponse;

            })

            .catch(() => {

                return caches.match(
                    event.request
                );

            })

    );

});
