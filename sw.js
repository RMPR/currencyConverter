self.addEventListener('fetch', function(e) {
    var dataUrl = 'https://free.currencyconverterapi.com/api/v5/convert?';
    if (e.request.url.includes(dataUrl)) {
      e.respondWith(
          fetch(e.request).then( (res) => {
              console.log('Fetching from Network');
              const resClone = res.clone();
              caches.open(dynamicCacheName).then( (cache) => {
                  cache.put(e.request, resClone);
              });
              return res;
          }).catch(function() {
              console.log('Fetching from Cache');
              return caches.match(e.request);
          })
      );
    } else {
      e.respondWith(
        caches.match(e.request).then( (response) => {
          return response || fetch(e.request);
        })
      );
    }
  });