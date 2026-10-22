/* history26 학생 로그인 세션 — 포털·개별 수업 웹앱 공용 (v83)
 *
 * 포털(index.html)과 개별 웹앱은 같은 출처(hyonnie-t.github.io)라 localStorage를 같이 본다.
 * 포털이 비밀번호로 로그인하면 `h26_auth`에 세션을 넣고, 이 스크립트가 Apps Script(script.google.com/macros)로
 * 가는 fetch에 세션을 자동으로 붙인다 — GET은 주소에 studentId가 있을 때 &session=, POST는 JSON 본문에 session 필드.
 * 그래서 웹앱 코드는 고칠 필요 없이 <head>에 이 한 줄만 넣는다(앱 스크립트보다 먼저):
 *   <script src="https://hyonnie-t.github.io/history26/snippets/portal_auth.js"></script>
 *
 * 웹앱 화면 가드: ?preview=1이 아니고 주소에 sid가 있는데 이 기기에 세션이 없거나 학번이 다르면
 * 화면을 덮고 그 자리에서 로그인(학번은 sid로 고정, 이름·비밀번호 입력)하게 한다(친구 학번을 주소에 넣고 여는 것 방지).
 * 포털에서 로그인한 채로 넘어오면 세션이 있어 창이 뜨지 않고 바로 입장한다.
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

  /* v89: 세션이 없을 때 "포털로 가세요" 안내만 띄우던 걸, 그 자리에서 로그인하는 창으로 바꿨다.
   * 학번은 주소의 sid로 고정(친구 학번으로 못 들어가게), 이름·비밀번호만 받는다. 성공하면 세션을 저장하고 새로고침. */
  var LOGIN_URL = 'https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec';

  function guard() {
    var q = new URLSearchParams(location.search);
    if (q.get('preview') === '1') return;
    var sid = String(q.get('sid') || q.get('studentId') || '').replace(/\s+/g, '');
    if (!sid) return;
    var a = read();
    if (a && a.sid === sid) return;
    var other = !!a;

    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
      'padding:16px;background:rgba(40,32,24,.55);font:16px/1.6 "Pretendard","Noto Sans KR",sans-serif;overflow:auto;';
    var inp = 'display:block;width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;margin:0 0 10px;font:inherit;' +
      'border:1px solid #c9b99a;border-radius:4px;background:#fff;color:#2b241c;';
    var lab = 'display:block;margin:0 0 2px;font-size:.9rem;color:#6b5d4c;text-align:left;';
    box.innerHTML =
      '<form id="h26Form" style="max-width:380px;width:100%;background:#fbf7ef;color:#2b241c;border:1px solid #c9b99a;border-radius:6px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);padding:22px 20px;text-align:center;">' +
      '<p style="margin:0 0 4px;font-size:1.15rem;font-weight:700;">🔒 로그인이 필요해요</p>' +
      '<p id="h26AuthMsg" style="margin:0 0 14px;font-size:.95rem;"></p>' +
      '<label style="' + lab + '" for="h26Sid">학번</label>' +
      '<input id="h26Sid" readonly style="' + inp + 'background:#efe8d8;" autocomplete="username">' +
      '<label style="' + lab + '" for="h26Name">이름</label>' +
      '<input id="h26Name" style="' + inp + '" autocomplete="off">' +
      '<label style="' + lab + '" for="h26Pw">비밀번호</label>' +
      '<input id="h26Pw" type="password" style="' + inp + '" autocomplete="current-password">' +
      '<p id="h26Err" role="alert" style="display:none;margin:0 0 10px;font-size:.9rem;color:#a02a1c;"></p>' +
      '<button id="h26Go" type="submit" style="display:block;width:100%;min-height:44px;box-sizing:border-box;border:0;cursor:pointer;' +
      'background:#7a4b2a;color:#fff;border-radius:4px;font:inherit;font-weight:600;">로그인</button>' +
      '<p style="margin:14px 0 0;font-size:.85rem;color:#6b5d4c;">처음이거나 비밀번호를 바꿔야 하면 ' +
      '<a href="' + PORTAL_URL + '" style="color:#7a4b2a;">포털</a>에서 로그인해 주세요. 함께 쓰는 기기라면 끝난 뒤 포털에서 "책 덮기"를 눌러 주세요.</p>' +
      '</form>';
    box.querySelector('#h26AuthMsg').textContent = other
      ? '이 기기에는 다른 학생 계정이 로그인돼 있어요. 내 이름과 비밀번호로 다시 로그인해 주세요.'
      : '이름과 비밀번호를 입력하면 바로 시작할 수 있어요.';
    document.body.appendChild(box);

    var $ = function (id) { return box.querySelector('#' + id); };
    $('h26Sid').value = sid;
    setTimeout(function () { try { $('h26Name').focus(); } catch (e) { /* 무시 */ } }, 0);

    function fail(m) {
      var e = $('h26Err'); e.textContent = m; e.style.display = 'block';
      $('h26Go').disabled = false; $('h26Go').textContent = '로그인';
    }
    $('h26Form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = $('h26Name').value.trim(), pw = $('h26Pw').value.trim();
      if (!name) return fail('이름을 입력해 주세요.');
      if (!pw) return fail('비밀번호를 입력해 주세요.');
      $('h26Err').style.display = 'none';
      $('h26Go').disabled = true; $('h26Go').textContent = '확인하는 중…';
      // 감싼 fetch를 거치면 이전 계정 세션이 본문에 붙으므로 원래 fetch로 보낸다.
      origFetch.call(window, LOGIN_URL, { method: 'POST', body: JSON.stringify({ action: 'login', studentId: sid, name: name, password: pw }) })
        .then(function (res) { return res.json(); })
        .then(function (r) {
          if (!r || r.result !== 'success') return fail((r && r.message) || '로그인하지 못했어요.');
          if (r.mustChange) return fail('처음 로그인이라 새 비밀번호를 정해야 해요. 아래 포털에서 먼저 로그인해 주세요.');
          set(r.session);
          location.reload();
        })
        .catch(function () { fail('로그인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();
})();
