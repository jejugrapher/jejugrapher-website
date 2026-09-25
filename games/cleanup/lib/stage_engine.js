/* 스케치 무대 엔진 — 프로젝터 페이지와 아이의 '내 무대'가 같이 쓴다.
   new StageEngine({canvas, soundBase, onCount, onWorld}) */
function StageEngine(opts) {
  opts = opts || {};

/* ═══════════════ 흰 배경 오려내기 ═══════════════ */
function cutoutPaper(img, maxSide) {
  maxSide = maxSide || 512;
  var s = Math.min(1, maxSide / Math.max(img.width, img.height));
  var w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  var ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  var id = ctx.getImageData(0, 0, w, h), d = id.data;
  var br = [], bg = [], bb = [];
  function push(i) { br.push(d[i]); bg.push(d[i+1]); bb.push(d[i+2]); }
  for (var x = 0; x < w; x++) { push(x*4); push(((h-1)*w + x)*4); }
  for (var y = 0; y < h; y++) { push((y*w)*4); push((y*w + w-1)*4); }
  function med(a) { a.sort(function(p,q){return p-q;}); return a[a.length>>1]; }
  var paperLum = 0.299*med(br) + 0.587*med(bg) + 0.114*med(bb);
  var lumMin = Math.max(110, paperLum * 0.6);
  var isPaper = new Uint8Array(w*h);
  for (var i = 0, p = 0; i < d.length; i += 4, p++) {
    var r = d[i], g = d[i+1], b = d[i+2];
    var lum = 0.299*r + 0.587*g + 0.114*b, sat = Math.max(r,g,b) - Math.min(r,g,b);
    isPaper[p] = (lum > lumMin && sat < 55) ? 1 : 0;
  }
  var out = new Uint8Array(w*h), stack = [];
  function seed(p) { if (isPaper[p] && !out[p]) { out[p] = 1; stack.push(p); } }
  for (var x2 = 0; x2 < w; x2++) { seed(x2); seed((h-1)*w + x2); }
  for (var y2 = 0; y2 < h; y2++) { seed(y2*w); seed(y2*w + w-1); }
  while (stack.length) {
    var q = stack.pop(), qx = q % w, qy = (q - qx) / w;
    if (qx > 0) seed(q-1); if (qx < w-1) seed(q+1);
    if (qy > 0) seed(q-w); if (qy < h-1) seed(q+w);
  }
  var minx = w, miny = h, maxx = -1, maxy = -1;
  for (var p2 = 0; p2 < w*h; p2++) {
    if (out[p2]) { d[p2*4+3] = 0; continue; }
    var px = p2 % w, py = (p2 - px) / w;
    var edge = (px>0 && out[p2-1]) || (px<w-1 && out[p2+1]) || (py>0 && out[p2-w]) || (py<h-1 && out[p2+w]);
    if (edge) d[p2*4+3] = 140;
    if (px < minx) minx = px; if (px > maxx) maxx = px;
    if (py < miny) miny = py; if (py > maxy) maxy = py;
  }
  if (maxx < 0) return null;
  ctx.putImageData(id, 0, 0);
  var pad = 2, cw = maxx-minx+1+pad*2, ch = maxy-miny+1+pad*2;
  var o = document.createElement('canvas'); o.width = cw; o.height = ch;
  o.getContext('2d').drawImage(cv, minx-pad, miny-pad, cw, ch, 0, 0, cw, ch);
  o.ox = minx - pad; o.oy = miny - pad; o.s = s; o.srcW = img.width; o.srcH = img.height;   // 잘라낸 위치·배율 (리그 좌표 변환용)
  return o;
}

/* ═══════════════ 공간과 규칙 ═══════════════
   band: 화면 높이 비율. 각 공간에서 "어디가 하늘·수면·물속·바닥"인지.
   rule: 카테고리 → 움직임. 밤의 박물관은 규칙을 쓰지 않는다.
   움직임: swim 헤엄 · crawl 기어다님 · paddle 수면에서 둥둥 · fly 날기 ·
           walk 걷기 · float 수면에 떠감 · sink 가라앉아 바닥에 누움 · drift 아무 데나 둥실 */
var WORLDS = {
  sea: {
    name: '제주 바다',
    band: { surface: 0.07, swim: [0.15, 0.78], bottom: 0.87 },
    rule: { art: 'paddle', fish: 'swim', whale: 'swim', shark: 'swim', sub: 'swim', clam: 'clam', crawler: 'crawl', bird: 'paddle', person: 'swim', animal: 'paddle',
            boat: 'float', vehicle: 'sink', aircraft: 'sink', light: 'paddle', heavy: 'sink' },
    draw: drawSea
  },
  village: {
    name: '옛 포구 마을',
    band: { sky: [0.08, 0.4], surface: 0.525, swim: [0.56, 0.72], bottom: 0.87, plane: [0.54, 0.68] },   // plane: 비스듬히 본 수면 띠 → 배가 위아래로도 다닌다
    /* 마을: 일반 물고기는 물속이라 보이지 않고 물결만. 고래는 뛰어오르고, 상어는 지느러미만 보인다 */
    rule: { art: 'fly', fish: 'hidden', whale: 'breach', shark: 'fin', sub: 'hidden', clam: 'hidden', crawler: 'crawl', bird: 'fly', person: 'person', animal: 'walk',
            boat: 'float', vehicle: 'walk', aircraft: 'fly', light: 'fly', heavy: 'walk' },
    draw: drawVillage
  },
  forest: {
    name: '제주 숲',
    band: { sky: [0.06, 0.42], bottom: 0.86, swim: [0.6, 0.8], surface: 0.6 },
    rule: { art: 'fly', fish: 'crawl', whale: 'crawl', shark: 'crawl', sub: 'crawl', clam: 'crawl', crawler: 'crawl', bird: 'fly', person: 'walk', animal: 'walk',
            boat: 'walk', vehicle: 'walk', aircraft: 'fly', light: 'fly', heavy: 'walk' },
    draw: drawForest
  },
  night: {
    name: '마법의 밤',
    band: { swim: [0.14, 0.72], bottom: 0.85 },
    rule: null,                                   // 규칙 없음: 모두 함께 둥실
    draw: drawNight
  }
};
var world = 'sea', worldFade = 0, nextWorld = null;
var CUSTOM = {};                                   // 아이가 만든 배경: id → {name, img, band, rule(null=규칙없음), draw}
function cur(name) { return WORLDS[name || world] || CUSTOM[name || world] || WORLDS.sea; }
/* 아이 배경 등록. band는 화면 비율 {sky:[a,b], surface:y, swim:[a,b], bottom:y} 중 있는 것만.
   kind: 'water'(물속) | 'landsky'(땅과 하늘) | 'all'(물·땅·하늘) | 'free'(규칙 없음) */
function kindToRule(kind) {
  if (kind === 'free') return null;
  if (kind === 'water') return WORLDS.sea.rule;
  return WORLDS.village.rule;                      // landsky, all: 마을 규칙(물고기는 물속, 새는 하늘)
}
function defineWorld(id, def) {
  var img = def.img, band = def.band || {};
  if (def.kind === 'water') { band.surface = band.surface !== undefined ? band.surface : 0.06; band.swim = band.swim || [band.surface + 0.08, (band.bottom || 0.88) - 0.08]; band.bottom = band.bottom || 0.88; }
  else if (def.kind === 'landsky') { band.sky = band.sky || [0.05, (band.bottom || 0.85) - 0.35]; band.bottom = band.bottom || 0.85; band.swim = band.swim || [band.bottom - 0.3, band.bottom - 0.05]; band.surface = band.surface !== undefined ? band.surface : band.bottom - 0.3; }
  else if (def.kind === 'all') { band.sky = band.sky || [0.05, (band.surface || 0.5) - 0.05]; band.surface = band.surface !== undefined ? band.surface : 0.5; band.bottom = band.bottom || 0.86; band.swim = band.swim || [band.surface + 0.04, band.bottom - 0.06]; band.plane = [band.surface + 0.02, band.bottom - 0.04]; }
  else { band.swim = band.swim || [0.12, 0.75]; band.bottom = band.bottom || 0.86; }
  CUSTOM[id] = { name: def.name || '내 무대', kind: def.kind, band: band, rule: kindToRule(def.kind), img: img, desc: def.desc || '',
    draw: function (t) {
      if (img && img.width) {
        var s = Math.max(W/img.width, H/img.height), dw = img.width*s, dh = img.height*s;   // 꽉 채우기(비율 유지)
        g.drawImage(img, (W-dw)/2, (H-dh)/2, dw, dh);
      } else { g.fillStyle = '#223'; g.fillRect(0, 0, W, H); }
      if (def.kind === 'water' || def.kind === 'all') {                 // 수면 표시선
        g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath();
        for (var x = 0; x <= W; x += 16) g.lineTo(x, H*band.surface + Math.sin(x*0.02 + t*1.5)*4); g.stroke();
      }
    } };
  return CUSTOM[id];
}

/* 아이가 쓴 설명 → 능력. 설명이 있으면 카테고리 규칙보다 우선한다.
   지금은 낱말로 판정하고, 서버가 붙으면 AI가 그림+설명을 읽어 같은 형식({fly,swim,surface,sink,ground,jump})으로 준다 */
function parseAbilities(text) {
  if (!text) return null;
  var t = String(text).replace(/\s+/g, '');
  var a = { fly: /날아|날으|나는|비행|하늘/.test(t), swim: /헤엄|물속|잠수|수영|바닷속/.test(t),
            surface: /물위|떠다|떠서|둥둥|수면/.test(t), sink: /가라앉|잠긴|바닥에눕/.test(t),
            ground: /걸어|기어|달리|뛰어다|땅/.test(t), jump: /뛰어오|뛰어올|점프|튀어오/.test(t) };
  return (a.fly || a.swim || a.surface || a.sink || a.ground || a.jump) ? a : null;
}
/* 설명으로 정한 능력 → 공간별 움직임 */
function motionFromAbilities(a, wname) {
  var wd = cur(wname), waterOnly = (wd === WORLDS.sea) || wd.kind === 'water';
  if (waterOnly) {
    if (a.sink) return 'sink';
    if (a.jump) return 'breach';               // 물 위로 뛰어오른다 → 바다에서도 점프
    if (a.swim || a.fly) return 'swim';        // 물속을 날아다니는 자동차 = 물속에서 자유롭게
    if (a.surface) return 'paddle';
    if (a.ground) return 'crawl';
  } else {
    if (a.fly) return 'fly';
    if (a.jump) return 'breach';
    if (a.swim) return 'hidden';
    if (a.surface) return 'float';
    if (a.ground || a.sink) return 'walk';
  }
  return null;
}
/* 카테고리와 공간으로 움직임을 정한다 */
function motionFor(sp, wname) {
  var wd = cur(wname);
  if (wd.rule && sp.abil) { var am = motionFromAbilities(sp.abil, wname); if (am) return am; }
  if (!wd.rule) return (sp.cat === 'fish' || sp.cat === 'whale' || sp.cat === 'shark' || sp.cat === 'sub') ? 'swim' : sp.cat === 'clam' ? 'clam' : 'drift';
  var m = wd.rule[sp.cat] || 'sink';
  if (m === 'person') {                         // 마을의 사람: 걷기 / 헤엄 / 배 타기
    var boats = sprites.filter(function (o) { return o !== sp && o.motion === 'float'; });
    var r = Math.random();
    if (boats.length && r < 0.35) { sp.ride = boats[Math.floor(Math.random()*boats.length)]; return 'ride'; }
    return r < 0.65 ? 'walk' : 'swim';
  }
  return m;
}
/* 그 움직임의 기본 높이 */
function homeY(sp, motion) {
  var b = cur().band, hh = sp.h*sp.depth/2;
  switch (motion) {
    case 'swim':
    case 'hidden':
    case 'breach': return H*(b.swim[0] + Math.random()*(b.swim[1]-b.swim[0]));
    case 'clam':   return H*b.bottom - hh - H*(0.03 + Math.random()*0.15);
    case 'fin':    return H*b.surface + sp.h*sp.depth*0.28;      // 윗부분 28%만 물 밖으로
    case 'crawl':
    case 'walk':
    case 'sink':   return H*b.bottom - hh;
    case 'paddle':
    case 'float':  return b.plane ? H*(b.plane[0] + Math.random()*(b.plane[1]-b.plane[0])) : H*b.surface;
    case 'fly':    return H*((b.sky||b.swim)[0] + Math.random()*((b.sky||b.swim)[1]-(b.sky||b.swim)[0]));
    case 'drift':  return H*(b.swim[0] + Math.random()*(b.swim[1]-b.swim[0]));
    default:       return H*0.5;
  }
}
/* 공간이 바뀌거나 새로 들어올 때: 움직임을 다시 정하고 전환(가라앉기·떠오르기)을 시작 */
function applyRules(sp, entering) {
  var m = motionFor(sp, world);
  var prev = sp.motion; sp.motion = m; sp.ride = m === 'ride' ? sp.ride : null;
  sp.ty = homeY(sp, m);
  sp.vy = 0; sp.rot = 0; sp.settled = false;
  if (m === 'sink' && !entering) { sp.vy = 20; sp.rot = 0; sp.x = Math.max(W*0.1, Math.min(W*0.9, sp.x)); }   // 그 자리에서 가라앉기 시작
  if (m === 'sink' && entering) { sp.y = H*0.2; sp.vy = 0; sp.x = W*(0.15 + Math.random()*0.7); spawnSplash(sp.x, H*cur().band.surface); }   // 새로 오면 화면 안 위쪽에서 떨어진다
  if (m === 'paddle' && !entering && prev !== 'paddle') sp.rising = true; // 수면으로 떠오르기
  if (m === 'paddle' && entering) sp.y = sp.ty;
  if ((m === 'walk' || m === 'crawl' || m === 'fly' || m === 'float' || m === 'swim' || m === 'drift' || m === 'hidden' || m === 'breach' || m === 'fin' || m === 'clam') && entering) sp.y = sp.ty;
  delete sp.jumpT; delete sp.breachT;
  if (prev && prev !== m && !entering && m !== 'sink' && m !== 'paddle') { /* 나머지는 부드럽게 이동 */ }
}

/* ═══════════════ 캔버스 ═══════════════ */
var canvas = opts.canvas, g = canvas.getContext('2d');
var W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
  canvas.width = W*DPR; canvas.height = H*DPR;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

var sprites = [], particles = [], texts = [], t0 = performance.now(), seq = 0;
var bubbles = [], weeds = [], dust = [], stars = [];
for (var sk = 0; sk < 90; sk++) stars.push({ x: Math.random(), y: Math.random()*0.6, r: Math.random()*1.4 + 0.4, ph: Math.random()*6 });
for (var i = 0; i < 14; i++) weeds.push({ x: Math.random(), h: 70 + Math.random()*120, ph: Math.random()*6, w: 9 + Math.random()*12 });
for (var j = 0; j < 40; j++) bubbles.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random()*5, v: 0.02 + Math.random()*0.04, ph: Math.random()*6 });
for (var m = 0; m < 60; m++) dust.push({ x: Math.random(), y: Math.random(), ph: Math.random()*6 });

