/* ================================================================
   sw.js — Service Worker
   Archers de Laillé | Entraînement au comptage des points | V4.2
   Stratégie : Cache First — l'appli fonctionne 100 % hors-ligne
   ================================================================ */

'use strict';

const CACHE_NAME = 'ecopo-v4.2';

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
];

/* ── Installation : mise en cache de tous les assets ─────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())   /* active immédiatement */
  );
});

/* ── Activation : suppression des anciens caches ─────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())  /* prend le contrôle immédiatement */
  );
});

/* ── Fetch : Cache First ──────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  /* On ne gère que les requêtes GET */
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      /* Ressource en cache → retour immédiat (offline OK) */
      if (cached) return cached;
      /* Sinon tentative réseau (première installation, MàJ) */
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
