/* ══════════════════════════════════════════════════════
 * v142 — 대시보드 «🏺 문화사 팀» 탭 (3학년 문화사 culture-dig 3판, 2026-11-03 효니 결정)
 *  - ① 팀 뽑기: 반 번호(config.js BAN_NUMS) + 학생 «발굴단 성향 테스트» 기록(gameName 문화사_팀테스트, choicesJson.ranking)으로
 *    인원 차이 최대 1명·1지망 최다 배정 → «확정»하면 백엔드 `문화사팀` 시트에 저장(action=cultureTeamsSave, 교사 토큰).
 *  - ② 결산: 게임활동_로그(ROWS)의 발굴·방탈출 제출 점수(choicesJson.score.score)로 팀 평균(분모 = 출석자 전원, 미제출 0점)
 *    → 순위 포인트 40/30/20/10(동점 같은 포인트) + 전원 제출 +5·전원 탈출 +5. 결석 번호는 차시별로 시트에 같이 저장.
 *  - 계산 함수는 culture-dig `logic.js`(drawTeams·teamResults·parseNumbers)를 탭을 열 때 불러 쓴다(테스트가 거기 있어서 단일 출처).
 *    TEAMS·SCORING은 culture-dig data.js와 같은 값을 여기 둔다(data.js는 전역 상수가 많아 대시보드에 못 싣는다) — 한쪽을 바꾸면 둘 다.
 *  - 저장은 반 단위 통째(백엔드 v142b: 이미 저장된 반은 overwrite:true). 확정·결석 토글 직전에 시트의 최신 명단을 다시 읽어
 *    다른 PC에서 바꾼 것을 덮지 않게 하고, 저장 중에는 버튼을 잠근다(연타로 앞 클릭이 사라지지 않게).
 *  - v158 (2026-11-10 효니: «팀 순위·제출이 새로고침해도 안 바뀌고 Ctrl+Shift+R 해야 했고 그러면 다시 로그인») —
 *    원인: 대시보드 맨 위 «새로고침»(btnDashRefresh, 07-dash-admin-boot.js)은 기록을 다시 받고 «최신 기록으로 갱신했어요»를 띄우지만
 *    이 탭은 다시 그리지 않아 옛 순위가 그대로 남았다. 탭을 다시 열거나 결석을 눌러도 제출 기록은 «들어올 때» 받은 것(ROWS)을 썼다.
 *    브라우저 새로고침(Ctrl+Shift+R)은 대시보드를 닫아 토큰을 다시 넣어야 했다(그래서 «다시 로그인»).
 *    서버 응답은 no-store, 서비스워커(sw.js)는 요청을 그대로 통과 — 둘 다 실험으로 원인 아님 확인(2026-11-10).
 *    → 맨 위 «새로고침»도 이 탭을 새로 읽는다(07).
 *    → 이 탭은 문화사 3활동 기록만 따로 읽는다(ctLoadRows_, game= 필터·no-store). 탭을 열 때·«🔄 다시 읽기»·결석 표시 때 읽고,
 *    탭이 보이는 동안 30초마다 저절로 읽는다. 마지막으로 읽은 시각을 위에 보여 준다. 로그인은 그대로 유지된다.
 *  - v158 — «✋ 팀 옮기기»: 확정한 팀에서 한 명을 다른 팀으로, 또는 두 명을 맞바꾼다. 시트의 최신 명단을 다시 읽고 그 위에서 바꿔
 *    cultureTeamsSave(overwrite)로 반 통째 저장 — 결석 표시는 그대로 간다. 칠판용 표는 저장 직후 다시 그리고 옮긴 번호를 잠깐 강조한다.
 * ══════════════════════════════════════════════════════ */
const CT_LOGIC_URL = 'https://hyonnie-t.github.io/culture-dig/logic.js?v=20261103e';
const CT_GAME = { quiz: '문화사_팀테스트', dig: '문화사_유물발굴', escape: '문화사_박물관방탈출' };
const CT_TEAMS = [
  { id: '붓', emoji: '🖌️' }, { id: '곡괭이', emoji: '⛏️' }, { id: '돋보기', emoji: '🔍' }, { id: '나침반', emoji: '🧭' }
];
const CT_SCORING = { RANK_POINTS: [40, 30, 20, 10], BONUS_ALL_SUBMIT: 5, BONUS_ALL_ESCAPE: 5 };
const CT = { ban: '', saved: null, draft: null, logic: null, err: '', busy: false, nums: {}, rows: null, readAt: null, moved: null, moveNo: '', moveTo: '' };
const CT_AUTO_MS = 30000; // v158 — 탭이 보이는 동안 제출 기록을 저절로 다시 읽는 간격
const CT_MAX_NUM = 50; // 백엔드 CULTURE_TEAM_MAX_NUM과 같게

