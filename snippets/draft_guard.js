/* draft_guard.js — 수업 웹앱 공용: 글쓰기 칸 자동 임시저장 (history26 v75)
 *
 * 쓰는 법 (웹앱 app.js 상단에 통째로 붙이거나 <script src>로 불러온다):
 *   DraftGuard.start({ key: CONFIG.GAME_NAME, sid: studentId });   // 활동 화면이 열릴 때 1번
 *   ...최종 제출이 서버에 성공한 직후:  DraftGuard.clear();
 *
 * 하는 일: 화면의 <textarea>(와 data-draft 속성을 붙인 <input>)에 학생이 쓰는 글을 태블릿 localStorage에
 *   0.4초 쉬었다 저장하고, 새로고침·실수로 닫음·배터리 꺼짐 뒤 다시 열면 같은 칸에 되돌려 넣는다.
 *   앱의 렌더링 코드를 안 고친다 — 입력 이벤트를 문서 전체에서 받고(위임), 화면이 다시 그려져 칸이 새로 생겨도
 *   MutationObserver가 그 칸을 다시 채운다.
 *
 * 옵션: DraftGuard.start({ key, sid, ttlDays: 7, restoreNote: true, selector: 'textarea, [data-draft]' })
 *   sid — 학번. 같은 태블릿을 여러 학생이 쓰므로 반드시 키에 넣는다(없으면 URL ?sid=, 그것도 없으면 'anon').
 *         학번을 화면에서 입력받는 앱은 로그인 직후 DraftGuard.setSid(학번)을 부른다.
 *   ttlDays — 이 기간이 지난 임시저장은 버린다(기본 7). restoreNote — 복원했을 때 작은 안내를 띄울지(기본 true).
 *
 * 제외: 라운드마다 값을 비우고 다시 쓰는 칸처럼 임시저장이 오히려 헷갈리는 칸엔 data-no-draft 속성을 붙인다.
 *
 * 칸 식별: id → name → data-draft(직접 이름 지정) → 문서 안 순번(textarea#N). 같은 칸이 매번 같은 이름이
 *   되도록 앱이 id/name을 주는 게 가장 안전하다. 순번 방식은 화면 구성이 바뀌면 어긋날 수 있다.
 *
 * 설계 메모
 * - ?preview=1(교사 미리보기)에선 저장도 복원도 안 한다(교사가 친 글이 학생 태블릿 것처럼 남지 않게).
 * - 같은 칸 이름은 페이지를 연 뒤 한 번만 복원한다. 앱이 값을 직접 비우고(예: 방향을 바꿔 ②를 지움) 칸을 다시 그려도
 *   옛 임시저장이 되살아나지 않게 하려는 것 — 그 뒤의 글은 앱이 자기 상태로 다시 그린다.
 * - 복원은 "그 칸이 비어 있을 때만" 한다 — 앱이 이미 채운 값(서버에서 불러온 이전 제출 등)을 덮어쓰지 않는다.
 *   복원 뒤 input 이벤트를 한 번 쏴서 앱이 자기 상태(글자 수·제출 버튼 활성화)를 갱신하게 한다.
 * - 저장소가 막히면(사생활 보호 모드 등) 조용히 건너뛴다. 글쓰기 자체는 막지 않는다.
 * - 이 파일은 기기에 글을 남긴다. 제출 성공 뒤엔 반드시 clear()로 지운다(공용 태블릿에서 다음 학생에게 안 보이게).
 * - 빌드 없는 plain JS. 함수 선언을 먼저 끝내고 start()는 호출하는 쪽이 맨 마지막에 부른다(TDZ 방지).
 */
