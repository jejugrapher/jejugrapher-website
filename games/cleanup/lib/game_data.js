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

  /* 캐릭터(제주): 지형별 이동배수(1.0=보통), 잠수 지속(초), 특수 플래그 */
  var CHARACTERS = {
    seal:    { name: '물개',   emoji: '🦭', cat: 'whale',   dive: 30, trait: '물속 최강·오래 잠수. 육지는 느려요',
               mul: { water: 2.0, sand: 0.6, forest: 0.5, village: 0.5, air: 0.5 } },
    crab:    { name: '게',     emoji: '🦀', cat: 'crawler', dive: 20, moisture: true, trait: '모래·바위 최고! 몸이 마르면 기절해요',
               mul: { water: 1.5, sand: 2.0, forest: 1.0, village: 1.0, air: 1.0 } },
    pony:    { name: '조랑말', emoji: '🐎', cat: 'animal',  dive: 6,  trait: '육지(마을·곶자왈) 최고속. 물은 약해요',
               mul: { water: 0.7, sand: 1.2, forest: 1.3, village: 1.6, air: 1.1 } },
    gull:    { name: '갈매기', emoji: '🐦', cat: 'bird',    dive: 5,  fly: true, trait: '트인 곳은 날아서 최고속. 숲·마을은 걸어서 느려요',
               mul: { water: 0.8, sand: 1.2, forest: 0.5, village: 0.6, air: 2.0 } },
    haenyeo: { name: '해녀',   emoji: '🧜', cat: 'person',  dive: 25, trait: '모든 곳 균형·잠수 좋음. 초보 추천 올라운더',
               mul: { water: 1.6, sand: 1.1, forest: 1.0, village: 1.0, air: 1.0 } }
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

  /* 장비 슬롯 B: 담는 도구 (cap=용량, collect=담기속도, leak=흘림, skewerLoss=작살 피격 손실확률) */
  var CONTAINERS = {
    basket: { name: '구덕',     emoji: '🧺', cap: 8,  collect: 1.3, leak: 0.05, skewerLoss: 0.0,
              desc: '대나무 바구니. 안정적으로 빨리 담고 잘 안 흘려요. 작살 방어 O (중간 용량)' },
    bag:    { name: '비닐봉투', emoji: '🛍️', cap: 15, collect: 1.0, leak: 0.0, skewerLoss: 0.9,
              desc: '가장 많이! 가벼워요. 대신 작살에 약해요(90%)' },
    net:    { name: '망사리',   emoji: '🕸️', cap: 15, collect: 1.1, leak: 0.0, skewerLoss: 0.3,
              desc: '해녀 그물망. 많이 담고 튼튼해요(작살에 강함)' }
  };
  var CONTAINER_ORDER = ['basket', 'bag', 'net'];

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
    equip = equip || {}; terrain = terrain || 'park';
    var ch = CHARACTERS[charKey] || CHARACTERS.human;
    var tool = TOOLS[equip.tool] || TOOLS.tongs;
    var cont = CONTAINERS[equip.container] || CONTAINERS.bag;
    var feet = equip.feet || 'sneakers';
    var base = (ch.mul[terrain] != null ? ch.mul[terrain] : 1.0) * footMul(feet, terrain);
    return {
      char: charKey, cat: ch.cat,
      speedMul: +base.toFixed(3),               // 기본이동 × 이 값 = 실제 속도
      dive: ch.dive,                            // 물속 잠수 지속(초)
      moisture: !!ch.moisture,                  // 게: 수분 게이지
      treeJump: !!ch.treeJump,                  // 원숭이: 숲 나무점프
      fly: !!ch.fly,                            // 새: 비행
      pickup: tool.pickup,                      // area | single | fast
      areaR: tool.areaR || 0,
      canHeavy: !!tool.canHeavy, canCorner: !!tool.canCorner,
      canSteal: !!tool.canSteal, cooldown: tool.cooldown || 0.4,
      capacity: cont.cap, collect: cont.collect, leak: cont.leak, skewerLoss: cont.skewerLoss
    };
  }

  global.GameData = {
    MAPS: MAPS, MVP_MAPS: MVP_MAPS,
    CHARACTERS: CHARACTERS, CHAR_ORDER: CHAR_ORDER,
    TOOLS: TOOLS, TOOL_ORDER: TOOL_ORDER,
    CONTAINERS: CONTAINERS, CONTAINER_ORDER: CONTAINER_ORDER,
    FEET: FEET, FEET_ORDER: FEET_ORDER,
    validate: validate, finalStats: finalStats, footMul: footMul,
    randomMap: function (pool) { pool = pool || MVP_MAPS; return pool[Math.floor(Math.random() * pool.length)]; }
  };
})(window);
