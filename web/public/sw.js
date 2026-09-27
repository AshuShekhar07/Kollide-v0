// Kollide service worker: only here so the app can be installed (PLAN.md
// §6.2). Offline support isn't needed, so nothing is cached and every request
// goes straight to the network.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
