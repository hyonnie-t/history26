/* history26 학생 로그인 세션 — 포털·개별 수업 웹앱 공용 (v83)
 *
 * 포털(index.html)과 개별 웹앱은 같은 출처(hyonnie-t.github.io)라 localStorage를 같이 본다.
 * 포털이 비밀번호로 로그인하면 `h26_auth`에 세션을 넣고, 이 스크립트가 Apps Script(script.google.com/macros)로
 * 가는 fetch에 세션을 자동으로 붙인다 — GET은 주소에 studentId가 있을 때 &session=, POST는 JSON 본문에 session 필드.
 * 그래서 웹앱 코드는 고칠 필요 없이 <head>에 이 한 줄만 넣는다(앱 스크립트보다 먼저):
 *   <script src="https://hyonnie-t.github.io/history26/snippets/portal_auth.js"></script>
 *
 * 웹앱 화면 가드: ?preview=1이 아니고 주소에 sid가 있는데 이 기기에 세션이 없거나 학번이 다르면
 * "포털에서 로그인해 주세요" 안내로 화면을 덮는다(친구 학번을 주소에 넣고 여는 것 방지).
 * 포털 자신은 data-guard="off"로 가드를 끈다. 실제 차단은 서버(history26_backend studentGate_)가 한다 —
 * 이 가드는 학생이 헛수고하지 않게 미리 알려 주는 용도다.
 */
(function () {
  'use strict';
  var KEY = 'h26_auth';
  var PORTAL_URL = 'https://hyonnie-t.github.io/history26/';
  var GAS_RE = /^https:\/\/script\.google(usercontent)?\.com\/macros\//;

  function read() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (a && a.token && a.sid && Number(a.exp) > Date.now()) return a;
    } catch (e) { /* 저장소 막힘·깨진 값 */ }
    return null;
  }
  function set(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ token: s.token, exp: Number(s.exp), sid: String(s.sid), name: String(s.name || '') }));
    } catch (e) { /* 저장 못 하면 이번 화면에서만 로그인 상태 */ }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
  }

  var origFetch = window.fetch;
  if (origFetch && !origFetch.__h26) {
    var patched = function (input, init) {
      try {
        var isUrl = typeof input === 'string' || (typeof URL !== 'undefined' && input instanceof URL);
        var url = isUrl ? String(input) : (input && input.url) || '';
        var a = GAS_RE.test(url) ? read() : null;
        if (a) {
          var method = String((init && init.method) || (!isUrl && input && input.method) || 'GET').toUpperCase();
          if (method === 'GET' && isUrl && /[?&]studentId=/.test(url) && !/[?&]session=/.test(url)) {
            input = url + '&session=' + encodeURIComponent(a.token);
          } else if (method === 'POST' && init && typeof init.body === 'string') {
            var b = JSON.parse(init.body);
            if (b && typeof b === 'object' && !Array.isArray(b) && !b.session) {
              b.session = a.token;
              init = Object.assign({}, init, { body: JSON.stringify(b) });
            }
          }
        }
      } catch (e) { /* 본문이 JSON이 아니면 손대지 않고 그대로 보낸다 */ }
      return origFetch.call(window, input, init);
    };
    patched.__h26 = true;
    window.fetch = patched;
  }

  window.H26Auth = { get: read, set: set, clear: clear, PORTAL_URL: PORTAL_URL };

  var me = document.currentScript;
  if (me && me.getAttribute('data-guard') === 'off') return;

  function guard() {
    var q = new URLSearchParams(location.search);
    if (q.get('preview') === '1') return;
    var sid = String(q.get('sid') || q.get('studentId') || '').replace(/\s+/g, '');
    if (!sid) return;
    var a = read();
    if (a && a.sid === sid) return;
    var msg = a
      ? '이 기기에는 다른 학생 계정으로 로그인돼 있어요. 포털에서 "책 덮기"를 누른 뒤 내 계정으로 다시 로그인하고 활동을 열어 주세요.'
      : '먼저 역사 탐구 기록 포털에서 비밀번호로 로그인한 뒤, 포털에서 이 활동을 열어 주세요.';
    var box = document.createElement('div');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;background:rgba(40,32,24,.55);font:16px/1.6 "Pretendard","Noto Sans KR",sans-serif;';
    box.innerHTML =
      '<div style="max-width:420px;width:100%;background:#fbf7ef;color:#2b241c;border:1px solid #c9b99a;border-radius:6px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);padding:24px 20px;text-align:center;">' +
      '<p style="margin:0 0 6px;font-size:1.15rem;font-weight:700;">🔒 로그인이 필요해요</p>' +
      '<p style="margin:0 0 18px;" id="h26AuthMsg"></p>' +
      '<a href="' + PORTAL_URL + '" style="display:inline-block;padding:12px 22px;min-height:44px;box-sizing:border-box;' +
      'background:#7a4b2a;color:#fff;border-radius:4px;text-decoration:none;font-weight:600;">포털로 가기</a>' +
      '<p style="margin:16px 0 0;font-size:.9rem;color:#6b5d4c;">함께 쓰는 기기라면 활동이 끝난 뒤 포털에서 꼭 "책 덮기"(로그아웃)를 눌러 주세요.</p>' +
      '</div>';
    box.querySelector('#h26AuthMsg').textContent = msg;
    document.body.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();
})();