function ctEsc_(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function ctBans_(){ return Object.keys(CONFIG.BAN_NUMS || {}).filter(k => k.startsWith('3-')).map(k => k.slice(2)); }
function ctJson_(r){ try { return JSON.parse(r.choicesJson || '{}') || {}; } catch(e){ return {}; } }

/* 그 반·그 활동의 학생별 마지막 제출 → {번호: 행}. 같은 학번은 나중 시각이 이긴다(방탈출은 다시 낼 수 있음). */
function ctLatest_(game){
  const out = {};
  (CT.rows || ROWS || []).forEach(r => { // v158 — 이 탭이 따로 읽은 최신 기록(CT.rows)을 먼저 쓴다
    const sid = String(r.studentId || '');
    if(r.gameName !== game || sid.slice(0, 3) !== '3' + String(CT.ban).padStart(2, '0')) return;
    const no = Number(sid.slice(3));
    const t = new Date(r.timestamp).getTime() || 0;
    if(!out[no] || t >= out[no]._t) out[no] = Object.assign({ _t: t }, r);
  });
  return out;
}
function ctScoreRows_(kind){
  const latest = ctLatest_(CT_GAME[kind]);
  const rows = {};
  Object.keys(latest).forEach(no => {
    const r = latest[no], j = ctJson_(r);
    let score = j.score && typeof j.score === 'object' ? Number(j.score.score) : Number(j.score);
    if(!isFinite(score)){ const m = String(r.choiceSummary || '').match(/점수\s*(\d+(?:\.\d+)?)/); score = m ? Number(m[1]) : 0; }
    rows[no] = { score: score, escaped: kind === 'escape' ? !!j.escaped : false };
  });
  return rows;
}
function ctPrefs_(){
  const latest = ctLatest_(CT_GAME.quiz), prefs = {};
  Object.keys(latest).forEach(no => { const j = ctJson_(latest[no]); if(Array.isArray(j.ranking) && j.ranking.length) prefs[no] = j.ranking; });
  return prefs;
}
/* 저장된 팀(시트)을 이 반 번호 기준으로: {teams:{번호:팀}, absent:{dig:[번호], escape:[번호]}} */
function ctSavedBan_(){
  const out = { teams: {}, absent: { dig: [], escape: [] } };
  const pre = '3' + String(CT.ban).padStart(2, '0');
  Object.keys(CT.saved || {}).forEach(sid => {
    if(sid.slice(0, 3) !== pre) return;
    const no = Number(sid.slice(3)), v = CT.saved[sid];
    out.teams[no] = v.team;
    if(v.absDig) out.absent.dig.push(no);
    if(v.absEsc) out.absent.escape.push(no);
  });
  return out;
}

function ctLoadLogic_(){
  if(window.Logic && window.Logic.drawTeams) return Promise.resolve(window.Logic);
  return new Promise((res, rej) => {
    document.querySelectorAll('script[data-ct-logic]').forEach(x => x.remove()); // 실패한 옛 태그가 쌓이지 않게
    const s = document.createElement('script');
    s.dataset.ctLogic = '1';
    s.src = CT_LOGIC_URL;
    s.onload = () => (window.Logic && window.Logic.drawTeams) ? res(window.Logic) : rej(new Error('계산 파일이 이상해요'));
    s.onerror = () => rej(new Error('culture-dig 계산 파일을 못 불러왔어요(인터넷 확인)'));
    document.head.appendChild(s);
  });
}
/* v158 — 문화사 3활동 기록만 따로, 캐시 없이 읽는다(게임활동_로그 기본 조회 + game= 필터). 실패하면 이전 값을 그대로 두고 throw. */
async function ctGet_(url){
  let last;
  for(let i = 0; i < 2; i++){
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch(e){ last = e; if(i < 1) await new Promise(r => setTimeout(r, 700)); }
  }
  throw last;
}
async function ctLoadRows_(){
  const stamp = Date.now();
  const lists = await Promise.all(Object.keys(CT_GAME).map(k =>
    ctGet_(CONFIG.WEBAPP_URL + '?token=' + encodeURIComponent(TOKEN) + '&game=' + encodeURIComponent(CT_GAME[k]) + '&_=' + stamp)));
  const rows = [];
  lists.forEach(j => {
    if(j.result === 'error') throw new Error(j.message || '제출 기록을 못 불러왔어요');
    (j.rows || []).forEach(r => { if(parseStudentId(String(r.studentId))) rows.push(r); });
  });
  CT.rows = rows; CT.readAt = new Date();
}
async function ctLoadSaved_(){
  const r = await ctGet_(CONFIG.WEBAPP_URL + '?mode=cultureTeams&token=' + encodeURIComponent(TOKEN) + '&_=' + Date.now()); // v158 — 캐시 없이
  if(r.result !== 'success') throw new Error(r.message || '팀 명단을 못 불러왔어요');
  if(!r.teams || typeof r.teams !== 'object') throw new Error('백엔드에 문화사 팀 기능이 아직 없어요'); // 재배포 전 옛 백엔드는 이 mode를 모르고 기록 목록을 돌려준다
  CT.saved = r.teams;
}

/* v146 — «모둠·팀» 탭에서 문화사 발굴단을 고르면 grSetSub_(10)가 부른다 */
async function dashCultureOpen_(){
  if(!CT.ban) CT.ban = ctBans_()[0] || '5';
  ctAutoStart_();
  await ctRefresh_(); // v158 — 탭을 열 때마다 팀 명단·제출 기록을 새로 읽는다(전엔 처음 한 번만)
}
/* v158 — «🔄 다시 읽기»·자동 읽기. 대시보드 전체(dashLoadData)가 아니라 이 탭에 필요한 것만 읽어 빠르다. 로그인은 그대로. */
async function ctRefresh_(quiet){
  if(CT.busy) return;
  CT.busy = true; if(!quiet) ctRender_();
  try {
    if(!CT.logic) CT.logic = await ctLoadLogic_(); // 처음에 못 불러왔으면 다시 시도
    await Promise.all([ctLoadRows_(), ctLoadSaved_()]); CT.err = ''; DASH_LOAD.culture = 'ready';
  } catch(e){ if(!quiet || CT.saved === null){ CT.err = e.message; DASH_LOAD.culture = 'error'; } else CT.note = '자동으로 다시 읽지 못했어요(' + e.message + ') — 잠시 뒤 다시 해요.'; }
  CT.busy = false;
  if(quiet && ctTyping_()) return; // 번호 칸·선택 상자를 만지는 중이면 다시 그리지 않는다(입력이 날아가지 않게). 다음 차례에 그린다.
  ctRender_();
}
/* v167 — 반을 바꾸면 확정 안 한 팀 초안이 사라지니 먼저 묻는다(전에는 말없이 지워졌다). */
function ctPickBan_(b){
  if(String(CT.ban) === String(b)) return;
  if(CT.draft && !confirm('확정하지 않은 팀 초안이 사라져요. 다른 반으로 갈까요?')) return;
  CT.ban = b; CT.draft = null; ctRender_();
}
function ctVisible_(){ const b = $('ctBox'), p = $('panelGroups'); return !!(b && p && b.style.display !== 'none' && p.style.display === 'block' && $('dashView') && $('dashView').style.display === 'block'); }
function ctTyping_(){ const a = document.activeElement; return !!(a && $('ctBox') && $('ctBox').contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); }
let CT_TIMER = null;
function ctAutoStart_(){
  if(CT_TIMER) return;
  CT_TIMER = setInterval(() => {
    if(!ctVisible_() || document.hidden || CT.busy || !CT.logic || CT.saved === null) return;
    if(typeof PREVIEW_MODE !== 'undefined' && PREVIEW_MODE) return;
    CT.note = ''; ctRefresh_(true);
  }, CT_AUTO_MS);
}
function ctAutoStop_(){ if(CT_TIMER){ clearInterval(CT_TIMER); CT_TIMER = null; } } // v160 — 대시보드 «나가기». 탭을 다시 열면 dashCultureOpen_이 다시 켠다

async function ctSave_(teams, absent, msg, overwrite){
  if(typeof PREVIEW_MODE !== 'undefined' && PREVIEW_MODE){ showToast('미리보기라 저장하지 않았어요.'); return false; }
  CT.busy = true; ctRender_();
  try {
    await dashPost_({ action: 'cultureTeamsSave', grade: '3', ban: Number(CT.ban), teams, absent, overwrite: !!overwrite }, '저장 실패') // v165 — 공용 dashPost_(js/06)
      .catch(async e => { if(e.response && e.response.already) await ctLoadSaved_(); throw e; });
    await ctLoadSaved_();
    if(msg) showToast(msg);
    return true;
  } catch(e){ showToast('저장 못 했어요: ' + e.message); return false; }
  finally { CT.busy = false; ctRender_(); }
}

function ctDraw_(){
  if(!CT.logic) return;
  const all = CT.logic.parseNumbers($('ctNums').value);
  const nos = all.filter(n => n <= CT_MAX_NUM);
  if(nos.length < all.length) showToast(CT_MAX_NUM + '번 넘는 번호는 뺐어요.');
  if(!nos.length){ showToast('번호를 넣어 주세요(예: 1-13, 21-34).'); return; }
  CT.draft = CT.logic.drawTeams(nos, ctPrefs_(), CT_TEAMS, CT.ban + ':' + Date.now());
  CT.draft.nums = $('ctNums').value;
  ctRender_();
}
async function ctConfirm_(){
  if(!CT.draft || CT.busy) return;
  try { await ctLoadSaved_(); } catch(e){ showToast(e.message); return; } // 다른 PC에서 그새 확정했는지 다시 본다
  const had = Object.keys(ctSavedBan_().teams).length;
  if(had && !confirm('3학년 ' + CT.ban + '반은 이미 확정한 팀이 있어요. 새로 뽑은 팀으로 바꿀까요? (결석 표시는 지워져요)')) return;
  if(await ctSave_(CT.draft.assign, { dig: [], escape: [] }, CT.ban + '반 팀을 확정했어요. 칠판에 띄워 주세요.', had > 0)) CT.draft = null;
}
async function ctToggleAbsent_(kind, no){
  if(CT.busy) return;
  CT.busy = true; ctRender_();
  try { await Promise.all([ctLoadSaved_(), ctLoadRows_().catch(() => {})]); } catch(e){ CT.busy = false; ctRender_(); showToast(e.message); return; } // 다른 PC가 바꾼 결석을 덮지 않게, v158 제출도 같이 새로
  CT.busy = false;
  const cur = ctSavedBan_();
  if(!cur.teams[no]) { ctRender_(); return; }
  const list = cur.absent[kind];
  const i = list.indexOf(no);
  if(i >= 0) list.splice(i, 1); else list.push(no);
  await ctSave_(cur.teams, cur.absent, '', true);
}

/* v158 — 팀 옮기기·맞바꾸기. 저장 직전에 시트의 최신 명단을 다시 읽고 그 위에서 바꾼다(다른 PC가 바꾼 것·결석 표시 보존). */
function ctMoveOptions_(){
  const sel = $('ctMoveTo'); if(!sel) return;
  const cur = ctSavedBan_(), no = Number($('ctMoveNo') ? $('ctMoveNo').value : 0), mine = cur.teams[no];
  if(!mine){ sel.innerHTML = '<option value="">먼저 번호를 고르세요</option>'; sel.disabled = true; return; }
  sel.disabled = false;
  const others = Object.keys(cur.teams).map(Number).sort((a, b) => a - b).filter(n => cur.teams[n] !== mine);
  sel.innerHTML = '<optgroup label="이 팀으로 옮기기">' + CT_TEAMS.filter(t => t.id !== mine).map(t => `<option value="${ctEsc_(t.id)}">${t.emoji} ${ctEsc_(t.id)} 발굴단으로</option>`).join('') + '</optgroup>' +
    '<optgroup label="두 명 맞바꾸기">' + others.map(n => `<option value="swap:${n}">${n}번(${ctEsc_(cur.teams[n])})과 맞바꾸기</option>`).join('') + '</optgroup>';
  if(CT.moveTo && [...sel.options].some(o => o.value === CT.moveTo)) sel.value = CT.moveTo; // 자동 다시 읽기로 다시 그려도 고른 곳이 첫 항목으로 돌아가지 않게(검토 2026-11-10)
  else CT.moveTo = sel.value;
}
async function ctMove_(){
  if(CT.busy){ showToast('기록을 읽는 중이에요. 잠깐 뒤에 다시 눌러 주세요.'); return; }
  const no = Number($('ctMoveNo').value), to = $('ctMoveTo').value;
  if(!no || !to){ showToast('옮길 번호와 갈 곳을 골라 주세요.'); return; }
  CT.busy = true; ctRender_();
  try { await ctLoadSaved_(); } catch(e){ CT.busy = false; ctRender_(); showToast(e.message); return; }
  CT.busy = false;
  const cur = ctSavedBan_();
  if(!cur.teams[no]){ ctRender_(); showToast(no + '번이 확정 명단에 없어요(다른 PC에서 바뀌었을 수 있어요).'); return; }
  let msg, moved;
  if(to.indexOf('swap:') === 0){
    const o = Number(to.slice(5));
    if(!cur.teams[o] || cur.teams[o] === cur.teams[no]){ ctRender_(); showToast('맞바꿀 학생의 팀이 바뀌었어요. 다시 골라 주세요.'); return; }
    const t = cur.teams[no]; cur.teams[no] = cur.teams[o]; cur.teams[o] = t;
    msg = `${no}번(→${cur.teams[no]})과 ${o}번(→${cur.teams[o]})을 맞바꿨어요.`; moved = [no, o];
  } else {
    if(!CT_TEAMS.some(t => t.id === to) || cur.teams[no] === to){ ctRender_(); showToast('이미 그 팀이에요.'); return; }
    cur.teams[no] = to; msg = `${no}번을 ${to} 발굴단으로 옮겼어요.`; moved = [no];
  }
  CT.moveNo = ''; CT.moveTo = '';
  if(await ctSave_(cur.teams, cur.absent, msg + ' 칠판 표가 바뀌었어요 — 그 학생은 앱에서 팀을 다시 고르게 해 주세요.', true)){
    CT.moved = moved; ctRender_();
    setTimeout(() => { CT.moved = null; }, 4000);
  }
}
function ctBoardHtml_(assign, stats){
  const by = {}; CT_TEAMS.forEach(t => { by[t.id] = []; });
  Object.keys(assign).map(Number).sort((a, b) => a - b).forEach(no => { if(by[assign[no]]) by[assign[no]].push(no); });
  return (stats ? `<p class="dash-hint">${stats}</p>` : '') +
    '<div class="ct-board">' + CT_TEAMS.map(t => `<div class="ct-col" data-team="${ctEsc_(t.id)}"><div class="ct-head">${t.emoji} ${ctEsc_(t.id)} <small>발굴단 · ${by[t.id].length}명</small></div><div class="ct-nos">${by[t.id].map(n => `<span${CT.moved && CT.moved.includes(n) ? ' class="ct-moved"' : ''}>${n}</span>`).join('')}</div></div>`).join('') + '</div>'; // v158 — 방금 옮긴 번호 강조
}
function ctResultHtml_(kind, saved){
  const rows = ctScoreRows_(kind);
  const res = CT.logic.teamResults(saved.teams, saved.absent[kind], rows, kind, CT_TEAMS, CT_SCORING);
  const stray = Object.keys(rows).filter(no => !saved.teams[no]);
  const chips = CT_TEAMS.map(t => `<div class="ct-ab-row"><span class="ct-ab-team">${t.emoji} ${ctEsc_(t.id)}</span>` +
    Object.keys(saved.teams).map(Number).sort((a, b) => a - b).filter(no => saved.teams[no] === t.id)
      .map(no => `<button type="button" class="btn btn-sm ct-ab${saved.absent[kind].includes(no) ? ' off' : ''}${rows[no] ? '' : ' none'}"${CT.busy ? ' disabled' : ''} onclick="ctToggleAbsent_('${kind}', ${no})" title="${rows[no] ? '제출 ' + rows[no].score + '점' : '미제출'}">${no}</button>`).join('') + '</div>').join('');
  const sorted = CT_TEAMS.slice().sort((a, b) => res[a.id].rank - res[b.id].rank);
  const table = `<table class="ct-table"><thead><tr><th>순위</th><th>팀</th><th>출석</th><th>제출</th>${kind === 'escape' ? '<th>탈출</th>' : ''}<th>평균</th><th>순위 포인트</th><th>보너스</th><th>합계</th></tr></thead><tbody>` +
    sorted.map(t => { const r = res[t.id]; return `<tr><td>${r.rank}위</td><td>${t.emoji} ${ctEsc_(t.id)}</td><td>${r.present}</td><td>${r.submitted}</td>${kind === 'escape' ? `<td>${r.escaped}</td>` : ''}<td><b>${r.avg}</b></td><td>${r.points}</td><td>${r.bonus ? '+' + r.bonus : 0}</td><td><b>${r.total}</b></td></tr>`; }).join('') + '</tbody></table>';
  const n = Object.keys(rows).length;
  return { res, n, html: `<p class="dash-hint">제출 ${n}명 · 번호를 누르면 결석으로 빠져요(회색 테두리 = 아직 미제출, 미제출은 0점으로 평균에 들어가요).${stray.length ? ' 팀 명단에 없는 번호의 제출 ' + stray.join(', ') + '번은 빼고 계산했어요.' : ''}</p>${chips}${n ? table : '<p class="dash-hint">아직 제출이 없어요. 30초마다 저절로 다시 읽어요(바로 보려면 «🔄 다시 읽기»).</p>'}` };
}
/* 학생이 앱에서 고른 팀(조번호 3-반-팀)이 확정 명단과 다른 학생 — 칠판을 잘못 본 경우. 점수는 확정 명단으로 계산하므로 안내만. */
function ctMismatch_(saved){
  const out = [];
  ['dig', 'escape'].forEach(kind => {
    const latest = ctLatest_(CT_GAME[kind]);
    Object.keys(latest).forEach(no => {
      const g = String(latest[no].groupId || ''), want = saved.teams[no];
      const picked = g.split('-')[2];
      if(want && picked && picked !== want && !out.some(x => x.no === Number(no))) out.push({ no: Number(no), picked, want });
    });
  });
  return out;
}

function ctRender_(){
  const box = $('ctBox');
  if(!box) return;
  const bans = ctBans_();
  const head = `<div class="ct-top">${bans.map(b => `<button type="button" class="btn btn-sm${b === String(CT.ban) ? '' : ' btn-ghost'}" onclick="ctPickBan_('${b}')">3-${b}</button>`).join('')}` +
    `<button type="button" class="btn btn-sm btn-ghost" onclick="ctRefresh_()"${CT.busy ? ' disabled' : ''}>🔄 다시 읽기</button>` +
    (CT.busy ? ' <span class="dash-hint">불러오는 중…</span>' : (CT.readAt ? ` <span class="dash-hint ct-read">${CT.readAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}에 읽음 · 30초마다 저절로</span>` : '')) +
    (CT.note ? ` <span class="dash-hint">${ctEsc_(CT.note)}</span>` : '') + '</div>'; // v158 — 다시 읽은 시각이 보여야 «새 값인지» 안다
  if(CT.err){ box.innerHTML = head + `<p class="dash-hint" style="color:var(--seal)">${ctEsc_(CT.err)} — 백엔드 v142 «새 버전» 재배포 전이면 팀 명단을 못 불러와요.</p>`; return; }
  if(!CT.logic || CT.saved === null){ box.innerHTML = head + '<p class="dash-hint">불러오는 중…</p>'; return; }
  const saved = ctSavedBan_();
  const hasSaved = Object.keys(saved.teams).length > 0;
  const prefs = ctPrefs_();
  const numsText = CT.draft ? CT.draft.nums : (CT.nums[CT.ban] != null ? CT.nums[CT.ban] : ((CONFIG.BAN_NUMS || {})['3-' + CT.ban] || ''));
  let draw = `<section class="dash-card"><h2 class="dash-card-title">① 팀 뽑기 — 3학년 ${CT.ban}반</h2>
    <p class="dash-card-desc">성향 테스트를 낸 학생 <b>${Object.keys(prefs).length}명</b>. «뽑기»는 팀 인원 차이를 1명 이하로 맞추고 그 안에서 1지망을 가장 많이 살려요(테스트 안 낸 학생은 빈자리에 랜덤). 마음에 들면 «확정» → 칠판에 띄우면 학생이 앱에서 자기 팀을 눌러요.</p>
    <label class="dash-hint">번호 (config.js BAN_NUMS — 전출·전입이 있으면 여기서 고쳐 뽑기)<input id="ctNums" class="ct-nums" value="${ctEsc_(numsText)}" oninput="CT.nums[CT.ban]=this.value"></label>
    <div class="ct-top"><button type="button" class="btn btn-sm" onclick="ctDraw_()"${CT.busy ? ' disabled' : ''}>🎲 ${CT.draft ? '다시 뽑기' : '뽑기'}</button>${CT.draft ? `<button type="button" class="btn btn-sm" onclick="ctConfirm_()"${CT.busy ? ' disabled' : ''}>✅ 이 팀으로 확정</button><button type="button" class="btn btn-sm btn-ghost" onclick="CT.draft=null;ctRender_()">취소</button>` : ''}</div>`;
  if(CT.draft) draw += `<p class="dash-hint"><b>뽑은 결과(아직 저장 안 됨)</b></p>` + ctBoardHtml_(CT.draft.assign, CT.draft.withPref ? `테스트 낸 ${CT.draft.withPref}명 중 1지망 ${CT.draft.first}명 · 2지망 ${CT.draft.second}명` : '성향 테스트 결과 없이 랜덤');
  else if(hasSaved){
    draw += `<p class="dash-hint"><b>확정한 팀</b> (칠판용)</p>` + ctBoardHtml_(saved.teams);
    // v158 — 팀 옮기기(한 명 이동·두 명 맞바꾸기). 결석 표시는 그대로 간다.
    const nos = Object.keys(saved.teams).map(Number).sort((a, b) => a - b);
    draw += `<div class="ct-move"><b>✋ 팀 옮기기</b><label class="ct-move-l">번호<select id="ctMoveNo" onchange="CT.moveNo=this.value;CT.moveTo='';ctMoveOptions_()"${CT.busy ? ' disabled' : ''}><option value="">고르기</option>${nos.map(n => `<option value="${n}"${String(n) === String(CT.moveNo) ? ' selected' : ''}>${n}번 (${ctEsc_(saved.teams[n])})</option>`).join('')}</select></label>` +
      `<label class="ct-move-l">→<select id="ctMoveTo" onchange="CT.moveTo=this.value"></select></label><button type="button" class="btn btn-sm" onclick="ctMove_()"${CT.busy ? ' disabled' : ''}>옮기기</button></div>` +
      '<p class="dash-hint">전학·친구 사이 문제 등으로 팀을 조금만 바꿀 때 써요. 다시 뽑기와 달리 결석 표시가 그대로 남아요.</p>';
  }
  else draw += '<p class="dash-hint">아직 확정한 팀이 없어요.</p>';
  const mis = hasSaved ? ctMismatch_(saved) : [];
  if(mis.length) draw += `<p class="dash-hint">앱에서 다른 팀을 고른 학생: ${mis.map(m => `${m.no}번(${ctEsc_(m.picked)} → 명단은 ${ctEsc_(m.want)})`).join(', ')} — 점수는 명단 팀으로 계산해요.</p>`;
  draw += '</section>';
  let calc = `<section class="dash-card"><h2 class="dash-card-title">② 결산 — 팀 평균 → 순위 포인트</h2><p class="dash-card-desc">팀 평균(그날 출석한 팀원 전원으로 나눔, 미제출 0점) → 1위 40 · 2위 30 · 3위 20 · 4위 10(평균 같으면 같은 포인트) + 전원 제출 +5 · 전원 탈출 +5(방탈출).</p>`;
  if(!hasSaved) calc += '<p class="dash-hint">먼저 ①에서 팀을 확정해 주세요.</p>';
  else {
    const d = ctResultHtml_('dig', saved), e = ctResultHtml_('escape', saved);
    calc += '<h3 class="td-sub">1차시 유물 발굴</h3>' + d.html + '<h3 class="td-sub">2차시 박물관 방탈출</h3>' + e.html;
    if(d.n && e.n){
      const sorted = CT_TEAMS.slice().sort((a, b) => (e.res[b.id].total + d.res[b.id].total) - (e.res[a.id].total + d.res[a.id].total));
      calc += '<h3 class="td-sub">문화사 합계</h3><table class="ct-table"><thead><tr><th>팀</th><th>발굴</th><th>방탈출</th><th>합계</th></tr></thead><tbody>' +
        sorted.map(t => `<tr><td>${t.emoji} ${ctEsc_(t.id)}</td><td>${d.res[t.id].total}</td><td>${e.res[t.id].total}</td><td><b>${d.res[t.id].total + e.res[t.id].total}</b></td></tr>`).join('') + '</tbody></table>';
    }
  }
  calc += '</section>';
  box.innerHTML = head + draw + calc;
  ctMoveOptions_(); // v158
}
