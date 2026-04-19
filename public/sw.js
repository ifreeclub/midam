/**
 * 미담사진관 태블릿 웹 - Service Worker
 *
 * 오프라인 지원은 불필요하지만 Chrome의 PWA 설치 기준을 충족하기 위해 등록
 * 캐시는 정적 파일만 최소한으로 처리
 * API 요청은 캐시하지 않음 (항상 네트워크)
 */

const CACHE_VERSION = 'midam-v1.0.0'
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // 개별 실패를 허용하기 위해 개별 add 사용
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn('[SW] cache add failed:', url, err)
        }))
      )
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Apps Script 요청은 항상 네트워크 (캐시 금지)
  if (url.hostname.includes('script.google.com')) {
    return
  }

  // GET 요청만 캐시 대상
  if (event.request.method !== 'GET') {
    return
  }

  // 정적 자산 - 네트워크 우선 + 실패 시 캐시 fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답만 캐시 갱신
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
