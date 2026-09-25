/* 예시 그림 생성기 — 테스트·강사 [예시 넣기]용. StageDemos.make(name, onSprite(img, cat, desc)) */
var StageDemos = (function () {
var onSprite = null;
/* 예시 그림: 종이 위 크레용 느낌. 종류별 하나씩 */
function paper(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var c = cv.getContext('2d'); c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#333'; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; return [cv, c]; }
var NICKS = ['번개상어','무지개고래','용감한게','반짝별','바다친구','초록거북','노랑오리','하늘새','씩씩이','방글이','테우선장','해녀삼춘'];
function toSprite(cv, cat, desc) { var im = new Image(); im.onload = function () { onSprite(im, cat, desc); }; im.src = cv.toDataURL(); }
var DEMOS = {
  fish: function () { var r = paper(400, 260), cv = r[0], c = r[1], hue = Math.floor(Math.random()*360);
    c.fillStyle = 'hsl(' + hue + ',80%,60%)'; c.beginPath(); c.ellipse(210, 130, 120, 70, 0, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(100, 130); c.lineTo(30, 70); c.lineTo(50, 130); c.lineTo(30, 190); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'hsl(' + ((hue+40)%360) + ',80%,55%)'; c.beginPath(); c.moveTo(200, 62); c.lineTo(240, 20); c.lineTo(260, 66); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(290, 110, 18, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#111'; c.beginPath(); c.arc(296, 112, 8, 0, 6.3); c.fill(); toSprite(cv, 'fish'); },
  whale: function () { var r = paper(460, 260), cv = r[0], c = r[1];
    c.fillStyle = '#4a78c2'; c.beginPath(); c.moveTo(40, 150); c.quadraticCurveTo(120, 40, 300, 70); c.quadraticCurveTo(420, 90, 430, 140); c.quadraticCurveTo(380, 210, 200, 200); c.quadraticCurveTo(90, 200, 40, 150); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(50, 150); c.lineTo(10, 100); c.lineTo(60, 130); c.lineTo(20, 190); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#dfe9f7'; c.beginPath(); c.moveTo(120, 180); c.quadraticCurveTo(250, 230, 400, 160); c.quadraticCurveTo(300, 200, 120, 180); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(360, 110, 14, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = '#111'; c.beginPath(); c.arc(364, 112, 6, 0, 6.3); c.fill();
    c.strokeStyle = '#4a78c2'; c.lineWidth = 5; c.beginPath(); c.moveTo(300, 62); c.lineTo(290, 30); c.moveTo(300, 62); c.lineTo(312, 30); c.stroke(); toSprite(cv, 'whale'); },
  shark: function () { var r = paper(460, 240), cv = r[0], c = r[1];
    c.fillStyle = '#8fa3b8'; c.beginPath(); c.moveTo(60, 140); c.quadraticCurveTo(200, 60, 420, 130); c.quadraticCurveTo(250, 200, 60, 140); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(200, 95); c.lineTo(230, 20); c.lineTo(280, 100); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(70, 140); c.lineTo(20, 80); c.lineTo(50, 140); c.lineTo(20, 200); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(330, 128); c.lineTo(400, 130); c.lineTo(340, 150); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.arc(360, 108, 6, 0, 6.3); c.fill(); toSprite(cv, 'shark'); },
  crawler: function () { var r = paper(360, 260), cv = r[0], c = r[1]; c.fillStyle = '#e8563a';
    for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(120, 150 + i*12); c.lineTo(40, 120 + i*30); c.stroke(); c.beginPath(); c.moveTo(240, 150 + i*12); c.lineTo(320, 120 + i*30); c.stroke(); }
    c.beginPath(); c.ellipse(180, 160, 90, 60, 0, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.arc(90, 90, 30, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.arc(270, 90, 30, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(150, 125, 14, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.arc(210, 125, 14, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.arc(154, 127, 6, 0, 6.3); c.fill(); c.beginPath(); c.arc(214, 127, 6, 0, 6.3); c.fill(); toSprite(cv, 'crawler'); },
  bird: function () { var r = paper(380, 260), cv = r[0], c = r[1]; c.fillStyle = '#fff'; c.strokeStyle = '#333';
    c.fillStyle = '#f2f2f2'; c.beginPath(); c.ellipse(190, 150, 100, 55, 0, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); c.arc(290, 100, 36, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#f5a623'; c.beginPath(); c.moveTo(322, 96); c.lineTo(370, 106); c.lineTo(322, 116); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#9ad0f5'; c.beginPath(); c.moveTo(150, 140); c.lineTo(90, 60); c.lineTo(230, 120); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.arc(300, 92, 6, 0, 6.3); c.fill(); toSprite(cv, 'bird'); },
  person: function () { var r = paper(220, 360), cv = r[0], c = r[1];
    c.fillStyle = '#ffd9b3'; c.beginPath(); c.arc(110, 70, 42, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#3b6fd6'; c.beginPath(); c.roundRect(70, 115, 80, 120, 12); c.fill(); c.stroke();
    c.lineWidth = 14; c.strokeStyle = '#ffd9b3'; c.beginPath(); c.moveTo(70, 130); c.lineTo(30, 200); c.moveTo(150, 130); c.lineTo(190, 200); c.stroke();
    c.strokeStyle = '#444'; c.beginPath(); c.moveTo(90, 235); c.lineTo(80, 330); c.moveTo(130, 235); c.lineTo(140, 330); c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.arc(98, 65, 5, 0, 6.3); c.fill(); c.beginPath(); c.arc(122, 65, 5, 0, 6.3); c.fill();
    c.lineWidth = 4; c.beginPath(); c.arc(110, 78, 14, 0.2, 2.9); c.stroke(); toSprite(cv, 'person'); },
  boat: function () { var r = paper(420, 260), cv = r[0], c = r[1]; c.fillStyle = '#b07a3c';
    for (var i = 0; i < 6; i++) { c.beginPath(); c.roundRect(60, 150 + i*12, 300, 14, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#6b4a2b'; c.fillRect(200, 40, 10, 115); c.fillStyle = '#fdf6e3'; c.beginPath(); c.moveTo(210, 40); c.lineTo(210, 140); c.lineTo(320, 140); c.closePath(); c.fill(); c.stroke(); toSprite(cv, 'boat'); },
  vehicle: function (desc) { var r = paper(420, 240), cv = r[0], c = r[1];
    c.fillStyle = '#e63946'; c.beginPath(); c.roundRect(40, 110, 340, 70, 16); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(120, 50, 180, 70, 16); c.fill(); c.stroke();
    c.fillStyle = '#bde0fe'; c.fillRect(140, 62, 60, 48); c.strokeRect(140, 62, 60, 48); c.fillRect(220, 62, 60, 48); c.strokeRect(220, 62, 60, 48);
    c.fillStyle = '#222'; c.beginPath(); c.arc(110, 185, 32, 0, 6.3); c.fill(); c.stroke(); c.beginPath(); c.arc(310, 185, 32, 0, 6.3); c.fill(); c.stroke(); toSprite(cv, 'vehicle', desc); },
  aircraft: function () { var r = paper(440, 220), cv = r[0], c = r[1];
    c.fillStyle = '#dfe7f2'; c.beginPath(); c.ellipse(220, 120, 180, 38, 0, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#4a90e2'; c.beginPath(); c.moveTo(200, 120); c.lineTo(120, 200); c.lineTo(260, 130); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(70, 110); c.lineTo(40, 50); c.lineTo(110, 100); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#bde0fe'; for (var i = 0; i < 5; i++) { c.beginPath(); c.arc(200 + i*36, 110, 9, 0, 6.3); c.fill(); c.stroke(); } toSprite(cv, 'aircraft'); }
};

return { NICKS: NICKS, names: Object.keys(DEMOS), make: function (name, cb, desc) { onSprite = cb; DEMOS[name](desc); }, all: function (cb) { onSprite = cb; Object.keys(DEMOS).forEach(function (k) { DEMOS[k](); }); } };
})();