/* ─── 제주 바다 ─── */
function drawSea(t) {
  var b = WORLDS.sea.band;
  var grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#1b7fc4'); grd.addColorStop(0.5, '#0b4a8f'); grd.addColorStop(1, '#031a3d');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // 하늘 띠 + 수면
  g.fillStyle = '#bfe6ff'; g.fillRect(0, 0, W, H*b.surface);
  g.fillStyle = '#1b7fc4';
  g.beginPath(); g.moveTo(0, H);
  for (var x = 0; x <= W; x += 16) g.lineTo(x, H*b.surface + Math.sin(x*0.02 + t*1.5)*5 + Math.sin(x*0.05 - t)*3);
  g.lineTo(W, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2;
  g.beginPath(); for (var x3 = 0; x3 <= W; x3 += 16) g.lineTo(x3, H*b.surface + Math.sin(x3*0.02 + t*1.5)*5 + Math.sin(x3*0.05 - t)*3); g.stroke();
  // 빛줄기
  g.save(); g.globalCompositeOperation = 'lighter';
  for (var r = 0; r < 6; r++) {
    var bx = W*(0.1 + r*0.16) + Math.sin(t*0.3 + r)*60;
    var lg = g.createLinearGradient(0, H*b.surface, 0, H*0.9);
    lg.addColorStop(0, 'rgba(180,230,255,0.18)'); lg.addColorStop(1, 'rgba(180,230,255,0)');
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(bx-30, H*b.surface); g.lineTo(bx+30, H*b.surface); g.lineTo(bx+160, H*0.9); g.lineTo(bx-80, H*0.9); g.closePath(); g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(10,25,50,.7)';
  g.beginPath(); g.moveTo(0, H*0.9); g.quadraticCurveTo(W*0.08, H*0.7, W*0.18, H*0.9); g.fill();
  g.beginPath(); g.moveTo(W*0.78, H*0.9); g.quadraticCurveTo(W*0.9, H*0.66, W*1.02, H*0.9); g.fill();
  g.fillStyle = '#c9b27a'; g.beginPath(); g.moveTo(0, H);
  for (var sx = 0; sx <= W; sx += 40) g.lineTo(sx, H*b.bottom - Math.sin(sx*0.01 + 1)*6);
  g.lineTo(W, H); g.closePath(); g.fill();
  weeds.forEach(function (wd) {
    var x = wd.x*W, segs = 8;
    g.strokeStyle = 'rgba(40,160,90,.85)'; g.lineWidth = wd.w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, H*b.bottom);
    for (var s = 1; s <= segs; s++) { var f = s/segs; g.lineTo(x + Math.sin(t*1.2 + wd.ph + f*2.5)*18*f, H*b.bottom - wd.h*f); }
    g.stroke();
  });
  bubbles.forEach(function (bb) {
    bb.y -= bb.v/60; bb.x += Math.sin(t*2 + bb.ph)*0.0004;
    if (bb.y < b.surface) { bb.y = 1.05; bb.x = Math.random(); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(bb.x*W, bb.y*H, bb.r, 0, 6.3); g.stroke();
  });
}

/* ─── 옛 포구 마을 ─── */
function drawVillage(t) {
  var b = WORLDS.village.band;
  var sky = g.createLinearGradient(0, 0, 0, H*0.5);
  sky.addColorStop(0, '#f7b267'); sky.addColorStop(0.6, '#f9d8a6'); sky.addColorStop(1, '#fde9c9');
  g.fillStyle = sky; g.fillRect(0, 0, W, H*0.52);
  g.fillStyle = '#ffd166'; g.beginPath(); g.arc(W*0.8, H*0.2, 46, 0, 6.3); g.fill();
  g.fillStyle = '#b08a6a';
  g.beginPath(); g.moveTo(0, H*0.52); g.quadraticCurveTo(W*0.25, H*0.25, W*0.55, H*0.52); g.fill();
  var sea = g.createLinearGradient(0, H*b.surface, 0, H*0.78);
  sea.addColorStop(0, '#6fb7d6'); sea.addColorStop(1, '#2b7fb0');
  g.fillStyle = sea; g.fillRect(0, H*b.surface, W, H*(0.78 - b.surface));
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2;
  for (var row = 0; row < 6; row++) {
    var y = H*(b.surface + 0.02 + row*0.04);
    g.beginPath(); for (var x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x*0.03 + t*1.2 + row)*3); g.stroke();
  }
  for (var bi = 0; bi < 3; bi++) {
    var bx = ((t*8 + bi*W*0.37) % (W + 120)) - 60, by = H*(b.surface + 0.02) + bi*H*0.012;
    g.fillStyle = '#5a3b2a'; g.fillRect(bx-18, by, 36, 6);
    g.fillStyle = '#fdf6e3'; g.beginPath(); g.moveTo(bx-2, by); g.lineTo(bx-2, by-28); g.lineTo(bx+16, by); g.closePath(); g.fill();
  }
  g.fillStyle = '#e3cfa0'; g.fillRect(0, H*0.78, W, H*0.22);
  g.fillStyle = '#d2b77f'; g.beginPath(); g.moveTo(0, H*0.92); g.quadraticCurveTo(W*0.5, H*0.86, W, H*0.93); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  for (var hi = 0; hi < 4; hi++) {
    var hx = W*(0.08 + hi*0.27), hy = H*0.78, hw = 120, hh = 46;
    g.fillStyle = '#e8d7b5'; g.fillRect(hx, hy-hh, hw, hh);
    g.fillStyle = '#b88b4a'; g.beginPath(); g.moveTo(hx-12, hy-hh); g.quadraticCurveTo(hx+hw/2, hy-hh-60, hx+hw+12, hy-hh); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (var rr = 0; rr < 4; rr++) { g.beginPath(); g.moveTo(hx+10+rr*30, hy-hh-2); g.lineTo(hx+hw/2, hy-hh-55); g.stroke(); }
    g.fillStyle = '#6b4a2b'; g.fillRect(hx+hw/2-14, hy-30, 28, 30);
  }
  for (var sx = -20; sx < W + 40; sx += 44) for (var sy = 0; sy < 3; sy++) {
    g.fillStyle = sy % 2 ? '#555a5e' : '#3f4447';
    g.beginPath(); g.ellipse(sx + (sy%2)*22, H*0.78 + 10 - sy*14, 22, 9, 0, 0, 6.3); g.fill();
  }
  g.strokeStyle = '#6b4a2b'; g.lineWidth = 2;
  for (var gi = 0; gi < 4; gi++) {
    var gx = ((t*30 + gi*W*0.3) % (W + 80)) - 40, gy = H*(0.12 + gi*0.06) + Math.sin(t*2 + gi)*6;
    g.beginPath(); g.moveTo(gx-12, gy); g.quadraticCurveTo(gx-6, gy-7, gx, gy); g.quadraticCurveTo(gx+6, gy-7, gx+12, gy); g.stroke();
  }
}

/* ─── 제주 숲: 오름·나무·길 ─── */
var trees = []; for (var ti = 0; ti < 16; ti++) trees.push({ x: Math.random(), h: 0.18 + Math.random()*0.2, w: 0.05 + Math.random()*0.05, hue: 95 + Math.random()*40, ph: Math.random()*6, round: Math.random() < 0.5 });
function drawForest(t) {
  var b = WORLDS.forest.band;
  var sky = g.createLinearGradient(0, 0, 0, H*0.6); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#e8f6ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(W*0.15, H*0.14, 40, 0, 6.3); g.fill();
  g.fillStyle = '#7fb069'; g.beginPath(); g.moveTo(0, H*0.62); g.quadraticCurveTo(W*0.2, H*0.3, W*0.45, H*0.62); g.fill();          // 오름
  g.fillStyle = '#6a9c55'; g.beginPath(); g.moveTo(W*0.35, H*0.62); g.quadraticCurveTo(W*0.65, H*0.36, W*1.0, H*0.62); g.fill();
  g.fillStyle = '#4f8a3c'; g.fillRect(0, H*0.6, W, H*0.4);
  trees.forEach(function (tr) {                                                                    // 나무
    var x = tr.x*W, base = H*(0.64 + (tr.x*7 % 1)*0.2), h = tr.h*H, w = tr.w*W, sway = Math.sin(t*0.8 + tr.ph)*4;
    g.fillStyle = '#5a3b2a'; g.fillRect(x - w*0.08, base - h*0.35, w*0.16, h*0.35);
    g.fillStyle = 'hsl(' + tr.hue + ',45%,' + (30 + (tr.x*13 % 1)*12) + '%)';
    if (tr.round) { g.beginPath(); g.ellipse(x + sway, base - h*0.6, w*0.6, h*0.42, 0, 0, 6.3); g.fill(); }
    else { g.beginPath(); g.moveTo(x - w*0.6, base - h*0.3); g.lineTo(x + sway, base - h); g.lineTo(x + w*0.6, base - h*0.3); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - w*0.45, base - h*0.55); g.lineTo(x + sway, base - h*1.05); g.lineTo(x + w*0.45, base - h*0.55); g.closePath(); g.fill(); }
  });
  g.fillStyle = '#c9a66b'; g.beginPath(); g.moveTo(0, H*b.bottom + 10);                             // 흙길
  for (var x = 0; x <= W; x += 40) g.lineTo(x, H*b.bottom + 10 - Math.sin(x*0.01)*6);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = '#3f7a2e'; for (var gx = 0; gx < W; gx += 28) { g.beginPath(); g.moveTo(gx, H*b.bottom + 12); g.lineTo(gx + 6, H*b.bottom - 10 - (gx*3 % 9)); g.lineTo(gx + 12, H*b.bottom + 12); g.fill(); }   // 풀
  for (var bi = 0; bi < 3; bi++) { var bx = ((t*25 + bi*W*0.33) % (W + 60)) - 30, by = H*(0.15 + bi*0.08) + Math.sin(t*2 + bi)*5; g.strokeStyle = '#445'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 10, by); g.quadraticCurveTo(bx - 5, by - 6, bx, by); g.quadraticCurveTo(bx + 5, by - 6, bx + 10, by); g.stroke(); }
}

