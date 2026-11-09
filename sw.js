/* v157 — 홈 화면 설치용 최소 서비스워커. 캐시를 하지 않는다(수업 중 고친 화면이 바로 보이게). 요청을 그대로 통과시킨다. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
