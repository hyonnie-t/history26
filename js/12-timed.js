/* ════════════════════════════════════════════════════════
 * v181 — 반별 제출 시간 (2026-11-17)
 * ════════════════════════════════════════════════════════
 * 효니 쪽지(2026-11-17): «수행평가 (2) → 수업 시작 기준 45분 안에만 수정, 그 뒤로는 제출 막기. 2-1은 포털 오류 때문에
 * 다음 시간에 시간을 더 줘야 해서, 교사가 잠깐 허용해 줄 수 있게.»
 * 백엔드 v181(history26_backend 98_timed_submit.gs)이 TIMED_SUBMIT 활동을 반마다 «그 반 학생 3명이 연 때(또는 첫 제출)부터 N분»만 받는다.
 * 여기는 «📅 오늘» 탭 #timedCard에 반별 상태를 보이고 «N분 열기»(action=timedOpen)로 그 반을 지금부터 N분 연다.
 * - 조회: mode=timedAdmin(토큰). 대시보드에 들어가면 읽고, 오늘 탭이 보이는 동안 1분마다 다시 읽는다.
 * - 반 목록: 담당 반(dashMyBans_) → 없으면 그 차시 반(clLessonBans_) → 그래도 없으면 서버에 기록이 있는 반.
 * - 쓰기는 PREVIEW_MODE에서 막는다. 학생 이름·학번은 다루지 않는다(반 단위 시각만).
 * ════════════════════════════════════════════════════════ */
const TIMED = { data: null, at: 0, busy: false, timer: null, tick: null };
const TIMED_POLL_MS = 60000;

function timedDashStart_(){
  timedDashLoad_();
  if(!TIMED.timer) TIMED.timer = setInterval(() => {
    if(!TOKEN){ timedDashStop_(); return; }
    if(VIEW === 'dash' && !document.hidden) timedDashLoad_();
  }, TIMED_POLL_MS);
  if(!TIMED.tick) TIMED.tick = setInterval(() => { if(TIMED.data && VIEW === 'dash' && !document.hidden) timedDashRender_(); }, 15000); // 남은 분만 다시 그림
}
function timedDashStop_(){
  if(TIMED.timer){ clearInterval(TIMED.timer); TIMED.timer = null; }
  if(TIMED.tick){ clearInterval(TIMED.tick); TIMED.tick = null; }
  TIMED.data = null;
  timedDashRender_();
}
async function timedDashLoad_(){
  if(!TOKEN || TIMED.busy) return;
  TIMED.busy = true;
  try{
    const d = await (await fetch(CONFIG.WEBAPP_URL + '?mode=timedAdmin&token=' + encodeURIComponent(TOKEN), { cache: 'no-store' })).json();
    if(d.result === 'success' && Array.isArray(d.activities)){ TIMED.data = d; TIMED.at = Date.now(); TIMED.skew = Date.now() - Number(d.now || Date.now()); }
    // 옛 백엔드는 이 mode를 몰라 교사 조회 응답을 준다 → 카드를 숨긴 채로 둔다
  }catch(e){ /* 다음 주기에 다시 */ }
  finally{ TIMED.busy = false; }
  timedDashRender_();
}

