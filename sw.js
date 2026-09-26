/* ============================================================
   게임 상자 서비스워커
   ------------------------------------------------------------
   문서(HTML)는 네트워크 우선 — 새 버전이 올라오면 바로 반영된다.
   나머지(스크립트·이미지)는 캐시 우선으로 즉시 띄우고 뒤에서 갱신한다.
   둘 다 실패하면 캐시에 있는 것으로 오프라인 실행.
   ============================================================ */
const CACHE = 'gamebox-v2';
const CORE = [
  './', './index.html',
  './merge-game.html', './screw-game.html', './prime-hunter.html',
  './recycle-runner.html', './duel.html',
  './assets/core.js', './assets/sprites.js',
  './assets/icon-192.png', './assets/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

function put(req, res){
  if(res && res.status === 200 && res.type === 'basic'){
    const copy = res.clone();
    caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
  }
  return res;
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;   // 폰트 등 외부 요청은 건드리지 않는다

  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if(isDoc){
    e.respondWith(
      fetch(req).then(res=>put(req,res))
                .catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>put(req,res)).catch(()=>hit);
      return hit || net;                                     // 캐시가 있으면 즉시, 갱신은 뒤에서
    })
  );
});
