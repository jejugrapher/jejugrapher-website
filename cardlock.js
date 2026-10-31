/* 제주그래퍼 — 카드 가림막 (서버가 여닫는 비밀번호)
 *
 * 쓰는 법: 가리고 싶은 페이지 <head> 안에 두 줄만 넣습니다.
 *   <script>window.JG_CARDLOCK={default:'locked'}</script>
 *   <script src="/cardlock.js" defer></script>
 *
 * - 비밀번호·공개여부는 관리자페이지에서 정하고, 그 값은 Apps Script 시트에 있습니다.
 *   이 파일도, 페이지 소스도 비밀번호를 담지 않습니다(관리자가 바꾸면 재배포 없이 바로 반영).
 * - 이것은 '가벼운 가림'입니다. 화면을 덮을 뿐, 사진 주소나 본문은 소스에 남습니다.
 *   진짜 숨겨야 하는 내용은 본문 암호화(lock_page.py)를 쓰거나 아예 올리지 않습니다.
 *
 * default:
 *   'locked'  시트에 아무 설정이 없으면 '잠김'으로 본다(관리자가 공개로 바꾸기 전엔 가림). 권장.
 *   'public'  시트에 설정이 없으면 공개로 본다.
 */
(function () {
  var CFG = window.JG_CARDLOCK || {};
  var API = CFG.api ||
    'https://script.google.com/macros/s/AKfycbwYW8zN_7UyGnbeYpf3A5hSeSp4GVTc3N3Rj3c28WgnOiAZHVDuovvn4WvN5zHE6_WV/exec';
  var DEF = CFG.default === 'public' ? 'public' : 'locked';
  var TITLE = CFG.title || document.title.replace(/\s*\|.*$/, '').trim() || '비공개 페이지';

  var path = location.pathname.replace(/^\/+/, '').replace(/index\.html$/, '');
  var OKKEY = 'jg-card-ok:' + path;

  function unlocked() { try { return sessionStorage.getItem(OKKEY) === '1'; } catch (e) { return false; } }
  if (unlocked()) return;                      // 이번 방문에서 이미 열었음

  /* 내용 위를 즉시 덮는다 */
  var ov = document.createElement('div');
  ov.id = 'jg-cardlock';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;' +
    'background:#0d1310;color:#e9eee6;padding:24px;text-align:center;' +
    'font:16px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  ov.innerHTML =
    '<div style="max-width:430px;width:100%">' +
    '<div style="font-size:.78rem;letter-spacing:.2em;color:#8f99a0;margin-bottom:.9rem">PRIVATE</div>' +
    '<h1 style="font-size:1.5rem;line-height:1.4;margin:0 0 .8rem;font-weight:700">' + esc(TITLE) + '</h1>' +
    '<div id="jg-cl-body"><p style="color:#a9b8ac">여는 중…</p></div>' +
    '</div>';

  function mount() { (document.body || document.documentElement).appendChild(ov); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function body(html) { var b = ov.querySelector('#jg-cl-body'); if (b) b.innerHTML = html; }
  function reveal() { try { sessionStorage.setItem(OKKEY, '1'); } catch (e) {} if (ov.parentNode) ov.remove(); }
  function ask(mode, extra) {
    var u = API + '?mode=' + mode + '&path=' + encodeURIComponent(path);
    if (extra) u += extra;
    return fetch(u, { redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  function gate(note) {
    body(
      '<p style="color:#a9b8ac;margin:0 0 1.4rem">안내받은 비밀번호를 넣으면 열립니다.</p>' +
      '<form id="jg-cl-f" autocomplete="off" style="display:flex;gap:.5rem;justify-content:center">' +
      '<input id="jg-cl-pw" type="password" inputmode="numeric" placeholder="비밀번호" aria-label="비밀번호" required ' +
      'style="flex:1;max-width:220px;padding:.75rem .9rem;border:1px solid #2a3830;border-radius:9px;' +
      'background:#141c17;color:#e9eee6;font:inherit">' +
      '<button type="submit" style="padding:.75rem 1.3rem;border:0;border-radius:9px;background:#f0b35a;' +
      'color:#15110a;font:inherit;font-weight:600;cursor:pointer">열기</button></form>' +
      '<p id="jg-cl-m" role="status" style="min-height:1.5em;margin:.9rem 0 0;color:#f08a6c;font-size:.92rem">' +
      esc(note || '') + '</p>' +
      '<p style="margin-top:1.4rem;font-size:.9rem;color:#8f99a0">' +
      '비밀번호가 필요하시면 <a href="/inquiry.html" style="color:#f0b35a">문의</a>해 주세요.</p>');
    var f = ov.querySelector('#jg-cl-f'), m = ov.querySelector('#jg-cl-m');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = ov.querySelector('#jg-cl-pw').value.trim();
      if (!pw) return;
      m.style.color = '#a9b8ac'; m.textContent = '확인 중…';
      ask('unlock', '&pw=' + encodeURIComponent(pw)).then(function (d) {
        if (d && d.ok) reveal();
        else { m.style.color = '#f08a6c'; m.textContent = '비밀번호가 맞지 않습니다.'; }
      }).catch(function () { m.style.color = '#f08a6c'; m.textContent = '서버에 닿지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; });
    });
    var pwi = ov.querySelector('#jg-cl-pw'); if (pwi) pwi.focus();

    /* 관리자 「바로 열기」 — 주소 뒤 #pw=... 로 들어오면 자동으로 넣어 본다 */
    try {
      var hm = (location.hash || '').match(/[#&]pw=([^&]+)/);
      if (hm) {
        history.replaceState(null, '', location.pathname + location.search);
        ov.querySelector('#jg-cl-pw').value = decodeURIComponent(hm[1]);
        f.dispatchEvent(new Event('submit'));
      }
    } catch (e) {}
  }

  ask('access').then(function (d) {
    var mode = (d && d.ok && d.mode) ? d.mode : 'unset';
    if (mode === 'unset') mode = DEF;
    if (mode === 'public') reveal(); else gate('');
  }).catch(function () {
    /* 서버에 못 닿음: 기본이 공개면 보여 주고, 아니면 잠근 채 비번으로 열게 둔다(열리는 쪽이 아니라 막는 쪽) */
    if (DEF === 'public') reveal(); else gate('서버에 닿지 못했습니다. 비밀번호로 열어 보세요.');
  });
})();
