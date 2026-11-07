/* ==========================================================
   Súper Barrio · Service worker
   Guarda una copia de la app para que abra sin internet.
   Para publicar una actualización: cambiá VERSION ("v1" → "v2").
   ========================================================== */

// Nombre de la "caja" donde se guardan las copias. Cambia con cada versión.
var VERSION = "v1";
var NOMBRE_CACHE = "super-barrio-" + VERSION;

// Todos los archivos que necesita la app para funcionar sin conexión.
// Rutas relativas ("./"): la app vive dentro de una subcarpeta de GitHub Pages.
var ARCHIVOS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icono-192.png",
  "./icono-512.png"
];

// INSTALL: la primera vez, guarda una copia de cada archivo de la lista.
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then(function (cache) {
      return cache.addAll(ARCHIVOS);
    })
  );
});

// ACTIVATE: borra las copias de versiones anteriores para no acumular.
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres
          .filter(function (nombre) { return nombre.indexOf("super-barrio-") === 0 && nombre !== NOMBRE_CACHE; })
          .map(function (nombre) { return caches.delete(nombre); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// FETCH: primero la copia guardada; si no está, la busca en internet.
self.addEventListener("fetch", function (evento) {
  if (evento.request.method !== "GET") return;

  evento.respondWith(
    caches.match(evento.request).then(function (copia) {
      return copia || fetch(evento.request);
    })
  );
});
