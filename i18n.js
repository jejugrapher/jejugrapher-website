/* JEJUGRAPHER 다국어 엔진 — KO / EN / ZH / JA
   페이지가 window.JG_I18N = {ko:{k:html}, en:{...}, zh:{...}, ja:{...}} 를 미리 넣어 두면,
   [data-i18n="k"] 요소의 innerHTML 과 [data-i18n-attr="attr:k;.."] 속성을 언어에 맞게 바꾼다.
   언어 선택은 localStorage('jg-lang') → 브라우저 언어 자동감지 → ko 순. 없는 키는 ko 로 남는다(폴백).
   스위처: 페이지에 #jglang 이 있으면 그 안에 버튼을 채우고, 없으면 우상단 플로팅으로 만든다. */
(function () {
  var LANGS = ['ko', 'en', 'zh', 'ja'];
  var SHORT = { ko: 'KO', en: 'EN', zh: '中', ja: '日' };
  var NAMES = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語' };
  var HTMLLANG = { ko: 'ko', en: 'en', zh: 'zh-CN', ja: 'ja' };

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

  function apply(lang) {
    var I = window.JG_I18N || {};
    var dict = I[lang] || {};
    var ko = I.ko || {};
    document.documentElement.setAttribute('lang', HTMLLANG[lang] || 'ko');
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n');
      var v = (dict[k] != null) ? dict[k] : ko[k];
      if (v != null) els[i].innerHTML = v;
    }
    var ae = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < ae.length; j++) {
      var pairs = ae[j].getAttribute('data-i18n-attr').split(';');
      for (var p = 0; p < pairs.length; p++) {
        var seg = pairs[p].split(':');
        if (seg.length === 2) {
          var key = seg[1].trim(), vv = (dict[key] != null) ? dict[key] : ko[key];
          if (vv != null) ae[j].setAttribute(seg[0].trim(), vv);
        }
      }
    }
    if (dict.__title != null) document.title = dict.__title;
    else if (ko.__title != null) document.title = ko.__title;
    var box = document.getElementById('jglang');
    if (box) {
      var bs = box.querySelectorAll('button');
      for (var b = 0; b < bs.length; b++) {
        var on = bs[b].getAttribute('data-l') === lang;
        bs[b].classList.toggle('on', on);
        bs[b].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    try { localStorage.setItem('jg-lang', lang); } catch (e) {}
    window.__jgLang = lang;
  }

  function buttons(box) {
    for (var i = 0; i < LANGS.length; i++) {
      var l = LANGS[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-l', l);
      btn.setAttribute('aria-label', NAMES[l]);
      btn.textContent = SHORT[l];
      btn.addEventListener('click', (function (x) { return function () { apply(x); }; })(l));
      box.appendChild(btn);
    }
  }

  function ensure() {
    var box = document.getElementById('jglang'), floating = false;
    if (!box) {
      box = document.createElement('div');
      box.id = 'jglang';
      floating = true;
      document.body.appendChild(box);
    }
    if (!box.querySelector('button')) buttons(box);
    var css = '#jglang{display:flex;gap:2px}' +
      '#jglang button{border:0;background:transparent;color:inherit;font:600 12px/1 system-ui,-apple-system,sans-serif;' +
      'padding:5px 8px;border-radius:999px;cursor:pointer;opacity:.6}' +
      '#jglang button:hover{opacity:1}' +
      '#jglang button.on{opacity:1;background:#1F3A5F;color:#fff}';
    if (floating) {
      css += '#jglang{position:fixed;top:10px;right:10px;z-index:9999;background:rgba(255,255,255,.92);' +
        'border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:3px;' +
        'backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.1)}' +
        '@media(max-width:600px){#jglang{top:8px;right:8px}#jglang button{padding:5px 7px}}';
    }
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function init() { ensure(); apply(detect()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
