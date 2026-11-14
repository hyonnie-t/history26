/* ══════════════ 선생님 도와주세요 (v177, 2026-11-14) ══════════════
 * 학생: 포털 오른쪽 아래 «🙋 선생님 도와주세요» → 앱 안 대화상자(한 줄 질문은 선택) → 백엔드 action=helpAsk.
 *   기다리는 동안 버튼이 «⏳ 선생님이 곧 와요»로 바뀌고 30초마다 mode=helpMine으로 해결됐는지 본다(포털이 보일 때만).
 *   «혼자 해결했어요» = action=helpCancel. PREVIEW_MODE(교사 미리보기)에서는 보내지 않는다.
 * 교사: 대시보드에 들어가면 30초마다 mode=helpAdmin을 읽어 «📅 오늘» 탭 맨 위 #helpCard에 반별로 그리고,
 *   탭 이름 옆 숫자·맨 위 #helpPill(어느 탭에서나 보임)·창 제목에 대기 인원을 띄운다. «해결»/«반 모두 해결»/«되돌리기» = action=helpResolve.
 * 로드 시점 코드는 상태 객체와 visibilitychange 등록뿐이다(앞 파일의 $·SESSION·showToast·VIEW, 뒤 파일의 TOKEN·dashMyBans_는 함수 안에서만 쓴다). */
const HELP = { sid: '', mine: null, timer: null, busy: false, dash: null, dashTimer: null, dashBusy: false, seen: new Set(), loaded: false, title: '' };
const HELP_WAIT_KEY = 'h26_help_wait'; // 이 기기에서 부른 뒤 아직 안 끝난 요청이 있으면 «학번|날짜». 있을 때만 들어올 때 상태를 묻는다(수업 시작 때 한 반이 같이 들어오는 조회를 늘리지 않으려고)
const HELP_STUDENT_POLL_MS = 30000;
const HELP_DASH_POLL_MS = 30000;

function helpAgo_(iso){
  const t = Date.parse(iso || '');
  if(!t) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '방금' : m + '분 전';
}