/* ─── 마법의 밤: 별자리·반딧불이·오로라·빛나는 버섯. 규칙 없음 ─── */
var fireflies = [], CONSTELL = [
  /* 참고래 */ [[0.08,0.22],[0.13,0.17],[0.19,0.15],[0.25,0.17],[0.30,0.22],[0.25,0.25],[0.17,0.25],[0.08,0.22]],
  /* 테우(배) */ [[0.60,0.12],[0.66,0.12],[0.72,0.12],[0.74,0.16],[0.58,0.16],[0.60,0.12],[0.66,0.05],[0.66,0.12]],
  /* 게 */ [[0.40,0.30],[0.46,0.27],[0.52,0.30],[0.49,0.35],[0.43,0.35],[0.40,0.30],[0.36,0.25],[0.40,0.30]],
  /* 북 */ [[0.82,0.30],[0.90,0.30],[0.90,0.38],[0.82,0.38],[0.82,0.30]]
];
for (var ff = 0; ff < 70; ff++) fireflies.push({ x: Math.random(), y: 0.3 + Math.random()*0.65, ph: Math.random()*6, sp: 0.2 + Math.random()*0.5, r: 2 + Math.random()*2 });
function drawNight(t) {
  var b = WORLDS.night.band;
  var bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07062b'); bg.addColorStop(0.55, '#1b1550'); bg.addColorStop(1, '#0e2a3a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // 오로라
  g.save(); g.globalCompositeOperation = 'lighter';
  for (var a = 0; a < 3; a++) {
    var ag = g.createLinearGradient(0, H*0.05, 0, H*0.45);
    ag.addColorStop(0, 'rgba(80,255,200,0)'); ag.addColorStop(0.5, a === 1 ? 'rgba(160,120,255,0.16)' : 'rgba(80,255,200,0.14)'); ag.addColorStop(1, 'rgba(80,255,200,0)');
    g.fillStyle = ag; g.beginPath(); g.moveTo(0, H*0.05);
    for (var x = 0; x <= W; x += 24) g.lineTo(x, H*0.08 + Math.sin(x*0.004 + t*0.4 + a*2)*H*0.06 + a*H*0.05);
    for (var x2 = W; x2 >= 0; x2 -= 24) g.lineTo(x2, H*0.38 + Math.sin(x2*0.005 - t*0.3 + a)*H*0.05 + a*H*0.05);
    g.closePath(); g.fill();
  }
  g.restore();
  // 별
  stars.forEach(function (st) { var tw = 0.5 + 0.5*Math.sin(t*2 + st.ph); g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6*tw) + ')'; g.beginPath(); g.arc(st.x*W, st.y*H*0.9, st.r*(0.7 + tw*0.5), 0, 6.3); g.fill(); });
  // 별자리 (박물관 전시물 모양)
  g.strokeStyle = 'rgba(200,220,255,.45)'; g.lineWidth = 1.5;
  CONSTELL.forEach(function (cs, ci) {
    g.beginPath(); cs.forEach(function (p, i) { i ? g.lineTo(p[0]*W, p[1]*H) : g.moveTo(p[0]*W, p[1]*H); }); g.stroke();
    cs.forEach(function (p, i) { var tw = 0.6 + 0.4*Math.sin(t*1.5 + i + ci); g.fillStyle = 'rgba(255,240,200,' + tw + ')'; g.beginPath(); g.arc(p[0]*W, p[1]*H, 3.5, 0, 6.3); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,150,' + (0.15*tw) + ')'; g.beginPath(); g.arc(p[0]*W, p[1]*H, 10, 0, 6.3); g.fill(); g.restore(); });
  });
  // 달
  g.save(); g.globalCompositeOperation = 'lighter'; var mg = g.createRadialGradient(W*0.85, H*0.16, 10, W*0.85, H*0.16, 90); mg.addColorStop(0, 'rgba(255,250,220,.5)'); mg.addColorStop(1, 'rgba(255,250,220,0)'); g.fillStyle = mg; g.beginPath(); g.arc(W*0.85, H*0.16, 90, 0, 6.3); g.fill(); g.restore();
  g.fillStyle = '#fff6d5'; g.beginPath(); g.arc(W*0.85, H*0.16, 28, 0, 6.3); g.fill();
  // 안개 낀 언덕
  g.fillStyle = '#132b3f'; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H*0.8);
  for (var hx = 0; hx <= W; hx += 40) g.lineTo(hx, H*0.8 - Math.sin(hx*0.006)*H*0.05 - Math.sin(hx*0.02)*H*0.015);
  g.lineTo(W, H); g.closePath(); g.fill();
  g.fillStyle = '#0c3a3a'; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H*b.bottom);
  for (var hx2 = 0; hx2 <= W; hx2 += 40) g.lineTo(hx2, H*b.bottom - Math.sin(hx2*0.01 + 2)*H*0.02);
  g.lineTo(W, H); g.closePath(); g.fill();
  // 빛나는 버섯
  for (var mi = 0; mi < 7; mi++) {
    var mx = W*(0.05 + mi*0.15) + Math.sin(mi*3)*30, my = H*b.bottom + 4, mh = 26 + (mi%3)*12, hue = [300, 180, 60][mi%3];
    g.save(); g.globalCompositeOperation = 'lighter'; var rg = g.createRadialGradient(mx, my - mh, 2, mx, my - mh, mh*1.6); rg.addColorStop(0, 'hsla(' + hue + ',90%,70%,' + (0.35 + 0.15*Math.sin(t*2 + mi)) + ')'); rg.addColorStop(1, 'hsla(' + hue + ',90%,70%,0)'); g.fillStyle = rg; g.beginPath(); g.arc(mx, my - mh, mh*1.6, 0, 6.3); g.fill(); g.restore();
    g.fillStyle = '#e9f3ff'; g.fillRect(mx - 4, my - mh, 8, mh);
    g.fillStyle = 'hsl(' + hue + ',80%,65%)'; g.beginPath(); g.ellipse(mx, my - mh, mh*0.7, mh*0.35, 0, Math.PI, 0); g.fill();
  }
  // 반딧불이
  g.save(); g.globalCompositeOperation = 'lighter';
  fireflies.forEach(function (f) {
    var fx = (f.x + Math.sin(t*f.sp + f.ph)*0.02)*W, fy = (f.y + Math.cos(t*f.sp*0.7 + f.ph)*0.02)*H, al = 0.3 + 0.7*Math.max(0, Math.sin(t*3 + f.ph*2));
    var fg = g.createRadialGradient(fx, fy, 0, fx, fy, f.r*5); fg.addColorStop(0, 'rgba(220,255,120,' + al + ')'); fg.addColorStop(1, 'rgba(220,255,120,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, f.r*5, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,200,' + al + ')'; g.beginPath(); g.arc(fx, fy, f.r*0.6, 0, 6.3); g.fill();
  });
  g.restore();
  dust.forEach(function (d) { g.fillStyle = 'rgba(255,240,200,' + (0.2 + 0.2*Math.sin(t*2 + d.ph)) + ')'; g.fillRect(d.x*W, (d.y*H + t*6) % H, 2, 2); });
}

/* ═══════════════ 소리 (파일 재생, 상황별 2종 무작위) ═══════════════
   assets/sound/{name}_1.mp3, {name}_2.mp3. 앞 무음은 건너뛰고, 효과음은 최대 길이까지만 틀고 페이드아웃.
   브라우저 정책상 사용자가 한 번 눌러야 소리가 난다 → enable() */
var Sound = (function () {
  var ac = null, master = null, bufs = {}, loopSrc = null, loopGain = null, base = opts.soundBase || 'assets/sound/';
  var MAXDUR = { enter: 1.6, friend: 3.0, win: 4.5, cheer: 3.0 };
  var NAMES = ['enter', 'friend', 'win', 'cheer', 'dance_loop', 'ssireum_loop'];
  function enable() {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination); load(); }
    if (ac.state === 'suspended') ac.resume();
    S.on = true;
  }
  function load() {
    NAMES.forEach(function (n) { [1, 2].forEach(function (v) {
      fetch(base + n + '_' + v + '.mp3').then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return ac.decodeAudioData(ab); })
        .then(function (buf) { bufs[n + '_' + v] = { buf: buf, onset: onset(buf) }; }).catch(function () {});
    }); });
  }
  function onset(buf) {                          // 앞쪽 무음 길이(초)
    var d = buf.getChannelData(0), thr = 0.02, i = 0;
    while (i < d.length && Math.abs(d[i]) < thr) i += 32;
    return Math.max(0, i/buf.sampleRate - 0.02);
  }
  function pick(n) { var a = bufs[n + '_1'], b = bufs[n + '_2']; if (a && b) return Math.random() < 0.5 ? a : b; return a || b || null; }
  function play(name) {
    if (!S.on) return;
    if (name === 'splash' || name === 'bubble' || name === 'thud') return synth(name);
    var it = pick(name); if (!it) return;
    var src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = it.buf;
    var t = ac.currentTime, max = MAXDUR[name] || 5, dur = Math.min(max, it.buf.duration - it.onset);
    gn.gain.setValueAtTime(1, t); gn.gain.setValueAtTime(1, t + Math.max(0, dur - 0.6)); gn.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(gn); gn.connect(master); src.start(t, it.onset, dur + 0.05);
  }
  function loop(name) {                          // 'dance' | 'ssireum'
    if (!S.on) return; stopLoop();
    var it = pick(name + '_loop'); if (!it) return;
    loopSrc = ac.createBufferSource(); loopGain = ac.createGain(); loopSrc.buffer = it.buf; loopSrc.loop = true; loopSrc.loopStart = it.onset; loopSrc.loopEnd = it.buf.duration;
    loopGain.gain.setValueAtTime(0.0001, ac.currentTime); loopGain.gain.exponentialRampToValueAtTime(0.8, ac.currentTime + 0.4);
    loopSrc.connect(loopGain); loopGain.connect(master); loopSrc.start(ac.currentTime, it.onset);
  }
  function stopLoop() {
    if (!loopSrc) return; var s = loopSrc, gn = loopGain, t = ac.currentTime;
    gn.gain.cancelScheduledValues(t); gn.gain.setValueAtTime(gn.gain.value, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    setTimeout(function () { try { s.stop(); } catch (e) {} }, 900); loopSrc = null; loopGain = null;
  }
  /* 물 효과음은 파일이 없어 합성 */
  function synth(name) {
    var t = ac.currentTime;
    function tone(f, dur, vol, slide) { var o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02); }
    if (name === 'bubble') tone(500 + Math.random()*400, 0.12, 0.08, 1200);
    else if (name === 'thud') tone(90, 0.3, 0.5, 40);
    else { var n = Math.floor(ac.sampleRate*0.35), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random()*2-1)*(1-i/n);
      var s = ac.createBufferSource(), gn = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; gn.gain.value = 0.35; s.buffer = buf; s.connect(f); f.connect(gn); gn.connect(master); s.start(t); tone(300, 0.2, 0.1, 120); }
  }
  var S = { enable: enable, play: play, loop: loop, stopLoop: stopLoop, on: false };
  return S;
})();

/* ═══════════════ 스프라이트 (y는 가운데 기준) ═══════════════ */
/* 도안 리그: 부위를 잘라 두고 관절로 돌린다. rigBox = {ox, oy, s}: 도안 좌표 → 그림 좌표 (ix = gx*s - ox) */
function buildRig(sp, rigName, rigBox) {
  var R = window.StageGuides && StageGuides.rigs && StageGuides.rigs[rigName]; if (!R) return;
  sp.rigName = rigName; sp.rig = R; if (R.faceLeft) sp.faceLeft = true; if (R.noFlip) sp.noFlip = true;
  if (!R.parts || !R.parts.length || !rigBox) return;
  var img = sp.img, W0 = img.width, H0 = img.height;
  var body = document.createElement('canvas'); body.width = W0; body.height = H0; var bc = body.getContext('2d'); bc.drawImage(img, 0, 0);
  var parts = [];
  R.parts.forEach(function (pt) {
    var x0 = Math.max(0, Math.round(pt.box[0]*rigBox.s - rigBox.ox)), y0 = Math.max(0, Math.round(pt.box[1]*rigBox.s - rigBox.oy));
    var x1 = Math.min(W0, Math.round(pt.box[2]*rigBox.s - rigBox.ox)), y1 = Math.min(H0, Math.round(pt.box[3]*rigBox.s - rigBox.oy));
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    var cv = document.createElement('canvas'); cv.width = x1 - x0; cv.height = y1 - y0;
    cv.getContext('2d').drawImage(body, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    // 비어 있는 부위(아이가 안 그린 곳)는 건너뛴다
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 30) n++;
    if (n < 10) return;
    bc.clearRect(x0, y0, x1 - x0, y1 - y0);
    parts.push({ cv: cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0, px: pt.pivot[0]*rigBox.s - rigBox.ox, py: pt.pivot[1]*rigBox.s - rigBox.oy, anim: pt.anim, name: pt.name });
  });
  if (parts.length) { sp.body = body; sp.parts = parts; }
}
function partAngle(sp, pt, t) {
  var a = pt.anim[sp.motion] || pt.anim.base || { amp: 0, freq: 1 };
  if (a.spin) return (a.spin*t) * (sp.dir || 1);
  return (a.bias || 0) + (a.amp || 0)*Math.sin(t*(a.freq || 1)*2*Math.PI + (a.phase || 0) + sp.ph);
}
function addSprite(imgCanvas, seat, cat, nick, desc) {
  var base = 110 + Math.random()*70;
  var scale = base / Math.max(imgCanvas.width, imgCanvas.height);
  var dir = Math.random() < 0.5 ? 1 : -1;
  var sp = {
    img: imgCanvas, seat: seat || null, nick: nick || null, cat: cat || 'fish', desc: desc || '', abil: parseAbilities(desc),
    w: imgCanvas.width*scale, h: imgCanvas.height*scale,
    x: dir > 0 ? -150 : W + 150, y: 0, ty: 0, dir: dir, vy: 0,
    speed: 30 + Math.random()*40, ph: Math.random()*6, wob: 0.9 + Math.random()*0.6,
    born: performance.now(), depth: 0.65 + Math.random()*0.35,
    ctrl: null, rot: 0, bounce: 0, mood: null, motion: null
  };
  sp.id = (opts.idFor && opts.idFor(sp)) || ('s' + (++seq));
  if (opts._rig) buildRig(sp, opts._rig.name, opts._rig.box);
  applyRules(sp, true);
  sprites.push(sp);
  Sound.play('enter');
  if (sp.desc) say(sp.desc, W/2, H*0.18, '#fff');
  var others = sprites.filter(function (o) { return o !== sp && !o.ctrl && o.motion !== 'sink'; });
  if (others.length && autoPlay && sp.motion !== 'sink') follow(sp, others[Math.floor(Math.random()*others.length)]);
  updateCount();
}
function updateCount() { if (opts.onCount) opts.onCount(sprites.length); }
function halfH(sp) { return sp.h*sp.depth/2; }
function spriteTop(sp) { return sp.y - halfH(sp) - sp.bounce; }

