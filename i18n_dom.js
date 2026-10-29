/* JEJUGRAPHER 사이트 공용 다국어 엔진 (DOM 사전 치환형) — KO / EN / ZH / JA
   페이지 HTML 은 손대지 않는다. window.JG_DICT = {en:{ko원문:번역}, zh:{...}, ja:{...}} 를
   /i18n_dict.js 로 불러와, 본문 텍스트 노드와 일부 속성을 선택 언어로 바꾼다.
   - 최초 1회 본문을 훑어 원문(정규화 키)과 노드를 기억한다.
   - KO 로 돌리면 원문을 복원한다. 사전에 없는 문자열은 한국어로 남는다(자동 폴백).
   - 스위처: #jglang 있으면 그 안에, 없으면 우상단 플로팅. (raven-lidar 등 자체 엔진 페이지는 주입 안 함)  */
(function () {
  if (window.__jgI18nDom) return; window.__jgI18nDom = true;
  var LANGS = ['ko', 'en', 'zh', 'ja'];
  var SHORT = { ko: 'KO', en: 'EN', zh: '中', ja: '日' };
  var NAMES = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語' };
  var HTMLLANG = { ko: 'ko', en: 'en', zh: 'zh-CN', ja: 'ja' };
  var NOWALK = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1, SVG: 1, TEMPLATE: 1 };
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function hangulish(s) { return /[가-힣]/.test(s); }

  var nodes = [];   // {node, orig, key}
  var attrs = [];   // {el, name, orig, key}
  var titleOrig = null, titleKey = null;
  var collected = false;

  function skip(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (NOWALK[n.nodeName]) return true;
      if (n.id === 'jglang') return true;
      if (n.hasAttribute && (n.hasAttribute('data-noi18n') || n.getAttribute('translate') === 'no')) return true;
    }
    return false;
  }

  function collect() {
    if (collected || !document.body) return;
    collected = true;
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var tn;
    while ((tn = tw.nextNode())) {
      var raw = tn.nodeValue;
      if (!raw || !hangulish(raw)) continue;
      if (skip(tn.parentNode)) continue;
      nodes.push({ node: tn, orig: raw, key: norm(raw) });
    }
    var all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (skip(el)) continue;
      for (var a = 0; a < ATTRS.length; a++) {
        var v = el.getAttribute(ATTRS[a]);
        if (v && hangulish(v)) attrs.push({ el: el, name: ATTRS[a], orig: v, key: norm(v) });
      }
    }
    var mt = document.querySelector('meta[name="description"]');
    if (mt && hangulish(mt.getAttribute('content') || '')) attrs.push({ el: mt, name: 'content', orig: mt.getAttribute('content'), key: norm(mt.getAttribute('content')) });
    if (document.title && hangulish(document.title)) { titleOrig = document.title; titleKey = norm(document.title); }
  }

  function apply(lang) {
    collect();
    var dict = (window.JG_DICT && window.JG_DICT[lang]) || null;
    document.documentElement.setAttribute('lang', HTMLLANG[lang] || 'ko');
    var i, v;
    for (i = 0; i < nodes.length; i++) {
      v = (lang === 'ko' || !dict) ? null : dict[nodes[i].key];
      nodes[i].node.nodeValue = (v != null) ? v : nodes[i].orig;
    }
    for (i = 0; i < attrs.length; i++) {
      v = (lang === 'ko' || !dict) ? null : dict[attrs[i].key];
      try { attrs[i].el.setAttribute(attrs[i].name, (v != null) ? v : attrs[i].orig); } catch (e) {}
    }
    if (titleKey != null) {
      v = (lang === 'ko' || !dict) ? null : dict[titleKey];
      document.title = (v != null) ? v : titleOrig;
    }
    var box = document.getElementById('jglang');
    if (box) {
      var bs = box.querySelectorAll('button');
      for (i = 0; i < bs.length; i++) {
        var on = bs[i].getAttribute('data-l') === lang;
        bs[i].classList.toggle('on', on);
        bs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    try { localStorage.setItem('jg-lang', lang); } catch (e) {}
    window.__jgLang = lang;
  }

  function detect() {
    try { var s = localStorage.getItem('jg-lang'); if (s && LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    var navs = navigator.languages || [navigator.language || 'ko'];
    for (var i = 0; i < navs.length; i++) {
      var l = String(navs[i]).toLowerCase();
      if (l.indexOf('ko') === 0) return 'ko';
      if (l.indexOf('zh') === 0) return 'zh';
      if (l.indexOf('ja') === 0) return 'ja';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'ko';
  }

  function buttons(box) {
    for (var i = 0; i < LANGS.length; i++) {
      var l = LANGS[i];
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-l', l); b.setAttribute('aria-label', NAMES[l]);
      b.textContent = SHORT[l];
      b.addEventListener('click', (function (x) { return function () { apply(x); }; })(l));
      box.appendChild(b);
    }
  }

  function ensure() {
    var box = document.getElementById('jglang'), floating = false;
    if (!box) { box = document.createElement('div'); box.id = 'jglang'; floating = true; document.body.appendChild(box); }
    box.setAttribute('data-noi18n', '1');
    if (!box.querySelector('button')) buttons(box);
    var css = '#jglang{display:flex;gap:2px}' +
      '#jglang button{border:0;background:transparent;color:inherit;font:600 12px/1 system-ui,-apple-system,sans-serif;padding:5px 8px;border-radius:999px;cursor:pointer;opacity:.6}' +
      '#jglang button:hover{opacity:1}#jglang button.on{opacity:1;background:#1F3A5F;color:#fff}';
    if (floating) {
      css += '#jglang{position:fixed;top:10px;right:10px;z-index:99999;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:3px;backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.12)}' +
        '@media(max-width:600px){#jglang{top:8px;right:8px}#jglang button{padding:5px 7px}}';
    }
    var st = document.createElement('style'); st.setAttribute('data-noi18n', '1'); st.textContent = css; document.head.appendChild(st);
  }

  function boot() { ensure(); apply(detect()); }
  function start() {
    if (window.JG_DICT) return boot();
    // 사전이 아직이면 로드 대기 후 부팅 (dict 스크립트가 이 스크립트보다 늦게 와도 동작)
    var tries = 0, t = setInterval(function () { if (window.JG_DICT || ++tries > 40) { clearInterval(t); boot(); } }, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