/* ── 학생 ── */
function helpPortalInit_(){
  const fab = $('helpFab');
  if(!fab) return;
  fab.style.display = SESSION ? '' : 'none';
  const sid = SESSION ? SESSION.studentId : '';
  if(HELP.sid !== sid){ HELP.sid = sid; HELP.mine = null; helpStopPoll_(); } // 다른 학생으로 바뀌었으면 비운다
  helpRenderFab_();
  if(PREVIEW_MODE || !SESSION || HELP.mine) return;
  if(helpWaitGet_() === sid + '|' + helpDay_()) helpCheckMine_(); // 새로고침해도 기다리는 중이 이어 보이게
}
function helpDay_(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function helpWaitGet_(){ try{ return localStorage.getItem(HELP_WAIT_KEY) || ''; }catch(e){ return ''; } }
function helpWaitSet_(on){ try{ if(on && SESSION) localStorage.setItem(HELP_WAIT_KEY, SESSION.studentId + '|' + helpDay_()); else localStorage.removeItem(HELP_WAIT_KEY); }catch(e){} }
function helpRenderFab_(){
  const fab = $('helpFab');
  if(!fab) return;
  const waiting = !!(HELP.mine && HELP.mine.status === '대기');
  fab.classList.toggle('is-waiting', waiting);
  fab.innerHTML = waiting ? '<span aria-hidden="true">⏳</span> 선생님이 곧 와요' : '<span aria-hidden="true">🙋</span> 선생님 도와주세요';
  fab.setAttribute('aria-label', waiting ? '선생님을 불렀어요. 눌러서 내 요청 보기' : '선생님 도와주세요');
}
function helpOpen_(){
  const d = $('helpDialog');
  if(!d) return;
  const waiting = !!(HELP.mine && HELP.mine.status === '대기');
  $('helpDialogTitle').textContent = waiting ? '⏳ 선생님을 불렀어요' : '🙋 선생님 도와주세요';
  $('helpDialogDesc').textContent = waiting
    ? '선생님 화면에 내 이름이 떠 있어요' + (HELP.mine.since ? ' (' + helpAgo_(HELP.mine.since) + ')' : '') + '. 조금만 기다려 줘요.'
    : '누르면 선생님 화면에 내 이름이 떠요. 선생님이 자리로 갈게요.';
  $('helpInput').value = waiting ? (HELP.mine.question || '') : '';
  $('helpSend').textContent = waiting ? '질문 바꾸기' : '선생님 부르기';
  $('helpCancel').style.display = waiting ? '' : 'none';
  $('helpError').style.display = 'none';
  if(d.showModal){ if(!d.open) d.showModal(); } else d.setAttribute('open', '');
  setTimeout(() => { try{ $('helpInput').focus(); }catch(e){} }, 50);
}
function helpClose_(){
  const d = $('helpDialog');
  if(!d) return;
  if(d.close && d.open) d.close(); else d.removeAttribute('open');
}
function helpErr_(msg){ const el = $('helpError'); el.textContent = msg; el.style.display = 'block'; }

async function helpPost_(body){
  const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(body) }); // 문자열 본문 — portal_auth.js가 세션을 붙인다(AGENTS 절대 규칙 11)
  const data = await res.json();
  if(data.result !== 'success'){ const e = new Error(data.message || '보내지 못했어요.'); e.fromServer = true; throw e; }
  return data;
}
async function helpSend_(){
  if(PREVIEW_MODE){ showToast('미리보기 모드예요 — 실제로 부르지 않아요.'); helpClose_(); return; }
  if(HELP.busy || !SESSION) return;
  const btn = $('helpSend'), label = btn.textContent;
  HELP.busy = true; btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    const data = await helpPost_({ action: 'helpAsk', studentId: SESSION.studentId, studentName: SESSION.name, question: $('helpInput').value.trim() });
    HELP.mine = data.mine; helpWaitSet_(true);
    helpRenderFab_(); helpClose_(); helpStartPoll_();
    showToast(data.already ? '질문을 바꿨어요. 선생님이 곧 와요.' : '선생님께 알렸어요! 조금만 기다려 줘요.');
  }catch(e){
    helpErr_(e.fromServer ? e.message : '보내지 못했어요. 인터넷을 확인하고 다시 눌러 줘요. 급하면 손을 들어 줘요.');
  }finally{
    HELP.busy = false; btn.disabled = false; btn.textContent = label;
  }
}
async function helpCancel_(){
  if(PREVIEW_MODE || HELP.busy || !SESSION) return;
  const btn = $('helpCancel');
  HELP.busy = true; btn.disabled = true;
  try{
    await helpPost_({ action: 'helpCancel', studentId: SESSION.studentId, studentName: SESSION.name });
    HELP.mine = null; helpWaitSet_(false); helpStopPoll_(); helpRenderFab_(); helpClose_();
    showToast('잘했어요! 혼자 해결했다고 선생님께 알렸어요.');
  }catch(e){
    helpErr_(e.fromServer ? e.message : '보내지 못했어요. 다시 눌러 줘요.');
  }finally{
    HELP.busy = false; btn.disabled = false;
  }
}
async function helpCheckMine_(){
  if(PREVIEW_MODE || !SESSION || VIEW !== 'portal') return;
  const wasWaiting = !!(HELP.mine && HELP.mine.status === '대기');
  try{
    const url = CONFIG.WEBAPP_URL + '?mode=helpMine&studentId=' + encodeURIComponent(SESSION.studentId) + '&name=' + encodeURIComponent(SESSION.name);
    const data = await (await fetch(url, { cache: 'no-store' })).json();
    if(data.result !== 'success') return; // needLogin 등은 다른 화면이 안내한다 — 버튼 상태만 그대로 둔다
    HELP.mine = data.mine && data.mine.status === '대기' ? data.mine : null;
    helpWaitSet_(!!HELP.mine);
    if(wasWaiting && !HELP.mine && data.mine && data.mine.status === '해결') showToast('선생님이 도움 요청을 끝냈어요 👍');
  }catch(e){ return; }
  helpRenderFab_();
  if(HELP.mine) helpStartPoll_(); else helpStopPoll_();
}
function helpStartPoll_(){ if(!HELP.timer) HELP.timer = setInterval(() => { if(!SESSION){ helpStopPoll_(); return; } if(VIEW === 'portal' && !document.hidden) helpCheckMine_(); }, HELP_STUDENT_POLL_MS); }
function helpStopPoll_(){ if(HELP.timer){ clearInterval(HELP.timer); HELP.timer = null; } }