function drawRipple(sp, t) {                 // 물속에 있는 것은 수면 물결로만 알 수 있다
  var b = cur().band, sy = H*b.surface + 4;
  g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
  for (var i = 0; i < 3; i++) { var r = 14 + ((t*30 + i*16) % 48); g.globalAlpha = 1 - r/62; g.beginPath(); g.ellipse(sp.x, sy, r, r*0.28, 0, 0, 6.3); g.stroke(); }
  g.restore();
}
function drawSprite(sp, t) {
  var img = sp.img, k = sp.depth, dw = sp.w*k, dh = sp.h*k, mo = sp.motion;
  var under = cur() === WORLDS.sea || cur().kind === 'water';          // 물속이 보이는 공간
  if (!under && (mo === 'hidden' || (mo === 'breach' && sp.breachT === undefined))) { drawRipple(sp, t); return; }
  if (under && (mo === 'breach' && sp.breachT === undefined)) mo = 'swim';   // 바다에서는 평소 헤엄치는 모습으로
  g.save();
  if (mo === 'fin') { g.beginPath(); g.rect(0, 0, W, H*cur().band.surface + 2); g.clip(); }   // 수면 위만 그린다
  g.translate(sp.x, sp.y - sp.bounce);
  var faceRight = sp.ctrl && sp.ctrl.face ? sp.ctrl.face > 0 : sp.dir > 0;
  if (sp.faceLeft) faceRight = !faceRight;                 // 도안이 왼쪽을 보는 그림
  if (sp.noFlip) faceRight = !sp.faceLeft;                 // 정면 그림은 뒤집지 않는다
  g.scale(faceRight ? 1 : -1, 1);
  var pose = 0;
  if (sp.rig && sp.rig.pose && sp.rig.pose[mo] === 'horizontal' && !sp.ctrl) pose = Math.PI/2 + (sp.pitch || 0);   // 물에서는 몸을 눕힌다(머리가 앞)
  g.rotate(sp.rot + pose + (mo === 'swim' && !sp.parts ? Math.sin(t*1.3 + sp.ph)*0.05 : 0));
  g.globalAlpha = 0.6 + 0.4*k;
  if (sp.parts) {                                          // 도안 리그: 몸통 + 관절로 도는 부위
    var kk = dw/img.width, base = sp.body;
    if (mo === 'swim' && sp.rig.wave) {                    // 산갈치처럼 긴 몸은 물결치며
      var N2 = 16, sw2 = base.width/N2, dsw2 = dw/N2, amp2 = dh*0.05*sp.rig.wave, headLeft = !!sp.faceLeft;
      for (var i2 = 0; i2 < N2; i2++) { var tl = headLeft ? i2/N2 : 1 - i2/N2, dy2 = Math.sin(t*5 + sp.ph - i2*0.5)*amp2*tl; g.drawImage(base, i2*sw2, 0, sw2+1, base.height, -dw/2 + i2*dsw2, -dh/2 + dy2, dsw2+1, dh); }
    } else g.drawImage(base, -dw/2, -dh/2, dw, dh);
    sp.parts.forEach(function (pt) {
      g.save(); g.translate(-dw/2 + pt.px*kk, -dh/2 + pt.py*kk); g.rotate(partAngle(sp, pt, t));
      g.drawImage(pt.cv, (pt.x - pt.px)*kk, (pt.y - pt.py)*kk, pt.w*kk, pt.h*kk); g.restore();
    });
  } else if (mo === 'swim') {
    var N = 14, sw = img.width/N, dsw = dw/N, amp = dh*0.07*sp.wob, hl = !!sp.faceLeft;
    for (var i = 0; i < N; i++) { var tail = hl ? i/N : 1 - i/N, dy = Math.sin(t*6 + sp.ph - i*0.45)*amp*tail*tail; g.drawImage(img, i*sw, 0, sw+1, img.height, -dw/2 + i*dsw, -dh/2 + dy, dsw+1, dh); }
  } else {
    var sq = 1;
    if (mo === 'walk') sq = 1 + Math.sin(t*8 + sp.ph)*0.04;
    else if (mo === 'crawl') sq = 1 + Math.sin(t*12 + sp.ph)*0.03;
    else if (mo === 'fly') sq = 1 + Math.sin(t*10 + sp.ph)*0.08;
    else if (mo === 'drift' || mo === 'paddle') sq = 1 + Math.sin(t*2 + sp.ph)*0.02;
    g.scale(1/sq, sq);
    g.drawImage(img, -dw/2, -dh/2, dw, dh);
  }
  g.restore();
  if (sp.mood) { g.save(); g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText(sp.mood, sp.x, spriteTop(sp) - 14); g.restore(); }
  if (sp.art && (sp.fixed || sp.heldBy)) {                                 // 작품: 빛나는 테두리 + 이름표
    var aw = sp.w*sp.depth, ah = sp.h*sp.depth;
    g.save(); g.translate(sp.x, sp.y); g.rotate(sp.rot);
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,230,150,' + (sp.fixed ? 0.5 : 0.9) + ')'; g.lineWidth = sp.fixed ? 4 : 6; g.setLineDash(sp.fixed ? [] : [10, 8]);
    g.strokeRect(-aw/2 - 10, -ah/2 - 10, aw + 20, ah + 20); g.restore();
    if (sp.fixed) { g.save(); g.font = 'bold 17px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText('✨ ' + (sp.nick || (sp.seat + '번')) + '의 작품', sp.x, sp.y + ah/2 + 30); g.restore(); }
  }
}
function spawnWake(x, y) { particles.push({ type: 'splash', x: x, y: y, vx: (Math.random()-0.5)*20, vy: -10, life: 0.6, age: 0, s: 2 + Math.random()*2 }); }

function label(sp) { return (sp.seat ? sp.seat + '번' : '') + (sp.nick ? ' ' + sp.nick : ''); }
/* 말풍선: 그림을 따라다니며 몇 초 뒤 사라진다 */
function drawBubble(sp) {
  var c = sp.chat; if (!c) return;
  var left = (c.until - performance.now())/1000; if (left <= 0) { sp.chat = null; return; }
  var a = Math.min(1, left/0.5, (performance.now() - c.at)/200);
  g.save(); g.globalAlpha = a; g.font = 'bold 24px sans-serif'; g.textAlign = 'center';
  var lines = wrap_(c.text, 14), lh = 30, tw = 0; lines.forEach(function (l) { tw = Math.max(tw, g.measureText(l).width); });
  var bw = tw + 32, bh = lines.length*lh + 18, bx = Math.max(8, Math.min(W - bw - 8, sp.x - bw/2)), by = spriteTop(sp) - bh - 60;
  if (by < 8) by = spriteTop(sp) + sp.h*sp.depth + 24;
  g.fillStyle = 'rgba(255,255,255,.96)'; g.strokeStyle = '#0b3d91'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(bx, by, bw, bh, 16); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(sp.x - 10, by + bh - 1); g.lineTo(sp.x, by + bh + 16); g.lineTo(sp.x + 10, by + bh - 1); g.closePath(); g.fill();   // 꼬리
  g.fillStyle = '#1b2533'; lines.forEach(function (l, i) { g.fillText(l, bx + bw/2, by + 30 + i*lh); });
  g.restore();
}
function wrap_(text, n) { var out = [], t = String(text); while (t.length > n) { out.push(t.slice(0, n)); t = t.slice(n); } out.push(t); return out.slice(0, 3); }
function drawBadge(sp) {
  if (!sp.seat && !sp.nick) return;
  var under = cur() === WORLDS.sea || cur().kind === 'water';
  if (!under && (sp.motion === 'hidden' || (sp.motion === 'breach' && sp.breachT === undefined))) return;
  if (!sp.seen && sp.x > sp.w/2 && sp.x < W - sp.w/2) sp.seen = performance.now();
  if (!sp.seen) return;
  var age = (performance.now() - sp.seen)/1000;
  var inScene = !!(sp.ctrl && !sp.ctrl.follow) || !!sp.manual || !!sp.chat;   // 장면·조종·말풍선 중에는 계속 보여 준다
  if (age > 5 && !inScene) return;
  var a = inScene ? 1 : (age < 4 ? 1 : 5 - age);
  g.save(); g.globalAlpha = a;
  g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
  var txt = label(sp), tw = g.measureText(txt).width + 20, ty = spriteTop(sp) - 46;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.roundRect(sp.x - tw/2, ty, tw, 34, 8); g.fill();
  g.fillStyle = '#0b3d91'; g.fillText(txt, sp.x, ty + 24);
  g.restore();
}

/* 평소 움직임 */
/* 아이가 조종하는 그림이 예시 캐릭터 가까이 오면 둘 다 멈춰 마주 보고 기다린다.
   화살표로 움직이면 풀리고, 말·친구하기·씨름은 그 자리에서 이어진다 */
