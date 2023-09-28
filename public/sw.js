//to be updated before each deployment to clean up old caches
const STATIC_CACHE_VERSION = "static-v5"
const DYNAMIC_CACHE_VERSION = "dynamic-v3"

// This code executes in its own worker or thread
self.addEventListener("install", event => {
    console.log("[Service worker] installed", event);
    event.waitUntil(
        caches.open(STATIC_CACHE_VERSION).then(cache => {
            // these are relative urls and not relative paths to request
            //add,addAll saves res themselves w/o providing explicitly, works for static assets
            cache.addAll([
                '/',
                '/index.html',
                '/src/js/app.js',
                '/src/js/material.min.js',
                '/src/css/app.css',
                '/src/css/feed.css',
                '/src/images/main-image-lg.jpg',
                'https://fonts.googleapis.com/css?family=Roboto:400,700',
                'https://fonts.googleapis.com/icon?family=Material+Icons',
                'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
                '/offline.html'
            ])
        })
    )
});
self.addEventListener("activate", event => {
    console.log("Service worker activated", event);
    // clean old caches here
    caches.keys().then(keys => {
        keys.forEach(key => {
            if (key !== STATIC_CACHE_VERSION && key !== DYNAMIC_CACHE_VERSION) {
                caches.delete(key)
            }
        })
    })

    return self.clients.claim()
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(cacheRes => {
            if (cacheRes) {
                return cacheRes
            }
            else {
                return fetch(event.request).then(res => {
                    const clonedRes = res.clone()
                    caches.open(DYNAMIC_CACHE_VERSION).then(cache => {
                        console.log("inside dynamic cache")
                        // put unlike add, needs us to pass the url and res
                        cache.put(event.request.url, clonedRes) // cloning since req can be used only once
                    })
                    return res
                }).catch(e => {
                    return caches.open(STATIC_CACHE_VERSION).then(cache => cache.match('/offline.html'))
                })
            }
        }).catch(e => fetch(event.request))
    )
});