/* 청소게임 데이터 모델 — 캐릭터·장비·지형 스탯 + 최종스탯 계산기
   폰(선택/색칠/검증)과 화면(적용)이 공용으로 사용. window.GameData */
(function (global) {

  /* 지형 키: water 물속 · sand 모래 · forest 숲 · city 도시 · park 평지 · air 하늘 */
  var MAPS = {
    sea:    { name: '바다',  emoji: '🌊', view: 'side', terrain: 'water',  hasWater: true,  trees: false, sky: false },
    island: { name: '섬',    emoji: '🏝️', view: 'top',  terrain: 'sand',   hasWater: true,  trees: false, sky: true  },
    forest: { name: '숲',    emoji: '🌳', view: 'top',  terrain: 'forest', hasWater: false, trees: true,  sky: false },
    city:   { name: '도시',  emoji: '🏙️', view: 'side', terrain: 'city',   hasWater: false, trees: false, sky: false },
    park:   { name: '공원',  emoji: '🌷', view: 'top',  terrain: 'park',   hasWater: false, trees: false, sky: true  }
  };
  var MVP_MAPS = ['sea', 'forest'];       // 지금 구현된 맵

  /* 캐릭터: 지형별 이동배수(사람=1.0), 잠수 지속(초), 특수 플래그, 엔진 리그용 cat */
  var CHARACTERS = {
    seal:   { name: '물개',   emoji: '🦭', cat: 'whale',   dive: 30,
              mul: { water: 2.0, sand: 0.5, forest: 0.5, city: 0.5, park: 0.5, air: 0.5 } },
    crab:   { name: '게',     emoji: '🦀', cat: 'crawler', dive: 20, moisture: true,
              mul: { water: 1.5, sand: 2.0, forest: 1.0, city: 1.0, park: 1.0, air: 1.0 } },
    monkey: { name: '원숭이', emoji: '🐒', cat: 'animal',  dive: 8,  treeJump: true,
              mul: { water: 0.8, sand: 1.0, forest: 1.8, city: 1.1, park: 1.1, air: 1.0 } },
    human:  { name: '사람',   emoji: '🧍', cat: 'person',  dive: 12,
              mul: { water: 1.0, sand: 1.0, forest: 1.0, city: 1.0, park: 1.0, air: 1.0 } },
    bird:   { name: '새',     emoji: '🐦', cat: 'bird',    dive: 5,  fly: true,
              mul: { water: 0.7, sand: 1.2, forest: 0.4, city: 0.4, park: 1.6, air: 2.0 } }
  };
  var CHAR_ORDER = ['seal', 'crab', 'monkey', 'human', 'bird'];

  /* 장비 슬롯 A: 줍는 도구 */
  var TOOLS = {
    broom:  { name: '빗자루', emoji: '🧹', pickup: 'area',   areaR: 130, canHeavy: false, canCorner: false,
              desc: '한 번에 여러 개! 무겁거나 구석 쓰레기는 못 담아요' },
    tongs:  { name: '집게',   emoji: '🦾', pickup: 'single', canHeavy: true,  canCorner: true,
              desc: '무엇이든 집어요. 한 번에 하나씩' },
    skewer: { name: '꼬챙이', emoji: '🍢', pickup: 'fast',   cooldown: 0.25, canHeavy: true, canCorner: false,
              weakCollect: true, canSteal: true,
              desc: '빠르게 콕콕! 줍는 힘은 약하지만 친구 쓰레기를 1개 뺏어요' }
  };
  var TOOL_ORDER = ['broom', 'tongs', 'skewer'];

  /* 장비 슬롯 B: 담는 도구 (cap=용량, collect=담기속도배수, leak=초당 흘릴 확률, skewerLoss=꼬챙이 피격 손실확률) */
  var CONTAINERS = {
    dustpan: { name: '쓰레받이', emoji: '🗑️', cap: 5,  collect: 1.4, leak: 0.12, skewerLoss: 0.0, noBroom: false,
               desc: '가장 빨리 담아요! 대신 적게 담기고, 다니다 보면 흘려요. 꼬챙이 방어 O' },
    bag:     { name: '비닐봉투', emoji: '🛍️', cap: 15, collect: 1.0, leak: 0.0, skewerLoss: 0.9, noBroom: false,
               desc: '가장 많이! 가벼워요. 대신 꼬챙이에 약해요(90%)' },
    backpack:{ name: '등가방',   emoji: '🎒', cap: 15, collect: 0.6, leak: 0.0, skewerLoss: 0.3, noBroom: true,
               desc: '많이 담고 안 흘려요. 담는 게 느리고, 빗자루와 같이 못 써요' }
  };
  var CONTAINER_ORDER = ['dustpan', 'bag', 'backpack'];

  /* 장비 슬롯 C: 신발 */
  var FEET = {
    fins:     { name: '오리발', emoji: '🦶', desc: '물속 슝슝! 육지는 느려요' },
    sneakers: { name: '운동화', emoji: '👟', desc: '육지 어디서나 빨라요. 물속은 느려요' },
    boots:    { name: '장화',   emoji: '🥾', desc: '숲에서 최고! 다른 곳은 그대로' }
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
