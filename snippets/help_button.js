/* history26 «🙋 선생님 도와주세요» — 개별 수업 웹앱용 (v178, 2026-11-14)
 *
 * 포털의 같은 버튼(js/03-help.js, v177)을 활동 웹앱에도 띄운다. 웹앱 레포는 고치지 않는다 —
 * 모든 웹앱이 <head>에 싣는 snippets/portal_auth.js가 이 파일을 불러 준다(포털 자신·data-help="off"면 안 부름).
 * - 보이는 때: 이 기기에 로그인 세션(h26_auth)이 있고, ?preview=1이 아니고, 주소의 sid가 있으면 세션 학번과 같을 때.
 * - 백엔드는 포털과 같다(history26_backend v177): action=helpAsk·helpCancel, mode=helpMine. 세션은 portal_auth.js가 붙인다.
 * - 화면은 Shadow DOM 안에 그려 웹앱 CSS와 서로 섞이지 않는다. 오른쪽 아래에 두되, 그 자리에 웹앱의 고정 버튼 줄
 *   (position:fixed/sticky)이 있으면 그 위로 비켜 올라간다(2초마다·스크롤·크기 바뀔 때 다시 잰다).
 * - 기다리는 중 표시는 포털과 같은 localStorage 키(h26_help_wait)를 써서 포털↔웹앱을 오가도 이어진다.
 */
