/* Firebase 릴레이 — GameRT 와 동일한 인터페이스(connect/on/toScreen/toPhones/toSeat)를
   Firebase Realtime Database 로 구현. 정적 호스팅(jejugrapher.com)에서도 폰↔화면 연결.
   방코드로 격리: room/cg/<CODE>/...  (스케치무대와 같은 프로젝트 재사용)
   경로: players/<id>{seat,nick,char,equip,img} · ctrl/<id>{dx,dy} · act/<id>{act,n} · game{phase,map} · score{} · me/<id>{} */
(function (global) {
  var FB = {
    apiKey: "AIzaSyCaCTx8NmsDvI7SOz5R8sgXABCr2-ySnB0",
    authDomain: "ai-class-sketrch.firebaseapp.com",
    databaseURL: "https://ai-class-sketrch-default-rtdb.firebaseio.com",
    projectId: "ai-class-sketrch",
    storageBucket: "ai-class-sketrch.firebasestorage.app",
    messagingSenderId: "648614543804",
    appId: "1:648614543804:web:7a64e55ad22b9debb2abb9"
  };
  var db = null, base = null, room = '', role = 'phone', seat = '', myId = '';
  var listeners = [], actN = {}, lastAct = {}, seenJoin = {}, seenImg = {};
  var readyRes, ready = new Promise(function (r) { readyRes = r; });

  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function emit(m) { listeners.forEach(function (fn) { try { fn(m); } catch (e) {} }); }
  function TS() { return firebase.database.ServerValue.TIMESTAMP; }
  function roomFromURL() { var m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search); return m ? m[1].toUpperCase() : ''; }
  function genRoom() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = ''; for (var i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }

  function connect(r, s, onMsg) {
    role = r; seat = (s == null ? '' : String(s));
    myId = (r === 'phone') ? (seat || ('c' + Date.now() + Math.floor(Math.random() * 1000))) : 'screen';   // phone: s=클라이언트ID(cid)
    if (onMsg) listeners.push(onMsg);
    init();
    return GameRT;
  }
  function on(fn) { listeners.push(fn); return GameRT; }

  function init() {
    room = roomFromURL() || (role === 'screen' ? genRoom() : (global.CG_ROOM || ''));
    loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
      .then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(FB);
        db = firebase.database(); base = db.ref('cg/' + room);
        if (role === 'screen') listenScreen(); else listenPhone();
        readyRes(room);
      })
      .catch(function (e) { console.warn('firebase 연결 실패', e); readyRes(''); });
  }

  function listenScreen() {
    base.child('players').on('child_added', playerCb);
    base.child('players').on('child_changed', playerCb);
    base.child('ctrl').on('child_added', ctrlCb);
    base.child('ctrl').on('child_changed', ctrlCb);
    base.child('act').on('child_added', actCb);
    base.child('act').on('child_changed', actCb);
  }
  function playerCb(s) {
    var id = s.key, v = s.val(); if (!v) return;
    if (!seenJoin[id]) { seenJoin[id] = 1; emit({ type: 'join', id: id, seat: v.seat, nick: v.nick }); }
    if (v.img && seenImg[id] !== v.ts) { seenImg[id] = v.ts; emit({ type: 'creature', id: id, seat: v.seat, nick: v.nick, char: v.char, equip: v.equip, transparent: true, dataUrl: v.img }); }
  }
  function ctrlCb(s) { var v = s.val(); if (v) emit({ type: 'ctrl', id: s.key, dx: v.dx || 0, dy: v.dy || 0 }); }
  function actCb(s) { var v = s.val(); if (v && v.n !== lastAct[s.key]) { lastAct[s.key] = v.n; emit({ type: 'ctrl', id: s.key, act: v.act }); } }

  function listenPhone() {
    base.child('game').on('value', function (s) { var v = s.val() || {}; emit({ type: 'phase', phase: v.phase || 'lobby', map: v.map }); });
    base.child('score').on('value', function (s) { emit({ type: 'score', score: s.val() || {} }); });
    base.child('me/' + myId).on('value', function (s) { var v = s.val(); if (v) { v.type = 'me'; v.id = myId; emit(v); } });
  }

  /* 통합 라우터: to = 'screen' | 'phones' | 'seat' */
  function send(to, msg, s2) {
    if (!db || !msg) return Promise.resolve(null);
    var t = msg.type;
    if (t === 'state' || t === 'noop') return Promise.resolve(null);   // Firebase 에선 불필요
    if (to === 'screen') {
      if (t === 'join') base.child('players/' + msg.id).update({ seat: msg.seat, nick: msg.nick, ts: TS() });
      else if (t === 'creature') base.child('players/' + msg.id).update({ seat: msg.seat, nick: msg.nick, char: msg.char, equip: msg.equip || null, img: msg.dataUrl, ts: TS() });
      else if (t === 'ctrl') {
        if (msg.act) base.child('act/' + msg.id).set({ act: msg.act, n: (actN[msg.id] = (actN[msg.id] || 0) + 1), ts: TS() });
        else base.child('ctrl/' + msg.id).set({ dx: msg.dx || 0, dy: msg.dy || 0 });
      }
    } else if (to === 'phones') {
      if (t === 'phase') base.child('game').update({ phase: msg.phase, map: msg.map || null, ts: TS() });
      else if (t === 'score') base.child('score').set(msg.score || {});
      else if (t === 'me' && msg.id) { var o = {}; Object.keys(msg).forEach(function (k) { if (k !== 'type') o[k] = msg[k]; }); base.child('me/' + msg.id).set(o); }
    } else if (to === 'seat') {
      if (msg.id) { var oo = {}; Object.keys(msg).forEach(function (k) { if (k !== 'type') oo[k] = msg[k]; }); base.child('me/' + msg.id).set(oo); }
    }
    return Promise.resolve({ ok: true });
  }

  /* ── 영구 저장/조회 헬퍼 (ready 이후 base 기준 상대경로) ── */
  function dbGet(p) { return ready.then(function () { return base.child(p).get().then(function (s) { return s.exists() ? s.val() : null; }); }); }
  function dbSet(p, v) { return ready.then(function () { return base.child(p).set(v); }); }
  function dbUpdate(p, v) { return ready.then(function () { return base.child(p).update(v); }); }
  function dbTx(p, fn) { return ready.then(function () { return base.child(p).transaction(fn).then(function (r) { return { committed: r.committed, value: r.snapshot.val() }; }); }); }
  function onValue(p, cb) { ready.then(function () { base.child(p).on('value', function (s) { cb(s.val()); }); }); }

  /* 접속 순서 번호 배정 (한 번만, cid 로 기억) */
  function claimSeat() {
    return dbGet('registry/' + myId).then(function (reg) {
      if (reg && reg.seat) return reg.seat;
      return dbTx('seq', function (n) { return (n || 0) + 1; }).then(function (r) { return r.value; });
    });
  }
  /* 별명 중복 방지: nicks/<key> 를 내 cid 로만 선점 가능 */
  function claimNick(nick) {
    var key = String(nick).trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_');
    if (!key) return Promise.resolve({ ok: false, reason: 'empty' });
    return dbTx('nicks/' + key, function (cur) {
      if (cur && cur !== myId) return;              // 다른 사람이 이미 씀 → 트랜잭션 취소
      return myId;
    }).then(function (r) { return { ok: !!r.committed, reason: r.committed ? '' : 'taken' }; });
  }

  var GameRT = {
    connect: connect, on: on, send: send,
    toScreen: function (msg) { return send('screen', msg); },
    toPhones: function (msg) { return send('phones', msg); },
    toSeat: function (seatN, msg) { return send('seat', msg); },
    state: function () { return Promise.resolve(null); },
    role: function () { return role; }, seat: function () { return seat; },
    room: function () { return room; }, ready: ready, mode: function () { return 'firebase'; },
    id: function () { return myId; },
    dbGet: dbGet, dbSet: dbSet, dbUpdate: dbUpdate, dbTx: dbTx, onValue: onValue,
    claimSeat: claimSeat, claimNick: claimNick
  };
  global.GameRT = GameRT;
})(window);
