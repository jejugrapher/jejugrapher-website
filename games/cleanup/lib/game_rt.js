/* 청소게임 통신 클라이언트 (화면·폰 공용)
   서버→클라: SSE(/events?role=&seat=)   클라→서버: POST(/send)
   같은 서버가 페이지를 서빙하므로 상대경로 사용. */
(function (global) {
  var listeners = [], es = null, myRole = 'phone', mySeat = '';

  function connect(role, seat, onMsg) {
    myRole = role; mySeat = seat == null ? '' : String(seat);
    if (onMsg) listeners.push(onMsg);
    open();
    return GameRT;
  }
  function open() {
    try { if (es) es.close(); } catch (e) {}
    var url = '/events?role=' + encodeURIComponent(myRole) + '&seat=' + encodeURIComponent(mySeat) + '&t=' + Date.now();
    es = new EventSource(url);
    es.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      listeners.forEach(function (fn) { try { fn(m); } catch (x) {} });
    };
    es.onerror = function () { /* EventSource 가 자동 재접속 */ };
  }
  function on(fn) { listeners.push(fn); return GameRT; }

  function send(to, msg, seat) {
    return fetch('/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: to, seat: seat, msg: msg })
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  var GameRT = {
    connect: connect, on: on, send: send,
    toScreen: function (msg) { return send('screen', msg); },
    toPhones: function (msg) { return send('phones', msg); },
    toSeat: function (seat, msg) { return send('seat', msg, seat); },
    state: function () { return fetch('/state').then(function (r) { return r.json(); }).catch(function () { return null; }); },
    role: function () { return myRole; }, seat: function () { return mySeat; }
  };
  global.GameRT = GameRT;
})(window);
