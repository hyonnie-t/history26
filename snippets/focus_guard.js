/* focus_guard.js — 수업 웹앱 공용: 작성 중 화면 이탈·붙여넣기 기록 (history26 v68)
 *
 * 쓰는 법 (웹앱 app.js 상단에 통째로 붙이거나 <script src>로 불러온다):
 *   FocusGuard.start({ key: CONFIG.GAME_NAME });              // 활동 화면이 열릴 때 1번
 *   ...최종 제출 body 만들 때:  Object.assign(body, FocusGuard.payload());
 *
 * payload()가 돌려주는 값 → 백엔드 기본 제출 경로가 게임활동_로그 24~26열에 저장한다:
 *   focusLeaveCount(이탈 횟수), focusLeaveSec(자리 비운 총 초), pasteChars(붙여넣기·드롭한 글자 수)
 *
 * 설계 메모
 * - 포털 → 웹앱 이동은 새 페이지 로드라 이벤트로 안 잡힌다(제외 처리 불필요). 웹앱 "안"에서 탭/앱을
 *   벗어난 경우만 센다. 1초 미만 이탈(알림창·실수)은 세지 않는다.
 * - 학생에게 숨기지 않는다: 돌아오면 배너로 알리고 기록이 교사에게 집계로 간다고 말한다.
 * - 정당한 이탈(사료 링크 열기 등)이 웹앱 안에 있으면 그 직전에 FocusGuard.exempt()를 부른다.
 * - 새로고침으로 카운터가 초기화되지 않게 sessionStorage에 key별로 이어서 저장한다(막히면 메모리만).
 * - 참고 신호일 뿐이다. 폰·다른 기기·분할 화면은 못 잡는다 — 단독 증거로 쓰지 말 것.
 * - 빌드 없는 plain JS. 함수 선언을 먼저 끝내고 start()는 호출하는 쪽이 맨 마지막에 부른다(TDZ 방지).
 */
(function () {
  var MIN_AWAY_MS = 1000;
  var state = { key: 'default', leaves: 0, sec: 0, paste: 0 };
  var awaySince = 0;      // 0이면 화면에 있는 상태
  var exemptUntil = 0;
  var started = false;
  var bannerTimer = null;

  function storeKey() { return 'focus_guard:' + state.key; }
  function load() {
    try {
      var raw = sessionStorage.getItem(storeKey());
      if (!raw) return;
      var o = JSON.parse(raw);
      state.leaves = Number(o.leaves) || 0;
      state.sec = Number(o.sec) || 0;
      state.paste = Number(o.paste) || 0;
    } catch (e) { /* 저장소 막힘 — 메모리만 */ }
  }
  function save() {
    try { sessionStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  function showBanner(n) {
    var el = document.getElementById('focusGuardBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'focusGuardBanner';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 16px;' +
        'background:#FFF9EC;color:#8A6A14;border-bottom:1px solid #EAD9A8;font-size:.95rem;' +
        'text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.12);';
      document.body.appendChild(el);
    }
    el.textContent = '학습 화면을 벗어났다가 돌아왔어요 (' + n + '회). 이탈 기록은 선생님이 볼 수 있어요.';
    el.style.display = 'block';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.style.display = 'none'; }, 8000);
  }

  function leave() {
    if (awaySince || Date.now() < exemptUntil) return;
    awaySince = Date.now();
  }
  function back() {
    if (!awaySince) return;
    var away = Date.now() - awaySince;
    awaySince = 0;
    if (away < MIN_AWAY_MS) return;
    state.leaves += 1;
    state.sec += Math.round(away / 1000);
    save();
    showBanner(state.leaves);
  }

  function onVisibility() { if (document.hidden) leave(); else back(); }
  function onPaste(ev) {
    var t = ev.clipboardData && ev.clipboardData.getData('text');
    if (t) { state.paste += t.length; save(); }
  }
  function onDrop(ev) {
    var t = ev.dataTransfer && ev.dataTransfer.getData('text');
    if (t) { state.paste += t.length; save(); }
  }

  function start(opts) {
    if (started) return;
    started = true;
    state.key = (opts && opts.key) || 'default';
    load();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('drop', onDrop, true);
  }
  function exempt(ms) { exemptUntil = Date.now() + (ms || 30000); }
  function payload() {
    // 제출 순간에 아직 자리를 비운 상태일 수는 없지만(제출 클릭=화면에 있음), 방어적으로 한 번 닫아준다.
    back();
    return { focusLeaveCount: state.leaves, focusLeaveSec: state.sec, pasteChars: state.paste };
  }

  window.FocusGuard = { start: start, payload: payload, exempt: exempt };
})();
