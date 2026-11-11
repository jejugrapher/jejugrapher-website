/* yt-nocaptions.js — 제주그래퍼 사이트 전역 자막(YouTube CC) 끄기
   사이트의 모든 유튜브 임베드에서 켜고 끌 수 있는 자막(CC)이 기본으로 나오지 않게 한다.
   방법: YouTube IFrame Player API 로 각 플레이어의 자막 모듈을 unload.
   - cc_load_policy=1(강제표시)이 있어도 런타임에서 꺼준다.
   - 잠금(복호화 후 삽입) 등 나중에 생기는 iframe 도 childList 관찰로 처리.
   - 보는 사람의 유튜브 계정 '항상 자막 표시' 설정과 무관하게 꺼진다.
   ※ 영상 화면에 '구워 넣은'(burned-in) 자막은 영상 픽셀의 일부라 여기서 끌 수 없다. */
(function () {
  "use strict";
  var API = "https://www.youtube.com/iframe_api";
  function isYT(s) { return /\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(s || ""); }

  function normalize(f) {
    var s = f.getAttribute("src") || "";
    if (!isYT(s)) return;
    var o = s;
    s = s.replace(/([?&])cc_load_policy=1(&|$)/, "$1cc_load_policy=0$2");
    if (!/[?&]enablejsapi=1(&|$)/.test(s)) s += (s.indexOf("?") < 0 ? "?" : "&") + "enablejsapi=1";
    if (s !== o) f.setAttribute("src", s); // 최초 1회만 바뀜(그 뒤엔 동일 → 재설정/루프 없음)
  }

  function kill(p) {
    try { p.unloadModule("captions"); } catch (e) {}
    try { p.unloadModule("cc"); } catch (e) {}
  }

  function attach(f) {
    if (!f || f.__nocap) return;
    if (!isYT(f.getAttribute("src"))) return;
    if (!window.YT || !YT.Player) return; // API 준비되면 scan 에서 다시 시도
    normalize(f);
    f.__nocap = true;
    try {
      new YT.Player(f, {
        events: {
          onReady: function (e) { kill(e.target); },
          onApiChange: function (e) { kill(e.target); }, // 자막 모듈 로드 시점 — 가장 확실한 훅
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) kill(e.target);
          }
        }
      });
    } catch (e) { f.__nocap = false; }
  }

  function scan() {
    var ifr = document.getElementsByTagName("iframe");
    for (var i = 0; i < ifr.length; i++) {
      if (isYT(ifr[i].getAttribute("src"))) attach(ifr[i]);
    }
  }

  if (!window.YT && !document.querySelector('script[src*="iframe_api"]')) {
    var t = document.createElement("script");
    t.src = API; (document.head || document.documentElement).appendChild(t);
  }
  var prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof prev === "function") { try { prev(); } catch (e) {} }
    scan();
  };

  function start() {
    scan();
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { scan(); return; }
        }
      });
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
