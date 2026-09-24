// Somente o shell local é armazenado. Supabase e autenticação exigem rede.
const CACHE_NAME = "mabijufit-v7";
const APP_FILES = [
    "./", "./index.html", "./css/style.css", "./js/app.js",
    "./js/supabase.js", "./manifest.json",
    "./assets/icons/icon-192.png", "./assets/icons/icon-512.png"
];
const APP_URLS = new Set(APP_FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith("mabijufit-") && name !== CACHE_NAME)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
    url.search = "";
    if (!APP_URLS.has(url.href)) return;

    const response = (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const network = await fetch(event.request, { cache: "no-cache" });
            if (network.ok) await cache.put(url.href, network.clone());
            return network;
        } catch {
            return await cache.match(url.href) || new Response("Sem conexão. Abra o aplicativo conectado para preparar o cache.", {
                status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
            });
        }
    })();
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined));
});
