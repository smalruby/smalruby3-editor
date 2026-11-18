/* global self */
// === Smalruby: This file is Smalruby-specific (service worker kill switch) ===
// The editor no longer registers a service worker (it is installable with the web app manifest
// alone). Browsers that registered `/service-worker.js` in the past keep checking this URL for
// updates, so this worker replaces the old one, deletes the caches it made and unregisters itself.
// It has no fetch handler: every request goes to the network as if there were no service worker.
// It does not reload open pages, so nothing the user is editing is lost; the next visit is served
// without a service worker.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            try {
                const keys = await self.caches.keys();
                await Promise.all(keys.map((key) => self.caches.delete(key)));
            } finally {
                await self.registration.unregister();
            }
        })(),
    );
});