var PAUSE_ON_MEET = false;                        // 가까이 가면 멈추는 기능. 조작을 방해해 끔(친구하기·씨름은 아이 화면에서 상대를 고른다)
function encounters(t) {
  if (!PAUSE_ON_MEET) { sprites.forEach(function (sp) { if (sp.wait) { sp.wait = null; sp.waitOwner = false; } }); return; }
  if (scene) { sprites.forEach(function (sp) { sp.wait = null; sp.waitOwner = false; }); return; }
  var R = W*0.12, now = performance.now();
  sprites.forEach(function (sp) { if (sp.wait && (sprites.indexOf(sp.wait) < 0)) sp.wait = null; });
  sprites.forEach(function (kid) {
    if (kid.wait && !kid.waitOwner) return;                                                  // 상대로서 기다리는 중: 짝을 만든 쪽이 푼다
    if (kid.demo || kid.ctrl || !(kid.lastInput && now - kid.lastInput < 15000)) { if (kid.wait) { kid.wait.wait = null; kid.wait.waitOwner = false; kid.wait = null; kid.waitOwner = false; } return; }
    var d = kid.wait, dist = d ? Math.hypot(d.x - kid.x, d.y - kid.y) : 1e9;
    if (d && dist > R*1.6) { d.wait = null; d.waitOwner = false; kid.wait = null; kid.waitOwner = false; d = null; }
    if (!d) { var best = null, bd = R; sprites.forEach(function (o) { if (o === kid || o.ctrl || o.wait || o.x < 0 || o.x > W || o.motion === 'sink' || o.motion === 'hidden') return; var dd = Math.hypot(o.x - kid.x, o.y - kid.y); if (dd < bd) { bd = dd; best = o; } });
      if (best) { kid.wait = best; kid.waitOwner = true; best.wait = kid; best.waitOwner = false; best.manual = null; if (best.demo) best.chat = { text: ['무슨 일이야?', '안녕? 나랑 놀래?', '뭐 할까?'][Math.floor(Math.random()*3)], at: now, until: now + 3000 }; if (!kid.manual) kid.chat = { text: '말하기·친구하기·씨름하기!', at: now, until: now + 3000 }; } }
  });
}
function idleFacing(sp, t) {                      // 멈춰서 상대를 보며 살짝 숨 쉰다
  var o = sp.wait; if (!o) return;
  sp.dir = o.x >= sp.x ? 1 : -1; sp.ty = sp.y; sp.bounce = Math.abs(Math.sin(t*2 + sp.ph))*3; sp.rot *= 0.9;
  if (sp.motion === 'swim' || sp.motion === 'drift') sp.y += Math.sin(t*1.2 + sp.ph)*0.15;
}
/* 아이가 조종 중이면 그 방향으로, 3초 입력이 없으면 다시 저절로 움직인다 */
function manualMove(sp, t, dt) {
  var m = sp.manual; if (!m || performance.now() > m.until) { sp.manual = null; return false; }
  var b = cur().band, mo = sp.motion, hh = halfH(sp), sp2 = 170 * (sp.speedMul || 1);
  if (m.dx) { sp.dir = m.dx > 0 ? 1 : -1; sp.x += m.dx*sp2*dt; }
  var onPlane = (mo === 'float' || mo === 'paddle') && b.plane;
  var missionFree = (M && !M.ended);                                          // 청소 중엔 상하 자유 이동(수거함까지 닿게 해서 공정·재미)
  var yOk = missionFree || onPlane || !(mo === 'walk' || mo === 'crawl' || mo === 'sink' || mo === 'ride' || mo === 'float' || mo === 'paddle' || mo === 'fin');   // 땅·한 줄 수면 위 것은 좌우만
  if (m.dy && yOk) { sp.y += m.dy*sp2*dt; sp.ty = sp.y; }
  var zone = missionFree ? [0.08, 0.94] : onPlane ? b.plane : (mo === 'fly') ? (b.sky || b.swim) : b.swim;
  if (yOk && zone) { sp.y = Math.max(H*zone[0], Math.min(H*zone[1], sp.y)); sp.ty = sp.y; }
  sp.x = Math.max(-sp.w*sp.depth/2, Math.min(W + sp.w*sp.depth/2, sp.x));
  if (mo === 'walk' && m.dy < 0 && sp.jumpT === undefined) sp.jumpT = t;          // 걷는 것은 ↑ 로 폴짝
  if (sp.jumpT !== undefined) { var jt = t - sp.jumpT; sp.bounce = jt < 0.5 ? Math.sin(jt/0.5*Math.PI)*30 : 0; if (jt >= 0.5) delete sp.jumpT; }
  if (mo === 'walk' || mo === 'crawl') sp.rot *= 0.9;
  return true;
}
/* 예시 캐릭터: 아이가 조종하는 그림이 가까이 오면 멈춰 서서 그쪽을 보고 기다린다 */
function demoWait(sp) {
  if (!sp.demo) return false;
  var near = null, bd = 0.16*W;
  sprites.forEach(function (o) { if (o === sp || o.demo || !o.manual) return; var d = Math.hypot(o.x - sp.x, (o.y - sp.y)*0.56); if (d < bd) { bd = d; near = o; } });
  if (near) { sp.waitUntil = performance.now() + 1500; sp.dir = near.x > sp.x ? 1 : -1; if (!sp.chat) sp.mood = '❔'; return true; }
  if (sp.waitUntil && performance.now() < sp.waitUntil) return true;
  if (sp.waitUntil) { sp.waitUntil = 0; if (sp.mood === '❔') sp.mood = null; }
  return false;
}
function roam(sp, t, dt) {
  if (sp.fixed) { sp.ty = sp.y; return; }                                  // 전시된 작품: 그 자리 그대로
  if (sp.heldBy) { var h = sp.heldBy; if (sprites.indexOf(h) < 0) { sp.heldBy = null; } else { sp.x = h.x + (h.dir > 0 ? 1 : -1)*(h.w*h.depth*0.5 + sp.w*sp.depth*0.35); sp.y = h.y - sp.h*sp.depth*0.2; sp.ty = sp.y; return; } }
  if (manualMove(sp, t, dt)) return;
  if (demoWait(sp)) { if (sp.motion === 'swim' || sp.motion === 'fly' || sp.motion === 'drift') sp.y += (sp.ty - sp.y)*0.03; if (sp.jumpT !== undefined) { var jt0 = t - sp.jumpT; sp.bounce = jt0 < 0.5 ? Math.sin(jt0/0.5*Math.PI)*30 : 0; if (jt0 >= 0.5) delete sp.jumpT; } return; }
  var b = cur().band, mo = sp.motion, hh = halfH(sp);
  var speedMul = { crawl: 0.4, walk: 0.7, paddle: 0.5, float: 0.5, fly: 1.5, drift: 0.5, sink: 0, ride: 0, hidden: 0.8, breach: 1.0, fin: 0.9, clam: 0 }[mo];
  if (mo === 'clam') speedMul = Math.max(0, Math.sin(t*1.2*2*Math.PI + sp.ph))*2.2;   // 껍데기를 닫을 때 앞으로 쑥
  if (speedMul === undefined) speedMul = 1;

  if (mo === 'sink') {                                     // 가라앉기: 중력, 기울기, 거품 → 바닥에 눕기
    var floor = H*b.bottom - hh*0.8;
    if (!sp.settled) {
      sp.vy += 60*dt; sp.y += sp.vy*dt; sp.x += Math.sin(t*2 + sp.ph)*0.6;
      sp.rot += (0.35*sp.dir - sp.rot)*0.02;
      if (Math.random() < 0.25) spawnBubble(sp.x + (Math.random()-0.5)*sp.w*0.5, sp.y);
      if (sp.y >= floor) { sp.y = floor; sp.settled = true; sp.vy = 0; spawnSand(sp.x, floor + hh*0.8); Sound.play('thud'); }
      else if (Math.random() < 0.03) Sound.play('bubble');
    } else { sp.rot += (0.35*sp.dir - sp.rot)*0.05; }
    return;
  }
  if (mo === 'ride' && sp.ride) {                           // 배 타기: 배 위에 올라탄다
    if (sprites.indexOf(sp.ride) < 0 || sp.ride.motion !== 'float') { sp.ride = null; sp.motion = 'walk'; sp.ty = homeY(sp, 'walk'); return; }
    sp.x += (sp.ride.x - sp.x)*0.2; sp.y += (sp.ride.y - halfH(sp.ride)*0.6 - hh - sp.y)*0.2;
    sp.dir = sp.ride.dir; sp.rot = sp.ride.rot; return;
  }
  if (sp.rising) {                                          // 떠오르기: 수면까지 거품 내며 올라간다
    sp.y -= 90*dt; sp.x += Math.sin(t*3)*0.8;
    if (Math.random() < 0.3) spawnBubble(sp.x, sp.y + hh);
    if (sp.y <= sp.ty) { sp.y = sp.ty; sp.rising = false; spawnSplash(sp.x, sp.ty); Sound.play('splash'); }
    return;
  }

  if (mo === 'breach' && sp.breachT !== undefined) {            // 고래 점프: 포물선으로 물 위로
    var bt = (t - sp.breachT)/1.6;
    if (bt >= 1) { delete sp.breachT; spawnSplash(sp.x, H*b.surface); Sound.play('splash'); sp.rot = 0; }
    else {
      sp.x += sp.dir*sp.speed*1.6*dt;
      sp.y = H*b.surface + hh*0.6 - Math.sin(bt*Math.PI)*(hh*2 + H*0.2);
      sp.rot = sp.dir*(bt - 0.5)*1.2;                            // 올라갈 땐 머리 위, 내려올 땐 머리 아래
      if (bt < 0.05 && !sp.splashed) { spawnSplash(sp.x, H*b.surface); Sound.play('splash'); sp.splashed = true; }
      if (bt > 0.5) sp.splashed = false;
    }
    return;
  }
  sp.x += sp.dir*sp.speed*speedMul*dt;
  if (mo === 'hidden' || mo === 'breach') {
    sp.ty += Math.sin(t*0.7 + sp.ph)*0.25;
    sp.ty = Math.max(H*b.swim[0], Math.min(H*b.swim[1], sp.ty));
    if (mo === 'breach' && Math.random() < 0.004 && sp.x > W*0.15 && sp.x < W*0.85) { sp.breachT = t; sp.splashed = false; }
  } else if (mo === 'fin') {
    sp.ty = H*b.surface + hh*0.44 + Math.sin(t*1.5 + sp.ph)*2;   // 지느러미만 수면 위
    if (Math.random() < 0.05) spawnWake(sp.x - sp.dir*sp.w*sp.depth*0.3, H*b.surface);
  } else if (mo === 'clam') {                               // 조개: 바닥 근처에서 껍데기를 여닫으며 통통
    var lo = H*b.bottom - hh - H*0.2, hi2 = H*b.bottom - hh - H*0.02;
    sp.ty += (Math.sin(t*1.2*2*Math.PI + sp.ph) > 0.7 ? -1.2 : 0.6);
    sp.ty = Math.max(lo, Math.min(hi2, sp.ty));
    sp.rot = Math.sin(t*1.2*2*Math.PI + sp.ph)*0.08;
  } else if (mo === 'swim' && sp.rig && sp.rig.dive) {     // 해녀: 수면에서 숨 쉬고 잠수했다 올라온다
    var cyc = (t*0.08 + sp.ph/6.28) % 1, top2 = H*b.swim[0], deep = H*b.swim[1];
    var target = cyc < 0.3 ? top2 : cyc < 0.75 ? deep : top2;
    sp.ty += (target - sp.ty)*0.02;
    sp.pitch = (target - sp.y) > 40 ? 0.5 : (target - sp.y) < -40 ? -0.5 : 0;   // 내려갈 땐 머리 아래, 올라올 땐 위
    if (cyc > 0.3 && cyc < 0.75 && Math.random() < 0.06) spawnBubble(sp.x, sp.y - hh*0.5);
    if (cyc >= 0.75 && cyc < 0.77 && sp.y < top2 + 20 && !sp.breathed) { spawnSplash(sp.x, sp.y - hh); sp.breathed = true; }
    if (cyc < 0.3) sp.breathed = false;
  } else if (mo === 'swim') {
    sp.ty += Math.sin(t*0.7 + sp.ph)*0.25;
    if (Math.random() < 0.002) sp.ty = H*(b.swim[0] + Math.random()*(b.swim[1]-b.swim[0]));
    sp.ty = Math.max(H*b.swim[0], Math.min(H*b.swim[1], sp.ty));
  } else if (mo === 'fly') {
    var sk = b.sky || b.swim;
    sp.ty += Math.sin(t*1.1 + sp.ph)*0.6;
    sp.ty = Math.max(H*sk[0], Math.min(H*sk[1], sp.ty));
    sp.rot = sp.dir*Math.sin(t*1.1 + sp.ph)*0.08;
  } else if ((mo === 'paddle' || mo === 'float') && b.plane) {        // 비스듬한 수면: 위아래로도 천천히 다닌다
    sp.ty += Math.sin(t*0.5 + sp.ph)*0.3;
    if (Math.random() < 0.002) sp.ty = H*(b.plane[0] + Math.random()*(b.plane[1]-b.plane[0]));
    sp.ty = Math.max(H*b.plane[0], Math.min(H*b.plane[1], sp.ty));
    sp.rot += (Math.sin(t*1.3 + sp.ph)*0.06 - sp.rot)*0.1;
  } else if (mo === 'paddle' || mo === 'float') {
    sp.ty = H*b.surface + Math.sin(t*1.3 + sp.ph)*4 - (mo === 'paddle' ? hh*0.2 : hh*0.1);
    sp.rot += (Math.sin(t*1.3 + sp.ph)*0.06 - sp.rot)*0.1;
  } else if (mo === 'drift') {
    sp.ty += Math.sin(t*0.5 + sp.ph)*0.5;
    sp.ty = Math.max(H*b.swim[0], Math.min(H*b.swim[1], sp.ty));
    sp.rot = Math.sin(t*0.8 + sp.ph)*0.1;
  } else {                                                  // walk / crawl
    sp.ty = H*b.bottom - hh;
    if (mo === 'walk' && Math.random() < 0.004 && sp.jumpT === undefined) sp.jumpT = t;
  }
  if (sp.jumpT !== undefined) { var jt = t - sp.jumpT; sp.bounce = jt < 0.5 ? Math.sin(jt/0.5*Math.PI)*30 : 0; if (jt >= 0.5) delete sp.jumpT; }
  sp.y += (sp.ty - sp.y)*0.03;
  if (sp.dir > 0 && sp.x > W + 120) { sp.dir = -1; sp.x = W + 120; }
  if (sp.dir < 0 && sp.x < -120) { sp.dir = 1; sp.x = -120; }
  if (Math.random() < 0.0008) sp.dir *= -1;
  if (mo === 'walk' || mo === 'crawl' || mo === 'swim' || mo === 'hidden' || mo === 'breach') sp.rot *= 0.9;
  if (mo !== 'swim') sp.pitch = 0;
}
function steer(sp) {
  var c = sp.ctrl, e = c.ease || 0.05;
  sp.x += (c.tx - sp.x)*e; sp.y += (c.ty - sp.y)*e;
  if (c.rot !== undefined) sp.rot += (c.rot - sp.rot)*0.2;
  if (c.bounce !== undefined) sp.bounce = c.bounce;
  if (c.dir) sp.dir = c.dir;
}
function release(sp) { sp.ctrl = null; if (sp.wait) { sp.wait.wait = null; sp.wait.waitOwner = false; } sp.wait = null; sp.waitOwner = false; sp.rot = 0; sp.bounce = 0; sp.mood = null; sp.ty = homeY(sp, sp.motion); if (sp.motion === 'sink') { sp.settled = false; sp.vy = 0; } }

/* ═══════════════ 효과 ═══════════════ */
function spawn(type, x, y, n) { for (var i = 0; i < n; i++) particles.push({ type: type, x: x, y: y, vx: (Math.random()-0.5)*120, vy: -40 - Math.random()*120, life: 1.2 + Math.random()*0.8, age: 0, s: 14 + Math.random()*14 }); }
function spawnBubble(x, y) { particles.push({ type: 'bubble', x: x, y: y, vx: (Math.random()-0.5)*20, vy: -60 - Math.random()*40, life: 1.5, age: 0, s: 3 + Math.random()*5 }); }
function spawnSand(x, y) { for (var i = 0; i < 10; i++) particles.push({ type: 'sand', x: x + (Math.random()-0.5)*40, y: y, vx: (Math.random()-0.5)*80, vy: -30 - Math.random()*40, life: 0.8, age: 0, s: 3 }); }
function spawnSplash(x, y) { for (var i = 0; i < 12; i++) particles.push({ type: 'splash', x: x + (Math.random()-0.5)*30, y: y, vx: (Math.random()-0.5)*120, vy: -80 - Math.random()*100, life: 0.7, age: 0, s: 3 + Math.random()*3 }); }
function say(txt, x, y, color) { texts.push({ txt: txt, x: x, y: y, age: 0, life: 2, color: color || '#fff' }); }

