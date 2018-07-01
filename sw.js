// Cached files
const urlsToCache = [
    '/styles/foundation.min.css',
    '/styles/main.css',
    '/styles/index.css',
    '/scripts/numeral.min.js',
    '/scripts/modernizr.js',
    '/scripts/jquery.js',
    '/styles/index.css',
  ];
  
  // Install essential URLs.
  self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE).then((cache) => cache.addAll(urlsToCache)));
  });
  
  // Delete old caches.
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((cacheName) => cacheName !== APP_CACHE)
              .map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  });
  
  // Fetch data from cache.
  self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname === '/rates') {
      // Rates. Don't cache.
      fetch(event.request);
    } else if (requestUrl.pathname === '/') {
      // Serve from cache, update in background.
      cacheThenUpdateWithCacheBust(event);
    } else {
      // Try cache first. If that fails, go to network and update cache.
      cacheWithNetworkFallbackAndStore(event);
    }
  });
  
  // Reply to sync events.
  self.addEventListener('sync', (event) => {
    if (event.tag === 'rates') {
      // Fetch the rates once the user gains connectivity.
      event.waitUntil(fetch(RATE_URL)
          .then((response) => response.json())
          .then((json) => {
            let idb = self.indexedDB;
            if (idb) {
              let req = idb.open('db', 1);
              if (req) {
                req.onsuccess = (event) => {
                  let db = event.target.result;
                  db.transaction('kv', 'readwrite').objectStore('kv')
                      .put(json, 'rates');
                };
                req.onupgradeneeded = (event) => {
                  let db = event.target.result;
                  db.createObjectStore('kv');
                };
              }
            }
          })
          .then(() => {
            registration.showNotification('Material Money', {
              body: 'Currency rates updated.',
              icon: '/images/touch/icon-256x256.png',
              badge: '/images/touch/icon-256x256.png',
            });
          }));
    }
  });
  
  /**
   * Attempts to retrieve from cache first. If that fails, goes to network and
   * stores it in the cache for later.
   * @param {FetchEvent} event The event to handle.
   */
  function cacheWithNetworkFallbackAndStore(event) {
    let response = null;
    event.respondWith(fromCache(event.request)
        .catch(() => fetch(event.request.clone())
            .then((resp) => {
                response = resp;
                return update(event.request, resp.clone());
            })
            .then(() => response)));
  }
  
  /**
   * Immediately responds from cache, but updates from network in the background.
   * Performs a cache bust when updating.
   * @param {FetchEvent} event The event to handle.
   */
  function cacheThenUpdateWithCacheBust(event) {
    const networkRequest =
        new Request(`${event.request.url}?${Date.now().toString()}`);
  
    const network = fetch(networkRequest);
    const networkClone = network.then((response) => response.clone());
  
    event.respondWith(fromCache(event.request).catch(() => networkClone));
    event.waitUntil(network.then((resp) => update(event.request, resp)));
  }
  
  /**
   * Retrieve response from cache.
   * @param {Request} request The fetch request to handle.
   * @return {Promise} The response promise.
   */
  function fromCache(request) {
    return caches.open(APP_CACHE).then((cache) => {
      return cache.match(request).then((matching) => {
        return matching || Promise.reject('no-match');
      });
    });
  }
  
  /**
   * Store response in the cache.
   * @param {Request} request The fetch request to handle.
   * @param {Response} response The fetch response to handle.
   * @return {Promise} The storage promise.
   */
  function update(request, response) {
    return caches.open(APP_CACHE).then((cache) => cache.put(request, response));
  }
  