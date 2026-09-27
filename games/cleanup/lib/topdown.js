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

  /* ───────── 생성 이미지 에셋 (있으면 사용, 없으면 벡터 폴백) ───────── */
  var ASSET_BASE = opts.assetBase || '../assets/';
  var GROUND = {}, SPRITE = {}, CHARIMG = {};
  function loadImg(src, into, key) { var im = new Image(); im.onload = function () { im._ok = true; into[key] = im; if (into === GROUND && key === mapKey) buildBlock(); }; im.onerror = function () {}; im.src = src; }
  function loadAssets() {
    ['village', 'beach', 'valley', 'gotjawal'].forEach(function (k) { loadImg(ASSET_BASE + 'maps/' + k + '.jpg', GROUND, k); });
    ['house', 'wall', 'dolharbang', 'tangerine', 'rock', 'basalt', 'tree', 'fern', 'buoy', 'deer'].forEach(function (k) { loadImg(ASSET_BASE + 'obstacles/' + k + '.png', SPRITE, k); });
    ['seal', 'crab', 'pony', 'gull', 'haenyeo'].forEach(function (k) { loadImg(ASSET_BASE + 'chars/' + k + '.png', CHARIMG, k); });
  }
  loadAssets();

  /* ───────── 쓰레기 종류 ───────── */
  var TRASH = {
    cup:   { c: '#ff9f1c', d: function (c, s) { c.fillStyle = '#ff9f1c'; c.beginPath(); c.moveTo(-s*.5, -s*.6); c.lineTo(s*.5, -s*.6); c.lineTo(s*.35, s*.6); c.lineTo(-s*.35, s*.6); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(-s*.5, -s*.6, s, s*.18); } },
    bag:   { c: '#8fd3ff', d: function (c, s) { c.fillStyle = 'rgba(180,220,255,.92)'; c.beginPath(); c.moveTo(-s*.5, -s*.4); c.lineTo(-s*.2, -s*.65); c.lineTo(s*.2, -s*.5); c.lineTo(s*.55, -s*.2); c.lineTo(s*.35, s*.6); c.lineTo(-s*.45, s*.5); c.closePath(); c.fill(); } },
    can:   { c: '#c0c6cc', d: function (c, s) { c.fillStyle = '#c8ced4'; c.fillRect(-s*.35, -s*.6, s*.7, s*1.2); c.fillStyle = '#e63946'; c.fillRect(-s*.35, -s*.15, s*.7, s*.3); c.strokeStyle = '#8a9199'; c.lineWidth = 2; c.strokeRect(-s*.35, -s*.6, s*.7, s*1.2); } },
    bottle:{ c: '#2ec4b6', d: function (c, s) { c.fillStyle = 'rgba(120,220,200,.9)'; c.beginPath(); c.roundRect(-s*.28, -s*.4, s*.56, s*1.0, s*.2); c.fill(); c.fillRect(-s*.14, -s*.7, s*.28, s*.32); c.fillStyle = '#1b9e8f'; c.fillRect(-s*.16, -s*.72, s*.32, s*.1); } },
    leaf:  { c: '#b45309', d: function (c, s) { c.fillStyle = '#c0672a'; c.beginPath(); c.ellipse(0, 0, s*.6, s*.35, 0.6, 0, 6.3); c.fill(); c.strokeStyle = '#7a3d16'; c.lineWidth = 2; c.beginPath(); c.moveTo(-s*.4, -s*.25); c.lineTo(s*.4, s*.25); c.stroke(); } },
    snack: { c: '#ff4fa3', d: function (c, s) { c.fillStyle = '#ff5aa8'; c.beginPath(); c.moveTo(-s*.55, -s*.4); c.lineTo(s*.55, -s*.5); c.lineTo(s*.5, s*.5); c.lineTo(-s*.5, s*.45); c.closePath(); c.fill(); c.fillStyle = '#ffd166'; c.fillRect(-s*.3, -s*.12, s*.6, s*.22); } },
    stick: { c: '#f2c14e', d: function (c, s) { c.strokeStyle = '#d9a441'; c.lineWidth = s*.22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s*.5, s*.5); c.lineTo(s*.3, -s*.4); c.stroke(); c.fillStyle = '#ff7ab6'; c.beginPath(); c.arc(s*.35, -s*.45, s*.34, 0, 6.3); c.fill(); } },
    juice: { c: '#8338ec', d: function (c, s) { c.fillStyle = '#9a5cf0'; c.fillRect(-s*.35, -s*.55, s*.7, s*1.1); c.fillStyle = '#ffd166'; c.fillRect(-s*.2, -s*.5, s*.4, s*.3); c.strokeStyle = '#5f28a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(s*.1, -s*.55); c.lineTo(s*.3, -s*.85); c.stroke(); } },
    paper: { c: '#eef1f6', d: function (c, s) { c.fillStyle = '#eef1f6'; c.beginPath(); c.moveTo(-s*.5,-s*.4); c.lineTo(-s*.1,-s*.55); c.lineTo(s*.45,-s*.35); c.lineTo(s*.5,s*.45); c.lineTo(-s*.1,s*.55); c.lineTo(-s*.55,s*.3); c.closePath(); c.fill(); c.strokeStyle='#b9c2d0'; c.lineWidth=2; c.beginPath(); c.moveTo(-s*.2,-s*.2); c.lineTo(s*.2,s*.1); c.moveTo(s*.1,-s*.25); c.lineTo(-s*.15,s*.25); c.stroke(); } },
    glass: { c: '#2f9e44', d: function (c, s) { c.fillStyle = 'rgba(90,200,120,.92)'; c.beginPath(); c.roundRect(-s*.26, -s*.35, s*.52, s*.95, s*.18); c.fill(); c.fillRect(-s*.13, -s*.68, s*.26, s*.36); c.fillStyle='#1f7a34'; c.fillRect(-s*.15,-s*.72,s*.3,s*.1); c.fillStyle='rgba(255,255,255,.4)'; c.fillRect(-s*.16,-s*.2,s*.08,s*.5); } },
    scrap: { c: '#8a9199', d: function (c, s) { c.fillStyle = '#9aa2ab'; c.beginPath(); c.moveTo(-s*.5,s*.3); c.lineTo(-s*.3,-s*.4); c.lineTo(s*.2,-s*.5); c.lineTo(s*.5,-s*.05); c.lineTo(s*.3,s*.5); c.closePath(); c.fill(); c.strokeStyle='#69707a'; c.lineWidth=2; c.stroke(); c.beginPath(); c.moveTo(-s*.2,-s*.35); c.lineTo(s*.1,s*.35); c.stroke(); c.fillStyle='#b7bec6'; c.beginPath(); c.arc(-s*.05,-s*.05,s*.08,0,6.3); c.fill(); } }
  };

  /* ───────── 분리수거 카테고리 (6종) ───────── */
  var TRASH_CAT = { cup: 'plastic', bottle: 'plastic', can: 'metal', scrap: 'metal', bag: 'vinyl', snack: 'vinyl', leaf: 'general', stick: 'general', juice: 'paper', paper: 'paper', glass: 'glass' };
  var CAT = { general: { name: '일반', color: '#8a9199' }, paper: { name: '종이', color: '#1f6feb' }, plastic: { name: '플라스틱', color: '#ffd166' }, vinyl: { name: '비닐', color: '#38b6d9' }, metal: { name: '캔·고철', color: '#ff7a3d' }, glass: { name: '유리병', color: '#2f9e44' } };
  /* 종류별 흐름 계수: 가벼울수록 잘 흘러다님 / 무거운 것(고철·유리·캔)은 거의 안 흘러 */
  var DRIFT = { bag: 1.3, leaf: 1.2, snack: 1.1, paper: 1.0, cup: 0.9, juice: 0.8, stick: 0.6, bottle: 0.35, glass: 0.2, can: 0.22, scrap: 0.12 };

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
    building: function (c, w, h) {                                  // 직부감(위에서 본 옥상) — 폴백 벡터
      function rr(x,y,ww,hh,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+ww,y,x+ww,y+hh,r); c.arcTo(x+ww,y+hh,x,y+hh,r); c.arcTo(x,y+hh,x,y,r); c.arcTo(x,y,x+ww,y,r); c.closePath(); }
      c.fillStyle='rgba(0,0,0,.22)'; rr(-w/2+7,-h/2+9,w,h,12); c.fill();          // 높이감 그림자
      c.fillStyle='#6b7b90'; rr(-w/2,-h/2,w,h,12); c.fill();                       // 옥상 테두리(파라펫)
      c.fillStyle='#5f6e82'; rr(-w/2+12,-h/2+12,w-24,h-24,8); c.fill();            // 옥상 바닥
      c.fillStyle='#48566a'; rr(-w/2+20,-h/2+20,Math.max(16,w*0.22),Math.max(16,h*0.22),4); c.fill();     // 계단탑
      c.fillStyle='#9aa7b8'; c.beginPath(); c.arc(w*0.16,-h*0.04,Math.max(7,w*0.09),0,6.3); c.fill(); c.strokeStyle='#48566a'; c.lineWidth=2; c.stroke();  // 급수탱크
      c.fillStyle='#39465a'; for(var i=0;i<3;i++) c.fillRect(-w/2+22+i*14, h/2-26, 9, 13); },          // 실외기
    wall: function (c, w, h) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-w/2+4, -h/2+5, w, h); c.fillStyle = '#a9865f'; c.fillRect(-w/2, -h/2, w, h);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; for (var y = -h/2+10; y < h/2; y += 12) { c.beginPath(); c.moveTo(-w/2, y); c.lineTo(w/2, y); c.stroke(); } },
    bench: function (c, w, h) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-w/2+3, -h/2+4, w, h); c.fillStyle = '#b5794a'; c.fillRect(-w/2, -h/2, w, h); c.fillStyle = '#8a5a34'; for (var x = -w/2; x < w/2; x += w/4) c.fillRect(x, -h/2, 3, h); },
    bush: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.4, r*.85, r*.3, 0, 0, 6.3); c.fill(); c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(-r*.4, 0, r*.55, 0, 6.3); c.arc(r*.4, 0, r*.55, 0, 6.3); c.arc(0, -r*.3, r*.6, 0, 6.3); c.fill(); },
    pond: function (c, r) { c.fillStyle = '#3aa5d9'; c.beginPath(); c.ellipse(0, 0, r, r*.72, 0, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-r*.3, -r*.2, r*.3, r*.12, 0.4, 0, 6.3); c.fill(); c.strokeStyle = '#2b83ad'; c.lineWidth = 3; c.stroke(); },
    bear: function (c, r) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, r*.5, r*.8, r*.3, 0, 0, 6.3); c.fill(); c.fillStyle = '#6b4226'; c.beginPath(); c.arc(0, 0, r*.85, 0, 6.3); c.fill(); c.beginPath(); c.arc(-r*.55, -r*.6, r*.28, 0, 6.3); c.arc(r*.55, -r*.6, r*.28, 0, 6.3); c.fill(); c.fillStyle = '#3a2415'; c.beginPath(); c.arc(-r*.28, -r*.1, r*.1, 0, 6.3); c.arc(r*.28, -r*.1, r*.1, 0, 6.3); c.arc(0, r*.2, r*.12, 0, 6.3); c.fill(); },
    squirrel: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.5, r*.7, r*.25, 0, 0, 6.3); c.fill(); c.fillStyle = '#c0672a'; c.beginPath(); c.arc(0, 0, r*.6, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(r*.3, r*.3); c.quadraticCurveTo(r*1.1, r*.1, r*.6, -r*.7); c.quadraticCurveTo(r*.5, -r*.1, r*.3, r*.1); c.fill(); c.fillStyle = '#3a2415'; c.beginPath(); c.arc(-r*.2, -r*.1, r*.08, 0, 6.3); c.fill(); },
    dolharbang: function (c, r) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.ellipse(0, r*.6, r*.6, r*.2, 0, 0, 6.3); c.fill();
      c.fillStyle = '#4a4d52'; c.beginPath(); c.ellipse(0, r*.2, r*.5, r*.6, 0, 0, 6.3); c.fill(); c.beginPath(); c.arc(0, -r*.4, r*.42, 0, 6.3); c.fill();      // 몸·머리
      c.fillStyle = '#3a3d42'; c.beginPath(); c.ellipse(0, -r*.6, r*.5, r*.22, 0, 0, 6.3); c.fill();                                                            // 모자
      c.fillStyle = '#2c2e33'; c.beginPath(); c.arc(-r*.16,-r*.38,r*.09,0,6.3); c.arc(r*.16,-r*.38,r*.09,0,6.3); c.fill(); },                                    // 눈
    fern: function (c, r) { c.fillStyle = 'rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(0, r*.4, r*.7, r*.22, 0, 0, 6.3); c.fill();
      c.strokeStyle = '#4f9e52'; c.lineWidth = r*.14; c.lineCap='round'; for (var i=0;i<6;i++){ c.save(); c.rotate((i/6-0.5)*1.6); c.beginPath(); c.moveTo(0,r*.3); c.quadraticCurveTo(r*.1,-r*.3,0,-r*.6); c.stroke(); c.restore(); } },
    buoy: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.4, r*.6, r*.2, 0, 0, 6.3); c.fill();
      c.fillStyle = '#ff7a3d'; c.beginPath(); c.arc(0, 0, r*.55, 0, 6.3); c.fill(); c.strokeStyle='#d9612a'; c.lineWidth=2; c.stroke(); c.fillStyle='rgba(255,255,255,.4)'; c.beginPath(); c.arc(-r*.18,-r*.18,r*.14,0,6.3); c.fill(); },
    deer: function (c, r) { c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(0, r*.55, r*.7, r*.22, 0, 0, 6.3); c.fill();
      c.fillStyle = '#b98a5a'; c.beginPath(); c.ellipse(0, r*.15, r*.5, r*.5, 0, 0, 6.3); c.fill(); c.beginPath(); c.arc(0, -r*.45, r*.32, 0, 6.3); c.fill();
      c.strokeStyle = '#8a5a34'; c.lineWidth = r*.08; c.beginPath(); c.moveTo(-r*.15,-r*.7); c.lineTo(-r*.25,-r*.95); c.moveTo(r*.15,-r*.7); c.lineTo(r*.25,-r*.95); c.stroke();
      c.fillStyle = '#3a2415'; c.beginPath(); c.arc(-r*.13,-r*.45,r*.07,0,6.3); c.arc(r*.13,-r*.45,r*.07,0,6.3); c.fill(); }
  };
  OB.house = OB.building; OB.tangerine = OB.tree; OB.basalt = OB.rock;   // 벡터 폴백 별칭

  /* ───────── 맵 정의 (obstacles: 정규좌표 0..1) ───────── */
  function G_bg(c, w, h, cols) { var grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]); c.fillStyle = grd; c.fillRect(0, 0, w, h); }
  var MAPS = {
    village: { name: '제주 마을', emoji: '🏘️', terrain: 'village', trashKinds: ['bag', 'can', 'cup', 'paper'], trashN: 24,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#c3ab7f', '#b09564']);                    // 흙길
        c.fillStyle = 'rgba(90,120,70,.28)'; [[0.12,0.2,0.18,0.12],[0.8,0.7,0.16,0.12]].forEach(function(g){ c.fillRect(g[0]*w,g[1]*h,g[2]*w,g[3]*h); });  // 밭/잔디
        c.strokeStyle = 'rgba(45,45,50,.5)'; c.lineWidth = 7; c.setLineDash([10,8]);       // 돌담 라인
        c.beginPath(); c.moveTo(0,h*0.5); c.lineTo(w,h*0.5); c.moveTo(w*0.5,0); c.lineTo(w*0.5,h); c.stroke(); c.setLineDash([]); },
      obstacles: [], water: null, col: 'dark', waterImg: false,      // 돌담=어두운 바위 감지
      bins: [ {x:.5, y:.1} ] },
    beach: { name: '제주 해변', emoji: '🏖️', terrain: 'sand', trashKinds: ['bottle', 'bag', 'glass', 'cup'], trashN: 26,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#e6d3a3', '#d8c088']);                    // 모래
        c.fillStyle = '#2f9ec2'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h*.74); for (var x = 0; x <= w; x += 24) c.lineTo(x, h*.74 + Math.sin(x*0.03 + t*1.8)*7); c.lineTo(w, h); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.5)'; for (var x2=0;x2<=w;x2+=24) c.fillRect(x2, h*0.74+Math.sin(x2*0.03+t*1.8)*7-2, 12, 3); },
      obstacles: [], water: { x0:0, y0:0.70, x1:1, y1:1 }, col: 'dark', waterImg: true,   // 바위 감지 + 바다=이미지 청록
      bins: [ {x:.5, y:.12} ] },
    valley: { name: '제주 계곡', emoji: '🏞️', terrain: 'water', trashKinds: ['bottle', 'glass', 'can', 'paper'], trashN: 24,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#4f8a6e', '#3c6e58']);                    // 이끼 바닥
        c.fillStyle = '#2f9e8f'; c.fillRect(w*0.32, 0, w*0.36, h);                          // 계곡물 줄기
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth=5; for (var y=30;y<h;y+=50){ c.beginPath(); for(var x=w*0.32;x<=w*0.68;x+=20) c.lineTo(x, y+Math.sin(x*0.03+t*1.6+y)*5); c.stroke(); } },
      obstacles: [], water: { x0:0.20, y0:0, x1:0.82, y1:1 }, col: 'dark', waterImg: true,  // 바위 둑 + 계곡물=이미지 청록
      bins: [ {x:.15, y:.1} ] },
    gotjawal: { name: '곶자왈', emoji: '🌿', terrain: 'forest', trashKinds: ['leaf', 'snack', 'paper', 'can'], trashN: 26,
      bg: function (c, w, h, t) { G_bg(c, w, h, ['#356b41', '#274f32']);                    // 어두운 이끼
        c.fillStyle = 'rgba(0,0,0,.10)'; for (var i = 0; i < 44; i++) { var x = (i*89 % w), y = (i*137 % h); c.fillRect(x, y, 9, 4); }
        c.fillStyle = 'rgba(160,200,120,.10)'; for (var j=0;j<10;j++){ c.beginPath(); c.arc((j*151%w),(j*211%h),40,0,6.3); c.fill(); } },
      obstacles: [], water: null, col: 'none', waterImg: false,       // 숲 바닥=전부 보행(어두움=흙)
      bins: [ {x:.5, y:.1} ] }
  };

  /* ───────── 상태 ───────── */
  var mapKey = 'gotjawal', players = {}, trash = [], particles = [], texts = [], M = null;
  var t0 = performance.now(), last = t0, banner = null;
  var BASE_SPEED_FRAC = 0.19;                                   // 화면 높이 기준 초당 이동(×speedMul) — 캐릭터 이동속도
  var spread = 1.0;                                             // 맵 크기(0.72 작게 ~ 1.18 크게): 배치를 중심 기준 확대/축소
  var wind = { x: 0, y: 0, t: 0 };                              // 바람/해류 벡터

  function curMap() { return MAPS[mapKey] || MAPS.gotjawal; }
  function rx(x) { return Math.max(0.04, Math.min(0.96, 0.5 + (x - 0.5) * spread)); }   // 맵 크기 리매핑
  function ry(y) { return Math.max(0.06, Math.min(0.96, 0.5 + (y - 0.5) * spread)); }
  function px(o) { return { x: rx(o.x) * W, y: ry(o.y) * H }; }

  /* ── 이미지 기반 충돌(어두운 바위·돌담) + 물 지형(청록 픽셀) ──
     맵별 col('dark'=어두운 바위/돌담 막힘, 'none'=막힘없음) · waterImg(청록=물) */
  var BLOCK = null, WATER = null;                              // {gw,gh,cells} 1=막힘 / 1=물
  function buildBlock() {
    BLOCK = null; WATER = null;
    var m = curMap(); var img = GROUND[mapKey];
    if (!img || !img._ok) return;
    if (m.col !== 'dark' && !m.waterImg) return;               // 이미지에서 뽑을 게 없으면 스킵
    var gw = 170, gh = Math.max(1, Math.round(gw * (img.height / img.width)));
    var oc = document.createElement('canvas'); oc.width = gw; oc.height = gh;
    var o = oc.getContext('2d', { willReadFrequently: true }); o.drawImage(img, 0, 0, gw, gh);
    var d = o.getImageData(0, 0, gw, gh).data;
    var rawB = new Uint8Array(gw*gh), rawW = new Uint8Array(gw*gh);
    for (var i = 0, p = 0; i < d.length; i += 4, p++) { var r = d[i], g = d[i+1], b = d[i+2];
      var mx = Math.max(r,g,b), mn = Math.min(r,g,b), lum = r*0.3+g*0.59+b*0.11, sat = mx-mn;
      if (m.col === 'dark' && lum < 52 && sat < 46) rawB[p] = 1;   // 어두운 저채도 = 현무암/돌담
      if (m.waterImg && b > r + 12 && lum > 55) rawW[p] = 1;       // 청록/파랑 + 밝음 = 물
    }
    if (m.col === 'dark') {                                     // 얇은 돌담 1px 팽창
      var cells = new Uint8Array(gw*gh);
      for (var y=0;y<gh;y++) for (var x=0;x<gw;x++){ var q=y*gw+x; var on=rawB[q]||(x>0&&rawB[q-1])||(x<gw-1&&rawB[q+1])||(y>0&&rawB[q-gw])||(y<gh-1&&rawB[q+gw]); cells[q]=on?1:0; }
      BLOCK = { gw: gw, gh: gh, cells: cells };
    }
    if (m.waterImg) {
      WATER = { gw: gw, gh: gh, cells: rawW };
      // 물가(해안선): 아래에서 위로 이어지는 '바다' 띠의 맨 윗행(위쪽 잡티는 무시)
      var shore = new Float32Array(gw); var waterFrac = 0;
      for (var gx2 = 0; gx2 < gw; gx2++) { var yb = gh - 1;
        while (yb >= 0 && rawW[yb*gw+gx2]) { yb--; waterFrac++; }
        shore[gx2] = (gh - 1 - yb >= 3) ? (yb + 1) / gh : -1;   // 3행 이상 이어질 때만 해안선
      }
      WATER.shore = shore; WATER.frac = waterFrac / (gw*gh);
    }
  }
  function blockedAt(x, y) { if (!BLOCK) return false; var gx = Math.floor(x/W*BLOCK.gw), gy = Math.floor(y/H*BLOCK.gh);
    if (gx<0||gy<0||gx>=BLOCK.gw||gy>=BLOCK.gh) return false; return BLOCK.cells[gy*BLOCK.gw+gx] === 1; }
  function terrainAt(x, y) {
    var m = curMap();
    if (WATER) { var gx = Math.floor(x/W*WATER.gw), gy = Math.floor(y/H*WATER.gh);   // 이미지에서 물 판정
      if (gx>=0&&gy>=0&&gx<WATER.gw&&gy<WATER.gh && WATER.cells[gy*WATER.gw+gx]) return 'water';
      return m.terrain === 'water' ? 'sand' : m.terrain;        // 계곡: 물 아닌 곳은 바위둑(육지)
    }
    var wz = m.water; if (wz && x>=wz.x0*W && x<=wz.x1*W && y>=wz.y0*H && y<=wz.y1*H) return 'water';
    return m.terrain;
  }

  /* 장애물 픽셀 도형 목록 (맵 크기 반영) */
  function obstaclePx() {
    return curMap().obstacles.map(function (o) {
      if (o.w != null) return { rect: true, kind: o.kind, x: rx(o.x)*W, y: ry(o.y)*H, w: o.w*W*spread, h: o.h*H*spread, r: 0 };
      return { rect: false, kind: o.kind, x: rx(o.x)*W, y: ry(o.y)*H, r: (o.r||30) };
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
    if (!p) { p = players[id] = { id: id, x: W*(0.2 + Math.random()*0.6), y: H*0.86, dir: 1, holds: [], score: 0, ctrl: null, bob: Math.random()*6, moist: 100, stunUntil: 0, cool: 0 }; p.startX = p.x; p.startY = p.y; }
    p.nick = meta.nick || p.nick || ''; p.seat = meta.seat || p.seat; p.char = meta.char || p.char;
    p.img = meta.img || p.img; p.speedMul = meta.speedMul != null ? meta.speedMul : (p.speedMul || 1);
    p.gaitHz = ({ seal: 6, crab: 13, pony: 12, gull: 15, haenyeo: 7 })[p.char] || 10;   // 캐릭터별 걸음 속도
    if (meta.ai != null) p.ai = !!meta.ai;                        // AI 경쟁 캐릭터 여부
    if (opts.onCount) opts.onCount(Object.keys(players).length);
    return p;
  }
  function removePlayer(id) { delete players[id]; if (opts.onCount) opts.onCount(Object.keys(players).length); }
  function setStats(id, s) { var p = players[id]; if (p && s) { p.speedMul = s.speedMul != null ? s.speedMul : p.speedMul; if (s.speedByTerrain) p.speedByTerrain = s.speedByTerrain; p.stats = s; } }
  function st(p) { return p.stats || { capacity: 15, pickup: 'single', areaR: 0, canHeavy: true, canCorner: true, canSteal: false, cooldown: 0.4, collect: 1, leak: 0, skewerLoss: 0.3 }; }
  function cap(p) { return st(p).capacity || 15; }
  function control(id, dx, dy) { var p = players[id]; if (!p) return; p.lastInput = performance.now(); if (performance.now() < p.stunUntil) { p.ctrl = null; return; } if (!dx && !dy) { p.ctrl = null; return; } p.ctrl = { dx: dx, dy: dy, until: performance.now() + 600 }; }
  function act(id, a) { var p = players[id]; if (!p) return; p.lastInput = performance.now(); if (performance.now() < p.stunUntil) return; if (a === 'grab') grab(p); else if (a === 'bump' || a === 'steal') bump(p); else if (a === 'gear') useGear(p); }
  function useGear(p) { var s = st(p), now = performance.now();
    if (s.gearBoost) { if (now < (p.boostCD||0)) return; p.boostCD = now + 10000; p.boostUntil = now + 1500; p.act = now; say('슝! 🚀', p.x, p.y - 46, '#7ae1ff'); burst(p.x, p.y, '#7ae1ff'); }
  }

  function nearBin(p) { if (!M || !M.bins) return null; for (var i = 0; i < M.bins.length; i++) { var b = M.bins[i]; if (Math.hypot(p.x - b.x*W, p.y - b.y*H) < 90) return b; } return null; }
  function deposit(p, bin) {
    var matched = p.holds.filter(function (t) { return t.cat === bin.cat; });
    var rest = p.holds.filter(function (t) { return t.cat !== bin.cat; });
    if (!matched.length) { say(CAT[bin.cat].name + '만 넣어요!', p.x, p.y - 46, '#ffb3b3'); return; }
    matched.forEach(function (t) { M.trash = M.trash.filter(function (x) { return x !== t; }); });
    p.holds = rest; p.score = (p.score||0) + matched.length; M.score[p.id] = p.score;
    say('+' + matched.length + ' (' + CAT[bin.cat].name + ')', p.x, p.y - 46, '#b6ff7a'); burst(p.x, p.y - 20, CAT[bin.cat].color);
    if (!M.trash.length) endRound();
  }
  function hitClump(p) {                                         // 뭉친 쓰레기 타격 → hp0이면 분리되어 흩어짐
    var best = null, bd = 74;
    M.trash.forEach(function (t) { if (!t.clump) return; var d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } });
    if (!best) return false;
    best.hp--; best.shake = performance.now() + 220; burst(best.x, best.y - 10, '#cfd6df');
    if (best.hp <= 0) {
      M.trash = M.trash.filter(function (x) { return x !== best; });
      best.kinds.forEach(function (kd, i) { var a = i/best.kinds.length*6.28; var t = { x: best.x + Math.cos(a)*30, y: best.y + Math.sin(a)*30, kind: kd, cat: TRASH_CAT[kd]||'general', value:1, big:false, s: 13+Math.random()*3, rot: Math.random()*6.3, held: null, heavy:(kd==='can'||kd==='bottle'||kd==='glass'||kd==='scrap'), corner:false, stuck:false, hidden:false, revealed:true, drift:true, ph: Math.random()*6.3 }; M.trash.push(t); });
      say('분리 완료!', best.x, best.y - 40, '#b6ff7a'); burst(best.x, best.y, '#ffd166'); sfx('break');
    } else { say('한 번 더! (' + best.hp + ')', best.x, best.y - 40, '#ffd166'); }
    return true;
  }
  function grab(p) {
    if (!M || M.ended) return;
    var s = st(p); p.act = performance.now(); p.actSteal = false; // 도구 사용 애니메이션 트리거
    if (M.warehouses) { for (var wid in M.warehouses) { if (wid === p.id) continue; var wh = M.warehouses[wid];   // 적 창고 옆이면 습격
      if (Math.hypot(p.x - wh.x, p.y - wh.y) < WH_R) { raid(p, wh); return; } } }
    if (hitClump(p)) return;                                     // 근처 뭉친 쓰레기부터 부순다
    if (p.holds.length >= cap(p)) { say('가방이 꽉 찼어! 수거함으로', p.x, p.y - 46, '#ffd166'); return; }
    function ok(t) { return !t.held && !t.clump && t.revealed; }
    if (s.pickup === 'area') {                                   // 빗자루: 주변 여러 개(가벼운·안구석)
      var got = 0, R = s.areaR || 130;
      M.trash.forEach(function (t) { if (!ok(t) || p.holds.length >= cap(p)) return; if (t.heavy || t.corner) return;
        if (Math.hypot(t.x - p.x, t.y - p.y) < R) { t.held = p.id; p.holds.push(t); got++; } });
      say(got ? '쓸었다! +' + got : '가벼운 쓰레기만 쓸려요', p.x, p.y - 46, got ? '#fff' : '#ffd166'); if (got) sfx('pick');
    } else {                                                     // 집게/꼬챙이: 하나
      var best = null, bd = 66;
      M.trash.forEach(function (t) { if (!ok(t)) return; if (!s.canHeavy && t.heavy) return; if (!s.canCorner && t.corner) return;
        var d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } });
      if (best) { best.held = p.id; p.holds.push(best); say('주웠다!', p.x, p.y - 46, '#fff'); sfx(best.big ? 'big' : 'pick'); }
      else say(s.canCorner ? '가까이에 쓰레기가 없어' : '구석/무거운 건 못 집어', p.x, p.y - 46, '#ffd166');
    }
  }
  /* ── PvP: 부딪히기(밀치기)·창고 습격·안티그리핑 ── */
  var BUMP_R = 66, MIN_SAFE_VAULT = 5, IFRAME = 3000, DR_WINDOW = 15000;
  function rankAsc() { return Object.keys(players).map(function (id) { return { id: id, b: players[id].bank||0 }; }).sort(function (a, b) { return a.b - b.b; }); }
  function isLeader(p) { var a = rankAsc(); return a.length > 2 && a[a.length-1].id === p.id && (p.bank||0) > 0; }
  function isBottom20(o) { var a = rankAsc(); if (a.length < 3) return false; var k = Math.max(1, Math.floor(a.length*0.2)); for (var i = 0; i < k; i++) if (a[i].id === o.id) return true; return false; }
  function protectedTarget(p, o) { return isLeader(p) && isBottom20(o); }        // 1위는 하위20% 못 건드림
  // 부딪히기: 가까운 상대의 손 보물 50%(최대3) 떨어뜨림 + 무적3s. 작살은 손으로 회수.
  function bump(p) {
    if (!M || M.ended) return; var now = performance.now(), s = st(p);
    if (now < (p.cool||0)) return; p.cool = now + (s.canSteal ? 450 : 620); p.act = now; p.actSteal = !!s.canSteal;
    var vic = null, bd = BUMP_R;
    Object.keys(players).forEach(function (id) { if (id === p.id) return; var o = players[id];
      if (o.afk || now < (o.iframe||0)) return; if (protectedTarget(p, o)) return;
      var d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; vic = o; } });
    if (!vic) { say('아무도 없네!', p.x, p.y - 46, '#ffd166'); return; }
    if (p._lastVic === vic.id && now - (p._lastVicT||0) < DR_WINDOW) { say('다른 친구를 찾아보자!', p.x, p.y - 46, '#8ee'); return; }  // 연속타격 무효
    p._lastVic = vic.id; p._lastVicT = now;
    var vs = st(vic);
    if (vs.superArmor && now >= (vic.armorCD||0)) { vic.armorCD = now + 10000; vic.iframe = now + 800; say('끄떡없다! 💪', vic.x, vic.y - 46, '#8ee'); sfx('block'); return; }  // 물개 슈퍼아머
    var n = vic.holds.length, drop = Math.min(Math.ceil(n*0.5), 3) - (vs.dropResist||0); if (drop < 0) drop = 0;
    var got = 0;
    for (var i = 0; i < drop; i++) { var t = vic.holds.pop(); if (!t) break; t.held = null;
      if (s.canSteal && p.holds.length < cap(p)) { t.held = p.id; p.holds.push(t); got++; }
      else { t.x = vic.x + (Math.random()-.5)*46; t.y = vic.y + (Math.random()-.5)*46; } }
    vic.iframe = now + IFRAME; vic.dwell = 0;
    if (p.char === 'crab') vic.slowUntil = now + 3000;           // 게: 명중 시 상대 둔화
    say(got ? '뺏었다! +' + got : (drop ? '삐용!' : '밀쳤다!'), p.x, p.y - 46, got ? '#ff7ab6' : '#fff');
    say('😜', p.x, p.y - 54, '#ff7ab6'); if (drop) burst(vic.x, vic.y, '#fff'); sfx(got ? 'steal' : 'bump');
  }
  // 창고 습격: 적 창고에서 1개 → 내 손. 앞 5개 보호, 선두/러쉬면 딜레이 반감, 자물쇠 +2s.
  function raid(p, wh) {
    if (!M || M.ended) return; var now = performance.now(); if (now < (p.raidCool||0)) return;
    var owner = players[wh.id]; if (!owner) return;
    if (protectedTarget(p, owner)) { say('너무 약해서 못 뺏어!', p.x, p.y - 46, '#8ee'); p.raidCool = now + 800; return; }
    if ((owner.bank||0) <= MIN_SAFE_VAULT) { say('금고 잠김(5개 보호)', p.x, p.y - 46, '#ffd166'); p.raidCool = now + 700; return; }
    if (p.holds.length >= cap(p)) { say('가방이 꽉 찼어', p.x, p.y - 46, '#ffd166'); return; }
    var fast = (owner.bank >= 15) || (M.phase === 'rush'); var delay = (fast ? 1000 : 2000) + (st(owner).gearLock ? 2000 : 0);
    p.raidCool = now + delay; p.act = now; p.actSteal = true;
    owner.bank -= 1; M.score[wh.id] = owner.bank;
    var t = makeTrash(p.x, p.y, 'cup', {}); t.held = p.id; p.holds.push(t);
    say('새치기! +1', p.x, p.y - 46, '#ff7ab6'); say('앗 내 창고!', wh.x, wh.y - 46, '#ffb3b3'); burst(wh.x, wh.y, wh.col); sfx('raid');
  }

  /* ───────── 창고(거점) & 보물 생성 헬퍼 ───────── */
  var WH_R = 46;                                                // 뱅킹/창고 반경(px)
  var WH_SLOTS = []; (function () { for (var i = 0; i < 10; i++) { var a = -Math.PI/2 + i*(2*Math.PI/10); WH_SLOTS.push({ ux: 0.5 + Math.cos(a)*0.40, uy: 0.5 + Math.sin(a)*0.40 }); } })();
  function nudgeWalkable(ux, uy) { var x = ux*W, y = uy*H;
    if (!blockedAt(x, y) && terrainAt(x, y) !== 'water') return { x: x, y: y };
    for (var r = 24; r < 240; r += 24) for (var k = 0; k < 8; k++) { var a = k*Math.PI/4, nx = x + Math.cos(a)*r, ny = y + Math.sin(a)*r;
      if (nx > 24 && nx < W-24 && ny > 24 && ny < H-24 && !blockedAt(nx, ny) && terrainAt(nx, ny) !== 'water') return { x: nx, y: ny }; }
    return { x: Math.max(24, Math.min(W-24, x)), y: Math.max(24, Math.min(H-24, y)) };
  }
  function buildWarehouses() {                                  // 테두리 10방향 대칭, 참여수만큼 균등 활성
    var ids = Object.keys(players).sort(function (a, b) { return (players[a].seat||0) - (players[b].seat||0); });
    var n = Math.max(1, ids.length), wh = {};
    ids.forEach(function (id, idx) { var s = WH_SLOTS[Math.floor(idx*10/n) % 10]; var pos = nudgeWalkable(s.ux, s.uy);
      wh[id] = { id: id, seat: players[id].seat, x: pos.x, y: pos.y, col: PCOL[((players[id].seat||1)-1) % PCOL.length] }; });
    return wh;
  }
  function centralPos() {                                       // 중앙 자원 밀집 구역
    var x, y, t = 0; do { x = W*(0.28 + Math.random()*0.44); y = H*(0.28 + Math.random()*0.44); t++; } while (t < 25 && blockedAt(x, y));
    return { x: x, y: y };
  }
  function makeTrash(x, y, kind, opt) { opt = opt || {};
    var heavy = (kind === 'can' || kind === 'bottle' || kind === 'glass' || kind === 'scrap');
    var big = !!opt.big;
    return { x: x, y: y, kind: kind, cat: TRASH_CAT[kind] || 'general', value: big ? 4 : 1, big: big,
             s: big ? 26 : 13 + Math.random()*4, rot: Math.random()*6.3, held: null, heavy: heavy || big,
             corner: !!opt.corner, stuck: !!opt.stuck, hidden: !!opt.hidden, revealed: !opt.hidden, drift: opt.drift !== false && !big, ph: Math.random()*6.3 }; }

  /* ───────── 라운드 ───────── */
  function startRound(key) {
    if (key) mapKey = key;
    buildBlock();
    var m = curMap(), list = [];
    var N = Math.round(m.trashN * spread);
    function nearBlocked(x, y) { for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) if (blockedAt(x + a*36, y + b*36)) return true; return false; }
    for (var i = 0; i < N; i++) {
      var x, y, tries = 0, nearObs = false;
      do { x = W*(0.18 + Math.random()*0.64); y = H*(0.18 + Math.random()*0.64); tries++;  // 중앙 집중
        nearObs = nearBlocked(x, y);
      } while (tries < 30 && (blockedAt(x, y) || y < H*0.14));
      var kind = m.trashKinds[i % m.trashKinds.length];
      var r = Math.random();
      var opt = { drift: true };
      if (nearObs) { opt.corner = true; opt.stuck = true; opt.drift = false; }        // 구석에 박힘
      else if (r < 0.12) { opt.hidden = true; opt.drift = false; }                    // 숨겨짐
      list.push(makeTrash(x, y, kind, opt));
    }
    // 뭉친 쓰레기(여러 번 타격→흩어짐) 2~4개
    var clumpN = 2 + Math.floor(Math.random()*3);
    for (var ci = 0; ci < clumpN; ci++) {
      var cp = centralPos(); var ck = []; for (var j = 0; j < 4; j++) ck.push(m.trashKinds[Math.floor(Math.random()*m.trashKinds.length)]);
      list.push({ clump: true, x: cp.x, y: cp.y, hp: 3, kinds: ck, s: 22, rot: 0, held: null, shake: 0, drift: false, ph: Math.random()*6.3, value: 1 });
    }
    // 플레이어별 전용 창고
    var warehouses = buildWarehouses();
    M = { trash: list, score: {}, ended: false, warehouses: warehouses, roundT: 0, phase: 'farm', spawnT: 0, bigT: 8, capN: N };
    wind = { x: 0, y: 0, t: 0 };
    // 스폰: 자기 창고(거점)에서 시작 → 여기가 돌아올 집. 창고가 막힌 땅이면 nudge된 위치
    Object.keys(players).forEach(function (id) { var p = players[id]; p.holds = []; p.bank = 0; p.score = 0; p.dwell = 0; p.moist = 100; p.stunUntil = 0;
      p.iframe = 0; p.slowUntil = 0; p.afk = false; p.lastInput = performance.now(); p._lastVic = null; p.hits = 0;
      p.armorCD = 0; p.boostCD = 0; p.boostUntil = 0; p.alarmUntil = 0; p.alarmCD = 0; p.trapCharges = 2; p.trapCD = 0;
      var wh = warehouses[id]; var sp0 = wh ? { x: wh.x, y: wh.y } : nudgeWalkable(0.5, 0.85);
      p.x = sp0.x; p.y = sp0.y; p.startX = sp0.x; p.startY = sp0.y; });
    say(m.emoji + ' ' + m.name + '!', W/2, H*0.5, '#ffd166', 2.2, 40); sfx('start');
  }
  function endRound() { if (!M) return; M.ended = true;
    // 미저장분: 손에 든 보물 가치의 50%(올림) 최종 인정
    Object.keys(players).forEach(function (id) { var p = players[id]; var hv = 0; (p.holds||[]).forEach(function (t) { hv += (t.value||1); });
      var bonus = Math.ceil(hv*0.5); p.bank = (p.bank||0) + bonus; M.score[id] = p.bank;
      if (bonus > 0) say('+' + bonus + ' 배달!', p.x, p.y - 46, '#b6ff7a'); });
  }
  function clear() { players = {}; trash = []; M = null; if (opts.onCount) opts.onCount(0); }

  /* ───────── 이펙트 ───────── */
  function burst(x, y, col) { for (var i = 0; i < 10; i++) particles.push({ x: x, y: y, vx: (Math.random()-.5)*180, vy: -40 - Math.random()*160, life: .7, age: 0, s: 4, col: col }); }
  function say(txt, x, y, col, life, size) { texts.push({ txt: txt, x: x, y: y, age: 0, life: life||1.2, col: col||'#fff', size: size||22 }); }

  /* ───────── 사운드 (WebAudio SFX) ───────── */
  var AC = null, masterGain = null, sfxMuted = false;
  function soundEnable() {
    try { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); masterGain = AC.createGain(); masterGain.gain.value = 0.4; masterGain.connect(AC.destination); }
      if (AC.state === 'suspended') AC.resume(); } catch (e) {}
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!AC || sfxMuted) return; var t0 = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(masterGain); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  var _sfxLast = {};
  function sfx(name) {
    if (!AC || sfxMuted) return;
    var now = AC.currentTime, gap = (name === 'pick' || name === 'bump' || name === 'raid') ? 0.09 : 0.05;
    if (now - (_sfxLast[name] || 0) < gap) return;             // 같은 소리 연타 방지(AI 다수 대비)
    _sfxLast[name] = now;
    switch (name) {
      case 'pick':  tone(620, 0.07, 'square', 0.22, 950); break;                         // 콕
      case 'bank':  tone(523, 0.09, 'sine', 0.3); tone(784, 0.11, 'sine', 0.3, null, 0.07); tone(1046, 0.14, 'sine', 0.32, null, 0.15); break;  // 저장! 상승
      case 'bump':  tone(200, 0.14, 'sawtooth', 0.34, 70); break;                         // 삐용
      case 'steal': tone(440, 0.09, 'triangle', 0.3, 660); tone(880, 0.1, 'triangle', 0.28, null, 0.08); break;
      case 'raid':  tone(360, 0.1, 'triangle', 0.3, 260); break;
      case 'big':   tone(880, 0.09, 'sine', 0.3); tone(1320, 0.16, 'sine', 0.32, null, 0.09); break;   // 반짝
      case 'break': tone(300, 0.09, 'square', 0.24, 150); tone(200, 0.1, 'square', 0.2, null, 0.06); break;
      case 'alarm': tone(900, 0.1, 'square', 0.32); tone(680, 0.12, 'square', 0.32, null, 0.12); break;
      case 'stun':  tone(220, 0.26, 'sine', 0.3, 80); break;
      case 'start': tone(523, 0.11, 'sine', 0.32); tone(659, 0.11, 'sine', 0.32, null, 0.12); tone(880, 0.2, 'sine', 0.34, null, 0.24); break;
      case 'block': tone(520, 0.12, 'sine', 0.28, 700); break;                            // 방어됨
    }
  }

  /* ───────── 업데이트 ───────── */
  var OPEN_MAPS = { beach: 1, valley: 1 };                       // 갈매기가 날 수 있는 트인 맵(숲·마을은 걷기)
  function inWater(p) { return terrainAt(p.x, p.y) === 'water'; }
  /* AI 경쟁 캐릭터: 가장 가까운 쓰레기로 가서 줍고, 가득 차면 맞는 수거함에 버린다 */
  function aiThink(p, now, s) {
    if (!M || M.ended) { p.ctrl = null; return; }
    // 벽에 낀 경우 감지 → 목표 버리고 잠깐 배회
    if (p._stx == null) { p._stx = p.x; p._sty = p.y; p._stChk = now; }
    if (now - p._stChk > 700) { if (Math.hypot(p.x - p._stx, p.y - p._sty) < 8 && p.ctrl) { p._t = null; p._wander = now + 600; } p._stx = p.x; p._sty = p.y; p._stChk = now; }
    if (p._wander && now < p._wander) { p.ctrl = { dx: Math.cos(now*0.004 + p.bob), dy: Math.sin(now*0.005 + p.bob*2), until: now + 300 }; return; }
    // 기회형 PvP: 옆에 적 창고면 습격, 옆에 짐 든 상대면 밀치기
    if (now > (p.aiPvp || 0)) {
      var rw = null, rd = WH_R + 8; if (M.warehouses) for (var wid in M.warehouses) { if (wid === p.id) continue; var w = M.warehouses[wid]; var ow = players[wid]; if (!ow || (ow.bank||0) <= MIN_SAFE_VAULT) continue; var dw = Math.hypot(p.x - w.x, p.y - w.y); if (dw < rd) { rd = dw; rw = w; } }
      if (rw && p.holds.length < cap(p)) { p.aiPvp = now + 400; raid(p, rw); return; }
      var opp = null, od = BUMP_R; Object.keys(players).forEach(function (id) { if (id === p.id) return; var o = players[id]; if (!o.holds || !o.holds.length || o.afk || now < (o.iframe||0)) return; var d = Math.hypot(p.x - o.x, p.y - o.y); if (d < od) { od = d; opp = o; } });
      if (opp && Math.random() < 0.5) { p.aiPvp = now + 700; bump(p); return; }
    }
    var mode = (p.holds.length >= Math.min(cap(p), 6)) ? 'home' : 'trash';   // 6개 모으면 내 창고로 귀환(자동 뱅킹)
    var lost = p._t && ((p._t.trash && p._t.trash.held) || (p._t.clump && p._t.clump.hp <= 0));
    if (!p._t || now > (p._tExp || 0) || lost || mode !== p._mode) {
      p._mode = mode; p._tExp = now + 450 + Math.random()*450; p._t = null;
      if (mode === 'home') {
        var wh = M.warehouses ? M.warehouses[p.id] : null;
        p._t = wh ? { home: wh } : null;
      } else {
        var best = null, bdist = 1e9;
        M.trash.forEach(function (t) { if (t.held) return; if (t.hidden && !t.revealed) return;
          if (!t.clump) { if (!s.canHeavy && t.heavy) return; if (!s.canCorner && t.corner) return; }
          var d = Math.hypot(t.x-p.x, t.y-p.y); if (d < bdist) { bdist = d; best = t; } });
        if (best) p._t = best.clump ? { clump: best } : { trash: best };
      }
    }
    var tgt = p._t, tx, ty, reach;
    if (!tgt) { p.ctrl = { dx: Math.cos(now*0.001 + p.bob), dy: Math.sin(now*0.0013 + p.bob), until: now + 300 }; return; }  // 배회
    if (tgt.home) { tx = tgt.home.x; ty = tgt.home.y; reach = 30; }   // 창고 도착=자동 뱅킹(step)
    else if (tgt.clump) { tx = tgt.clump.x; ty = tgt.clump.y; reach = 54; }
    else { tx = tgt.trash.x; ty = tgt.trash.y; reach = 52; }
    var dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy) || 1;
    p.ctrl = { dx: dx/dist, dy: dy/dist, until: now + 300 };
    if (!tgt.home && dist < reach && now > (p.aiCool || 0)) {   // 창고는 근처 체류만 하면 자동저장
      p.aiCool = now + Math.max(260, (s.cooldown||0.4)*1000);
      grab(p); p._tExp = 0;
    }
  }
  function step(dt, now) {
    var sp = Math.min(W, H) * BASE_SPEED_FRAC;
    Object.keys(players).forEach(function (id) { var p = players[id]; var s = st(p);
      p.afk = !p.ai && (now - (p.lastInput || now)) > 15000;     // 15초 무입력 → 유령(공격 불가)
      // 게: 수분 게이지 (물 밖이면 마름 → 0이면 기절, 쓰레기 다 흘리고 시작점 복귀)
      if (s.moisture) {
        if (inWater(p)) p.moist = Math.min(100, p.moist + 40*dt);
        else p.moist = Math.max(0, p.moist - 12*dt);
        if (p.moist <= 0 && now >= p.stunUntil && !p._stunned) { p._stunned = true; p.stunUntil = now + 3000;
          (p.holds||[]).forEach(function (t) { t.held = null; t.x = p.x + (Math.random()-.5)*50; t.y = p.y + (Math.random()-.5)*50; }); p.holds = [];
          say('😵 말라서 기절!', p.x, p.y - 46, '#ffb3b3'); sfx('stun'); }
      }
      if (p._stunned && now >= p.stunUntil) { p._stunned = false; p.x = p.startX; p.y = p.startY; p.moist = 100; }
      if (now < p.stunUntil) { p.moving = false; return; }        // 기절 중 이동 불가
      if (p.ai) aiThink(p, now, s);                               // AI 경쟁 캐릭터: 스스로 줍고 버림
      // 갈매기: 벽·물 무시 비행(전 맵)
      var fly = s.fly;
      function block(x, y) { return fly ? false : blockedAt(x, y); }
      if (p.ctrl && now > p.ctrl.until) p.ctrl = null;
      if (p.ctrl) { var dx = p.ctrl.dx, dy = p.ctrl.dy, mag = Math.hypot(dx, dy) || 1; dx /= mag; dy /= mag;
        var terr = fly ? 'air' : terrainAt(p.x, p.y);
        var tmul = (p.speedByTerrain && p.speedByTerrain[terr] != null) ? p.speedByTerrain[terr] : (p.speedMul || 1);
        if (p.holds && p.holds.some(function (t) { return t.big; })) tmul *= 0.6;   // 대형 보물 운반 시 둔화
        if (now < (p.iframe||0)) tmul *= 1.2;                    // 피격 무적 중 이속 보너스(도망)
        if (now < (p.slowUntil||0)) tmul *= 0.5;                 // 게 집게에 둔화
        if (now < (p.boostUntil||0)) tmul *= 2.0;               // 부스트 장비
        if (s.hAccel && Math.abs(dx) > Math.abs(dy)) tmul *= 1.3;  // 게: 가로 이동 가속
        if (s.homeTurf) { var mwh = M && M.warehouses ? M.warehouses[id] : null; if (mwh && Math.hypot(p.x-mwh.x, p.y-mwh.y) < WH_R*2.4) tmul *= 1.3; }  // 해녀 홈터프
        if (now < (p.alarmUntil||0)) tmul *= 1.5;                // 경보기: 귀환 가속
        var mv = sp * tmul * dt;
        var nx = p.x + dx*mv; if (inBounds(nx, p.y, 18) && !block(nx, p.y)) p.x = nx;
        var ny = p.y + dy*mv; if (inBounds(p.x, ny, 18) && !block(p.x, ny)) p.y = ny;
        if (dx) p.dir = dx > 0 ? 1 : -1;
        p.moving = true; p.mdx = dx; p.mdy = dy;
      } else p.moving = false;
      // 걷기 애니메이션: 이동 중일 때만 걸음 위상 전진 + 이동세기 스무딩(자연스러운 가감속)
      var gaitSpeed = (p.gaitHz || 10) * (inWater(p) ? 0.7 : 1);
      if (p.moving) p.gait = (p.gait || 0) + dt * gaitSpeed;
      p.mv = (p.mv || 0) + ((p.moving ? 1 : 0) - (p.mv || 0)) * Math.min(1, dt * 10);   // 0..1
      // 쓰레받이: 이동 중 새는 확률 (담은 것 하나 흘림)
      if (p.moving && s.leak && p.holds.length && Math.random() < s.leak*dt*6) { var t = p.holds.pop(); t.held = null; t.x = p.x - p.dir*14; t.y = p.y + 16; say('앗, 흘렸다', p.x, p.y - 46, '#ffd166'); }
      // 자동 뱅킹: 내 창고 반경 안에서 0.5초 머무르면 손에 든 보물 전부 저장(=점수)
      if (M && !M.ended && M.warehouses) { var wh = M.warehouses[id];
        if (wh && Math.hypot(p.x - wh.x, p.y - wh.y) < WH_R) {
          p.dwell = (p.dwell || 0) + dt;
          if (p.dwell >= 0.5 && p.holds.length) { var val = 0; p.holds.forEach(function (t) { val += (t.value||1); M.trash = M.trash.filter(function (x) { return x !== t; }); });
            p.bank = (p.bank || 0) + val; M.score[id] = p.bank; say('+' + val + ' 저장!', p.x, p.y - 48, '#b6ff7a'); burst(p.x, p.y - 20, wh.col); p.holds = []; p.dwell = 0; sfx('bank'); }
        } else p.dwell = 0;
      }
    });
    // 장비 자동효과: 함정(내 창고 침입자 기절)·경보(적 접근 알림+귀환가속)
    if (M && !M.ended && M.warehouses) { Object.keys(M.warehouses).forEach(function (wid) {
      var owner = players[wid]; if (!owner) return; var os = st(owner), wh = M.warehouses[wid];
      var intruder = null; for (var iid in players) { if (iid === wid) continue; var e = players[iid]; if (e.afk) continue; if (Math.hypot(e.x - wh.x, e.y - wh.y) < WH_R + 6) { intruder = e; break; } }
      if (!intruder) return;
      if (os.gearTrap && (owner.trapCharges||0) > 0 && now > (owner.trapCD||0)) { owner.trapCharges--; owner.trapCD = now + 600;
        intruder.stunUntil = Math.max(intruder.stunUntil||0, now + 2000); intruder.ctrl = null; say('🪤 찰칵!', intruder.x, intruder.y - 46, '#ffd166'); burst(intruder.x, intruder.y, '#ffd166'); sfx('stun'); }
      if (os.gearAlarm && now > (owner.alarmCD||0)) { owner.alarmCD = now + 2500; owner.alarmUntil = now + 3000; say('🔔!', wh.x, wh.y - 52, '#ff6b6b'); sfx('alarm'); if (opts.onAlarm) opts.onAlarm(wid); }
    }); }
    // 라운드 시간·페이즈·지속 스폰 (0~60 파밍 2s / 60~90 러쉬: 중앙 스폰 절반, 대형 20s)
    if (M && !M.ended) {
      M.roundT += dt; M.phase = M.roundT < 60 ? 'farm' : 'rush';
      var m2 = curMap(), curN = M.trash.filter(function (t) { return !t.held; }).length;
      M.spawnT += dt; var interval = (M.phase === 'farm') ? 2.0 : 4.0;
      if (M.spawnT >= interval && curN < (M.capN || 24) * 1.3) { M.spawnT = 0;
        var cp = centralPos(); M.trash.push(makeTrash(cp.x, cp.y, m2.trashKinds[Math.floor(Math.random()*m2.trashKinds.length)], { drift: true })); }
      M.bigT -= dt; if (M.bigT <= 0) { M.bigT = 20; var bp = centralPos(); M.trash.push(makeTrash(bp.x, bp.y, 'scrap', { big: true })); say('💎 대형 보물 등장!', bp.x, bp.y - 30, '#ffd23f', 1.6, 26); sfx('big'); }
    }
    // 바람/파도: 안 잡힌 쓰레기가 흘러다녀 줍기 어려워짐 (바다>섬>육지)
    wind.t += dt; var wt = wind.t;
    var wmag = ({ valley: 70, beach: 60, village: 26, gotjawal: 24 })[mapKey] || 30;
    var gx = Math.cos(wt*0.4)*0.75 + Math.sin(wt*0.9 + 1)*0.3;   // 서서히 방향이 바뀌는 바람
    var gy = Math.sin(wt*0.55)*0.6 + Math.cos(wt*0.7)*0.2;
    if (M && !M.ended) M.trash.forEach(function (t) {
      // 숨겨진 쓰레기: 가까이 가면 발견
      if (t.hidden && !t.revealed) { for (var id in players) { var p = players[id]; if (Math.hypot(p.x - t.x, p.y - t.y) < 85) { t.revealed = true; say('찾았다!', t.x, t.y - 30, '#ffd166'); burst(t.x, t.y, '#fff'); break; } } return; }
      if (t.held || t.clump || t.stuck || !t.drift) return;      // 구석에 박힌 것·뭉친 것은 안 흐름
      var d = (DRIFT[t.kind] || 0.6) * wmag;
      var nx = t.x + gx*d*dt + Math.sin(wt*1.4 + t.ph)*0.4;
      var ny = t.y + gy*d*dt + Math.cos(wt*1.2 + t.ph)*0.4;
      nx = Math.max(14, Math.min(W-14, nx)); ny = Math.max(H*0.16, Math.min(H-14, ny));
      if (!blockedAt(nx, ny)) { t.x = nx; t.y = ny; }
      t.rot += (0.3 + d*0.004)*dt;
    });
    for (var i = particles.length-1; i >= 0; i--) { var q = particles[i]; q.age += dt; if (q.age > q.life) { particles.splice(i,1); continue; } q.vy += 400*dt; q.x += q.vx*dt; q.y += q.vy*dt; }
    for (var j = texts.length-1; j >= 0; j--) { texts[j].age += dt; texts[j].y -= 14*dt; if (texts[j].age > texts[j].life) texts.splice(j,1); }
  }

  /* ───────── 환경 애니메이션(파도·바람·물결) ───────── */
  var GRASS = null;
  function ambientFX(t) {
    if (mapKey === 'beach') fxBeach(t);
    else if (mapKey === 'valley') fxValley(t);
    else if (mapKey === 'gotjawal') fxGotjawal(t);
    else if (mapKey === 'village') fxVillage(t);
  }
  function fxBeach(t) {
    if (!WATER || !WATER.shore) return;
    var sh = WATER.shore, gw = WATER.gw;
    // 바다 윤슬(반짝임)
    g.save();
    for (var k = 0; k < 70; k++) { var col = (k*23) % gw; var s = sh[col]; if (s < 0) continue;
      var xx = (col/gw)*W, yy = (s + (1-s)*(((k*37)%100)/100))*H;
      g.globalAlpha = 0.10 + 0.22*(0.5+0.5*Math.sin(t*3 + k)); g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx+9, yy); g.stroke(); }
    g.restore();
    // 밀려왔다 빠지는 파도 거품(해안선 따라)
    var wash = 0.5 + 0.5*Math.sin(t*0.8);
    g.save(); g.lineCap = 'round';
    for (var band = 0; band < 3; band++) {
      g.beginPath(); var started = false, amp = 5 + band*3;
      for (var x = 0; x <= W; x += 8) { var c = Math.min(gw-1, Math.floor(x/W*gw)); var sc = sh[c];
        if (sc < 0) { started = false; continue; }
        var yy = sc*H - 22*wash - band*9 + Math.sin(x*0.03 + t*2 + band)*amp;
        if (!started) { g.moveTo(x, yy); started = true; } else g.lineTo(x, yy); }
      g.strokeStyle = 'rgba(255,255,255,' + (0.55 - band*0.16) + ')'; g.lineWidth = 5 - band*1.4; g.stroke();
    }
    g.restore();
  }
  function fxValley(t) {
    if (!WATER) return; var gw = WATER.gw, gh = WATER.gh, cells = WATER.cells;
    g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.lineCap = 'round';
    for (var gy = 0; gy < gh; gy += 4) for (var gx = 0; gx < gw; gx += 6) { if (!cells[gy*gw+gx]) continue;
      var flow = ((t*36 + gx*11) % 48)/48;                    // 하류로 흐르는 물결
      var xx = (gx/gw)*W, yy = ((gy/gh))*H + flow*H*0.05;
      g.globalAlpha = 0.06 + 0.12*(0.5+0.5*Math.sin(t*2 + gx + gy));
      g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx+11, yy+2); g.stroke(); }
    g.restore();
  }
  function fxGotjawal(t) {
    if (!GRASS) { GRASS = []; for (var i = 0; i < 64; i++) GRASS.push({ x: Math.random(), y: 0.16 + Math.random()*0.8, h: 11 + Math.random()*12, ph: Math.random()*6.3, hue: 88 + Math.random()*34 }); }
    var gust = Math.sin(t*1.1)*0.6 + Math.sin(t*0.47)*0.3;    // 바람 돌풍
    g.save(); g.lineCap = 'round';
    GRASS.forEach(function (bl) { var x = bl.x*W, y = bl.y*H, sway = (gust + Math.sin(t*2.3 + bl.ph)*0.22) * bl.h*0.6;
      g.strokeStyle = 'hsla(' + bl.hue + ',52%,40%,.82)'; g.lineWidth = 2.4;
      for (var b = -1; b <= 1; b++) { g.beginPath(); g.moveTo(x + b*3, y); g.quadraticCurveTo(x + b*3 + sway*0.5, y - bl.h*0.6, x + b*3 + sway, y - bl.h); g.stroke(); } });
    g.restore();
    // 떠다니는 꽃가루/포자 + 빛무리
    g.save(); g.fillStyle = '#dcffb4';
    for (var s = 0; s < 16; s++) { var px = (((s*137) + t*14) % 100)/100*W, py = (((s*71) + Math.sin(t + s)*5) % 100)/100*H;
      g.globalAlpha = 0.14 + 0.18*(0.5+0.5*Math.sin(t*2 + s)); g.beginPath(); g.arc(px, py, 2, 0, 6.3); g.fill(); }
    g.restore();
  }
  function fxVillage(t) {
    g.save();
    for (var i = 0; i < 12; i++) { var prog = (((i*61) + t*28) % 130)/130, x = prog*W*1.2 - W*0.1;
      var y = (0.18 + (((i*37)%80)/100))*H + Math.sin(t*3 + i)*10;
      g.globalAlpha = 0.18 + 0.2*(0.5+0.5*Math.sin(t*2 + i)); g.fillStyle = i%3 ? 'rgba(190,160,95,.6)' : 'rgba(150,125,80,.6)';
      g.save(); g.translate(x, y); g.rotate(t*3.5 + i); g.fillRect(-3, -2, 6, 4); g.restore(); }
    g.restore();
  }

  /* ───────── 렌더 ───────── */
  function draw(now) {
    var t = (now - t0)/1000, m = curMap();
    if (GROUND[mapKey] && GROUND[mapKey]._ok) g.drawImage(GROUND[mapKey], 0, 0, W, H); else m.bg(g, W, H, t);
    ambientFX(t);                                               // 파도·바람·물결 등 환경 애니메이션
    // 플레이어별 전용 창고(거점): 고유색 + 저장량 + 뱅킹 반경
    var whs = (M && M.warehouses) ? M.warehouses : {};
    Object.keys(whs).forEach(function (wid) { var wh = whs[wid]; var p = players[wid]; var amt = p ? (p.bank||0) : 0;
      g.save(); g.translate(wh.x, wh.y);
      // 뱅킹 반경(옅은 링)
      g.strokeStyle = wh.col; g.globalAlpha = 0.28; g.lineWidth = 2; g.setLineDash([6,6]); g.beginPath(); g.arc(0, 0, WH_R, 0, 6.3); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      // 그림자 + 통(고유색) — 15개 이상이면 부풀고 반짝(선두 타겟)
      var lead = amt >= 15, pulse = lead ? (1 + Math.sin(t*6)*0.06) : 1, bw = 30*pulse;
      g.fillStyle = 'rgba(0,0,0,.20)'; g.beginPath(); g.ellipse(0, bw*0.5, bw*0.9, bw*0.3, 0, 0, 6.3); g.fill();
      if (lead) { g.fillStyle = 'rgba(255,235,120,'+(0.25+0.15*Math.sin(t*6))+')'; g.beginPath(); g.arc(0, 0, bw*1.5, 0, 6.3); g.fill(); }
      g.fillStyle = wh.col; g.beginPath(); g.roundRect(-bw, -bw*0.7, bw*2, bw*1.3, 8); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.30)'; g.beginPath(); g.roundRect(-bw-3, -bw*0.95, bw*2+6, bw*0.4, 4); g.fill();   // 지붕
      // 저장량
      g.fillStyle = '#fff'; g.font = 'bold '+Math.round(bw*0.85)+'px -apple-system,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(amt, 0, 2); g.fillText(amt, 0, 2);
      g.textBaseline = 'alphabetic';
      // 주인 이름표(작게)
      if (p && p.nick) { g.font = 'bold 12px -apple-system,sans-serif'; g.fillStyle = '#fff'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.5)';
        var nm = (p.seat?p.seat+'번 ':'') + p.nick; g.strokeText(nm, 0, bw*1.2); g.fillText(nm, 0, bw*1.2); }
      g.restore();
    });
    // 쓰레기
    if (M) M.trash.forEach(function (tr) { if (tr.held) return;
      if (tr.clump) {                                            // 뭉친 쓰레기 더미
        var shk = (tr.shake && performance.now() < tr.shake) ? (Math.random()-0.5)*6 : 0;
        g.save(); g.translate(tr.x + shk, tr.y);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, tr.s*0.9, tr.s*1.2, tr.s*0.4, 0, 0, 6.3); g.fill();
        tr.kinds.forEach(function (kd, i) { var a = i/tr.kinds.length*6.28; g.save(); g.translate(Math.cos(a)*tr.s*0.5, Math.sin(a)*tr.s*0.4 - tr.s*0.2); g.rotate(a); (TRASH[kd]||TRASH.cup).d(g, tr.s*0.7); g.restore(); });
        // 타격 횟수 배지
        g.fillStyle = '#e63946'; g.beginPath(); g.arc(tr.s*1.0, -tr.s*1.0, 13, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tr.hp, tr.s*1.0, -tr.s*1.0); g.textBaseline = 'alphabetic';
        g.restore(); return;
      }
      if (tr.hidden && !tr.revealed) {                           // 숨겨진 쓰레기 힌트(❓)
        g.save(); g.globalAlpha = 0.5 + Math.sin(t*3 + tr.ph)*0.2; g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.fillText('❔', tr.x, tr.y); g.restore(); return;
      }
      g.save(); g.translate(tr.x, tr.y);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, tr.s*0.7, tr.s*0.7, tr.s*0.26, 0, 0, 6.3); g.fill();   // 접지 그림자(가독성)
      if (tr.big) {                                              // 대형 특수 보물: 반짝이는 후광 + 가치 배지
        g.save(); g.globalAlpha = 0.3 + 0.2*Math.sin(t*4 + tr.ph); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(0, 0, tr.s*1.5, 0, 6.3); g.fill(); g.restore();
      }
      g.save(); g.rotate(tr.rot); (TRASH[tr.kind]||TRASH.cup).d(g, tr.s); g.restore();
      if (tr.big) { g.fillStyle = '#e63946'; g.beginPath(); g.arc(tr.s*0.9, -tr.s*0.9, 12, 0, 6.3); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+' + (tr.value||4), tr.s*0.9, -tr.s*0.9); g.textBaseline = 'alphabetic'; }
      g.restore();
    });
    // 장애물 (y 정렬로 겹침 자연스럽게)
    var obs = curMap().obstacles.slice().sort(function (a, b) { return a.y - b.y; });
    var SWAY = { tree:1, palm:1, bush:1, coral:1 }, HOP = { bear:1, squirrel:1 }, PULSE = { pond:1 }, FLAT = { pond:1 };
    obs.forEach(function (o) { var ox = rx(o.x)*W, oy = ry(o.y)*H, ph = o.x*13.3 + o.y*7.7;
      var sp = SPRITE[o.kind];
      if (sp && sp._ok) {
        var ar = sp.height/sp.width;
        if (FLAT[o.kind]) {                                    // 평면(직부감): 중앙 정렬, 발밑 앵커 없음
          var fw = ((o.r != null) ? o.r*2.3 : o.w*W*1.06) * spread, fh = ((o.r != null) ? o.r*2.3*ar : o.h*H*1.06) * spread;
          g.save(); g.translate(ox, oy);
          if (PULSE[o.kind]) { var p3 = 1 + Math.sin(t*2 + ph)*0.02; g.scale(p3, p3); }
          g.drawImage(sp, -fw/2, -fh/2, fw, fh); g.restore();
        } else {                                               // 3/4 시점: 밑동 기준 + 흔들/콩콩 + 강한 접지그림자
          var mult = (o.kind === 'building') ? 1.15 : 1.5;
          var sz = ((o.r != null) ? o.r*2.9 : Math.max(o.w*W, o.h*H)*mult) * spread, iw = sz, ih = sz*ar, baseY = ih*0.38;
          g.save(); g.translate(ox, oy + baseY*0.7); g.fillStyle = 'rgba(20,24,33,.30)'; g.beginPath(); g.ellipse(0, 0, iw*0.36, iw*0.14, 0, 0, 6.3); g.fill(); g.restore();
          // 가림 처리: 뒤에 있는 플레이어가 안 보이면 반투명
          var occl = false; for (var pk in players) { var pp = players[pk]; if (Math.abs(pp.x - ox) < iw*0.42 && pp.y < oy + baseY*0.3 && pp.y > oy - ih*0.9) { occl = true; break; } }
          g.save(); g.translate(ox, oy); if (occl) g.globalAlpha = 0.55;
          if (SWAY[o.kind]) { g.translate(0, baseY); g.rotate(Math.sin(t*1.4 + ph)*0.05); g.translate(0, -baseY); }
          else if (HOP[o.kind]) { var hop = Math.abs(Math.sin(t*3 + ph)); g.translate(0, -hop*10); var sq = 1 + Math.sin(t*6 + ph)*0.05; g.scale(1/Math.sqrt(sq), sq); }
          g.drawImage(sp, -iw/2, -ih*0.62, iw, ih); g.restore();
        }
      }
      else { g.save(); g.translate(ox, oy); if (o.w != null) (OB[o.kind]||OB.building)(g, o.w*W*spread, o.h*H*spread); else (OB[o.kind]||OB.rock)(g, o.r||30); g.restore(); }
    });
    // 플레이어 (y 정렬)
    var ps = Object.keys(players).map(function (k){return players[k];}).sort(function (a,b){return a.y-b.y;});
    ps.forEach(function (p) { drawPlayer(p, t); });
    // 들고 있는 쓰레기 스택 (플레이어 머리 위에 쌓임) + 용량
    ps.forEach(function (p) { var n = p.holds ? p.holds.length : 0; if (!n) return;
      for (var i = 0; i < Math.min(n, 5); i++) { var t = p.holds[i]; g.save(); g.translate(p.x + (i-2)*7, p.y - 44 - i*7); g.rotate(0.1); (TRASH[t.kind]||TRASH.cup).d(g, 10); g.restore(); }
      var c = cap(p); var lab = containerOf(st(p)) + ' ' + n + '/' + c;
      g.font = 'bold 13px -apple-system,sans-serif'; g.textAlign = 'center'; g.fillStyle = n >= c ? '#ffb3b3' : '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3;
      g.strokeText(lab, p.x, p.y - 44 - Math.min(n,5)*7 - 4); g.fillText(lab, p.x, p.y - 44 - Math.min(n,5)*7 - 4);
    });
    // 파티클/텍스트
    particles.forEach(function (q) { g.globalAlpha = Math.max(0, 1 - q.age/q.life); g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.s, 0, 6.3); g.fill(); }); g.globalAlpha = 1;
    texts.forEach(function (tx) { g.globalAlpha = Math.max(0, 1 - tx.age/tx.life); g.fillStyle = tx.col; g.font = 'bold ' + tx.size + 'px -apple-system,sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(tx.txt, tx.x, tx.y); g.fillText(tx.txt, tx.x, tx.y); }); g.globalAlpha = 1;
  }
  var CHAR_EMOJI = { seal:'🦭', crab:'🦀', pony:'🐎', gull:'🐦', haenyeo:'🧜' };
  var CHARACTERS_FLY = { gull: true };
  var PCOL = ['#ff4fa3','#22c1e6','#8bd329','#ff9f1c','#a06bff','#ff6b6b','#2ee6b6','#ffd23f','#6b8cff','#ff7ab6','#7ae1ff','#c0f24e','#ffb14e','#d06bff','#ff8f8f'];
  /* 캐릭터별 애니메이션 팔다리/지느러미(걸음 위상 gait에 맞춰 교차). 벡터 캐릭터(PNG 없을 때)에만 그림. 몸통 전에 호출 → 아래로 삐져나옴 */
  function drawLimbs(ch, R, gait, mv, col, flying) {
    var s1 = Math.sin(gait), s2 = Math.sin(gait + Math.PI); g.lineCap = 'round';
    if (ch === 'pony') {                                        // 네 다리 교차 질주
      g.strokeStyle = 'rgba(70,48,34,.95)'; g.lineWidth = 5;
      [[-13,s1],[-5,s2],[6,s1],[13,s2]].forEach(function (L) { var sw = L[1]*7*mv; g.beginPath(); g.moveTo(L[0], R*0.45); g.lineTo(L[0]+sw, R*0.95); g.stroke(); });
    } else if (ch === 'crab') {                                 // 양옆 다리 6개 + 집게
      g.strokeStyle = 'rgba(150,44,32,.95)'; g.lineWidth = 3;
      for (var i = 0; i < 3; i++) { var ph = Math.sin(gait + i)*4*mv;
        g.beginPath(); g.moveTo(-R*0.5, -4+i*8); g.lineTo(-R*0.98, -7+i*8+ph); g.stroke();
        g.beginPath(); g.moveTo(R*0.5, -4+i*8); g.lineTo(R*0.98, -7+i*8-ph); g.stroke(); }
      g.fillStyle = 'rgba(185,52,40,.98)'; g.beginPath(); g.arc(-R*0.72, R*0.32, 5.5, 0, 6.3); g.fill(); g.beginPath(); g.arc(R*0.72, R*0.32, 5.5, 0, 6.3); g.fill();
    } else if (ch === 'gull') {                                 // 양 날개 파닥
      var flap = Math.sin(gait) * (flying ? 1 : 0.55);
      g.fillStyle = 'rgba(245,246,250,.96)'; g.strokeStyle = 'rgba(120,124,135,.6)'; g.lineWidth = 1.5;
      [-1, 1].forEach(function (d) { g.save(); g.rotate(d*(0.28 - flap*0.55)); g.beginPath(); g.ellipse(d*R*0.66, -2, R*0.5, R*0.19, 0, 0, 6.3); g.fill(); g.stroke(); g.restore(); });
    } else if (ch === 'seal' || ch === 'haenyeo') {            // 꼬리지느러미 흔들
      g.fillStyle = ch === 'seal' ? 'rgba(84,94,116,.92)' : 'rgba(38,120,138,.92)';
      g.save(); g.translate(0, R*0.5); g.rotate(Math.sin(gait)*0.45*mv); g.beginPath(); g.ellipse(0, R*0.22, R*0.4, R*0.18, 0, 0, 6.3); g.fill(); g.restore();
    } else {
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 5;
      [[-8,s1],[8,s2]].forEach(function (L) { var sw = L[1]*6*mv; g.beginPath(); g.moveTo(L[0], R*0.45); g.lineTo(L[0]+sw, R*0.95); g.stroke(); });
    }
  }
  /* 장비 표시 — 캐릭터가 든 도구를 보여주고 사용 순간 애니메이션 */
  var TOOL_EMOJI = { broom: '🧹', tongs: '🦾', spear: '🔱' };
  function toolOf(s) { return s.pickup === 'area' ? 'broom' : (s.canSteal ? 'spear' : 'tongs'); }
  function containerOf(s) { return (s.capacity <= 8) ? '🧺' : (s.skewerLoss >= 0.7 ? '🛍️' : '🕸️'); }
  function feetHint(s) { return s.speedByTerrain ? '' : ''; }
  function drawTool(p, s, R, dir, bob, sideSway) {
    var tk = toolOf(s), now = performance.now(), since = now - (p.act || -9999), act = since < 320 ? (1 - since/320) : 0;
    var hx = dir * R*0.6, hy = R*0.02;
    // 빗자루 광역 반경(사용 순간 링)
    if (tk === 'broom' && act && !p.actSteal) { g.save(); g.globalAlpha = act*0.4; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(p.x + sideSway, p.y + bob, (s.areaR || 120)*0.82, 0, 6.3); g.stroke(); g.restore(); }
    g.save(); g.translate(p.x + sideSway, p.y + bob); g.font = 'bold ' + Math.round(R*0.82) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (p.actSteal && act) tk = 'spear';
    if (tk === 'broom') { var sweep = act ? Math.sin(since*0.05)*0.6 : 0; g.translate(hx, hy); g.rotate(dir*0.35 + sweep); if (dir < 0) g.scale(-1, 1); g.fillText('🧹', 0, 0); }
    else if (tk === 'spear') { var thr = act ? act*R*0.55 : 0; g.translate(hx + dir*thr, hy); if (dir < 0) g.scale(-1, 1); g.rotate(0.15); g.fillText('🔱', 0, 0); }
    else { var pinch = act ? Math.sin(since*0.07)*0.25 : 0; g.translate(hx, hy - (act ? R*0.18 : 0)); if (dir < 0) g.scale(-1, 1); g.rotate(pinch); g.fillText('🦾', 0, 0); }
    g.restore();
  }
  function drawPlayer(p, t) {
    var R = 34;
    var mv = p.mv || 0, gait = p.gait || 0, dir = p.dir || 1, ch = p.char;
    var swimming = inWater(p), flying = !!CHARACTERS_FLY[ch];
    var col = PCOL[((p.seat||1)-1) % PCOL.length];
    // 걸음 기반 모션값 (각 캐릭터 특징에 맞춘 움직임 — 이미지 스프라이트에도 적용)
    var sg = Math.sin(gait), cg = Math.cos(gait), hop = Math.abs(sg);
    var breathe = Math.sin(t*2.2 + p.bob);                      // 정지 시 숨쉬기/개성
    var lift, squashX = 1, squashY = 1, lean = 0, sideSway = 0;
    if (ch === 'crab') {                                        // 게: 옆으로 촘촘 뒤뚱 + 틱틱 틸트
      sideSway = sg * 11 * mv; lift = -hop*4*mv;
      squashX = 1 + hop*0.12*mv; squashY = 1 - hop*0.10*mv;
      lean = sg*0.10*mv + breathe*0.02*(1-mv);
    } else if (ch === 'pony') {                                 // 조랑말: 힘차게 껑충 질주(앞뒤 피치)
      lift = -hop*17*mv + breathe*1.2*(1-mv);
      squashX = 1 + (1-hop)*0.15*mv; squashY = 1 + hop*0.17*mv - (1-hop)*0.11*mv;
      lean = dir*mv*0.17 + sg*0.05*mv;
    } else if (ch === 'gull') {                                 // 갈매기: 빠른 파닥 부양(날개짓 펄스)
      var flap = Math.sin(gait);
      lift = -(4 + Math.abs(flap)*9)*mv - (flying ? 16 : 0) - (flying ? (2+breathe*1.6) : 0);
      squashX = 1 + flap*0.15; squashY = 1 - flap*0.11; lean = dir*mv*0.08;
    } else if (ch === 'seal') {                                 // 물개: 좌우 몸 롤 + 물결, 정지=배 숨쉬기
      lift = -Math.abs(sg)*5*mv; sideSway = cg*4*mv;
      lean = sg*0.18*mv + dir*mv*0.05 + breathe*0.03*(1-mv);
      squashY = 1 + breathe*0.05*(1-mv); squashX = 1 - breathe*0.03*(1-mv);
    } else if (ch === 'haenyeo') {                              // 해녀: 자맥질 헤엄(상하 물결 + 좌우 킥)
      lift = -Math.abs(sg)*6*mv; sideSway = cg*3*mv;
      lean = sg*0.11*mv + dir*mv*0.05 + breathe*0.02*(1-mv);
      squashY = 1 + breathe*0.04*(1-mv);
    } else { lift = -hop*10*mv + breathe*1.2*(1-mv); squashX = 1+(1-hop)*0.10*mv; squashY = 1+hop*0.10*mv; lean = dir*mv*0.12; }
    var bob = lift;

    g.save(); g.translate(p.x, p.y);
    var pnow = performance.now();
    if (p.afk) g.globalAlpha = 0.35;                            // AFK 유령
    else if (pnow < (p.iframe||0)) g.globalAlpha = 0.4 + 0.35*Math.abs(Math.sin(pnow*0.02));   // 피격 무적 깜빡임
    // 접지 그림자 (뜰수록 작고 옅게)
    var shk = 1 - (mv * hop * 0.5);
    g.fillStyle = 'rgba(20,24,33,'+(0.28*shk)+')'; g.beginPath(); g.ellipse(sideSway*0.5, R*0.82, R*0.72*shk, R*0.26*shk, 0, 0, 6.3); g.fill();
    // 이동 이펙트: 땅=먼지, 물=물결
    if (mv > 0.35 && hop < 0.25) {
      if (swimming) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for (var w=0;w<2;w++){ g.beginPath(); g.ellipse(0, R*0.7, R*(0.5+w*0.28), R*(0.18+w*0.1), 0, 0, 6.3); g.stroke(); } }
      else if (Math.random() < 0.25) particles.push({ x: p.x - dir*R*0.4, y: p.y + R*0.7, vx: -dir*30*Math.random(), vy: -20-Math.random()*30, life: .4, age: 0, s: 3, col: 'rgba(150,140,120,.6)' });
    }
    g.translate(sideSway, bob);
    g.rotate(lean);
    g.scale(squashX, squashY);
    // 다리/지느러미 (걸음 위상에 맞춰 교차) — 벡터 캐릭터에만
    var im = CHARIMG[ch];
    if (!(im && im._ok)) drawLimbs(ch, R, gait, mv, col, flying);
    if (im && im._ok) { var iw = im.width, ih = im.height, s = (R*2.4)/Math.max(iw, ih); g.save(); if (dir < 0) g.scale(-1, 1); g.drawImage(im, -iw*s/2, -ih*s + R*0.9, iw*s, ih*s); g.restore(); }   // 바닥중앙 앵커
    else { g.fillStyle = col; g.beginPath(); g.arc(0, 0, R*0.72, 0, 6.3); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
      g.save(); if (dir < 0) g.scale(-1, 1);
      g.font = (R*0.9)+'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(CHAR_EMOJI[ch] || '🙂', 0, 1); g.textBaseline = 'alphabetic'; g.restore(); }
    g.restore();
    drawTool(p, st(p), R, dir, bob, sideSway);                  // 든 도구 표시 + 사용 애니메이션
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
    score: function () { return M ? M.score : {}; }, mission: function () { return M ? { ended: M.ended, left: M.trash.length } : null; }, trash: function () { return M ? M.trash : []; },
    players: function () { return players; }, map: function () { return mapKey; },
    positions: function () { var o = {}; Object.keys(players).forEach(function (id){ var p = players[id]; o[id] = { x:+(p.x/W).toFixed(3), y:+(p.y/H).toFixed(3), seat:p.seat, nick:p.nick }; }); return o; },
    clear: clear, say: function (txt, col) { say(txt, W/2, H*0.2, col || '#ffd166', 2, 34); },
    setMapSize: function (v) { spread = Math.max(0.6, Math.min(1.2, +v || 1)); }, mapSize: function () { return spread; },
    sound: { enable: soundEnable, sfx: sfx, mute: function (v) { sfxMuted = !!v; }, on: true },
    MAPS: MAPS
  };
}