/* ═══════════════ 청소 미션: 쓰레기 줍기 → 수거선/수거함에 놓기 ═══════════════ */
var M = null;                                              // { type:'sea'|'forest', trash:[], bin:{}, score:{}, ended }
var TRASH_DRAW = {
  bottle: function (c, s) { c.fillStyle = '#8ecae6'; c.fillRect(-s*0.22, -s*0.3, s*0.44, s*0.8); c.fillStyle = '#219ebc'; c.fillRect(-s*0.12, -s*0.5, s*0.24, s*0.22); c.strokeStyle = '#1b2533'; c.lineWidth = s*0.06; c.strokeRect(-s*0.22, -s*0.3, s*0.44, s*0.8); },
  bag:    function (c, s) { c.fillStyle = 'rgba(255,255,255,.85)'; c.strokeStyle = '#667'; c.lineWidth = s*0.05; c.beginPath(); c.moveTo(-s*0.4, -s*0.1); c.quadraticCurveTo(-s*0.5, s*0.5, 0, s*0.5); c.quadraticCurveTo(s*0.5, s*0.5, s*0.4, -s*0.1); c.quadraticCurveTo(s*0.2, -s*0.6, 0, -s*0.3); c.quadraticCurveTo(-s*0.2, -s*0.6, -s*0.4, -s*0.1); c.fill(); c.stroke(); },
  cup:    function (c, s) { c.fillStyle = '#f4a261'; c.strokeStyle = '#1b2533'; c.lineWidth = s*0.06; c.beginPath(); c.moveTo(-s*0.35, -s*0.4); c.lineTo(s*0.35, -s*0.4); c.lineTo(s*0.22, s*0.45); c.lineTo(-s*0.22, s*0.45); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-s*0.4, -s*0.5, s*0.8, s*0.14); },
  can:    function (c, s) { c.fillStyle = '#e63946'; c.strokeStyle = '#1b2533'; c.lineWidth = s*0.06; c.beginPath(); c.roundRect(-s*0.28, -s*0.45, s*0.56, s*0.9, s*0.1); c.fill(); c.stroke(); c.fillStyle = '#ddd'; c.fillRect(-s*0.28, -s*0.45, s*0.56, s*0.12); c.fillRect(-s*0.28, s*0.33, s*0.56, s*0.12); },
  tire:   function (c, s) { c.strokeStyle = '#222'; c.lineWidth = s*0.3; c.beginPath(); c.arc(0, 0, s*0.4, 0, 6.3); c.stroke(); c.strokeStyle = '#555'; c.lineWidth = s*0.06; c.beginPath(); c.arc(0, 0, s*0.4, 0, 6.3); c.stroke(); },
  boot:   function (c, s) { c.fillStyle = '#6b4a2b'; c.strokeStyle = '#1b2533'; c.lineWidth = s*0.06; c.beginPath(); c.moveTo(-s*0.2, -s*0.5); c.lineTo(s*0.15, -s*0.5); c.lineTo(s*0.15, s*0.1); c.lineTo(s*0.5, s*0.3); c.lineTo(s*0.5, s*0.5); c.lineTo(-s*0.2, s*0.5); c.closePath(); c.fill(); c.stroke(); },
  glass:  function (c, s) { c.fillStyle = '#2a9d8f'; c.strokeStyle = '#1b2533'; c.lineWidth = s*0.06; c.beginPath(); c.moveTo(-s*0.1, -s*0.5); c.lineTo(s*0.1, -s*0.5); c.lineTo(s*0.1, -s*0.25); c.quadraticCurveTo(s*0.28, -s*0.15, s*0.25, s*0.05); c.lineTo(s*0.25, s*0.5); c.lineTo(-s*0.25, s*0.5); c.lineTo(-s*0.25, s*0.05); c.quadraticCurveTo(-s*0.28, -s*0.15, -s*0.1, -s*0.25); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f1faee'; c.fillRect(-s*0.18, s*0.08, s*0.36, s*0.22); },
  paper:  function (c, s) { c.fillStyle = '#f8f4e3'; c.strokeStyle = '#8a8a7a'; c.lineWidth = s*0.05; c.beginPath(); c.moveTo(-s*0.45, -s*0.2); c.lineTo(-s*0.2, -s*0.5); c.lineTo(s*0.15, -s*0.35); c.lineTo(s*0.45, -s*0.1); c.lineTo(s*0.3, s*0.3); c.lineTo(0, s*0.5); c.lineTo(-s*0.35, s*0.25); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-s*0.2, -s*0.5); c.lineTo(-s*0.05, -s*0.1); c.lineTo(s*0.3, s*0.3); c.stroke(); c.beginPath(); c.moveTo(-s*0.45, -s*0.2); c.lineTo(-s*0.05, -s*0.1); c.stroke(); },
  wrapper:function (c, s) { c.fillStyle = '#ffd166'; c.strokeStyle = '#1b2533'; c.lineWidth = s*0.05; c.beginPath(); c.moveTo(-s*0.5, -s*0.2); c.lineTo(-s*0.3, -s*0.3); c.lineTo(s*0.3, -s*0.25); c.lineTo(s*0.5, -s*0.1); c.lineTo(s*0.45, s*0.3); c.lineTo(-s*0.45, s*0.25); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#e63946'; c.fillRect(-s*0.25, -s*0.12, s*0.5, s*0.2); }
};
/* 분리수거 종류: 쓰레기 → 수거함 */
var TRASH_CAT = { bottle: 'plastic', bag: 'plastic', cup: 'paper', paper: 'paper', can: 'metal', tire: 'general', boot: 'general', wrapper: 'general', glass: 'glass' };
var BIN_DEF = [ { cat: 'general', name: '일반', color: '#6c757d' }, { cat: 'paper', name: '종이', color: '#4f86c6' }, { cat: 'plastic', name: '플라스틱', color: '#2ec4b6' }, { cat: 'glass', name: '병', color: '#7fb069' }, { cat: 'metal', name: '금속', color: '#e9c46a' } ];
var CAT_KO = { general: '일반', paper: '종이', plastic: '플라스틱', glass: '병', metal: '금속' };
function missionStart(type) {
  if (M) missionStop(true);
  var b = cur().band, n = 22, trash = [];
  for (var i = 0; i < n; i++) {
    var float = type === 'sea' && Math.random() < 0.55;
    var kind = type === 'sea' ? (float ? ['bottle', 'bag', 'cup'][i % 3] : ['can', 'tire', 'boot', 'bottle'][i % 4]) : ['bottle', 'can', 'bag', 'cup', 'wrapper', 'glass', 'paper', 'boot'][i % 8];
    trash.push({ id: 't' + i, kind: kind, float: float, x: W*(0.06 + Math.random()*0.88), y: float ? H*(b.swim[0] + 0.05 + Math.random()*(b.swim[1] - b.swim[0] - 0.1)) : H*b.bottom - 14 - Math.random()*10,
                 s: 26 + Math.random()*14, ph: Math.random()*6, vx: (Math.random() - 0.5)*12, held: null, vy: 0, rot: (Math.random() - 0.5)*0.6 });
  }
  M = { type: type, trash: trash, score: {}, bin: { x: W*0.5, y: type === 'sea' ? H*b.surface : H*b.bottom, dir: 1, w: 190 }, ended: false, start: performance.now() };
  if (type === 'forest') M.bins = BIN_DEF.map(function (d, i) { return { cat: d.cat, name: d.name, color: d.color, x: W*(0.14 + i*0.18), y: H*b.bottom, w: 120 }; });   // 숲: 분리수거함 5개
  say(type === 'sea' ? '🧹 바다 청소 시작!' : '🌲 숲 청소 시작!', W/2, H*0.2, '#ffd166'); Sound.play('cheer');
}
function missionStop(silent) {
  if (!M) return; M.ended = true;
  if (!silent) { var rank = Object.keys(M.score).map(function (id) { var sp = findSprite(id); return { n: M.score[id], nick: sp ? (sp.nick || sp.seat + '번') : '?' }; }).sort(function (p, q) { return q.n - p.n; });
    say(rank.length ? '🏆 ' + rank.slice(0, 3).map(function (r, i) { return (i + 1) + '등 ' + r.nick + ' ' + r.n + '개'; }).join('  ') : '청소 끝!', W/2, H*0.22, '#ffd166'); Sound.play('win'); }
  sprites.forEach(function (sp) { sp.holding = null; });
  var old = M; setTimeout(function () { if (M === old) M = null; }, silent ? 0 : 4000);
}
/* 줍기/놓기: 버튼 하나. 들고 있으면 놓고, 아니면 가까운 쓰레기를 집는다 */
function grab(id) {
  var sp = findSprite(id); if (!sp) return false;
  if (sp.art) return false;
  /* 작품 전시: 내 작품(같은 자리 번호)을 집어 옮기고 놓으면 그 자리에 전시된다. 청소 미션과 무관하게 된다 */
  if (sp.holdingArt) { var a = sp.holdingArt; a.heldBy = null; a.fixed = true; a.manual = null; sp.holdingArt = null; say('✨ 전시!', a.x, a.y - a.h*a.depth/2 - 40, '#ffd166'); Sound.play('friend'); return true; }
  var bestA = null, bdA = Math.max(110, sp.w*sp.depth*0.8);
  sprites.forEach(function (o) { if (!o.art || o.heldBy || o.seat !== sp.seat) return; var d = Math.hypot(o.x - sp.x, o.y - sp.y); if (d < bdA) { bdA = d; bestA = o; } });
  if (bestA && !sp.holding) { bestA.fixed = false; bestA.heldBy = sp; bestA.manual = null; bestA.ctrl = null; sp.holdingArt = bestA; sp.chat = { text: '작품을 들었다! ↺↻ 로 돌려요', at: performance.now(), until: performance.now() + 2500 }; Sound.play('enter'); return true; }
  if (!M || M.ended) { stuck(sp, bestA ? '' : '가까이에 내 작품이 없어'); return false; }
  if (sp.holding) return drop(id);
  var best = null, bd = Math.max(90, sp.w*sp.depth*0.7);
  M.trash.forEach(function (t) { if (t.held) return; var d = Math.hypot(t.x - sp.x, t.y - sp.y); if (d < bd) { bd = d; best = t; } });
  if (!best) { stuck(sp, '가까이에 쓰레기가 없어'); return false; }
  best.held = id; sp.holding = best; sp.chat = { text: '주웠다!', at: performance.now(), until: performance.now() + 1500 }; Sound.play('enter'); return true;
}
function rotateArt(id, dir) { var sp = findSprite(id); if (!sp) return false; var a = sp.holdingArt; if (!a) { stuck(sp, '작품을 먼저 들어요'); return false; } a.rot += dir*Math.PI/12; return true; }
function drop(id) {
  var sp = findSprite(id); if (!sp || !sp.holding) return false;
  var t = sp.holding; sp.holding = null; t.held = null;
  var near = false;
  if (M && !M.ended && M.bins) {                                                  // 분리수거: 가장 가까운 수거함이 맞는 종류여야 한다
    var bin = null, bd = 1e9; M.bins.forEach(function (bb) { var d = Math.abs(sp.x - bb.x); if (d < bd) { bd = d; bin = bb; } });
    if (bin && bd < bin.w*0.6 && Math.abs(sp.y - bin.y) < H*0.22) {
      if (bin.cat === TRASH_CAT[t.kind]) near = true;
      else { sp.chat = { text: '여기 아니야! ' + CAT_KO[TRASH_CAT[t.kind]] + ' 쓰레기야', at: performance.now(), until: performance.now() + 2500 }; t.x = sp.x; t.y = sp.y; t.vy = 0; Sound.play('thud'); return true; }
    }
  } else near = M && !M.ended && Math.abs(sp.x - M.bin.x) < M.bin.w*0.7 && Math.abs(sp.y - M.bin.y) < H*0.22;
  if (near) { M.trash = M.trash.filter(function (x) { return x !== t; }); M.score[id] = (M.score[id] || 0) + 1; say('+1', sp.x, sp.y - 80, '#7CFC00'); spawn('star', sp.x, sp.y - 40, 8); Sound.play('friend');
    if (!M.trash.length) missionStop(); return true; }
  t.x = sp.x; t.y = sp.y; t.vy = 0; sp.chat = { text: '앗, 떨어졌다', at: performance.now(), until: performance.now() + 1500 }; return true;
}
function missionTick(t, dt) {
  if (!M) return;
  var b = cur().band, floor = H*b.bottom - 14;
  // 수거선/수거함
  if (M.type === 'sea') { M.bin.x += M.bin.dir*18*dt; if (M.bin.x > W*0.85 || M.bin.x < W*0.15) M.bin.dir *= -1; M.bin.y = H*b.surface + Math.sin(t*1.3)*4; }
  M.trash.forEach(function (tr) {
    if (tr.held) { var sp = findSprite(tr.held); if (!sp) { tr.held = null; return; } tr.x = sp.x + (sp.dir > 0 ? -1 : 1)*sp.w*sp.depth*0.35; tr.y = sp.y + sp.h*sp.depth*0.1; return; }
    if (tr.float) { tr.x += tr.vx*dt + Math.sin(t*0.8 + tr.ph)*0.3; tr.y += Math.sin(t*1.1 + tr.ph)*0.25; if (tr.x < 20 || tr.x > W - 20) tr.vx *= -1; tr.y = Math.max(H*b.swim[0], Math.min(H*b.swim[1], tr.y)); }
    else if (tr.y < floor) { tr.vy += (M.type === 'sea' ? 60 : 500)*dt; tr.y += tr.vy*dt; if (tr.y >= floor) { tr.y = floor; tr.vy = 0; } }
  });
}
function drawMission(t) {
  if (!M) return;
  var bin = M.bin;
  g.save(); g.translate(bin.x, bin.y);
  if (M.type === 'sea') {                                                  // 수거선
    g.fillStyle = '#5a3b2a'; g.beginPath(); g.moveTo(-95, 0); g.lineTo(95, 0); g.lineTo(75, 36); g.lineTo(-75, 36); g.closePath(); g.fill();
    g.fillStyle = '#f1faee'; g.fillRect(-40, -46, 70, 46); g.fillStyle = '#1f6feb'; g.fillRect(-30, -36, 16, 14); g.fillRect(-6, -36, 16, 14);
    g.fillStyle = '#2ec4b6'; g.fillRect(30, -30, 50, 30); g.strokeStyle = '#1b2533'; g.lineWidth = 3; g.strokeRect(30, -30, 50, 30);
    g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText('♻', 55, -8);
    g.fillText('수거선 — 여기에 놓기', 0, 60);
  } else if (M.bins) {                                                     // 분리수거함 5개
    g.restore();
    M.bins.forEach(function (bb) {
      g.save(); g.translate(bb.x, bb.y);
      g.fillStyle = bb.color; g.beginPath(); g.roundRect(-50, -84, 100, 84, 10); g.fill(); g.strokeStyle = '#1b2533'; g.lineWidth = 4; g.strokeRect(-50, -84, 100, 84);
      g.fillStyle = '#1b2533'; g.fillRect(-56, -94, 112, 12);
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('♻', 0, -58);
      g.font = 'bold 20px sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(bb.name, 0, -30); g.fillText(bb.name, 0, -30);
      g.restore();
    });
    g.save();
  }
  g.restore();
  M.trash.forEach(function (tr) { g.save(); g.translate(tr.x, tr.y); g.rotate(tr.rot + (tr.float ? Math.sin(t + tr.ph)*0.2 : 0)); (TRASH_DRAW[tr.kind] || TRASH_DRAW.can)(g, tr.s); g.restore(); });
  // 점수판
  var ids = Object.keys(M.score).sort(function (p, q) { return M.score[q] - M.score[p]; }).slice(0, 5);
  g.save(); g.font = 'bold 20px sans-serif'; g.textAlign = 'left';
  var bw = 300, bh = 34 + ids.length*28 + 26; g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(14, 14, bw, bh, 12); g.fill();
  g.fillStyle = '#ffd166'; g.fillText((M.type === 'sea' ? '🧹 바다 청소' : '🌲 숲 청소') + '  남은 쓰레기 ' + M.trash.length, 28, 40);
  g.fillStyle = '#fff'; ids.forEach(function (id, i) { var sp = findSprite(id); g.fillText((i + 1) + '. ' + (sp ? (sp.nick || sp.seat + '번') : '?') + '  ' + M.score[id] + '개', 28, 70 + i*28); });
  if (!ids.length) { g.fillStyle = '#ddd'; g.font = '16px sans-serif'; g.fillText(M.bins ? '[줍기] → 종류에 맞는 수거함에서 [놓기]' : '쓰레기 옆에서 [줍기] → 수거 장소에서 [놓기]', 28, 70); }
  g.restore();
}