(function () {
  'use strict';
  if (window.__h26Help) return;
  window.__h26Help = true;
  var API = 'https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec';
  var WAIT_KEY = 'h26_help_wait', POLL_MS = 30000, BASE = 16;

  function session() { try { return window.H26Auth ? window.H26Auth.get() : null; } catch (e) { return null; } }
  function day() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); } // 포털 js/03-help.js helpDay_와 같은 꼴
  function waitGet() { try { return localStorage.getItem(WAIT_KEY) || ''; } catch (e) { return ''; } }
  function waitSet(on, sid) { try { if (on) localStorage.setItem(WAIT_KEY, sid + '|' + day()); else localStorage.removeItem(WAIT_KEY); } catch (e) { /* 무시 */ } }
  function ago(iso) { var t = Date.parse(iso || ''); if (!t) return ''; var m = Math.floor((Date.now() - t) / 60000); return m < 1 ? '방금' : m + '분 전'; }

  function start() {
    var q = new URLSearchParams(location.search);
    if (q.get('preview') === '1') return;
    if (document.getElementById('helpFab')) return; // 포털
    var a = session();
    if (!a) return;
    var urlSid = String(q.get('sid') || q.get('studentId') || '').replace(/\s+/g, '');
    if (urlSid && urlSid !== a.sid) return; // 로그인 창(portal_auth guard)이 먼저 뜬다

    var host = document.createElement('div');
    host.id = 'h26-help-host';
    host.style.cssText = 'position:fixed;right:0;bottom:0;z-index:2147483000;';
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:"Pretendard","Noto Sans KR",-apple-system,sans-serif}' +
      '.fab{position:fixed;right:16px;bottom:16px;min-height:48px;padding:0 16px;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;' +
      'background:#B03A2E;color:#fff;font-size:15px;font-weight:700;line-height:1;box-shadow:0 4px 16px rgba(35,38,44,.25);cursor:pointer;transition:transform .15s,bottom .2s}' +
      '.fab:hover{transform:translateY(-2px)}.fab:focus-visible{outline:3px solid #C9972E;outline-offset:2px}' +
      '.fab.wait{background:#2E4A7A}.fab.wait .i{display:inline-block;animation:tick 2s ease-in-out infinite}@keyframes tick{50%{transform:rotate(180deg)}}' +
      'dialog{border:0;padding:16px;background:transparent;width:min(420px,100%);max-width:100%}dialog::backdrop{background:rgba(35,38,44,.45)}' +
      '.card{background:#fff;color:#23262C;border:1px solid #D9D3C4;border-radius:14px;padding:24px;box-shadow:0 2px 10px rgba(35,38,44,.12);animation:rise .2s ease-out}' +
      '@keyframes rise{from{opacity:0;transform:translateY(8px)}}' +
      '.t{margin:0 0 8px;font-size:17px;font-weight:700}.d{margin:0 0 16px;color:#5A5F6A;font-size:14px;line-height:1.5}' +
      'label{display:block;margin:0 0 8px;font-size:14px;font-weight:600}label small{font-weight:400;color:#5A5F6A}' +
      'input{display:block;width:100%;min-height:48px;padding:8px 16px;margin:0 0 8px;font-size:16px;border:1.5px solid #D9D3C4;border-radius:10px;background:#FBFAF6;color:#23262C}' +
      'input:focus{border-color:#2E4A7A;outline:none}' +
      '.err{display:none;margin:0 0 8px;color:#B03A2E;font-size:14px}' +
      '.row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.row button{flex:1 1 auto;min-height:48px;padding:0 16px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}' +
      '.go{border:0;background:#2E4A7A;color:#fff}.ghost{border:1px solid #D9D3C4;background:#fff;color:#5A5F6A}button:disabled{opacity:.6;cursor:default}' +
      '.toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);max-width:90vw;padding:8px 16px;border-radius:999px;background:#23262C;color:#fff;font-size:14px;' +
      'text-align:center;opacity:0;pointer-events:none;transition:opacity .25s}.toast.on{opacity:1}' +
      '@media (prefers-reduced-motion:reduce){.fab,.fab.wait .i,.card{animation:none;transition:none}}' +
      '</style>' +
      '<button class="fab" type="button" aria-label="선생님 도와주세요"><span class="i" aria-hidden="true">🙋</span><span class="l">선생님 도와주세요</span></button>' +
      '<dialog aria-labelledby="h26ht"><form class="card" method="dialog">' +
      '<p class="t" id="h26ht"></p><p class="d"></p>' +
      '<label for="h26hq">어디서 막혔는지 한 줄로 적어도 돼요 <small>(안 적어도 괜찮아요)</small></label>' +
      '<input id="h26hq" type="text" maxlength="80" autocomplete="off" placeholder="예: 2번 문제에서 막혔어요">' +
      '<p class="err" role="alert"></p>' +
      '<div class="row"><button type="submit" class="go"></button><button type="button" class="ghost cancel">혼자 해결했어요</button><button type="button" class="ghost close">닫기</button></div>' +
      '</form></dialog><div class="toast" role="status"></div>';
    document.body.appendChild(host);
    /* 페이지 맨 아래 내용(제출 버튼 등)이 떠 있는 버튼에 가려지지 않게, 끝까지 내리면 버튼 높이만큼 더 내려가도록 빈 칸을 둔다. */
    var pad = document.createElement('div');
    pad.id = 'h26-help-pad'; pad.setAttribute('aria-hidden', 'true');
    pad.style.cssText = 'height:80px;pointer-events:none;';
    document.body.appendChild(pad);
    var $ = function (s) { return root.querySelector(s); };
    var fab = $('.fab'), dlg = $('dialog'), inp = $('#h26hq'), err = $('.err'), go = $('.go'), cancelBtn = $('.cancel');
    var mine = null, timer = null, busy = false, toastT = null;

    function toast(m) { var t = $('.toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600); }
    function waiting() { return !!(mine && mine.status === '대기'); }
    function render() {
      fab.classList.toggle('wait', waiting());
      $('.i').textContent = waiting() ? '⏳' : '🙋';
      $('.l').textContent = waiting() ? '선생님이 곧 와요' : '선생님 도와주세요';
      fab.setAttribute('aria-label', waiting() ? '선생님을 불렀어요. 눌러서 내 요청 보기' : '선생님 도와주세요');
    }
    function open() {
      var w = waiting();
      $('.t').textContent = w ? '⏳ 선생님을 불렀어요' : '🙋 선생님 도와주세요';
      $('.d').textContent = w ? '선생님 화면에 내 이름이 떠 있어요' + (mine.since ? ' (' + ago(mine.since) + ')' : '') + '. 조금만 기다려 줘요.'
        : '누르면 선생님 화면에 내 이름이 떠요. 선생님이 자리로 갈게요.';
      inp.value = w ? (mine.question || '') : '';
      go.textContent = w ? '질문 바꾸기' : '선생님 부르기';
      cancelBtn.style.display = w ? '' : 'none';
      err.style.display = 'none';
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
      setTimeout(function () { try { inp.focus(); } catch (e) { /* 무시 */ } }, 50);
    }
    function close() { if (dlg.close && dlg.open) dlg.close(); else dlg.removeAttribute('open'); }
    function fail(m) { err.textContent = m; err.style.display = 'block'; }
    function post(body) {
      return fetch(API, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.result !== 'success') { var e = new Error((d && d.message) || '보내지 못했어요.'); e.fromServer = true; throw e; }
        return d;
      });
    }
    function startPoll() { if (!timer) timer = setInterval(function () { if (!document.hidden) check(); }, POLL_MS); }
    function stopPoll() { if (timer) { clearInterval(timer); timer = null; } }
    function check() {
      var s = session(); if (!s) { stopPoll(); host.remove(); pad.remove(); return; }
      var was = waiting();
      fetch(API + '?mode=helpMine&studentId=' + encodeURIComponent(s.sid) + '&name=' + encodeURIComponent(s.name), { cache: 'no-store' })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (!d || d.result !== 'success') return;
          mine = d.mine && d.mine.status === '대기' ? d.mine : null;
          waitSet(!!mine, s.sid);
          if (was && !mine && d.mine && d.mine.status === '해결') toast('선생님이 도움 요청을 끝냈어요 👍');
          render(); if (mine) startPoll(); else stopPoll();
        }).catch(function () { /* 다음에 다시 */ });
    }

    fab.addEventListener('click', open);
    $('.close').addEventListener('click', close);
    $('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var s = session(); if (busy || !s) return;
      busy = true; go.disabled = true; var label = go.textContent; go.textContent = '보내는 중…';
      post({ action: 'helpAsk', studentId: s.sid, studentName: s.name, question: inp.value.trim() }).then(function (d) {
        mine = d.mine; waitSet(true, s.sid); render(); close(); startPoll();
        toast(d.already ? '질문을 바꿨어요. 선생님이 곧 와요.' : '선생님께 알렸어요! 조금만 기다려 줘요.');
      }).catch(function (e) {
        fail(e.fromServer ? e.message : '보내지 못했어요. 인터넷을 확인하고 다시 눌러 줘요. 급하면 손을 들어 줘요.');
      }).then(function () { busy = false; go.disabled = false; go.textContent = label; });
    });
    cancelBtn.addEventListener('click', function () {
      var s = session(); if (busy || !s) return;
      busy = true; cancelBtn.disabled = true;
      post({ action: 'helpCancel', studentId: s.sid, studentName: s.name }).then(function () {
        mine = null; waitSet(false); stopPoll(); render(); close();
        toast('잘했어요! 혼자 해결했다고 선생님께 알렸어요.');
      }).catch(function (e) { fail(e.fromServer ? e.message : '보내지 못했어요. 다시 눌러 줘요.'); })
        .then(function () { busy = false; cancelBtn.disabled = false; });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && timer) check(); });

    /* 웹앱의 고정 버튼 줄과 겹치면 그 위로 비킨다. 기본 자리(오른쪽 아래 16px)의 두 점 아래에 무엇이 있는지 보고,
     * 그것(또는 조상)이 fixed/sticky이면서 화면 아래쪽에 붙어 있으면 그 윗변보다 8px 위로 올린다. 화면 절반 넘게 덮는 창은 무시. */
    function place() {
      var W = window.innerWidth, H = window.innerHeight, lift = BASE;
      [[W - 32, H - BASE - 24], [W - 140, H - BASE - 24], [W - 32, H - BASE - 4]].forEach(function (p) {
        var els = document.elementsFromPoint ? document.elementsFromPoint(p[0], p[1]) : [];
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el === host || el === document.body || el === document.documentElement) continue;
          for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            var pos = getComputedStyle(n).position;
            if (pos !== 'fixed' && pos !== 'sticky') continue;
            var r = n.getBoundingClientRect();
            if (r.height > H * 0.5 || r.top < H * 0.5) break;
            lift = Math.max(lift, Math.ceil(H - r.top) + 8);
            break;
          }
          break; // 맨 위 요소 하나만 본다
        }
      });
      fab.style.bottom = lift + 'px';
      $('.toast').style.bottom = (lift + 72) + 'px';
    }
    var raf = 0;
    function placeSoon() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }
    window.addEventListener('resize', placeSoon); window.addEventListener('scroll', placeSoon, { passive: true });
    setInterval(placeSoon, 2000);
    render(); place();
    if (waitGet() === a.sid + '|' + day()) check(); // 포털이나 다른 웹앱에서 불러 둔 요청이 이어 보이게
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
