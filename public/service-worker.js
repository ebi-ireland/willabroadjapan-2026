const CACHE_NAME = 'willabroad-v1'
const OFFLINE_URL = '/offline.html'

// プリキャッシュするファイル
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/index.html',
  '/student-japan.html',
]

// インストール時にプリキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// フェッチ処理
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // APIリクエストはネットワーク優先（キャッシュしない）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'オフラインです' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    )
    return
  }

  // 静的アセット（CSS/JS/画像）はキャッシュ優先
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        return response
      }))
    )
    return
  }

  // HTMLページはネットワーク優先、失敗時にキャッシュ、それもなければオフラインページ
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
  )
})