/* ═══════════════ 장면 ═══════════════ */
var scene = null, autoPlay = true, lastAuto = 0;
function free() { return sprites.filter(function (s) { return !s.ctrl && !s.art && s.x > 0 && s.x < W && ['sink','ride','hidden','breach','fin'].indexOf(s.motion) < 0 && !s.rising; }); }
function pickTwo() { var f = free(); if (f.length < 2) return null; f.sort(function(){return Math.random()-0.5;}); return [f[0], f[1]]; }
/* 장면이 벌어질 높이: 두 친구의 움직임이 허용하는 범위 안에서 */
function meetY(a, b) {
  var y = (a.y + b.y)/2, bd = cur().band;
  var lo = H*(bd.swim ? bd.swim[0] : 0.2), hi = H*bd.bottom - Math.max(halfH(a), halfH(b));
  return Math.max(lo, Math.min(hi, y));
}

function friends(pair) {
  if (!pair) return false;
  var a = pair[0], b = pair[1], cx = Math.max(W*0.2, Math.min(W*0.8, (a.x + b.x)/2)), cy = meetY(a, b);
  var start = performance.now();
  scene = { name: 'friends', tick: function () {
    var age = (performance.now() - start)/1000;
    if (!scene.started) { scene.started = true; Sound.play('friend'); }
    if (age < 1.5) { a.ctrl = { tx: cx - 70, ty: cy, face: 1 }; b.ctrl = { tx: cx + 70, ty: cy, face: -1 }; }
    else if (age < 7) {
      var ang = (age-1.5)*1.6;
      a.ctrl = { tx: cx + Math.cos(ang)*80, ty: cy + Math.sin(ang)*35, face: Math.sin(ang) < 0 ? 1 : -1, ease: 0.12, bounce: Math.abs(Math.sin(age*6))*12 };
      b.ctrl = { tx: cx - Math.cos(ang)*80, ty: cy - Math.sin(ang)*35, face: Math.sin(ang) < 0 ? -1 : 1, ease: 0.12, bounce: Math.abs(Math.cos(age*6))*12 };
      a.mood = '😊'; b.mood = '😊';
      if (Math.random() < 0.15) spawn('heart', cx + (Math.random()-0.5)*120, cy - 20, 1);
    } else { release(a); release(b); a.dir = 1; b.dir = -1; scene = null; }
  }};
  return true;
}

function ssireum(pair, done) {
  if (!pair) { if (done) done(); return false; }
  var a = pair[0], b = pair[1], cx = W/2, cy = meetY(a, b);
  var winner = Math.random() < 0.5 ? a : b, loser = winner === a ? b : a;
  var start = performance.now(), gap = (a.w*a.depth + b.w*b.depth)/4 + 10;
  say('씨름!', cx, cy - 140, '#ffd166'); Sound.play('cheer'); Sound.loop('ssireum');
  scene = { name: 'ssireum', tick: function () {
    var age = (performance.now() - start)/1000;
    if (age < 1.8) { a.ctrl = { tx: cx - gap - 30, ty: cy, face: 1, ease: 0.06 }; b.ctrl = { tx: cx + gap + 30, ty: cy, face: -1, ease: 0.06 }; }
    else if (age < 2.6) { a.ctrl = { tx: cx - gap, ty: cy, face: 1, rot: 0.25, ease: 0.15 }; b.ctrl = { tx: cx + gap, ty: cy, face: -1, rot: -0.25, ease: 0.15 }; a.mood = '😤'; b.mood = '😤'; }
    else if (age < 6) {
      var s = Math.sin(age*9)*14 + Math.sin(age*2.3)*30;
      a.ctrl = { tx: cx - gap + s, ty: cy + Math.sin(age*18)*4, face: 1, rot: 0.25 + Math.sin(age*9)*0.08, ease: 0.3 };
      b.ctrl = { tx: cx + gap + s, ty: cy - Math.sin(age*18)*4, face: -1, rot: -0.25 + Math.sin(age*9)*0.08, ease: 0.3 };
      if (Math.random() < 0.2) spawn('spark', cx + s, cy, 1);
    } else if (age < 7.8) {
      var f = (age-6)/1.8, side = loser === a ? -1 : 1;
      loser.ctrl = { tx: cx + side*(gap + 60 + f*260), ty: cy - Math.sin(f*Math.PI)*120, face: -side, rot: side*f*Math.PI*2, ease: 0.2 };
      winner.ctrl = { tx: cx - side*gap*0.5, ty: cy, face: side, rot: 0, bounce: Math.abs(Math.sin(age*10))*28, ease: 0.2 };
      winner.mood = '🎉'; loser.mood = '😵';
      if (age < 6.1) { say((winner.nick || (winner.seat ? winner.seat + '번' : '')) + ' 이겼다!', cx, cy - 160, '#ffd166'); spawn('star', winner.x, spriteTop(winner), 18); Sound.play('win'); Sound.stopLoop(); }
    } else { release(a); release(b); a.dir = -1; b.dir = 1; scene = null; if (done) done(); }
  }};
  return true;
}
/* 아이들끼리 하는 씨름(대결): 점수는 밖(아이 화면 연타)에서 들어온다. opts.duration 초 뒤 점수 높은 쪽이 이긴다 */
function duel(idA, idB, opts) {
  opts = opts || {};
  var a = null, b = null; sprites.forEach(function (s) { if (s.id === idA) a = s; if (s.id === idB) b = s; });
  if (!a || !b) return false;
  sprites.forEach(function (sp) { if (sp.ctrl) release(sp); }); Sound.stopLoop();
  a.manual = null; b.manual = null;
  var cx = W/2, cy = meetY(a, b), gap = (a.w*a.depth + b.w*b.depth)/4 + 10, dur = opts.duration || 8, start = performance.now();
  var sc = { a: 0, b: 0 }, ended = false;
  say((a.nick || '') + ' vs ' + (b.nick || ''), cx, cy - 140, '#ffd166'); Sound.play('cheer'); Sound.loop('ssireum');
  scene = { name: 'duel', a: a, b: b, setScores: function (sa, sb) { sc.a = +sa || 0; sc.b = +sb || 0; }, tick: function () {
    var age = (performance.now() - start)/1000;
    if (age < 1.8) { a.ctrl = { tx: cx - gap - 30, ty: cy, face: 1, ease: 0.06 }; b.ctrl = { tx: cx + gap + 30, ty: cy, face: -1, ease: 0.06 }; }
    else if (age < 3) { a.ctrl = { tx: cx - gap, ty: cy, face: 1, rot: 0.25, ease: 0.15 }; b.ctrl = { tx: cx + gap, ty: cy, face: -1, rot: -0.25, ease: 0.15 }; a.mood = '😤'; b.mood = '😤';
      if (!scene.counted) { scene.counted = true; say('준비!', cx, cy - 200, '#fff'); } }
    else if (age < 3 + dur) {
      if (!scene.go) { scene.go = true; say('시작!', cx, cy - 200, '#ffd166'); }
      var push = Math.max(-140, Math.min(140, (sc.a - sc.b)*8));             // 점수 차만큼 밀린다
      var s2 = push + Math.sin(age*9)*10;
      a.ctrl = { tx: cx - gap + s2, ty: cy + Math.sin(age*18)*4, face: 1, rot: 0.25 + Math.sin(age*9)*0.08, ease: 0.3 };
      b.ctrl = { tx: cx + gap + s2, ty: cy - Math.sin(age*18)*4, face: -1, rot: -0.25 + Math.sin(age*9)*0.08, ease: 0.3 };
      if (Math.random() < 0.25) spawn('spark', cx + s2, cy, 1);
      scene.bar = { a: sc.a, b: sc.b, left: Math.max(0, 3 + dur - age), x: cx, y: cy - 210 };
    } else if (age < 3 + dur + 1.8) {
      if (!scene.winner) { scene.winner = sc.a > sc.b ? a : sc.b > sc.a ? b : (Math.random() < 0.5 ? a : b); scene.bar = null;
        say((scene.winner.nick || (scene.winner.seat + '번')) + ' 이겼다!', cx, cy - 160, '#ffd166'); spawn('star', scene.winner.x, spriteTop(scene.winner), 18); Sound.play('win'); Sound.stopLoop(); }
      var winner = scene.winner, loser = winner === a ? b : a, f = (age - 3 - dur)/1.8, side = loser === a ? -1 : 1;
      loser.ctrl = { tx: cx + side*(gap + 60 + f*260), ty: cy - Math.sin(f*Math.PI)*120, face: -side, rot: side*f*Math.PI*2, ease: 0.2 };
      winner.ctrl = { tx: cx - side*gap*0.5, ty: cy, face: side, rot: 0, bounce: Math.abs(Math.sin(age*10))*28, ease: 0.2 };
      winner.mood = '🎉'; loser.mood = '😵';
    } else { release(a); release(b); a.dir = -1; b.dir = 1; var w = scene.winner; scene = null; if (opts.onEnd && !ended) { ended = true; opts.onEnd(w.id, sc.a, sc.b); } }
  }};
  return true;
}
/* 대결 점수판 */
function drawDuelBar() {
  if (!scene || scene.name !== 'duel' || !scene.bar) return;
  var bb = scene.bar, a = scene.a, b = scene.b, tot = Math.max(1, bb.a + bb.b), w = 520, h = 34, x = bb.x - w/2, y = bb.y;
  g.save(); g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect(x - 10, y - 40, w + 20, h + 80, 14); g.fill();
  g.fillStyle = '#ffd166'; g.fillText('⏱ ' + Math.ceil(bb.left) + '초  — 화살표를 여러 방향으로 연타!', bb.x, y - 14);
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
  g.fillStyle = '#e63946'; g.beginPath(); g.roundRect(x, y, w*(bb.a/tot), h, 8); g.fill();
  g.fillStyle = '#1f6feb'; g.beginPath(); g.roundRect(x + w*(bb.a/tot), y, w*(bb.b/tot), h, 8); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText((a.nick || a.seat + '번') + ' ' + bb.a, x, y + h + 28); g.textAlign = 'right'; g.fillText(bb.b + ' ' + (b.nick || b.seat + '번'), x + w, y + h + 28);
  g.restore();
}
function tournament() {
  var f = free(); f.sort(function(){return Math.random()-0.5;});
  if (f.length < 2) { say('친구가 더 필요해요', W/2, H/2, '#fff'); return; }
  var queue = []; for (var i = 0; i + 1 < f.length; i += 2) queue.push([f[i], f[i+1]]);
  (function next() { var p = queue.shift(); if (p) ssireum(p, next); })();
}
function dance() {
  var f = free(); if (f.length < 1) return;
  var start = performance.now(), n = f.length;
  say('춤 시간!', W/2, H*0.2, '#ffd166'); Sound.loop('dance');
  scene = { name: 'dance', tick: function () {
    var age = (performance.now() - start)/1000, beat = age*2*Math.PI*1.8;
    var ground = H*cur().band.bottom;
    f.forEach(function (sp, i) {
      var ang = Math.PI + (i + 0.5)/n*Math.PI, rx = W*0.38, ry = H*0.16;
      var bx = W/2 + Math.cos(ang)*rx, by = ground - halfH(sp) - 10 + Math.sin(ang)*ry;
      if (age < 2) sp.ctrl = { tx: bx, ty: by, face: bx < W/2 ? 1 : -1, ease: 0.06 };
      else {
        var odd = i % 2 ? Math.PI : 0;
        sp.ctrl = { tx: bx + Math.sin(beat/2 + odd)*20, ty: by, face: Math.sin(beat/2 + odd) > 0 ? 1 : -1, rot: Math.sin(beat + odd)*0.2, bounce: Math.max(0, Math.sin(beat + odd))*30, ease: 0.2 };
        sp.mood = '🎵';
      }
    });
    if (age > 2 && Math.random() < 0.25) spawn('note', W*0.2 + Math.random()*W*0.6, ground - H*0.25, 1);
    if (age > 16) { f.forEach(release); scene = null; Sound.stopLoop(); }
  }};
}
function follow(sp, leader) {
  var start = performance.now();
  var h = setInterval(function () {
    var age = (performance.now() - start)/1000;
    var stop = age > 8 || leader.ctrl || sprites.indexOf(leader) < 0 || sprites.indexOf(sp) < 0 || (sp.ctrl && !sp.ctrl.follow) || sp.motion === 'sink' || leader.motion === 'sink';
    if (stop) { if (sprites.indexOf(sp) >= 0 && sp.ctrl && sp.ctrl.follow) release(sp); clearInterval(h); return; }
    sp.ctrl = { tx: leader.x - leader.dir*(leader.w*leader.depth/2 + sp.w*sp.depth/2 + 20), ty: sp.ty, face: leader.dir, ease: 0.04, follow: true };
    sp.dir = leader.dir;
  }, 50);
}

