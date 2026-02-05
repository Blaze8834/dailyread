const STATIC_CACHE = "dailyread-static-v1";
const PLAY_CACHE = "dailyread-play";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/src/main.js",
  "/src/canvas.js",
  "/src/catalogs.js",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, PLAY_CACHE].includes(key)) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.url.includes("/api/play/today")) {
    event.respondWith(cacheThenNetwork(request));
    return;
  }

  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});

async function cacheThenNetwork(request) {
  const cache = await caches.open(PLAY_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
