/* 캐릭터+장비 도안(윤곽선) — 아이가 그 위를 색칠한다. window.CharArt
   draw(charKey, ctx, size, {equip, guide}) : size×size 캔버스에 윤곽선을 그린다.
   guide=true 면 연한 회색(색칠용 밑그림), false면 진한 선(칩 미리보기). */
(function (global) {
  function S(ctx, size, guide) {
    ctx.save();
    ctx.translate(size / 2, size / 2);        // 중앙 원점
    ctx.scale(size / 200, size / 200);        // 200 기준 좌표계
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = guide ? '#b7bcc7' : '#333';
    ctx.lineWidth = guide ? 4 : 5;
    ctx.fillStyle = 'rgba(0,0,0,0)';
  }
  function eye(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r || 5, 0, 6.3); ctx.stroke(); }

  /* ── 캐릭터 몸통 (원점=중앙, 좌표 -100..100) ── */
  var BODY = {
    seal: function (c) {                                   // 🦭 물개
      c.beginPath(); c.ellipse(0, 20, 42, 55, 0, 0, 6.3); c.stroke();       // 몸
      c.beginPath(); c.arc(0, -40, 34, 0, 6.3); c.stroke();                 // 머리
      c.beginPath(); c.ellipse(-40, 55, 22, 12, -0.5, 0, 6.3); c.stroke();  // 지느러미
      c.beginPath(); c.ellipse(40, 55, 22, 12, 0.5, 0, 6.3); c.stroke();
      eye(c, -12, -44); eye(c, 12, -44);
      c.beginPath(); c.arc(0, -34, 6, 0, 6.3); c.stroke();                  // 코
      c.beginPath(); c.moveTo(-30, -34); c.lineTo(-14, -30); c.moveTo(30, -34); c.lineTo(14, -30); c.stroke(); // 수염
    },
    crab: function (c) {                                   // 🦀 게
      c.beginPath(); c.ellipse(0, 10, 60, 40, 0, 0, 6.3); c.stroke();       // 등딱지
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 22, 45); c.lineTo(i * 26, 75); c.stroke(); } // 다리
      c.beginPath(); c.arc(-70, -18, 20, 0, 6.3); c.stroke();               // 집게 왼
      c.beginPath(); c.arc(70, -18, 20, 0, 6.3); c.stroke();                // 집게 오
      c.beginPath(); c.moveTo(-55, 0); c.lineTo(-70, -18); c.moveTo(55, 0); c.lineTo(70, -18); c.stroke();
      c.beginPath(); c.moveTo(-16, -28); c.lineTo(-16, -46); c.moveTo(16, -28); c.lineTo(16, -46); c.stroke(); // 눈자루
      eye(c, -16, -50); eye(c, 16, -50);
    },
    monkey: function (c) {                                 // 🐒 원숭이
      c.beginPath(); c.ellipse(0, 30, 34, 42, 0, 0, 6.3); c.stroke();       // 몸
      c.beginPath(); c.arc(0, -34, 32, 0, 6.3); c.stroke();                 // 머리
      c.beginPath(); c.arc(-32, -46, 13, 0, 6.3); c.stroke();               // 귀
      c.beginPath(); c.arc(32, -46, 13, 0, 6.3); c.stroke();
      c.beginPath(); c.ellipse(0, -26, 20, 16, 0, 0, 6.3); c.stroke();      // 얼굴판
      eye(c, -9, -30); eye(c, 9, -30);
      c.beginPath(); c.moveTo(30, 40); c.quadraticCurveTo(70, 30, 60, -6); c.stroke(); // 꼬리
      c.beginPath(); c.moveTo(-30, 18); c.lineTo(-52, 44); c.moveTo(30, 18); c.lineTo(52, 44); c.stroke(); // 팔
    },
    human: function (c) {                                  // 🧍 사람
      c.beginPath(); c.arc(0, -46, 26, 0, 6.3); c.stroke();                 // 머리
      c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 40); c.stroke();         // 몸통
      c.beginPath(); c.moveTo(0, -8); c.lineTo(-34, 18); c.moveTo(0, -8); c.lineTo(34, 18); c.stroke(); // 팔
      c.beginPath(); c.moveTo(0, 40); c.lineTo(-24, 82); c.moveTo(0, 40); c.lineTo(24, 82); c.stroke();  // 다리
      eye(c, -9, -48); eye(c, 9, -48);
      c.beginPath(); c.arc(0, -38, 8, 0.2, Math.PI - 0.2); c.stroke();      // 미소
    },
    bird: function (c) {                                   // 🐦 새
      c.beginPath(); c.ellipse(0, 20, 40, 46, 0, 0, 6.3); c.stroke();       // 몸
      c.beginPath(); c.arc(6, -34, 26, 0, 6.3); c.stroke();                 // 머리
      c.beginPath(); c.moveTo(30, -34); c.lineTo(58, -26); c.lineTo(30, -18); c.closePath(); c.stroke(); // 부리
      c.beginPath(); c.moveTo(-30, 6); c.quadraticCurveTo(-72, 24, -34, 54); c.stroke(); // 날개
      c.beginPath(); c.moveTo(-38, 60); c.lineTo(-58, 74); c.moveTo(-30, 64); c.lineTo(-46, 82); c.stroke(); // 꼬리깃
      c.beginPath(); c.moveTo(-8, 66); c.lineTo(-8, 84); c.moveTo(12, 66); c.lineTo(12, 84); c.stroke();     // 다리
      eye(c, 8, -38);
    }
  };

  /* ── 장비 오버레이 ── */
  var TOOL = {
    broom: function (c) { c.beginPath(); c.moveTo(58, -30); c.lineTo(40, 40); c.stroke();          // 자루
      c.beginPath(); c.moveTo(30, 40); c.lineTo(50, 40); c.lineTo(56, 66); c.lineTo(24, 66); c.closePath(); c.stroke(); },
    tongs: function (c) { c.beginPath(); c.moveTo(48, -6); c.lineTo(74, -24); c.moveTo(48, 6); c.lineTo(74, 24); c.stroke();
      c.beginPath(); c.moveTo(48, -6); c.lineTo(48, 6); c.stroke(); },
    skewer: function (c) { c.beginPath(); c.moveTo(24, 50); c.lineTo(84, -34); c.stroke();          // 긴 막대
      c.beginPath(); c.moveTo(84, -34); c.lineTo(78, -26); c.moveTo(84, -34); c.lineTo(76, -32); c.stroke(); } // 뾰족
  };
  var CONTAINER = {
    dustpan: function (c) { c.beginPath(); c.moveTo(-78, 44); c.lineTo(-40, 44); c.lineTo(-46, 70); c.lineTo(-84, 70); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, 44); c.lineTo(-30, 34); c.stroke(); },
    bag: function (c) { c.beginPath(); c.moveTo(-74, 30); c.lineTo(-40, 30); c.lineTo(-46, 78); c.lineTo(-68, 78); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-70, 30); c.lineTo(-66, 18); c.moveTo(-44, 30); c.lineTo(-48, 18); c.stroke(); },  // 손잡이
    backpack: function (c) { c.beginPath(); c.roundRect ? c.roundRect(20, -20, 40, 56, 10) : c.rect(20, -20, 40, 56); c.stroke();
      c.beginPath(); c.moveTo(20, -14); c.lineTo(4, 0); c.moveTo(20, 20); c.lineTo(6, 30); c.stroke(); }         // 어깨끈
  };
  var FEET = {
    fins: function (c) { c.beginPath(); c.ellipse(-24, 88, 20, 9, -0.3, 0, 6.3); c.stroke(); c.beginPath(); c.ellipse(24, 88, 20, 9, 0.3, 0, 6.3); c.stroke(); },
    sneakers: function (c) { c.beginPath(); c.roundRect ? c.roundRect(-40, 80, 34, 16, 6) : c.rect(-40, 80, 34, 16); c.stroke(); c.beginPath(); c.roundRect ? c.roundRect(6, 80, 34, 16, 6) : c.rect(6, 80, 34, 16); c.stroke(); },
    boots: function (c) { c.beginPath(); c.rect(-36, 66, 22, 30); c.stroke(); c.beginPath(); c.rect(14, 66, 22, 30); c.stroke(); }
  };

  function draw(charKey, ctx, size, opts) {
    opts = opts || {}; var guide = !!opts.guide, eq = opts.equip || {};
    S(ctx, size, guide);
    (BODY[charKey] || BODY.human)(ctx);
    if (eq.feet && FEET[eq.feet]) FEET[eq.feet](ctx);
    if (eq.container && CONTAINER[eq.container]) CONTAINER[eq.container](ctx);
    if (eq.tool && TOOL[eq.tool]) TOOL[eq.tool](ctx);
    ctx.restore();
  }

  global.CharArt = { draw: draw, BODY: BODY, TOOL: TOOL, CONTAINER: CONTAINER, FEET: FEET };
})(window);