/* ── 교사 대시보드 ── */
function helpDashStart_(){
  helpDashLoad_();
  if(!HELP.dashTimer) HELP.dashTimer = setInterval(() => {
    if(!TOKEN){ helpDashStop_(); return; } // «나가기»(dashClearSession_)가 TOKEN을 비운다
    if(VIEW === 'dash' && !document.hidden) helpDashLoad_(); // 학생 화면 미리보기 중엔 쉬었다가 돌아오면 이어서
  }, HELP_DASH_POLL_MS);
}
function helpDashStop_(){
  if(HELP.dashTimer){ clearInterval(HELP.dashTimer); HELP.dashTimer = null; }
  HELP.dash = null; HELP.seen = new Set(); HELP.loaded = false; helpDashBadges_(0);
  helpDashRender_(); // 숨은 칸에 남은 학생 이름도 비운다(나가기 = dashClearSession_ 규칙)
}
async function helpDashLoad_(){
  if(!TOKEN || HELP.dashBusy) return;
  HELP.dashBusy = true;
  const st = $('helpStatus');
  try{
    const data = await (await fetch(CONFIG.WEBAPP_URL + '?mode=helpAdmin&token=' + encodeURIComponent(TOKEN), { cache: 'no-store' })).json();
    if(data.result !== 'success') throw new Error(data.message || '');
    HELP.dash = data;
    if(st){ st.textContent = ''; st.style.display = 'none'; }
  }catch(e){
    if(st){ st.innerHTML = '⚠ 도움 요청을 불러오지 못했어요.' + (typeof dashRetryBtn_ === 'function' ? dashRetryBtn_('helpDashLoad_()') : ''); st.style.display = 'block'; }
  }finally{
    HELP.dashBusy = false;
  }
  helpDashRender_();
}
function helpDashMine_(rows){
  // 질문함과 같은 담당 반 규칙(dashMyBans_). 트랙 설정이 없으면 다 보인다.
  return (rows || []).filter(r => {
    const mine = typeof dashMyBans_ === 'function' ? dashMyBans_(String(r.grade)) : null;
    return !mine || mine.includes(Number(r.ban));
  });
}
function helpDashBadges_(n){
  const b = $('helpTabBadge'), pill = $('helpPill');
  if(b){ b.textContent = n; b.style.display = n ? '' : 'none'; }
  if(pill){ pill.style.display = n ? '' : 'none'; $('helpPillN').textContent = n; }
  if(!HELP.title) HELP.title = document.title.replace(/^\(\d+\) /, '');
  document.title = (n ? '(' + n + ') ' : '') + HELP.title;
}
function helpDashRender_(){
  const box = $('helpList');
  if(!box) return;
  const d = HELP.dash;
  const pending = d ? helpDashMine_(d.pending) : [];
  const done = d ? helpDashMine_(d.done) : [];
  helpDashBadges_(pending.length);
  $('helpCount').textContent = d ? (pending.length ? pending.length + '명 기다려요' : '기다리는 학생 없음') : '불러오는 중…';
  if(!d){ box.innerHTML = ''; return; }
  if(!pending.length){
    box.innerHTML = '<p class="help-empty">지금 도움을 기다리는 학생이 없어요. 학생이 포털에서 «🙋 선생님 도와주세요»를 누르면 여기에 떠요.</p>';
  }else{
    const groups = {};
    pending.forEach(r => { const k = r.grade + '-' + r.ban; (groups[k] = groups[k] || []).push(r); });
    const keys = Object.keys(groups).sort((a, b) => { const [ga, ba] = a.split('-').map(Number), [gb, bb] = b.split('-').map(Number); return ga - gb || ba - bb; });
    box.innerHTML = keys.map(k => {
      const list = groups[k].sort((a, b) => String(a.since).localeCompare(String(b.since))); // 오래 기다린 학생이 위
      return '<section class="help-ban">'
        + '<div class="help-ban-head"><b>' + escapeHtml(k.replace('-', '학년 ')) + '반</b> <span class="help-n">' + list.length + '명</span>'
        + (list.length > 1 ? '<button type="button" class="btn btn-sm btn-ghost" onclick="helpResolve_(' + escapeHtml(JSON.stringify(list.map(r => r.id))) + ', false, this)">반 모두 해결</button>' : '')
        + '</div><ul class="help-rows">'
        + list.map(r => {
            const isNew = HELP.loaded && !HELP.seen.has(r.id); // 처음 그릴 땐 다 «새것»이라 깜빡이지 않는다
            return '<li class="help-row' + (isNew ? ' is-new' : '') + '">'
              + '<div class="help-who"><b>' + Number(String(r.studentId).slice(3)) + '번 ' + escapeHtml(r.studentName) + '</b> <span class="help-ago">' + helpAgo_(r.since) + '</span>'
              + (r.question ? '<p class="help-q">' + escapeHtml(r.question) + '</p>' : '') + '</div>'
              + '<button type="button" class="btn btn-sm" onclick="helpResolve_([\'' + escapeHtml(r.id) + '\'], false, this)">해결</button></li>';
          }).join('')
        + '</ul></section>';
    }).join('');
  }
  pending.forEach(r => HELP.seen.add(r.id)); HELP.loaded = true;
  const doneBox = $('helpDone');
  if(doneBox){
    doneBox.style.display = done.length ? '' : 'none';
    $('helpDoneN').textContent = d.doneCount || 0;
    $('helpDoneList').innerHTML = done.map(r => '<li class="help-row help-row-done"><div class="help-who">' + escapeHtml(r.grade + '-' + r.ban) + ' ' + Number(String(r.studentId).slice(3)) + '번 ' + escapeHtml(r.studentName)
      + ' <span class="help-ago">' + (r.status === '취소' ? '혼자 해결' : '해결') + ' · ' + helpAgo_(r.doneAt) + '</span></div>'
      + (r.status === '해결' ? '<button type="button" class="btn btn-sm btn-ghost" onclick="helpResolve_([\'' + escapeHtml(r.id) + '\'], true, this)">되돌리기</button>' : '') + '</li>').join('');
  }
}
async function helpResolve_(ids, undo, btn){
  if(PREVIEW_MODE || !TOKEN) return;
  if(btn){ btn.disabled = true; btn.textContent = '처리 중…'; }
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({ action: 'helpResolve', token: TOKEN, ids: ids, undo: !!undo }) });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '');
    if(undo && !data.changed) showToast('그 학생이 이미 다시 불러서 되돌리지 않았어요.');
    if(HELP.dash && !undo){ // 서버를 다시 읽기 전에 바로 지운다
      const now = new Date().toISOString();
      const moved = HELP.dash.pending.filter(r => ids.includes(r.id));
      HELP.dash.pending = HELP.dash.pending.filter(r => !ids.includes(r.id));
      HELP.dash.done = moved.map(r => Object.assign({}, r, { status: '해결', doneAt: now })).concat(HELP.dash.done || []);
      HELP.dash.doneCount = (HELP.dash.doneCount || 0) + moved.length;
      helpDashRender_();
    }
    helpDashLoad_();
  }catch(e){
    showToast('처리하지 못했어요. ' + (e.message || '다시 눌러 주세요.'));
    if(btn){ btn.disabled = false; btn.textContent = undo ? '되돌리기' : '해결'; }
  }
}
function helpGoCard_(){
  if(typeof switchDashTab === 'function') switchDashTab('today');
  const c = $('helpCard');
  if(c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  if(VIEW === 'dash' && HELP.dashTimer) helpDashLoad_();      // 다른 창에 있다 돌아오면 바로 새로
  if(VIEW === 'portal' && HELP.timer) helpCheckMine_();
});
