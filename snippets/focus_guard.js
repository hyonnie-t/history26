/* focus_guard.js — 수업 웹앱 공용: 작성 중 화면 이탈·붙여넣기 기록 (history26 v68)
 *
 * 쓰는 법 (웹앱 app.js 상단에 통째로 붙이거나 <script src>로 불러온다):
 *   FocusGuard.start({ key: CONFIG.GAME_NAME });              // 활동 화면이 열릴 때 1번
 *   ...최종 제출 body 만들 때:  Object.assign(body, FocusGuard.payload());
 *
 * payload()가 돌려주는 값 → 백엔드 기본 제출 경로가 게임활동_로그 24~26열에 저장한다:
 *   focusLeaveCount(이탈 횟수), focusLeaveSec(자리 비운 총 초), pasteChars(붙여넣기·드롭한 글자 수)
 *
 * 옵션: FocusGuard.start({ key, minAwaySec: 5, allowHosts: ['padlet.com'] })
 *   minAwaySec — 이 시간(초) 미만의 이탈은 세지 않는다(기본 5). allowHosts — 이 웹앱 안의 링크(<a>)가 이 도메인으로
 *   가는 클릭은 이탈로 안 센다(기본 패들렛). 링크가 아니라 버튼+window.open으로 여는 경우는 직전에 exempt()를 부른다.
 *
 * 설계 메모
 * - 포털 → 웹앱 이동은 새 페이지 로드라 이벤트로 안 잡힌다(제외 처리 불필요). 웹앱 "안"에서 탭/앱을
 *   벗어난 경우만 센다. 5초 미만 이탈(알림창·실수·잠깐 확인)은 세지 않는다.
 * - 학생에게 숨기지 않는다: 돌아오면 붉은 배너("확인"을 눌러야 닫힘)로 알리고 기록이 교사에게 집계로 간다고 말한다.
 * - 정당한 이탈(사료 링크 열기 등)이 웹앱 안에 있으면 그 직전에 FocusGuard.exempt()를 부른다.
 * - 새로고침으로 카운터가 초기화되지 않게 sessionStorage에 key별로 이어서 저장한다(막히면 메모리만).
 * - 참고 신호일 뿐이다. 폰·다른 기기·분할 화면은 못 잡는다 — 단독 증거로 쓰지 말 것.
 * - 빌드 없는 plain JS. 함수 선언을 먼저 끝내고 start()는 호출하는 쪽이 맨 마지막에 부른다(TDZ 방지).
 */
(function () {
  var minAwayMs = 5000;
  var allowHosts = ['padlet.com'];
  var state = { key: 'default', leaves: 0, sec: 0, paste: 0 };
  var awaySince = 0;      // 0이면 화면에 있는 상태
  var exemptUntil = 0;
  var started = false;

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

  // 눈에 띄게: 붉은 전폭 배너 + 큰 글씨 + 흔들림. 자동으로 사라지지 않고 학생이 "확인"을 눌러야 닫힌다.
  // 흔들림은 prefers-reduced-motion이면 끈다. 입력은 막지 않는다(글쓰기 흐름을 끊지 않으려고).
  function ensureBannerStyle() {
    if (document.getElementById('focusGuardStyle')) return;
    var st = document.createElement('style');
    st.id = 'focusGuardStyle';
    st.textContent = '@keyframes fgShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}' +
      '40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}' +
      '#focusGuardBanner.fg-shake{animation:fgShake .5s ease-in-out 2}' +
      '@media (prefers-reduced-motion:reduce){#focusGuardBanner.fg-shake{animation:none}}';
    document.head.appendChild(st);
  }

  function showBanner(n) {
    ensureBannerStyle();
    var el = document.getElementById('focusGuardBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'focusGuardBanner';
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:16px;' +
        'background:#B03A2E;color:#fff;font-size:1.15rem;font-weight:700;line-height:1.5;' +
        'text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.4);display:none;' +
        'align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 14px;';
      var msg = document.createElement('span');
      msg.id = 'focusGuardMsg';
      msg.style.wordBreak = 'keep-all';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '확인';
      btn.style.cssText = 'min-height:44px;min-width:72px;padding:0 18px;border:2px solid #fff;border-radius:6px;' +
        'background:#fff;color:#B03A2E;font-size:1rem;font-weight:700;cursor:pointer;';
      btn.addEventListener('click', function () { el.style.display = 'none'; });
      el.appendChild(msg);
      el.appendChild(btn);
      document.body.appendChild(el);
    }
    document.getElementById('focusGuardMsg').textContent =
      '⚠️ 학습 화면을 벗어났어요 (' + n + '번째). 이탈 기록은 선생님이 볼 수 있어요.';
    el.style.display = 'flex';
    el.classList.remove('fg-shake');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('fg-shake');
  }

  function leave() {
    if (awaySince || Date.now() < exemptUntil) return;
    awaySince = Date.now();
  }
  function back() {
    exemptUntil = 0; // 면제는 한 번 다녀오면 소멸 — 남아 있으면 그다음 이탈까지 가려진다
    if (!awaySince) return;
    var away = Date.now() - awaySince;
    awaySince = 0;
    if (away < minAwayMs) return;
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

  // 허용 도메인(패들렛 등)으로 가는 링크 클릭은 직후의 이탈을 면제한다. 새 탭이 열리며 blur가 바로 오므로 짧은 창이면 충분.
  function onLinkClick(ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var host = '';
    try { host = new URL(a.href, location.href).hostname.toLowerCase(); } catch (e) { return; }
    for (var i = 0; i < allowHosts.length; i++) {
      var h = allowHosts[i];
      if (host === h || host.slice(-(h.length + 1)) === '.' + h) { exempt(10000); return; }
    }
  }

  function start(opts) {
    if (started) return;
    started = true;
    state.key = (opts && opts.key) || 'default';
    if (opts && Number(opts.minAwaySec) >= 0) minAwayMs = Number(opts.minAwaySec) * 1000;
    if (opts && opts.allowHosts) allowHosts = opts.allowHosts;
    load();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', back);
    document.addEventListener('click', onLinkClick, true);
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
