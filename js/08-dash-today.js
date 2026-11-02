/* ══ v134 — 📅 오늘 탭: 시간표 앱(timetable)의 오늘 수업·반별 진도·할 일을 교사 대시보드에서 본다 ══
 * 시간표 앱과 같은 origin(hyonnie-t.github.io)이라 그 앱의 firebase.js·engine/*.js를 그대로 import한다
 *   → Firebase 설정값을 이 공개 레포에 복사하지 않고, 시간표 앱에서 해 둔 구글 로그인도 그대로 이어진다.
 *   (localhost에서 볼 때는 GitHub Pages의 CORS 허용으로 불러오고, 로그인은 한 번 따로 한다.)
 * 읽기: users/{uid}/v2(시간표·진도·차시 주제), school/calendar(학사일정), users/{uid}/planner(할 일, 실시간).
 * 쓰기: 할 일 완료·되돌리기만 — task-engine의 patch + 시간표 앱과 같은 log 한 줄, assertPlannerPatch로 planner 밖 차단.
 * 시간표·진도 고치기와 할 일 추가·편집은 시간표 앱에서 한다(두 앱이 같은 데이터를 서로 다르게 고치지 않게).
 * 교사 대시보드 전용. 이 파일은 함수 선언뿐이고, 시간표 앱 모듈(Firebase 포함)은 탭을 처음 열 때만 불러온다
 *   (학생 화면·대시보드 진입 속도에 영향 없음). 로드 시점에 부르는 코드는 맨 아래 visibilitychange 등록 하나뿐.
 * 시간표 앱의 파일 경로·함수 이름(firebase.js·engine/progress-engine.js·engine/task-engine.js)을 바꾸면 이 탭이 깨진다. */
const TD_TT_BASE = 'https://hyonnie-t.github.io/timetable/';
const TD_DOW = ['일','월','화','수','목','금','토'];
const TD = { mods: null, loading: false, user: undefined, data: null, missing: false, ledgers: {}, planner: null, unsub: null, busy: new Set(), slotBefore: {} };

