/* 청소게임 데이터 모델 — 캐릭터·장비·지형 스탯 + 최종스탯 계산기
   폰(선택/색칠/검증)과 화면(적용)이 공용으로 사용. window.GameData */
(function (global) {

  /* 지형 키: water 물속 · sand 모래 · forest 숲(곶자왈) · village 마을(육지) · air 하늘 */
  var MAPS = {
    village:  { name: '제주 마을', emoji: '🏘️', view: 'top', terrain: 'village', hasWater: false, trees: false, sky: false },
    beach:    { name: '제주 해변', emoji: '🏖️', view: 'top', terrain: 'sand',    hasWater: true,  trees: false, sky: true  },
    valley:   { name: '제주 계곡', emoji: '🏞️', view: 'top', terrain: 'water',   hasWater: true,  trees: false, sky: false },
    gotjawal: { name: '곶자왈',    emoji: '🌿', view: 'top', terrain: 'forest',  hasWater: false, trees: true,  sky: false }
  };
  var MVP_MAPS = ['village', 'beach', 'valley', 'gotjawal'];

  /* 캐릭터(제주): 지형별 이동배수(1.0=보통), 기본 용량 cap, 특수 패시브 pv
     pv: superArmor(1회 피격무시)·hAccel(가로가속)·homeTurf(내창고 근처 강함)·fly(벽/물 무시 비행) */
  var CHARACTERS = {
    pony:    { name: '조랑말', emoji: '🐎', cat: 'animal',  dive: 6,  cap: 3, pv: 'dash',       role: '수집·기동', trait: '가장 빠름! 대신 조금밖에 못 담아요',
               mul: { water: 0.8, sand: 1.3, forest: 1.4, village: 1.5, air: 1.1 } },
    seal:    { name: '물개',   emoji: '🦭', cat: 'whale',   dive: 30, cap: 8, pv: 'superArmor', role: '대량 운반', trait: '가장 많이 담는 튼튼이! 한 번은 안 뺏겨요(10초). 좀 느려요',
               mul: { water: 1.6, sand: 0.7, forest: 0.6, village: 0.6, air: 0.6 } },
    gull:    { name: '갈매기', emoji: '🐦', cat: 'bird',    dive: 5,  cap: 4, pv: 'fly', fly: true, role: '습격·기동', trait: '벽·물 위를 날아 어디든 습격! 공격이 빨라요',
               mul: { water: 1.0, sand: 1.2, forest: 1.0, village: 1.0, air: 1.6 } },
    crab:    { name: '게',     emoji: '🦀', cat: 'crawler', dive: 20, cap: 5, pv: 'hAccel', moisture: true, role: '견제(둔화)', trait: '부딪히면 상대를 느리게! 가로로 빨라요. 몸이 마르면 기절',
               mul: { water: 1.4, sand: 1.6, forest: 1.0, village: 1.0, air: 1.0 } },
    haenyeo: { name: '해녀',   emoji: '🧜', cat: 'person',  dive: 25, cap: 5, pv: 'homeTurf',  role: '수비', trait: '내 창고 근처에선 빠르고 강해요! 지킬 때 최고',
               mul: { water: 1.2, sand: 1.0, forest: 1.0, village: 1.0, air: 1.0 } }
  };
  var CHAR_ORDER = ['seal', 'crab', 'pony', 'gull', 'haenyeo'];

  /* 장비 슬롯 A: 줍는 도구 */
  var TOOLS = {
    broom:  { name: '빗자루', emoji: '🧹', pickup: 'area',   areaR: 130, canHeavy: false, canCorner: false,
              desc: '한 번에 여러 개 쓸어 담아요. 무겁거나 구석 쓰레기는 못 해요' },
    tongs:  { name: '집게',   emoji: '🦾', pickup: 'single', canHeavy: true,  canCorner: true,
              desc: '무엇이든 확실하게. 한 번에 하나씩' },
    spear:  { name: '작살',   emoji: '🔱', pickup: 'fast',   cooldown: 0.25, canHeavy: true, canCorner: false,
              weakCollect: true, canSteal: true,
              desc: '빠르게 콕콕! 친구 쓰레기를 1개 뺏을 수 있어요(해녀 도구)' }
  };
  var TOOL_ORDER = ['broom', 'tongs', 'spear'];

  /* 장비 슬롯 B: 담는 도구 (capBonus=캐릭터 기본용량에 더함, collect·leak, dropResist=피격 시 덜 떨어뜨림) */
  var CONTAINERS = {
    basket: { name: '구덕',     emoji: '🧺', capBonus: 0, collect: 1.3, leak: 0.04, dropResist: 0,
              desc: '대나무 바구니. 안정적으로 빨리 담아요(용량 그대로)' },
    bag:    { name: '비닐봉투', emoji: '🛍️', capBonus: 4, collect: 1.0, leak: 0.0,  dropResist: 0,
              desc: '더 많이 담아요(+4). 대신 부딪히면 잘 떨어져요' },
    net:    { name: '망사리',   emoji: '🕸️', capBonus: 2, collect: 1.1, leak: 0.0,  dropResist: 1,
              desc: '해녀 그물망. 조금 더 담고(+2) 튼튼해 덜 뺏겨요' }
  };
  var CONTAINER_ORDER = ['basket', 'bag', 'net'];

  /* 장비 슬롯 D: 방어·유틸 (공수 전략의 핵심) */
  var GEAR = {
    lock:  { name: '자물쇠', emoji: '🔒', desc: '내 창고를 잠가요. 뺏는 데 2배 오래 걸려요', active: false },
    trap:  { name: '함정',   emoji: '🪤', desc: '내 창고에 온 친구를 잠깐 멈칫! (2번)', active: false },
    alarm: { name: '경보기', emoji: '🔔', desc: '창고에 적이 오면 폰이 울리고 빨리 돌아가요', active: false },
    boost: { name: '부스트', emoji: '🚀', desc: '버튼 누르면 잠깐 슝! 빨라져요 (10초마다)', active: true }
  };
  var GEAR_ORDER = ['lock', 'trap', 'alarm', 'boost'];

  /* 장비 슬롯 C: 신발 */
  var FEET = {
    fins:     { name: '오리발', emoji: '🦶', desc: '물속 슝슝! 육지는 느려요' },
    sneakers: { name: '운동화', emoji: '👟', desc: '육지 어디서나 빨라요. 물속은 느려요' },
    boots:    { name: '장화',   emoji: '🥾', desc: '곶자왈에서 최고! 다른 곳은 보통' }
  };
  var FEET_ORDER = ['fins', 'sneakers', 'boots'];

  function isWater(terrain) { return terrain === 'water'; }
  function footMul(feetKey, terrain) {
    if (feetKey === 'fins') return isWater(terrain) ? 1.8 : 0.4;
    if (feetKey === 'sneakers') return isWater(terrain) ? 0.6 : 1.4;
    if (feetKey === 'boots') return terrain === 'forest' ? 1.6 : 1.0;
    return 1.0;
  }

  /* 장비 조합 검증: 등가방 + 빗자루 불가 */
  function validate(equip) {
    equip = equip || {};
    if (equip.container === 'backpack' && equip.tool === 'broom')
      return { ok: false, msg: '등가방은 빗자루와 같이 못 써요. 집게나 꼬챙이를 골라요' };
    return { ok: true };
  }

  /* 최종 스탯: 캐릭터+장비+지형 → 게임이 쓸 값들 */
  function finalStats(charKey, equip, terrain) {
    equip = equip || {}; terrain = terrain || 'village';
    var ch = CHARACTERS[charKey] || CHARACTERS.haenyeo;
    var tool = TOOLS[equip.tool] || TOOLS.tongs;
    var cont = CONTAINERS[equip.container] || CONTAINERS.basket;
    var feet = equip.feet || 'sneakers';
    var gear = equip.gear || 'alarm';
    var base = (ch.mul[terrain] != null ? ch.mul[terrain] : 1.0) * footMul(feet, terrain);
    var cooldown = (tool.cooldown || 0.4) * (ch.pv === 'fly' ? 0.8 : 1);   // 갈매기 공격쿨 -20%
    return {
      char: charKey, cat: ch.cat,
      speedMul: +base.toFixed(3),               // 기본이동 × 이 값 = 실제 속도
      dive: ch.dive,
      moisture: !!ch.moisture,                  // 게: 수분 게이지
      fly: !!ch.fly,                            // 갈매기: 벽·물 무시 비행
      superArmor: ch.pv === 'superArmor',       // 물개: 1회 피격 무시(10초)
      homeTurf: ch.pv === 'homeTurf',           // 해녀: 내 창고 근처 강함
      hAccel: ch.pv === 'hAccel',               // 게: 가로 이동 가속
      pickup: tool.pickup,                      // area | single | fast
      areaR: tool.areaR || 0,
      canHeavy: !!tool.canHeavy, canCorner: !!tool.canCorner,
      canSteal: !!tool.canSteal, cooldown: cooldown,
      capacity: (ch.cap || 5) + (cont.capBonus || 0), collect: cont.collect, leak: cont.leak, dropResist: cont.dropResist || 0,
      gear: gear, gearLock: gear === 'lock', gearTrap: gear === 'trap', gearAlarm: gear === 'alarm', gearBoost: gear === 'boost'
    };
  }

  global.GameData = {
    MAPS: MAPS, MVP_MAPS: MVP_MAPS,
    CHARACTERS: CHARACTERS, CHAR_ORDER: CHAR_ORDER,
    TOOLS: TOOLS, TOOL_ORDER: TOOL_ORDER,
    CONTAINERS: CONTAINERS, CONTAINER_ORDER: CONTAINER_ORDER,
    FEET: FEET, FEET_ORDER: FEET_ORDER,
    GEAR: GEAR, GEAR_ORDER: GEAR_ORDER,
    validate: validate, finalStats: finalStats, footMul: footMul,
    randomMap: function (pool) { pool = pool || MVP_MAPS; return pool[Math.floor(Math.random() * pool.length)]; }
  };
})(window);
