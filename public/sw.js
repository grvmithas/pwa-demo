importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

var CACHE_STATIC_NAME = 'static-v15';
var CACHE_DYNAMIC_NAME = 'dynamic-v2';
var STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    'src/js/idb.js',
    'src/js/utility.js',
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/js/material.min.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/images/main-image.jpg',
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];

// function trimCache(cacheName, maxItems) {
//   caches.open(cacheName)
//     .then(function (cache) {
//       return cache.keys()
//         .then(function (keys) {
//           if (keys.length > maxItems) {
//             cache.delete(keys[0])
//               .then(trimCache(cacheName, maxItems));
//           }
//         });
//     })
// }
function isResourceFetchable(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${url}`);
            }
        })
        .catch(error => {
            console.error(error);
            return false;
        });
}



self.addEventListener('install', function (event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
            .then(cache => {
                console.log('[Service Worker] Precaching App Shell', cache);
                cache.addAll(STATIC_FILES);
            }))
    // return self.clients.claim()
});

self.addEventListener('activate', function (event) {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys()
            .then(function (keyList) {
                return Promise.all(keyList.map(function (key) {
                    if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                        console.log('[Service Worker] Removing old cache.', key);
                        return caches.delete(key);
                    }
                }));
            })
    );
    return self.clients.claim();
});

function isInArray(string, array) {
    var cachePath;
    if (string.indexOf(self.origin) === 0) { // request targets domain where we serve the page from (i.e. NOT a CDN)
        console.log('matched ', string);
        cachePath = string.substring(self.origin.length); // take the part of the URL AFTER the domain (e.g. after localhost:8080)
    } else {
        cachePath = string; // store the full request (for CDNs)
    }
    return array.indexOf(cachePath) > -1;
}

self.addEventListener('fetch', function (event) {

    var url = 'https://pwa-demo-3ec01-default-rtdb.firebaseio.com/posts.json';
    if (event.request.url.indexOf(url) > -1) {
        event.respondWith(fetch(event.request)
            .then(function (res) {
                var clonedRes = res.clone();
                clearAllData('posts')
                    .then(function () {
                        return clonedRes.json();
                    })
                    .then(function (data) {
                        for (var key in data) {
                            writeData('posts', data[key])
                        }
                    });
                return res;
            })
        );
    } else if (isInArray(event.request.url, STATIC_FILES)) {
        //cache only for static assets
        event.respondWith(
            caches.match(event.request)
        );
    } else {
        event.respondWith(
            //cache then network
            caches.match(event.request)
                .then(function (response) {
                    if (response) {
                        return response;
                    } else {
                        return fetch(event.request)
                            .then(function (res) {
                                return caches.open(CACHE_DYNAMIC_NAME)
                                    .then(function (cache) {
                                        // trimCache(CACHE_DYNAMIC_NAME, 3);
                                        cache.put(event.request.url, res.clone());
                                        return res;
                                    })
                            })
                            .catch(function (err) {
                                return caches.open(CACHE_STATIC_NAME)
                                    .then(function (cache) {
                                        if (event.request.headers.get('accept').includes('text/html')) {
                                            return cache.match('/offline.html');
                                        }
                                    });
                            });
                    }
                })
        );
    }
});

/* self.addEventListener("fetch", event => {
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
                        //  cache.put(event.request.url, clonedRes) // cloning since req can be used only once
                    })
                    return res
                }).catch(e => {
                    return caches.open(STATIC_CACHE_VERSION).then(cache => cache.match('/offline.html'))
                })
            }
        }).catch(e => fetch(event.request))
    )
}); */

/**
 * cache only stretagy
 * relies only on cache, doesnt return fallback network, no valid use case
 */

/* self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request))
}); */


/**
 * network only stretagy
 * relies only on network, doesnt return fallback network, no valid use case
 */

/* self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request))
});
 */

/**
 * network with cache fallback
 * pro: faster response of cache, 
 * con: horrible user experience for timeout after 60 sec issue as cache will check only after slow network
 */
/* 
self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request).catch(e => {
            console.log("inside offline for network with cache fallback")
            return caches.match(event.request)
        }))
});
 */



/**
 * Network first with dynamic caching
 */
self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request).then(res => {
            const clonedRes = res.clone()
            caches.open(DYNAMIC_CACHE_VERSION).then(cache => {
                cache.put(event.request.url, clonedRes)
            })
            return res
        }).catch(err => {
            console.log("inside offline for network with cache fallback")
            return caches.match(event.request)
        })
    )
})




self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts');
        event.waitUntil(
            readAllData('sync-posts')
                .then(function (data) {
                    for (var dt of data) {
                        fetch('https://pwa-demo-3ec01-default-rtdb.firebaseio.com/posts.json', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                id: dt.id,
                                title: dt.title,
                                location: dt.location,
                                // image: 'https://firebasestorage.googleapis.com/v0/b/pwagram-99adf.appspot.com/o/sf-boat.jpg?alt=media&token=19f4770c-fc8c-4882-92f1-62000ff06f16'
                            })
                        })
                            .then(function (res) {
                                console.log('Sent data', res);
                                if (res.ok) {
                                    deleteItemFromData('sync-posts', dt.id); // Isn't working correctly!
                                }
                            })
                            .catch(function (err) {
                                console.log('Error while sending data', err);
                            });
                    }

                })
        );
    }
});