function tdPad_(n){ return String(n).padStart(2, '0'); }
function tdToday_(){ const d = new Date(); return `${d.getFullYear()}-${tdPad_(d.getMonth()+1)}-${tdPad_(d.getDate())}`; }
function tdNowStamp_(){ const d = new Date(); return `${tdToday_()} ${tdPad_(d.getHours())}:${tdPad_(d.getMinutes())}:${tdPad_(d.getSeconds())}`; }
function tdNowMin_(){ const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function tdMD_(s){ const [y, m, d] = s.split('-').map(Number); return `${m}/${d}(${TD_DOW[new Date(y, m-1, d).getDay()]})`; }
function tdStatus_(msg, isErr){
  const el = $('tdStatus'); if(!el) return;
  el.innerHTML = msg || ''; el.style.display = msg ? '' : 'none';
  el.classList.toggle('td-err', !!isErr);
}

/* 탭을 열 때마다 부른다(switchDashTab). 처음 한 번만 모듈을 불러오고, 그 뒤로는 시간표 데이터를 새로 읽는다. */
async function dashTodayOpen_(){
  $('tdDate').textContent = tdMD_(tdToday_());
  if(TD.loading) return;
  if(!TD.mods){
    TD.loading = true;
    tdStatus_('시간표 앱을 불러오는 중…');
    try{
      const [fb, PE, T] = await Promise.all(
        ['firebase.js', 'engine/progress-engine.js', 'engine/task-engine.js'].map(f => import(TD_TT_BASE + f)));
      TD.mods = { fb, PE, T };
    }catch(e){
      console.error('시간표 앱 불러오기 실패', e);
      tdStatus_('시간표 앱을 불러오지 못했어요. 인터넷 연결을 확인하고 <b>↻ 새로고침</b>을 눌러 주세요.', true);
      return;
    }finally{ TD.loading = false; }
    TD.mods.fb.onAuthStateChanged(TD.mods.fb.auth, tdOnUser_);   // 처음 한 번 바로 불린다(저장된 로그인 복원 포함)
    return;
  }
  if(TD.user) tdLoadData_(); else tdRender_();
}

function tdOnUser_(user){
  TD.user = user || null;
  if(TD.unsub){ TD.unsub(); TD.unsub = null; }
  TD.data = null; TD.planner = null; TD.missing = false; TD.ledgers = {};
  if(!user){ tdStatus_(''); tdRender_(); return; }
  const { fb } = TD.mods;
  // 할 일은 실시간 — 시간표 앱(폰·PC)에서 고친 것도 바로 보인다
  TD.unsub = fb.onValue(fb.ref(fb.db, `users/${user.uid}/planner`),
    snap => { TD.planner = snap.val() || {}; tdRenderTasks_(); },
    err => { console.error(err); $('tdTasks').innerHTML = '<p class="dash-hint">할 일을 읽지 못했어요(권한 또는 연결 문제).</p>'; });
  tdLoadData_();
}

async function tdLoadData_(){
  const { fb } = TD.mods;
  tdStatus_('시간표 불러오는 중…');
  try{
    const [v2, cal] = await Promise.all([
      fb.get(fb.ref(fb.db, `users/${TD.user.uid}/v2`)),
      fb.get(fb.ref(fb.db, 'school/calendar'))
    ]);
    TD.missing = !v2.exists();
    TD.data = TD.missing ? null : { curriculum: {}, ...v2.val(), calendar: cal.val() || {} };
    TD.ledgers = {};
    TD_LAST_DAY = tdToday_();
    tdStatus_('');
  }catch(e){
    console.error('시간표 읽기 실패', e);
    tdStatus_('시간표를 읽지 못했어요: ' + escapeHtml(e.message || e), true);
  }
  tdRender_();
}

async function tdLogin_(){
  try{ await TD.mods.fb.signInWithPopup(TD.mods.fb.auth, TD.mods.fb.googleProvider); }
  catch(e){ if(e?.code !== 'auth/popup-closed-by-user') tdStatus_('로그인하지 못했어요: ' + escapeHtml(e.message || e), true); }
}

// 반_과목별 차시 장부 — 학기 정보가 없으면 null(진도 계산 불가)
function tdLedger_(key){
  if(!(key in TD.ledgers)){
    try{ TD.ledgers[key] = TD.mods.PE.buildLedger(TD.data, key); }catch(e){ TD.ledgers[key] = null; }
  }
  return TD.ledgers[key];
}

function tdRender_(){
  const login = $('tdLogin');
  const needLogin = TD.mods && TD.user === null;
  login.style.display = needLogin ? '' : 'none';
  $('tdGrid').style.display = TD.user ? '' : 'none';
  if(!TD.user) return;
  tdRenderLessons_(); tdRenderProgress_(); tdRenderTasks_();
  tdRise_();
}

function tdTopic_(key, step){
  const t = step ? (TD.data.curriculum?.[key]?.[step] || '') : '';
  return t ? ' · ' + escapeHtml(t) : '';
}

/* ── 오늘 수업: 교시마다 반·과목 → 몇 차시·주제 (학사일정으로 빠진 칸·특별 수업도 표시) ── */
function tdRenderLessons_(){
  const el = $('tdLessons');
  if(TD.missing){ el.innerHTML = '<p class="dash-hint">시간표 앱에 아직 이번 학기 시간표가 없어요. 시간표 앱에서 먼저 만들어 주세요.</p>'; return; }
  if(!TD.data){ el.innerHTML = ''; return; }
  const { PE } = TD.mods, data = TD.data, today = tdToday_(), nowMin = tdNowMin_();
  const periods = PE.periodsOn(data, today), sched = PE.scheduleOn(data, today);
  const rows = Object.keys(sched).map(Number).sort((a, b) => a - b).map(p => {
    const cell = sched[p], key = PE.cellKey(cell);
    if(!key) return '';
    const t = periods[p] || {};
    const ev = PE.calendarEvent(data, today, p, cell.class);
    const sp = ev ? null : PE.specialAt(data, today, p, key);
    const lg = ev || sp ? null : tdLedger_(key);
    const step = lg ? PE.stepAt(data, key, today, p, lg) : null;
    const endMin = t.end ? PE.timeToMin(t.end) : null, startMin = t.start ? PE.timeToMin(t.start) : null;
    const state = endMin != null && endMin <= nowMin ? 'past' : (startMin != null && startMin <= nowMin ? 'now' : '');
    let what;
    if(ev) what = `<span class="td-muted">수업 없음 — ${escapeHtml(ev.label || '학사일정')}</span>`;
    else if(sp) what = `<span><span class="td-chip">특별</span> ${escapeHtml(sp.label || '')}</span>`;
    else if(step) what = `<span><b>${step}차시</b>${tdTopic_(key, step)}</span>`;
    else what = '<span class="td-muted">차시 계산 안 됨(시간표 앱 학기 설정 확인)</span>';
    return `<li class="td-row ${state}">
      <span class="td-when"><b>${p}교시</b><small>${t.start ? escapeHtml(t.start) + '~' + escapeHtml(t.end || '') : ''}</small></span>
      <span class="td-what"><span class="td-cls">${escapeHtml(cell.class)} ${escapeHtml(cell.subject)}</span>${what}</span>
      ${state === 'now' ? '<span class="td-chip td-now">지금</span>' : ''}
    </li>`;
  }).join('');
  el.innerHTML = rows ? `<ul class="td-list">${rows}</ul>` : '<p class="dash-hint">오늘은 수업이 없어요.</p>';
}

/* ── 반별 진도: 반_과목마다 다음 수업(오늘 진행 중 포함)과 그 차시 주제 ── */
function tdRenderProgress_(){
  const el = $('tdProgress');
  if(!TD.data){ el.innerHTML = TD.missing ? '<p class="dash-hint">시간표가 없어서 진도를 셀 수 없어요.</p>' : ''; return; }
  const { PE } = TD.mods, data = TD.data, today = tdToday_(), now = { date: today, min: tdNowMin_() };
  const rows = PE.allKeys(data).map(key => {
    const lg = tdLedger_(key); if(!lg) return null;
    const n = PE.nextLesson(data, key, now, lg);
    if(!n) return null;   // 이번 학기 남은 수업이 없는 반(옛 시간표의 반 포함)은 뺀다
    const [cls, ...sub] = key.split('_');
    const when = n.date === today ? `오늘 ${n.p}교시` : `${tdMD_(n.date)} ${n.p}교시`;
    return `<li class="td-row">
      <span class="td-cls">${escapeHtml(cls)} ${escapeHtml(sub.join('_'))}</span>
      <span class="td-what"><span><b>${n.step}차시</b>${tdTopic_(key, n.step)}</span><small class="td-muted">${when}</small></span>
    </li>`;
  }).filter(Boolean);
  el.innerHTML = rows.length ? `<ul class="td-list">${rows.join('')}</ul>` : '<p class="dash-hint">남은 수업이 있는 반이 없어요.</p>';
}

/* ── 할 일: 마감 지남·오늘·지켜볼 일 + 오늘 끝낸 일(되돌리기). 이번 주 남은 건 개수만 ── */
function tdTaskItem_(t, done){
  const today = tdToday_();
  const meta = [];
  if(t.slot?.date === today && t.slot.start) meta.push(escapeHtml(t.slot.start));
  else if(t.due && t.due !== today) meta.push(tdMD_(t.due) + ' 마감');
  if(t.daily === true) meta.push('매일');
  const busy = TD.busy.has(t.id) ? ' disabled' : '';
  const btn = done
    ? `<button type="button" class="btn btn-sm btn-ghost td-check" onclick="tdToggleTask_('${t.id}', true)" aria-label="되돌리기"${busy}>↺</button>`
    : `<button type="button" class="btn btn-sm btn-ghost td-check" onclick="tdToggleTask_('${t.id}', false)" aria-label="끝냈어요"${busy}>✓</button>`;
  return `<li class="td-row td-task${done ? ' done' : ''}">${btn}
    <span class="td-what"><span class="td-title">${escapeHtml(t.title)}</span>
    <small class="td-muted"><span class="td-chip">${escapeHtml(t.area || '기타')}</span> ${meta.join(' · ')}</small></span></li>`;
}

function tdRenderTasks_(){
  const el = $('tdTasks');
  if(!el || !TD.mods || !TD.user) return;
  if(TD.planner === null){ el.innerHTML = '<p class="dash-hint">불러오는 중…</p>'; return; }
  const { T } = TD.mods, today = tdToday_();
  const tasks = T.listTasks(TD.planner).filter(t => T.isValidId(t.id));
  const c = T.classify(tasks, today);
  const doneToday = tasks.filter(t => (t.status === 'done' && String(t.doneAt || '').startsWith(today))
    || (t.status === 'open' && t.daily === true && t.dailyDone === today));
  const group = (title, list, cls) => list.length
    ? `<h3 class="td-sub ${cls || ''}">${title} <small>${list.length}</small></h3><ul class="td-list">${list.map(t => tdTaskItem_(t, false)).join('')}</ul>` : '';
  let html = group('⏰ 마감 지남', c.overdue, 'td-late') + group('오늘', c.today) + group('👀 지켜볼 일', c.watch);
  if(!c.overdue.length && !c.today.length) html = '<p class="dash-hint">오늘 할 일이 없어요.</p>' + html;
  if(doneToday.length) html += `<h3 class="td-sub">오늘 끝낸 일 <small>${doneToday.length}</small></h3><ul class="td-list">${doneToday.map(t => tdTaskItem_(t, true)).join('')}</ul>`;
  const later = c.week.length;
  if(later) html += `<p class="dash-hint">이번 주에 ${later}개가 더 있어요 — 할 일 탭에서 보기.</p>`;
  el.innerHTML = html;
}

async function tdToggleTask_(id, undo){
  if(PREVIEW_MODE || !TD.user || TD.busy.has(id)) return;   // 절대 규칙 1 — 미리보기 중에는 쓰지 않는다
  const { T, fb } = TD.mods, today = tdToday_(), now = tdNowStamp_();
  const t = T.listTasks(TD.planner).find(x => x.id === id);
  if(!t) return;
  // 시간표 앱 planner와 같은 분기: «오늘 몫»이 남은 매일 일만 dailyDone, 나머지(마감 지난 매일 일·지켜볼 일 포함)는 완료
  let patch, action;
  try{   // 엔진이 값을 거절해도(throw) 상태 줄에 이유가 보이게 patch 만들기부터 try 안에서
    if(undo){
      if(t.status === 'done'){
        patch = T.planUndoComplete(t, { now });
        const before = TD.slotBefore[id];   // 칸이 끝나기 전에 끝내 줄어든 칸을 원래대로(시간표 앱 doneUndoOpts와 같게, 이 화면에서 누른 것만)
        if(before) patch = { ...patch, ...T.planSetSlot(t, before, { now }) };
        action = 'undo';
      }else{ patch = T.planDailyUndo(t, today, { now }); action = 'daily-undo'; }
    }else if(T.isDailyDue(t, today)){
      patch = T.planDailyDone(t, today, { now }); action = 'daily-done';
    }else{
      patch = T.planComplete(t, { now }); action = 'done';
      if(t.slot) TD.slotBefore[id] = t.slot;
    }
    if(!Object.keys(patch).length) return;
    // 시간표 앱 planner.commit()과 같은 모양의 변경 기록(설정 > 데이터 진단에서 보인다). 오래된 기록 정리는 시간표 앱이 한다.
    patch[`log/${Date.now()}_${Math.random().toString(36).slice(2, 5)}`] = { t: now, a: action };
    const abs = {};
    T.assertPlannerPatch(patch);
    for(const [k, v] of Object.entries(patch)) abs[`users/${TD.user.uid}/planner/${k}`] = v;
    TD.busy.add(id); tdRenderTasks_();
    await fb.update(fb.ref(fb.db), abs);   // onValue가 다시 그린다
  }catch(e){
    console.error(e);
    tdStatus_('저장하지 못했어요: ' + escapeHtml(e.message || e), true);
  }finally{ TD.busy.delete(id); tdRenderTasks_(); }
}

function tdOpenTimetable_(tasks){
  window.open(TD_TT_BASE + (tasks ? '?tab=tasks' : ''), 'timetableApp');
}

// 움직임: 카드가 보이는 순간 한 장씩 떠오름(Scroll-triggered). prefers-reduced-motion이면 CSS가 끈다.
function tdRise_(){
  const cards = document.querySelectorAll('#tdGrid .td-rise:not(.show)');
  if(!('IntersectionObserver' in window)){ cards.forEach(c => c.classList.add('show')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add('show'); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  cards.forEach((c, i) => { c.style.transitionDelay = (i * 0.05) + 's'; io.observe(c); });
}

// 오래 열어 둔 탭: 다시 볼 때(창 전환·화면 켜짐) 날짜·지금 교시·진도를 새로 그린다. 날이 바뀌었으면 시간표도 다시 읽는다.
let TD_LAST_DAY = '';
document.addEventListener('visibilitychange', () => {
  if(document.hidden || !TD.user || $('panelToday')?.style.display === 'none') return;
  const day = tdToday_();
  $('tdDate').textContent = tdMD_(day);
  if(TD_LAST_DAY && TD_LAST_DAY !== day) tdLoadData_(); else tdRender_();
  TD_LAST_DAY = day;
});
