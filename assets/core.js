/* ============================================================
   게임 상자 공용 코어
   ------------------------------------------------------------
   게임들이 똑같이 쓰던 것들을 한곳에 모았다.
   - 저장소(지갑·아이템·기록) · 사운드 · 스프라이트 로더
   - 런처가 읽는 게임 목록(제목·태그)
   - PWA 서비스워커 등록
   window.GB 하나로 접근한다.
   ============================================================ */
(function(){
'use strict';

/* ── 저장소 ─────────────────────────────────── */
const store = {
  read(key, def){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
    catch(e){ return def; }
  },
  write(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ return false; }
  },
  num(key){
    try{ return Number(localStorage.getItem(key) || 0) || 0; }catch(e){ return 0; }
  }
};

/* ── 게임 목록 — 런처가 이 데이터로 카드를 그린다 ── */
const GAMES = [
  { id:'merge',   file:'merge-game.html',     emoji:'🍹', title:'비치바 머지!',
    desc:'음료를 튕겨 쏘고 같은 음료끼리 합치기. 손님 주문을 서빙하세요.',
    tags:['퍼즐','물리'], thumb:'merge', save:'mergeSave' },
  { id:'screw',   file:'screw-game.html',     emoji:'🔩', title:'나사 풀기!',
    desc:'풍선·곰인형·로켓을 나사로 분해하기. 같은 색 3개를 홀더에 모으면 팝!',
    tags:['퍼즐','두뇌'], thumb:'screw', save:'screwNutsSave' },
  { id:'prime',   file:'prime-hunter.html',   emoji:'🚀', title:'프라임 헌터',
    desc:'숫자가 적힌 적기 중 소수만 골라 격추. 끝나면 오답을 소인수분해로 설명합니다.',
    tags:['액션','학습'], thumb:'prime', bestKey:'primeBest' },
  { id:'recycle', file:'recycle-runner.html', emoji:'♻️', title:'쓰담쓰담 러너',
    desc:'달리며 쓰레기를 줍고, 플라스틱·종이·캔·유리 네 통에 나눠 담기.',
    tags:['액션','학습'], thumb:'recycle', bestKey:'recycleBest' },
  { id:'duel',    file:'duel.html',           emoji:'⚔️', title:'맞짱 두뇌대결',
    desc:'한 기기를 반으로 나눠 둘이서 대결. 먼저 O·X를 누르는 쪽이 점수를 가져갑니다.',
    tags:['2인','학습'], thumb:'duel', bestKey:'duelBest' }
];

/* ── 플레이 기록 ─────────────────────────────── */
const PLAYS = 'gamePlays';
function log(id){
  const p = store.read(PLAYS, {});
  const e = p[id] || {count:0, last:0};
  e.count++; e.last = Date.now();
  p[id] = e; store.write(PLAYS, p);
}
function best(id, score){
  const p = store.read(PLAYS, {});
  const e = p[id] || {count:0, last:0};
  if(!(e.best >= score)) e.best = score;
  p[id] = e; store.write(PLAYS, p);
  return e.best;
}
function plays(){ return store.read(PLAYS, {}); }

/* ── 지갑 · 아이템 (머지·나사 공용) ───────────── */
const wallet = {
  get(){ return store.read('gameWallet', {coins:120}); },
  set(w){ store.write('gameWallet', w); }
};
const items = {
  get(){ return store.read('gameItems', {bomb:1,upgrade:1,refill:1,holder:1,undo:1,recolor:1}); },
  set(i){ store.write('gameItems', i); }
};

/* ── 사운드 — 짧은 신호음을 그때그때 만든다 ───── */
function makeSound(){
  let ac = null, on = true;
  function ctx(){
    if(!on) return null;
    try{
      if(!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if(ac.state === 'suspended') ac.resume();
      return ac;
    }catch(e){ return null; }
  }
  const api = {
    get on(){ return on; },
    toggle(){ on = !on; return on; },
    beep(freq, dur, type, vol, slide){
      const a = ctx(); if(!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, a.currentTime);
      if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), a.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur + 0.02);
    },
    chord(list, step, dur, type, vol){
      list.forEach((f,i)=>setTimeout(()=>api.beep(f, dur||0.14, type||'square', vol||0.08), i*(step||80)));
    }
  };
  return api;
}

/* ── 스프라이트 로더 (없으면 벡터로 폴백) ─────── */
function makeSprites(getCtx){
  const cache = {}, ready = [];
  function img(path){
    if(!path) return null;
    if(path in cache) return cache[path];
    const im = new Image();
    im.onload  = ()=>{ im._ok = true; for(const cb of ready) cb(); };
    im.onerror = ()=>{ cache[path] = null; };
    im.src = ((window.GAME_SPRITES||{}).base || 'assets/') + path;
    cache[path] = im; return im;
  }
  return {
    onReady(cb){ ready.push(cb); },
    get(group, key){
      const g = (window.GAME_SPRITES||{})[group];
      const im = img(g && g[key]);
      return im && im._ok ? im : null;
    },
    draw(im, x, y, h){
      const g = getCtx(), w = h*(im.naturalWidth/im.naturalHeight);
      g.drawImage(im, x-w/2, y-h/2, w, h);
    },
    fit(im, w, h){ getCtx().drawImage(im, -w/2, -h/2, w, h); }
  };
}

/* ── PWA — 설치와 오프라인 실행 ───────────────── */
function registerPWA(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol === 'file:') return;      // 파일로 열었을 때는 등록되지 않는다
  addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

window.GB = { store, GAMES, log, best, plays, wallet, items, makeSound, makeSprites, registerPWA };
})();