(function () {
  var PREFIX = 'draft_guard:';
  var DELAY_MS = 400;
  var ttlMs = 7 * 24 * 3600 * 1000;
  var selector = 'textarea, [data-draft]';
  var restoreNote = true;
  var state = { key: 'default', sid: 'anon' };
  var started = false;
  var preview = false;
  var timers = new WeakMap();
  var restored = {};                  // 칸 이름별로 페이지당 한 번만 복원한다(아래 설계 메모)
  var noteTimer = 0;

  function prefix() { return PREFIX + state.key + ':' + state.sid + ':'; }

  function isField(el) {
    return !!(el && el.matches && el.matches(selector) && !el.hasAttribute('data-no-draft') &&
      (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'));
  }

  // 칸 이름 — 같은 칸은 다시 열어도 같은 이름이어야 한다.
  function fieldName(el) {
    if (el.id) return 'id:' + el.id;
    if (el.name) return 'name:' + el.name;
    var d = el.getAttribute('data-draft');
    if (d) return 'draft:' + d;
    var all = document.querySelectorAll(selector);
    for (var i = 0; i < all.length; i++) if (all[i] === el) return 'idx:' + i;
    return 'idx:0';
  }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 막힘·용량 초과 — 건너뜀 */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }

  function saveField(el) {
    if (!isField(el)) return;
    var k = prefix() + fieldName(el);
    var v = el.value;
    if (!v) { lsDel(k); return; }          // 비운 칸은 임시저장도 지운다
    lsSet(k, JSON.stringify({ v: v, t: Date.now() }));
  }

  function restoreField(el) {
    if (!isField(el)) return;
    var name = fieldName(el);
    if (restored[name]) return;
    restored[name] = true;
    if (el.value) return;                  // 앱이 이미 채웠으면 건드리지 않는다
    var raw = lsGet(prefix() + name);
    if (!raw) return;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return; }
    if (!o || typeof o.v !== 'string' || !o.v) return;
    if (Date.now() - (Number(o.t) || 0) > ttlMs) { lsDel(prefix() + name); return; }
    var max = Number(el.getAttribute('maxlength'));
    el.value = max > 0 ? o.v.slice(0, max) : o.v;
    // 앱이 input 이벤트로 글자 수·버튼 상태를 갱신하게 알린다. 이 이벤트는 우리 리스너도 받지만 같은 값이라 무해하다.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    showNote();
  }

  function restoreAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var list = scope.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) restoreField(list[i]);
    if (scope !== document && isField(scope)) restoreField(scope);
  }

  function showNote() {
    if (!restoreNote) return;
    var el = document.getElementById('draftGuardNote');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draftGuardNote';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99998;' +
        'max-width:calc(100vw - 32px);padding:12px 18px;border-radius:8px;background:#2B3A55;color:#fff;' +
        'font-size:1rem;line-height:1.5;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;' +
        'word-break:keep-all;';
      el.textContent = '쓰던 글을 다시 불러왔어요.';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  function onInput(ev) {
    var el = ev.target;
    if (!isField(el)) return;
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(function () { saveField(el); }, DELAY_MS));
  }

  // 탭을 닫거나 숨기는 순간엔 대기 중인 저장을 기다리지 않고 바로 쓴다.
  function flush() {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) {
      if (timers.has(list[i])) { clearTimeout(timers.get(list[i])); timers.delete(list[i]); saveField(list[i]); }
    }
  }
  function onHide() { if (document.hidden) flush(); }

  function purgeExpired() {
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        var o = null;
        try { o = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 깨진 값은 지운다 */ }
        if (!o || Date.now() - (Number(o.t) || 0) > ttlMs) drop.push(k);
      }
      drop.forEach(lsDel);
    } catch (e) { /* 무시 */ }
  }

  function start(opts) {
    if (started) return;
    started = true;
    opts = opts || {};
    state.key = opts.key || 'default';
    var qs = {};
    try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
    state.sid = String(opts.sid || qs.get('sid') || 'anon');
    if (Number(opts.ttlDays) > 0) ttlMs = Number(opts.ttlDays) * 24 * 3600 * 1000;
    if (opts.selector) selector = opts.selector;
    if (opts.restoreNote === false) restoreNote = false;
    preview = qs.get('preview') === '1';
    if (preview) return;                   // 미리보기: 저장·복원 모두 안 함
    purgeExpired();
    document.addEventListener('input', onInput, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) restoreAll(added[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    restoreAll(document);
  }

  // 학번을 화면에서 입력받는 앱: 로그인 직후 호출하면 그 학번 몫의 임시저장을 불러온다.
  function setSid(sid) {
    state.sid = String(sid || 'anon');
    if (!started || preview) return;
    restored = {};
    restoreAll(document);
  }

  // 최종 제출이 성공한 직후 호출 — 이 학생·이 활동의 임시저장을 전부 지운다.
  function clear() {
    var fl = document.querySelectorAll(selector);
    for (var n = 0; n < fl.length; n++) if (timers.has(fl[n])) { clearTimeout(timers.get(fl[n])); timers.delete(fl[n]); }
    try {
      var p = prefix(), drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(p) === 0) drop.push(k);
      }
      drop.forEach(lsDel);
    } catch (e) { /* 무시 */ }
  }

  window.DraftGuard = { start: start, setSid: setSid, clear: clear };
})();
