/* 제주그래퍼 — 포트폴리오 카드 가림막 (서버가 여닫는 공개/비공개/비밀번호)
 *
 * 쓰는 법: 카드가 가리키는 페이지 <head> 안에 두 줄.
 *   <script>window.JG_CARDLOCK={default:'public'}</script>
 *   <script src="/cardlock.js" defer></script>
 *
 * 관리자페이지에서 페이지(카드)별로 정합니다 — 재배포 없이 바로 반영:
 *   공개   : 그대로 열림
 *   비공개 : 「가리기」(mode=hide) → 이 페이지만 "준비 중"으로 덮음 (카드는 포트폴리오에 그대로 보임)
 *   비밀번호: 「비번 넣기」(pw_set) → 비밀번호를 넣어야 열림. 비번은 「비밀번호」 시트에만, 이 파일/페이지엔 안 들어감.
 *
 * 이것은 '가벼운 가림'입니다(화면만 덮음). 진짜 숨길 내용은 본문 암호화를 쓰거나 올리지 않습니다.
 * default: 'public'이면 시트에 설정이 없을 때 공개로 봅니다(포트폴리오 공개 페이지 기본값).
 */
(function () {
  var CFG = window.JG_CARDLOCK || {};
  var API = CFG.api ||
    'https://script.google.com/macros/s/AKfycbwYW8zN_7UyGnbeYpf3A5hSeSp4GVTc3N3Rj3c28WgnOiAZHVDuovvn4WvN5zHE6_WV/exec';
  var DEF = CFG.default === 'locked' ? 'locked' : 'public';
  var TITLE = CFG.title || document.title.replace(/\s*[|·].*$/, '').trim() || '비공개 페이지';

  var path = location.pathname.replace(/^\/+/, '').replace(/index\.html$/, '');
  var OKKEY = 'jg-card-ok:' + path;       // 이번 방문에서 비번 통과함
  var HINT = 'jg-card-locked:' + path;    // 지난 방문에서 잠겨 있었음(깜빡임 줄이기)

  function ok() { try { return sessionStorage.getItem(OKKEY) === '1'; } catch (e) { return false; } }
  function hint() { try { return localStorage.getItem(HINT) === '1'; } catch (e) { return false; } }
  function setHint(v) { try { v ? localStorage.setItem(HINT, '1') : localStorage.removeItem(HINT); } catch (e) {} }
  if (ok()) return;

  var ov = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build() {
    var d = document.createElement('div');
    d.id = 'jg-cardlock';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;' +
      'background:#0d1310;color:#e9eee6;padding:24px;text-align:center;' +
      'font:16px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    d.innerHTML = '<div style="max-width:430px;width:100%"><div id="jg-cl-body"><p style="color:#a9b8ac">여는 중…</p></div></div>';
    return d;
  }
  function mount() { if (!ov) { ov = build(); (document.body || document.documentElement).appendChild(ov); } }
  function body(html) { if (!ov) mount(); var b = ov.querySelector('#jg-cl-body'); if (b) b.innerHTML = html; }
  function reveal() { try { sessionStorage.setItem(OKKEY, '1'); } catch (e) {} setHint(false); if (ov && ov.parentNode) { ov.remove(); ov = null; } }
  function ask(mode, extra) {
    return fetch(API + '?mode=' + mode + '&path=' + encodeURIComponent(path) + (extra || ''), { redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  function notice() {          // 비공개(가리기)
    document.title = '준비 중';
    body('<div style="font-size:.78rem;letter-spacing:.2em;color:#8f99a0;margin-bottom:.9rem">PRIVATE</div>' +
      '<h1 style="font-size:1.5rem;margin:0 0 .6rem">잠시 내려 두었습니다</h1>' +
      '<p style="color:#a9b8ac">이 페이지는 지금 볼 수 없습니다.<br>문의는 <a href="/inquiry.html" style="color:#f0b35a">문의하기</a>로 주세요.</p>' +
      '<p style="margin-top:1rem"><a href="/" style="color:#f0b35a">제주그래퍼 첫 화면으로</a></p>');
  }

  function gate(note) {        // 비밀번호
    setHint(true);
    body('<div style="font-size:.78rem;letter-spacing:.2em;color:#8f99a0;margin-bottom:.9rem">PRIVATE</div>' +
      '<h1 style="font-size:1.5rem;line-height:1.4;margin:0 0 .8rem;font-weight:700">' + esc(TITLE) + '</h1>' +
      '<p style="color:#a9b8ac;margin:0 0 1.4rem">안내받은 비밀번호를 넣으면 열립니다.</p>' +
      '<form id="jg-cl-f" autocomplete="off" style="display:flex;gap:.5rem;justify-content:center">' +
      '<input id="jg-cl-pw" type="password" inputmode="numeric" placeholder="비밀번호" aria-label="비밀번호" required ' +
      'style="flex:1;max-width:220px;padding:.75rem .9rem;border:1px solid #2a3830;border-radius:9px;background:#141c17;color:#e9eee6;font:inherit">' +
      '<button type="submit" style="padding:.75rem 1.3rem;border:0;border-radius:9px;background:#f0b35a;color:#15110a;font:inherit;font-weight:600;cursor:pointer">열기</button></form>' +
      '<p id="jg-cl-m" role="status" style="min-height:1.5em;margin:.9rem 0 0;color:#f08a6c;font-size:.92rem">' + esc(note || '') + '</p>' +
      '<p style="margin-top:1.4rem;font-size:.9rem;color:#8f99a0">비밀번호가 필요하시면 <a href="/inquiry.html" style="color:#f0b35a">문의</a>해 주세요.</p>');
    var f = ov.querySelector('#jg-cl-f'), m = ov.querySelector('#jg-cl-m');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = ov.querySelector('#jg-cl-pw').value.trim(); if (!pw) return;
      m.style.color = '#a9b8ac'; m.textContent = '확인 중…';
      ask('unlock', '&pw=' + encodeURIComponent(pw)).then(function (d) {
        if (d && d.ok) reveal();
        else { m.style.color = '#f08a6c'; m.textContent = '비밀번호가 맞지 않습니다.'; }
      }).catch(function () { m.style.color = '#f08a6c'; m.textContent = '서버에 닿지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; });
    });
    var pwi = ov.querySelector('#jg-cl-pw'); if (pwi) pwi.focus();
    try {
      var hm = (location.hash || '').match(/[#&]pw=([^&]+)/);
      if (hm) { history.replaceState(null, '', location.pathname + location.search); ov.querySelector('#jg-cl-pw').value = decodeURIComponent(hm[1]); f.dispatchEvent(new Event('submit')); }
    } catch (e) {}
  }

  function hiddenMatch(list) {
    if (!Array.isArray(list)) return false;
    return list.some(function (p) { p = String(p).replace(/^\/+/, ''); return p && (path === p || path === p + 'index.html' || path.indexOf(p) === 0); });
  }

  // 공개 기본값이고 지난번에 잠겨 있지 않았으면, 깜빡임 없이 그대로 두고 뒤에서 확인한다.
  if (DEF === 'locked' || hint()) mount();

  Promise.all([
    ask('access').catch(function () { return null; }),
    ask('state').catch(function () { return null; })
  ]).then(function (res) {
    var a = res[0], s = res[1];
    if (s && s.ok && hiddenMatch(s.hidden)) { mount(); notice(); return; }   // 비공개
    var mode = (a && a.ok && a.mode) ? a.mode : 'unset';
    if (mode === 'unset') mode = DEF;
    if (mode === 'locked') { mount(); gate(''); }
    else reveal();   // 공개
  }).catch(function () {
    if (DEF === 'locked' || hint()) { mount(); gate('서버에 닿지 못했습니다. 비밀번호로 열어 주세요.'); }
  });
})();
