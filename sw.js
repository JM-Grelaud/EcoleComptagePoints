/* ================================================================
   sw.js â Service Worker
   Archers de LaillÃ© | EntraÃ®nement au comptage des points | V4.3
   StratÃ©gie : Cache First â l'appli fonctionne 100 % hors-ligne
   ================================================================ */

'use strict';

const CACHE_NAME = 'ecopo-v4.3';

/* Tous les fichiers constituant l'appli */
const ASSETS = [
  './ecopo.html',
  './styles.css',
  './target.js',
  './sounds.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './EcCoPo_Manuel_Utilisateur.pdf',
];

/* ââ Installation : mise en cache de tous les assets âââââââââââ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())   /* active immÃ©diatement */
  );
});

/* ââ Activation : suppression des anciens caches âââââââââââââââ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())   /* prend le contrÃ´le immÃ©diatement */
  );
});

/* ââ Fetch : Cache First ââââââââââââââââââââââââââââââââââââââââ */
self.addEventListener('fetch', (event) => {
  /* On ne gÃ¨re que les requÃªtes GET */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      /* Ressource en cache â retour immÃ©diat (offline OK) */
      if (cached) return cached;
      /* Sinon tentative rÃ©seau (premiÃ¨re installation, MÃ J) */
      return fetch(event.request).then((response) => {
        /* Mise en cache de la nouvelle ressource */
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, clone)
          );
        }
        return response;
      });
    })
  );
});
