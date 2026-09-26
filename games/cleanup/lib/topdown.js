/* 청소게임 탑다운 엔진 — 전 맵 공통 탑다운 뷰 + 진짜 콜리전 + 쓰레기/수거함.
   new TopDown({canvas, onCount}) →
     setMap(key) · startRound(key) · endRound() · addPlayer(id,meta) · removePlayer(id) ·
     setStats(id,stats) · control(id,dx,dy) · act(id,'grab') · score() · players() · positions() ·
     clear() · say(text) · sound(stub)
   좌표: 논리적으로 픽셀. 장애물/스폰은 맵 정의의 정규좌표(0..1)를 매 프레임 픽셀로 변환. */
function TopDown(opts) {
  opts = opts || {};
  var canvas = opts.canvas, g = canvas.getContext('2d');
  var W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  /* ───────── 쓰레기 종류 ───────── */
  var TRASH = {
    cup:   { c: '#ff9f1c', d: function (c, s) { c.fillStyle = '#ff9f1c'; c.beginPath(); c.moveTo(-s*.5, -s*.6); c.lineTo(s*.5, -s*.6); c.lineTo(s*.35, s*.6); c.lineTo(-s*.35, s*.6); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(-s*.5, -s*.6, s, s*.18); } },
    bag:   { c: '#8fd3ff', d: function (c, s) { c.fillStyle = 'rgba(180,220,255,.92)'; c.beginPath(); c.moveTo(-s*.5, -s*.4); c.lineTo(-s*.2, -s*.65); c.lineTo(s*.2, -s*.5); c.lineTo(s*.55, -s*.2); c.lineTo(s*.35, s*.6); c.lineTo(-s*.45, s*.5); c.closePath(); c.fill(); } },
    can:   { c: '#c0c6cc', d: function (c, s) { c.fillStyle = '#c8ced4'; c.fillRect(-s*.35, -s*.6, s*.7, s*1.2); c.fillStyle = '#e63946'; c.fillRect(-s*.35, -s*.15, s*.7, s*.3); c.strokeStyle = '#8a9199'; c.lineWidth = 2; c.strokeRect(-s*.35, -s*.6, s*.7, s*1.2); } },
    bottle:{ c: '#2ec4b6', d: function (c, s) { c.fillStyle = 'rgba(120,220,200,.9)'; c.beginPath(); c.roundRect(-s*.28, -s*.4, s*.56, s*1.0, s*.2); c.fill(); c.fillRect(-s*.14, -s*.7, s*.28, s*.32); c.fillStyle = '#1b9e8f'; c.fillRect(-s*.16, -s*.72, s*.32, s*.1); } },
    leaf:  { c: '#b45309', d: function (c, s) { c.fillStyle = '#c0672a'; c.beginPath(); c.ellipse(0, 0, s*.6, s*.35, 0.6, 0, 6.3); c.fill(); c.strokeStyle = '#7a3d16'; c.lineWidth = 2; c.beginPath(); c.moveTo(-s*.4, -s*.25); c.lineTo(s*.4, s*.25); c.stroke(); } },
    snack: { c: '#ff4fa3', d: function (c, s) { c.fillStyle = '#ff5aa8'; c.beginPath(); c.moveTo(-s*.55, -s*.4); c.lineTo(s*.55, -s*.5); c.lineTo(s*.5, s*.5); c.lineTo(-s*.5, s*.45); c.closePath(); c.fill(); c.fillStyle = '#ffd166'; c.fillRect(-s*.3, -s*.12, s*.6, s*.22); } },
    stick: { c: '#f2c14e', d: function (c, s) { c.strokeStyle = '#d9a441'; c.lineWidth = s*.22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s*.5, s*.5); c.lineTo(s*.3, -s*.4); c.stroke(); c.fillStyle = '#ff7ab6'; c.beginPath(); c.arc(s*.35, -s*.45, s*.34, 0, 6.3); c.fill(); } },
    juice: { c: '#8338ec', d: function (c, s) { c.fillStyle = '#9a5cf0'; c.fillRect(-s*.35, -s*.55, s*.7, s*1.1); c.fillStyle = '#ffd166'; c.fillRect(-s*.2, -s*.5, s*.4, s*.3); c.strokeStyle = '#5f28a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(s*.1, -s*.55); c.lineTo(s*.3, -s*.85); c.stroke(); } }
  };

  /* ───────── 장애물 그리기(정규 크기 r=반지름 픽셀) ───────── */
  var OB = {
    tree: function (c, r) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, r*.5, r*.9, r*.35, 0, 0, 6.3); c.fill();
      c.fillStyle = '#7a4b2a'; c.fillRect(-r*.16, -r*.1, r*.32, r*.8);
      c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(0, -r*.35, r*.95, 0, 6.3); c.fill(); c.fillStyle = '#37b24d'; c.beginPath(); c.arc(-r*.4, -r*.15, r*.55, 0, 6.3); c.arc(r*.45, -r*.2, r*.5, 0, 6.3); c.fill(); },
    palm: function (c, r) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, r*.5, r*.8, r*.3, 0, 0, 6.3); c.fill();
      c.strokeStyle = '#a9763f'; c.lineWidth = r*.28; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, r*.55); c.quadraticCurveTo(r*.2, -r*.1, 0, -r*.5); c.stroke();
      c.fillStyle = '#2f9e44'; for (var i = 0; i < 6; i++) { c.save(); c.translate(0, -r*.5); c.rotate(i/6*6.28); c.beginPath(); c.ellipse(r*.6, 0, r*.6, r*.18, 0, 0, 6.3); c.fill(); c.restore(); } },
    rock: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.4, r*.9, r*.3, 0, 0, 6.3); c.fill();
      c.fillStyle = '#8a9199'; c.beginPath(); c.moveTo(-r*.9, r*.4); c.lineTo(-r*.5, -r*.6); c.lineTo(r*.3, -r*.8); c.lineTo(r*.9, -r*.1); c.lineTo(r*.6, r*.5); c.closePath(); c.fill(); c.fillStyle = '#a7adb4'; c.beginPath(); c.moveTo(-r*.5, -r*.6); c.lineTo(r*.3, -r*.8); c.lineTo(r*.1, -r*.1); c.closePath(); c.fill(); },
    coral: function (c, r) { c.fillStyle = '#ff7ab6'; for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i*r*.4, r*.5); c.lineTo(i*r*.4 - r*.14, -r*.5); c.lineTo(i*r*.4 + r*.14, -r*.5); c.closePath(); c.fill(); c.beginPath(); c.arc(i*r*.4, -r*.5, r*.2, 0, 6.3); c.fill(); } },
    building: function (c, w, h) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-w/2+6, -h/2+8, w, h);
      c.fillStyle = '#5b6b7f'; c.fillRect(-w/2, -h/2, w, h); c.fillStyle = '#48566a'; c.fillRect(-w/2, -h/2, w, h*.16);
      c.fillStyle = '#ffd873'; var cols = Math.max(2, Math.round(w/26)), rows = Math.max(2, Math.round(h/26));
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) { if ((i+j)%3===0) continue; c.fillRect(-w/2 + 10 + i*(w-20)/cols, -h/2 + 14 + j*(h-18)/rows, (w-20)/cols*.55, (h-18)/rows*.5); } },
    wall: function (c, w, h) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-w/2+4, -h/2+5, w, h); c.fillStyle = '#a9865f'; c.fillRect(-w/2, -h/2, w, h);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; for (var y = -h/2+10; y < h/2; y += 12) { c.beginPath(); c.moveTo(-w/2, y); c.lineTo(w/2, y); c.stroke(); } },
    bench: function (c, w, h) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-w/2+3, -h/2+4, w, h); c.fillStyle = '#b5794a'; c.fillRect(-w/2, -h/2, w, h); c.fillStyle = '#8a5a34'; for (var x = -w/2; x < w/2; x += w/4) c.fillRect(x, -h/2, 3, h); },
    bush: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.4, r*.85, r*.3, 0, 0, 6.3); c.fill(); c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(-r*.4, 0, r*.55, 0, 6.3); c.arc(r*.4, 0, r*.55, 0, 6.3); c.arc(0, -r*.3, r*.6, 0, 6.3); c.fill(); },
    pond: function (c, r) { c.fillStyle = '#3aa5d9'; c.beginPath(); c.ellipse(0, 0, r, r*.72, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-r*.3, -r*.2, r*.3, r*.12, 0.4, 0, 6.3); c.fill(); c.strokeStyle = '#2b83ad'; c.lineWidth = 3; c.stroke(); },
    bear: function (c, r) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, r*.5, r*.8, r*.3, 0, 0, 6.3); c.fill(); c.fillStyle = '#6b4226'; c.beginPath(); c.arc(0, 0, r*.85, 0, 6.3); c.fill(); c.beginPath(); c.arc(-r*.55, -r*.6, r*.28, 0, 6.3); c.arc(r*.55, -r*.6, r*.28, 0, 6.3); c.fill(); c.fillStyle = '#3a2415'; c.beginPath(); c.arc(-r*.28, -r*.1, r*.1, 0, 6.3); c.arc(r*.28, -r*.1, r*.1, 0, 6.3); c.arc(0, r*.2, r*.12, 0, 6.3); c.fill(); },
    squirrel: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.5, r*.7, r*.25, 0, 0, 6.3); c.fill(); c.fillStyle = '#c0672a'; c.beginPath(); c.arc(0, 0, r*.6, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(r*.3, r*.3); c.quadraticCurveTo(r*1.1, r*.1, r*.6, -r*.7); c.quadraticCurveTo(r*.5, -r*.1, r*.3, r*.1); c.fill(); c.fillStyle = '#3a2415'; c.beginPath(); c.arc(-r*.2, -r*.1, r*.08, 0, 6.3); c.fill(); }
  };

  /* ───────── 맵 정의 (obstacles: 정규좌표 0..1) ───────── */
  function G_bg(c, w, h, cols) { var grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]); c.fillStyle = grd; c.fillRect(0, 0, w, h); }
  var MAPS = {
    sea: { name: '바다', emoji: '🌊', terrain: 'water', trashKinds: ['cup', 'bag', 'bottle'], trashN: 26,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#2a9dd6', '#0b6ea8']);
        c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 6; for (var y = 40; y < h; y += 60) { c.beginPath(); for (var x = 0; x <= w; x += 30) c.lineTo(x, y + Math.sin((x*0.02) + t*1.5 + y)*6); c.stroke(); } },
      obstacles: [ {kind:'coral', x:.2, y:.28, r:34}, {kind:'coral', x:.74, y:.24, r:30}, {kind:'rock', x:.5, y:.5, r:44}, {kind:'rock', x:.32, y:.72, r:38}, {kind:'coral', x:.82, y:.66, r:34}, {kind:'rock', x:.16, y:.5, r:30} ],
      bins: [ {x:.5, y:.1} ] },
    island: { name: '섬', emoji: '🏝️', terrain: 'sand', trashKinds: ['bottle', 'bag', 'cup'], trashN: 24,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#f6e2a8', '#ecd08a']);
        c.fillStyle = '#3aa5d9'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h*.72); for (var x = 0; x <= w; x += 24) c.lineTo(x, h*.72 + Math.sin(x*0.03 + t*1.8)*7); c.lineTo(w, h); c.closePath(); c.fill(); },
      obstacles: [ {kind:'palm', x:.16, y:.3, r:40}, {kind:'palm', x:.8, y:.26, r:44}, {kind:'palm', x:.62, y:.5, r:38}, {kind:'rock', x:.34, y:.52, r:34}, {kind:'rock', x:.88, y:.6, r:30}, {kind:'palm', x:.26, y:.7, r:40} ],
      bins: [ {x:.5, y:.12} ] },
    forest: { name: '숲', emoji: '🌳', terrain: 'forest', trashKinds: ['leaf', 'snack', 'can'], trashN: 26,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#3f8f4e', '#2d6f3c']);
        c.fillStyle = 'rgba(0,0,0,.06)'; for (var i = 0; i < 40; i++) { var x = (i*79 % w), y = (i*131 % h); c.fillRect(x, y, 8, 3); } },
      obstacles: [ {kind:'tree', x:.18, y:.24, r:40}, {kind:'tree', x:.4, y:.32, r:38}, {kind:'tree', x:.66, y:.22, r:42}, {kind:'tree', x:.84, y:.36, r:40}, {kind:'tree', x:.28, y:.56, r:40}, {kind:'tree', x:.56, y:.54, r:44}, {kind:'tree', x:.78, y:.62, r:40}, {kind:'bear', x:.46, y:.74, r:34}, {kind:'squirrel', x:.2, y:.78, r:22}, {kind:'bush', x:.9, y:.52, r:30} ],
      bins: [ {x:.5, y:.1} ] },
    city: { name: '도시', emoji: '🏙️', terrain: 'city', trashKinds: ['can', 'bag', 'cup'], trashN: 24,
      bg: function (c, w, h, t) { c.fillStyle = '#6b7280'; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([18, 16]); c.lineWidth = 4; c.beginPath(); c.moveTo(0, h*.5); c.lineTo(w, h*.5); c.moveTo(w*.5, 0); c.lineTo(w*.5, h); c.stroke(); c.setLineDash([]); },
      obstacles: [ {kind:'building', x:.16, y:.2, w:.16, h:.2}, {kind:'building', x:.82, y:.2, w:.18, h:.22}, {kind:'building', x:.2, y:.74, w:.2, h:.22}, {kind:'building', x:.8, y:.76, w:.16, h:.2}, {kind:'wall', x:.5, y:.32, w:.24, h:.05}, {kind:'wall', x:.5, y:.68, w:.24, h:.05}, {kind:'bench', x:.5, y:.5, w:.1, h:.05} ],
      bins: [ {x:.5, y:.12} ] },
    park: { name: '공원', emoji: '🌷', terrain: 'park', trashKinds: ['stick', 'juice', 'snack'], trashN: 24,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#7cc85f', '#5fae46']);
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 20; c.beginPath(); c.moveTo(w*.1, h*.9); c.quadraticCurveTo(w*.5, h*.6, w*.9, h*.1); c.stroke(); },
      obstacles: [ {kind:'pond', x:.28, y:.62, r:60}, {kind:'tree', x:.72, y:.3, r:40}, {kind:'tree', x:.86, y:.62, r:38}, {kind:'bench', x:.5, y:.44, w:.1, h:.05}, {kind:'bench', x:.2, y:.28, w:.1, h:.05}, {kind:'bush', x:.62, y:.7, r:30}, {kind:'tree', x:.16, y:.78, r:36} ],
      bins: [ {x:.5, y:.12} ] }
  };

  /* ───────── 상태 ───────── */
  var mapKey = 'forest', players = {}, trash = [], particles = [], texts = [], M = null;
  var t0 = performance.now(), last = t0, banner = null;
  var BASE_SPEED_FRAC = 0.30;                                   // 화면 높이 기준 초당 이동(×speedMul)

  function curMap() { return MAPS[mapKey] || MAPS.forest; }
  function px(o) { return { x: o.x * W, y: o.y * H }; }

  /* 장애물 픽셀 도형 목록 */
  function obstaclePx() {
    return curMap().obstacles.map(function (o) {
      if (o.w != null) return { rect: true, kind: o.kind, x: o.x*W, y: o.y*H, w: o.w*W, h: o.h*H, r: 0 };
      return { rect: false, kind: o.kind, x: o.x*W, y: o.y*H, r: (o.r||30) };
    });
  }
  function hitsObstacle(x, y, r, list) {
    for (var i = 0; i < list.length; i++) { var o = list[i];
      if (o.rect) { var cx = Math.max(o.x - o.w/2, Math.min(x, o.x + o.w/2)), cy = Math.max(o.y - o.h/2, Math.min(y, o.y + o.h/2));
        if ((x-cx)*(x-cx) + (y-cy)*(y-cy) < r*r) return true; }
      else { var d = (x-o.x)*(x-o.x) + (y-o.y)*(y-o.y), rr = (o.r*0.82 + r); if (d < rr*rr) return true; }
    }
    return false;
  }
  function inBounds(x, y, r) { return x > r+4 && x < W-r-4 && y > r+4 && y < H-r-4; }

  /* ───────── 플레이어 ───────── */
  function addPlayer(id, meta) {
    meta = meta || {};
    var p = players[id];
    if (!p) { p = players[id] = { id: id, x: W*(0.2 + Math.random()*0.6), y: H*0.86, dir: 1, hold: null, score: 0, ctrl: null, bob: Math.random()*6 }; }
    p.nick = meta.nick || p.nick || ''; p.seat = meta.seat || p.seat; p.char = meta.char || p.char;
    p.img = meta.img || p.img; p.speedMul = meta.speedMul != null ? meta.speedMul : (p.speedMul || 1);
    if (opts.onCount) opts.onCount(Object.keys(players).length);
    return p;
  }
  function removePlayer(id) { delete players[id]; if (opts.onCount) opts.onCount(Object.keys(players).length); }
  function setStats(id, s) { var p = players[id]; if (p && s) { p.speedMul = s.speedMul != null ? s.speedMul : p.speedMul; p.stats = s; } }
  function control(id, dx, dy) { var p = players[id]; if (!p) return; if (!dx && !dy) { p.ctrl = null; return; } p.ctrl = { dx: dx, dy: dy, until: performance.now() + 600 }; }
  function act(id, a) { var p = players[id]; if (!p) return; if (a === 'grab') grab(p); }

  function grab(p) {
    if (!M || M.ended) return;
    if (p.hold) {                                              // 놓기: 수거함 근처면 점수
      var bins = curMap().bins.map(px), near = false;
      for (var i = 0; i < bins.length; i++) { if (Math.hypot(p.x - bins[i].x, p.y - bins[i].y) < 90) { near = true; break; } }
      if (near) { M.trash = M.trash.filter(function (t) { return t !== p.hold; }); p.score = (p.score||0)+1; M.score[p.id] = p.score;
        say('+1', p.x, p.y - 46, '#b6ff7a'); burst(p.x, p.y - 20, '#ffd166'); p.hold = null;
        if (!M.trash.length) endRound(); }
      else { p.hold.x = p.x; p.hold.y = p.y + 22; p.hold.held = null; p.hold = null; say('여기 아니야!', p.x, p.y - 46, '#ffb3b3'); }
      return;
    }
    var best = null, bd = 64;                                  // 줍기: 가까운 쓰레기
    M.trash.forEach(function (t) { if (t.held) return; var d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } });
    if (best) { best.held = p.id; p.hold = best; say('주웠다!', p.x, p.y - 46, '#fff'); }
  }

  /* ───────── 라운드 ───────── */
  function startRound(key) {
    if (key) mapKey = key;
    var m = curMap(), obs = obstaclePx(), list = [];
    for (var i = 0; i < m.trashN; i++) {
      var x, y, tries = 0;
      do { x = W*(0.06 + Math.random()*0.88); y = H*(0.22 + Math.random()*0.72); tries++; }
      while (tries < 30 && (hitsObstacle(x, y, 20, obs) || y < H*0.2));
      list.push({ x: x, y: y, kind: m.trashKinds[i % m.trashKinds.length], s: 13 + Math.random()*4, rot: Math.random()*6.3, held: null });
    }
    M = { trash: list, score: {}, ended: false };
    Object.keys(players).forEach(function (id) { players[id].hold = null; players[id].score = 0; });
    say(m.emoji + ' ' + m.name + '!', W/2, H*0.5, '#ffd166', 2.2, 40);
  }
  function endRound() { if (M) M.ended = true; }
  function clear() { players = {}; trash = []; M = null; if (opts.onCount) opts.onCount(0); }

  /* ───────── 이펙트 ───────── */
  function burst(x, y, col) { for (var i = 0; i < 10; i++) particles.push({ x: x, y: y, vx: (Math.random()-.5)*180, vy: -40 - Math.random()*160, life: .7, age: 0, s: 4, col: col }); }
  function say(txt, x, y, col, life, size) { texts.push({ txt: txt, x: x, y: y, age: 0, life: life||1.2, col: col||'#fff', size: size||22 }); }

  /* ───────── 업데이트 ───────── */
  function step(dt, now) {
    var obs = obstaclePx(), sp = Math.min(W, H) * BASE_SPEED_FRAC;
    Object.keys(players).forEach(function (id) { var p = players[id];
      if (p.ctrl && now > p.ctrl.until) p.ctrl = null;
      if (p.ctrl) { var dx = p.ctrl.dx, dy = p.ctrl.dy, mag = Math.hypot(dx, dy) || 1; dx /= mag; dy /= mag;
        var s = sp * (p.speedMul || 1) * dt;
        var nx = p.x + dx*s; if (inBounds(nx, p.y, 20) && !hitsObstacle(nx, p.y, 20, obs)) p.x = nx;
        var ny = p.y + dy*s; if (inBounds(p.x, ny, 20) && !hitsObstacle(p.x, ny, 20, obs)) p.y = ny;
        if (dx) p.dir = dx > 0 ? 1 : -1;
        p.moving = true;
      } else p.moving = false;
      if (p.hold) { p.hold.x = p.x - p.dir*10; p.hold.y = p.y + 20; }
    });
    for (var i = particles.length-1; i >= 0; i--) { var q = particles[i]; q.age += dt; if (q.age > q.life) { particles.splice(i,1); continue; } q.vy += 400*dt; q.x += q.vx*dt; q.y += q.vy*dt; }
    for (var j = texts.length-1; j >= 0; j--) { texts[j].age += dt; texts[j].y -= 14*dt; if (texts[j].age > texts[j].life) texts.splice(j,1); }
  }

  /* ───────── 렌더 ───────── */
  function draw(now) {
    var t = (now - t0)/1000, m = curMap();
    m.bg(g, W, H, t);
    // 수거함
    m.bins.map(px).forEach(function (b) {
      g.save(); g.translate(b.x, b.y);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 30, 54, 16, 0, 0, 6.3); g.fill();
      g.fillStyle = '#1f6feb'; g.beginPath(); g.roundRect(-46, -30, 92, 60, 10); g.fill(); g.fillStyle = '#1550b0'; g.fillRect(-52, -40, 104, 12);
      g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('♻', 0, 8);
      g.font = 'bold 16px sans-serif'; g.fillText('여기에 버려요', 0, 52); g.restore();
    });
    // 쓰레기
    if (M) M.trash.forEach(function (tr) { if (tr.held) return; g.save(); g.translate(tr.x, tr.y); g.rotate(tr.rot); (TRASH[tr.kind]||TRASH.cup).d(g, tr.s); g.restore(); });
    // 장애물 (y 정렬로 겹침 자연스럽게)
    var obs = curMap().obstacles.slice().sort(function (a, b) { return a.y - b.y; });
    obs.forEach(function (o) { g.save(); g.translate(o.x*W, o.y*H);
      if (o.w != null) (OB[o.kind]||OB.building)(g, o.w*W, o.h*H); else (OB[o.kind]||OB.rock)(g, o.r||30); g.restore(); });
    // 플레이어 (y 정렬)
    var ps = Object.keys(players).map(function (k){return players[k];}).sort(function (a,b){return a.y-b.y;});
    ps.forEach(function (p) { drawPlayer(p, t); });
    // 들고 있는 쓰레기 (플레이어 위에)
    ps.forEach(function (p) { if (p.hold) { g.save(); g.translate(p.hold.x, p.hold.y); g.rotate(0.2); (TRASH[p.hold.kind]||TRASH.cup).d(g, p.hold.s); g.restore(); } });
    // 파티클/텍스트
    particles.forEach(function (q) { g.globalAlpha = Math.max(0, 1 - q.age/q.life); g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.s, 0, 6.3); g.fill(); }); g.globalAlpha = 1;
    texts.forEach(function (tx) { g.globalAlpha = Math.max(0, 1 - tx.age/tx.life); g.fillStyle = tx.col; g.font = 'bold ' + tx.size + 'px -apple-system,sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(tx.txt, tx.x, tx.y); g.fillText(tx.txt, tx.x, tx.y); }); g.globalAlpha = 1;
  }
  function drawPlayer(p, t) {
    var bob = Math.sin(t*8 + p.bob) * (p.moving ? 4 : 1.5), R = 34;
    g.save(); g.translate(p.x, p.y);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, R*0.8, R*0.7, R*0.24, 0, 0, 6.3); g.fill();
    g.translate(0, bob);
    if (p.img) { var iw = p.img.width, ih = p.img.height, s = (R*2.2)/Math.max(iw, ih); g.save(); if (p.dir < 0) g.scale(-1, 1); g.drawImage(p.img, -iw*s/2, -ih*s/2 - 4, iw*s, ih*s); g.restore(); }
    else { g.fillStyle = '#ff7ab6'; g.beginPath(); g.arc(0, 0, R*0.7, 0, 6.3); g.fill(); }
    g.restore();
    // 이름표
    g.save(); g.translate(p.x, p.y - R*1.15);
    var label = (p.seat ? p.seat + '번 ' : '') + (p.nick || '');
    g.font = 'bold 15px -apple-system,sans-serif'; g.textAlign = 'center';
    var tw = g.measureText(label).width + 14; g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(-tw/2, -16, tw, 20, 6); g.fill();
    g.fillStyle = '#fff'; g.fillText(label, 0, -1); g.restore();
  }

  /* ───────── 루프 ───────── */
  function frame(now) { var dt = Math.min(0.05, (now - last)/1000); last = now; step(dt, now); draw(now); requestAnimationFrame(frame); }
  resize(); requestAnimationFrame(frame);

  return {
    setMap: function (k) { mapKey = k; }, startRound: startRound, endRound: endRound,
    addPlayer: addPlayer, removePlayer: removePlayer, setStats: setStats,
    control: control, act: act, grab: function (id) { act(id, 'grab'); },
    score: function () { return M ? M.score : {}; }, mission: function () { return M ? { ended: M.ended, left: M.trash.length } : null; },
    players: function () { return players; }, map: function () { return mapKey; },
    positions: function () { var o = {}; Object.keys(players).forEach(function (id){ var p = players[id]; o[id] = { x:+(p.x/W).toFixed(3), y:+(p.y/H).toFixed(3), seat:p.seat, nick:p.nick }; }); return o; },
    clear: clear, say: function (txt, col) { say(txt, W/2, H*0.2, col || '#ffd166', 2, 34); },
    sound: { enable: function () {}, on: false },
    MAPS: MAPS
  };
}
