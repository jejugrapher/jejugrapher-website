/* yt-nocaptions.js — 제주그래퍼 사이트 전역 자막 끄기
   사이트의 모든 유튜브 임베드에서 자막(CC)이 기본으로 나오지 않게 한다.
   방법: YouTube IFrame Player API 로 각 플레이어의 자막 모듈을 unload.
   - cc_load_policy=1(강제표시)이 있어도 런타임에서 꺼준다.
   - 잠금(복호화 후 삽입)·모달 등 나중에 생기는 iframe 도 MutationObserver 로 처리.
   - 보는 사람의 유튜브 계정 '항상 자막 표시' 설정과 무관하게 꺼진다. */
(function () {
  "use strict";
  var API = "https://www.youtube.com/iframe_api";
  function isYT(src) { return /\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(src || ""); }

  // iframe src 에 enablejsapi=1 보장 + cc_load_policy=1 → 0 (한 번만)
  function normalize(f) {
    var s = f.getAttribute("src") || "";
    if (!isYT(s)) return false;
    var orig = s;
    s = s.replace(/([?&])cc_load_policy=1(&|$)/, "$1cc_load_policy=0$2");
    if (!/[?&]enablejsapi=1(&|$)/.test(s)) s += (s.indexOf("?") < 0 ? "?" : "&") + "enablejsapi=1";
    if (s !== orig) f.setAttribute("src", s);
    return true;
  }

  function kill(p) {
    try { p.unloadModule("captions"); } catch (e) {}
    try { p.unloadModule("cc"); } catch (e) {}
  }

  function makePlayer(f) {
    try {
      new YT.Player(f, {
        events: {
          onReady: function (e) { kill(e.target); },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) kill(e.target);
          }
        }
      });
    } catch (e) {}
  }
  function attach(f) {
    if (!f || f.__nocap) return;
    var src = f.getAttribute("src");
    if (!isYT(src)) return;
    if (!window.YT || !YT.Player) return; // API 준비 후 재시도
    f.__nocap = true;
    // 핵심: iframe 이 API 리스닝 전에 이미 로드되면 handshake 가 안 돼 onReady 가 안 뜬다.
    // 그래서 src 를 다시 지정해 '다시 로드' → load 직후 YT.Player 생성(핸드셰이크 성립) → unloadModule.
    f.addEventListener("load", function onL() {
      f.removeEventListener("load", onL);
      makePlayer(f);
    });
    try { f.src = src; } catch (e) { makePlayer(f); } // 재할당이 load 를 트리거
  }

  function scan() {
    var ifr = document.getElementsByTagName("iframe");
    for (var i = 0; i < ifr.length; i++) {
      if (isYT(ifr[i].getAttribute("src"))) { normalize(ifr[i]); attach(ifr[i]); }
    }
  }

  // YouTube IFrame API 로드 (중복 로드 방지)
  if (!window.YT) {
    if (!document.querySelector('script[src*="iframe_api"]')) {
      var t = document.createElement("script");
      t.src = API; (document.head || document.documentElement).appendChild(t);
    }
  }
  var prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof prev === "function") { try { prev(); } catch (e) {} }
    scan();
  };

  // 나중에 DOM 에 추가되거나(잠금 복호화) src 가 바뀌는(모달) iframe 대응
  function observe() {
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === "attributes" && m.target && m.target.tagName === "IFRAME") {
            if (isYT(m.target.getAttribute("src"))) { m.target.__nocap = false; normalize(m.target); attach(m.target); }
          }
        }
        scan();
      });
      mo.observe(document.body || document.documentElement,
        { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    } catch (e) {}
    scan();
  }
  // 아직 로드 안 된 iframe 도 미리 normalize(재로딩 깜빡임 방지) — DOM 준비되는 대로
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observe);
  } else {
    observe();
  }
})();