/* ═══════════════ 메인 루프 ═══════════════ */
function step(now) {
  var t = (now - t0)/1000, dt = Math.min(0.05, (now - (step.last||now))/1000); step.last = now;
  if (W !== (canvas.clientWidth || window.innerWidth) || H !== (canvas.clientHeight || window.innerHeight)) resize();

  cur().draw(t);
  if (scene) scene.tick(t);
  else if (autoPlay && sprites.length >= 2 && t - lastAuto > 25 && Math.random() < 0.01) { lastAuto = t; friends(pickTwo()); }

  missionTick(t, dt);
  encounters(t);
  sprites.forEach(function (sp) { if (sp.ctrl) steer(sp); else if (sp.wait && !sp.manual) idleFacing(sp, t); else roam(sp, t, dt); });
  sprites.slice().sort(function (p, q) { return p.depth - q.depth; }).forEach(function (sp) { drawSprite(sp, t); drawBadge(sp); drawBubble(sp); });

  particles = particles.filter(function (p) { return p.age < p.life; });
  particles.forEach(function (p) {
    p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt;
    var grav = { spark: 200, sand: 300, splash: 400, bubble: -10 }[p.type]; p.vy += (grav === undefined ? -20 : grav)*dt;
    g.save(); g.globalAlpha = 1 - p.age/p.life;
    if (p.type === 'bubble') { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.3); g.stroke(); }
    else if (p.type === 'sand') { g.fillStyle = '#e0cf9a'; g.fillRect(p.x, p.y, p.s, p.s); }
    else if (p.type === 'splash') { g.fillStyle = '#dff3ff'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.3); g.fill(); }
    else {
      g.font = 'bold ' + p.s*1.4 + 'px sans-serif'; g.textAlign = 'center';
      var glyph = { heart: '♥', star: '★', note: '♪', spark: '✦' }[p.type];
      g.fillStyle = { heart: '#ff5c8a', star: '#ffd166', note: '#fff7ae', spark: '#ffffff' }[p.type];
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(glyph, p.x, p.y); g.fillText(glyph, p.x, p.y);
    }
    g.restore();
  });
  drawMission(t);
  drawDuelBar();
  texts = texts.filter(function (x) { return x.age < x.life; });
  texts.forEach(function (x) {
    x.age += dt; var f = Math.min(1, x.age*4);
    g.save(); g.globalAlpha = Math.min(1, (x.life - x.age)*2); g.translate(x.x, x.y - x.age*20); g.scale(f, f);
    g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(x.txt, 0, 0);
    g.fillStyle = x.color; g.fillText(x.txt, 0, 0); g.restore();
  });

  if (nextWorld) {
    worldFade += dt*1.5;
    if (worldFade >= 1 && world !== nextWorld) {
      world = nextWorld; scene = null; if (opts.onWorld) opts.onWorld(world);
      sprites.forEach(function (sp) { sp.ctrl = null; sp.mood = null; sp.bounce = 0; });
      sprites.filter(function (sp) { return sp.motion === 'float'; }).forEach(function (sp) { applyRules(sp, false); });   // 배부터 정해야 사람이 탈 수 있다
      sprites.filter(function (sp) { return sp.motion !== 'float'; }).forEach(function (sp) { applyRules(sp, false); });
    }
    if (worldFade >= 2) { nextWorld = null; worldFade = 0; }
    g.fillStyle = 'rgba(0,0,0,' + (worldFade < 1 ? worldFade : 2 - worldFade) + ')'; g.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);


  function endScene() { scene = null; Sound.stopLoop(); sprites.forEach(function (sp) { if (sp.ctrl) release(sp); }); }
  function setWorld(name) { if ((WORLDS[name] || CUSTOM[name]) && name !== world && !nextWorld) { nextWorld = name; worldFade = 0; } }
  function clear() { sprites = []; scene = null; Sound.stopLoop(); updateCount(); }
  function removeSprite(id) { sprites = sprites.filter(function (s) { return s.id !== id; }); updateCount(); }
  function add(img, meta) { meta = meta || {}; if (meta.id) { var dup = sprites.some(function (s) { return s.id === meta.id; }); if (dup) return null; }
    var keep = opts.idFor; opts.idFor = meta.id ? function () { return meta.id; } : null; opts._rig = meta.rig ? { name: meta.rig, box: meta.rigBox } : null; addSprite(img, meta.seat, meta.cat, meta.nick, meta.desc); opts.idFor = keep; opts._rig = null;
    var sp = sprites[sprites.length - 1]; if (meta.abil) { sp.abil = meta.abil; applyRules(sp, true); }
    sp.demo = !!meta.demo; sp.art = meta.cat === 'art';
    var face = meta.face || (meta.rigBox && meta.rigBox.face);                 // 아이가 고른 그림 방향이 도안 기본값보다 우선
    if (face) { sp.faceLeft = face === 'left'; sp.noFlip = face === 'front'; }
    return sp; }
  function findSprite(id) { for (var i = 0; i < sprites.length; i++) if (sprites[i].id === id) return sprites[i]; return null; }
  /* 조종: dx,dy ∈ {-1,0,1}. 입력이 없으면 3초 뒤 자동 복귀. 장면(씨름 등) 중에는 무시 */
  function control(id, dx, dy) {
    var sp = findSprite(id); if (!sp || (sp.ctrl && !sp.ctrl.follow)) return false;
    if (sp.ctrl && sp.ctrl.follow) release(sp);
    if (!dx && !dy) { if (sp.manual) sp.manual.until = performance.now() + 400; return true; }   // 손을 뗌: 잠깐 뒤 자동 복귀
    /* 규칙에 묶인 것은 못 움직인다 (설명으로 능력을 받은 그림은 예외) */
    if (sp.motion === 'sink' || sp.motion === 'ride') { stuck(sp, '난 못 움직여…'); return 'stuck'; }
    if (sp.motion === 'hidden' || sp.motion === 'fin' || sp.motion === 'breach') { if (dy < 0) { stuck(sp, '물 밖으론 못 나가!'); return 'stuck'; } }
    var b = cur().band;
    if ((sp.motion === 'swim' || sp.motion === 'clam') && dy < 0 && b.swim && sp.y <= H*b.swim[0] + 4) { stuck(sp, '물 밖으론 못 나가!'); return 'stuck'; }   // 물고기·잠수함은 수면 위로 못 간다
    if (sp.motion === 'fly' && dy > 0 && b.sky && sp.y >= H*b.sky[1] - 4) { stuck(sp, '더는 못 내려가!'); return 'stuck'; }
    sp.manual = { dx: dx, dy: dy, until: performance.now() + 3500 }; sp.rising = false; sp.lastInput = performance.now();
    return true;
  }
  function stuck(sp, text) { if (!sp.chat || sp.chat.text !== text) sp.chat = { text: text, at: performance.now(), until: performance.now() + 2500 }; }
  function friendsById(idA, idB) { var a = findSprite(idA), b = findSprite(idB); if (!a || !b) return false; endScene(); a.manual = null; b.manual = null; return friends([a, b]); }
  /* 화면 안 그림들의 위치(0~1 비율). 아이 화면의 '가까운 친구' 판단용 */
  function positions() { var o = {}; sprites.forEach(function (sp) { if (sp.x > 0 && sp.x < W) o[sp.id] = { x: +(sp.x/W).toFixed(3), y: +(sp.y/H).toFixed(3), seat: sp.seat || 0, nick: sp.nick || '', demo: sp.demo ? 1 : 0, hold: (sp.holding || sp.holdingArt) ? 1 : 0, holdArt: sp.holdingArt ? 1 : 0, art: sp.art ? 1 : 0, with: sp.wait ? sp.wait.id : '' }; }); return o; }
  function nearestDemo(id, maxFrac) { var me = findSprite(id); if (!me) return null; var best = null, bd = (maxFrac || 0.35)*W;
    sprites.forEach(function (sp) { if (!sp.demo || sp === me || sp.x < 0 || sp.x > W) return; var d = Math.hypot(sp.x - me.x, sp.y - me.y); if (d < bd) { bd = d; best = sp; } }); return best; }
  function dash(id, secs) { var sp = findSprite(id); if (!sp) return; if (sp.wait) { sp.wait.wait = null; sp.wait = null; } sp.speed *= 3; setTimeout(function () { sp.speed /= 3; }, (secs || 4)*1000); }
  function flee(id, fromId) { var sp = findSprite(id), f = findSprite(fromId); if (!sp) return; sp.dir = f && f.x > sp.x ? -1 : 1; sp.manual = null; dash(id, 3); if (sp.jumpT === undefined) sp.jumpT = (performance.now() - t0)/1000; }
  function chat(id, text) {
    var sp = findSprite(id); if (!sp) return false;
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!text) return false;
    sp.chat = { text: text, at: performance.now(), until: performance.now() + 4000 + text.length*120 };
    Sound.play('enter'); return true;
  }
  return {
    add: add, clear: clear, removeSprite: removeSprite, control: control, chat: chat, find: findSprite, duel: duel, friendsById: friendsById, positions: positions,
    nearestDemo: nearestDemo, dash: dash, flee: flee,
    missionStart: missionStart, missionStop: function () { missionStop(false); }, grab: grab, rotateArt: rotateArt, mission: function () { return M ? { type: M.type, left: M.trash.length, ended: M.ended, bin: { x: M.bin.x, y: M.bin.y }, trash: M.trash.map(function (t) { return { x: t.x, y: t.y, held: t.held, kind: t.kind }; }), score: M.score } : null; },
    duelScores: function (sa, sb) { if (scene && scene.name === 'duel') scene.setScores(sa, sb); }, sceneName: function () { return scene ? scene.name : null; }, setWorld: setWorld, defineWorld: defineWorld, worlds: WORLDS, custom: CUSTOM,
    friends: function () { endScene(); friends(pickTwo()); }, tournament: function () { endScene(); tournament(); }, dance: function () { endScene(); dance(); }, endScene: endScene,
    setAuto: function (v) { autoPlay = !!v; }, getAuto: function () { return autoPlay; }, sound: Sound, cutout: cutoutPaper, parseAbilities: parseAbilities,
    setStats: function (id, s) { var sp = findSprite(id); if (!sp || !s) return; sp.speedMul = s.speedMul != null ? s.speedMul : sp.speedMul; sp.stats = s; },
    setHome: function (id, x, y) { var sp = findSprite(id); if (sp) { sp.homeX = x; sp.homeY0 = y; } },
    sprites: function () { return sprites; }, world: function () { return world; }, say: function (t, c) { say(t, W/2, H*0.2, c || '#ffd166'); }
  };
}