/* 활동 id → 커리큘럼 차시(제목·학년·반) */
function timedLessonOf_(act){
  const list = (typeof LESSONS_ADMIN !== 'undefined' && LESSONS_ADMIN) || [];
  return list.find(l => {
    if(String(l.id) === act) return true;
    try{ return (JSON.parse(l.activitiesRaw || '[]') || []).some(x => x && String(x.id) === act); }catch(e){ return false; }
  }) || null;
}
function timedBans_(lesson, act){
  const grade = lesson ? String(lesson.grade) : '';
  let bans = grade && typeof dashMyBans_ === 'function' ? dashMyBans_(grade) : null;
  if((!bans || !bans.length) && lesson && typeof clLessonBans_ === 'function') bans = clLessonBans_(lesson);
  if(!bans || !bans.length){
    bans = Object.keys(act.classes || {}).filter(k => !grade || k[0] === grade).map(k => Number(k.slice(1)));
  }
  return { grade: grade || (Object.keys(act.classes || {})[0] || '2')[0], bans: bans.slice().sort((a, b) => a - b) };
}
function timedClock_(t){
  const d = new Date(t), h = d.getHours(), m = d.getMinutes();
  return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + String(m).padStart(2, '0');
}
function timedStateText_(st){
  if(!st || !st.started) return { cls: 'idle', text: '시작 전 · 학생 3명이 열거나 첫 제출 때 시작' };
  const now = Date.now() - (TIMED.skew || 0);
  const left = st.closesAt - now;
  if(left > 0){
    const m = Math.ceil(left / 60000);
    return { cls: m <= 5 ? 'soon' : 'open', text: (st.extended ? '열어 줌 · ' : '') + m + '분 남음 (' + timedClock_(st.closesAt + (TIMED.skew || 0)) + '까지)' };
  }
  return { cls: 'closed', text: '마감 (' + timedClock_(st.closesAt + (TIMED.skew || 0)) + ')' };
}

function timedDashRender_(){
  const card = $('timedCard');
  if(!card) return;
  const d = TIMED.data;
  if(!d || !d.activities.length){ card.style.display = 'none'; return; }
  card.style.display = '';
  const min = Number(($('timedMin') || {}).value) || 20;
  $('timedList').innerHTML = d.activities.map(act => {
    const lesson = timedLessonOf_(act.id);
    const { grade, bans } = timedBans_(lesson, act);
    const title = lesson ? escapeHtml(lesson.title || act.id) : escapeHtml(act.id);
    const rows = bans.map(b => {
      const cls = grade + String(b).padStart(2, '0');
      const st = (act.classes || {})[cls];
      const s = timedStateText_(st);
      const now = Date.now() - (TIMED.skew || 0);
      const canClose = st && st.extended && st.openUntil > now;
      return `<li class="timed-row ${s.cls}"><b>${grade}-${b}반</b><span class="timed-state">${s.text}</span>`
        + `<span class="timed-btns"><button type="button" class="btn btn-sm" data-act="${escapeHtml(act.id)}" data-cls="${cls}" data-min="${min}" onclick="timedOpen_(this)">${min}분 열기</button>`
        + (canClose ? `<button type="button" class="btn btn-sm btn-ghost" data-act="${escapeHtml(act.id)}" data-cls="${cls}" data-min="0" onclick="timedOpen_(this)">열어 준 시간 끝내기</button>` : '')
        + `</span></li>`;
    }).join('');
    return `<div class="timed-act"><p class="timed-title">${title} <small class="td-muted">· 반마다 ${act.minutes}분</small></p><ul class="timed-rows">${rows}</ul></div>`;
  }).join('');
}

async function timedOpen_(btn){
  if(typeof PREVIEW_MODE !== 'undefined' && PREVIEW_MODE){ showToast('미리보기라 저장하지 않았어요.'); return; }
  const act = btn.dataset.act, cls = btn.dataset.cls, minutes = Number(btn.dataset.min);
  btn.disabled = true;
  try{
    const j = await dashPostRaw_({ action: 'timedOpen', activityId: act, cls, minutes });
    if(j.result !== 'success' || !j.state) throw new Error(/gameName/.test(j.message || '') || !j.message ? '백엔드 v181 «새 버전» 재배포 전이에요' : j.message);
    const a = TIMED.data && TIMED.data.activities.find(x => x.id === act);
    if(a){ a.classes = a.classes || {}; a.classes[cls] = j.state; }
    if(j.now) TIMED.skew = Date.now() - Number(j.now);
    timedDashRender_();
    const ban = cls[0] + '-' + Number(cls.slice(1));
    showToast(minutes ? ban + '반을 지금부터 ' + minutes + '분 열었어요. 학생 화면은 1분 안에 열려요.' : ban + '반 열어 준 시간을 끝냈어요.');
  }catch(e){
    btn.disabled = false;
    showToast('처리하지 못했어요: ' + e.message);
  }
}
