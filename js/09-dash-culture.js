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
 * ══════════════════════════════════════════════════════ */
const CT_LOGIC_URL = 'https://hyonnie-t.github.io/culture-dig/logic.js?v=20261103e';
const CT_GAME = { quiz: '문화사_팀테스트', dig: '문화사_유물발굴', escape: '문화사_박물관방탈출' };
const CT_TEAMS = [
  { id: '붓', emoji: '🖌️' }, { id: '곡괭이', emoji: '⛏️' }, { id: '돋보기', emoji: '🔍' }, { id: '나침반', emoji: '🧭' }
];
const CT_SCORING = { RANK_POINTS: [40, 30, 20, 10], BONUS_ALL_SUBMIT: 5, BONUS_ALL_ESCAPE: 5 };
const CT = { ban: '', saved: null, draft: null, logic: null, err: '', busy: false, nums: {} };
const CT_MAX_NUM = 50; // 백엔드 CULTURE_TEAM_MAX_NUM과 같게

function ctEsc_(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function ctBans_(){ return Object.keys(CONFIG.BAN_NUMS || {}).filter(k => k.startsWith('3-')).map(k => k.slice(2)); }
function ctSid_(no){ return '3' + String(CT.ban).padStart(2, '0') + String(no).padStart(2, '0'); }
function ctJson_(r){ try { return JSON.parse(r.choicesJson || '{}') || {}; } catch(e){ return {}; } }

/* 그 반·그 활동의 학생별 마지막 제출 → {번호: 행}. 같은 학번은 나중 시각이 이긴다(방탈출은 다시 낼 수 있음). */
function ctLatest_(game){
  const out = {};
  (ROWS || []).forEach(r => {
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
async function ctLoadSaved_(){
  const r = await fetchJsonRetry_(CONFIG.WEBAPP_URL + '?mode=cultureTeams&token=' + encodeURIComponent(TOKEN));
  if(r.result !== 'success') throw new Error(r.message || '팀 명단을 못 불러왔어요');
  if(!r.teams || typeof r.teams !== 'object') throw new Error('백엔드에 문화사 팀 기능이 아직 없어요'); // 재배포 전 옛 백엔드는 이 mode를 모르고 기록 목록을 돌려준다
  CT.saved = r.teams;
}

/* switchDashTab('culture')에서 부른다 */
async function dashCultureOpen_(){
  if(!CT.ban) CT.ban = ctBans_()[0] || '5';
  ctRender_();
  try {
    if(!CT.logic) CT.logic = await ctLoadLogic_();
    if(CT.saved === null) await ctLoadSaved_();
    CT.err = '';
  } catch(e){ CT.err = e.message; }
  ctRender_();
}
async function ctRefresh_(){
  CT.busy = true; ctRender_();
  try {
    if(!CT.logic) CT.logic = await ctLoadLogic_(); // 처음에 못 불러왔으면 다시 시도
    await dashLoadData(); await ctLoadSaved_(); CT.err = '';
  } catch(e){ CT.err = e.message; }
  CT.busy = false; ctRender_();
}

async function ctSave_(teams, absent, msg, overwrite){
  if(typeof PREVIEW_MODE !== 'undefined' && PREVIEW_MODE){ showToast('미리보기라 저장하지 않았어요.'); return false; }
  CT.busy = true; ctRender_();
  try {
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({ action: 'cultureTeamsSave', token: TOKEN, grade: '3', ban: Number(CT.ban), teams, absent, overwrite: !!overwrite }) });
    const j = await res.json();
    if(j.result !== 'success'){ if(j.already) await ctLoadSaved_(); throw new Error(j.message || '저장 실패'); }
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
  try { await ctLoadSaved_(); } catch(e){ CT.busy = false; ctRender_(); showToast(e.message); return; } // 다른 PC가 바꾼 결석을 덮지 않게
  CT.busy = false;
  const cur = ctSavedBan_();
  if(!cur.teams[no]) { ctRender_(); return; }
  const list = cur.absent[kind];
  const i = list.indexOf(no);
  if(i >= 0) list.splice(i, 1); else list.push(no);
  await ctSave_(cur.teams, cur.absent, '', true);
}

function ctBoardHtml_(assign, stats){
  const by = {}; CT_TEAMS.forEach(t => { by[t.id] = []; });
  Object.keys(assign).map(Number).sort((a, b) => a - b).forEach(no => { if(by[assign[no]]) by[assign[no]].push(no); });
  return (stats ? `<p class="dash-hint">${stats}</p>` : '') +
    '<div class="ct-board">' + CT_TEAMS.map(t => `<div class="ct-col" data-team="${ctEsc_(t.id)}"><div class="ct-head">${t.emoji} ${ctEsc_(t.id)} <small>발굴단 · ${by[t.id].length}명</small></div><div class="ct-nos">${by[t.id].map(n => `<span>${n}</span>`).join('')}</div></div>`).join('') + '</div>';
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
  return { res, n, html: `<p class="dash-hint">제출 ${n}명 · 번호를 누르면 결석으로 빠져요(회색 테두리 = 아직 미제출, 미제출은 0점으로 평균에 들어가요).${stray.length ? ' 팀 명단에 없는 번호의 제출 ' + stray.join(', ') + '번은 빼고 계산했어요.' : ''}</p>${chips}${n ? table : '<p class="dash-hint">아직 제출이 없어요. 수업이 끝나면 «새로고침».</p>'}` };
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
  const head = `<div class="ct-top">${bans.map(b => `<button type="button" class="btn btn-sm${b === String(CT.ban) ? '' : ' btn-ghost'}" onclick="CT.ban='${b}';CT.draft=null;ctRender_()">3-${b}</button>`).join('')}` +
    `<button type="button" class="btn btn-sm btn-ghost" onclick="ctRefresh_()"${CT.busy ? ' disabled' : ''}>🔄 새로고침</button>${CT.busy ? ' <span class="dash-hint">불러오는 중…</span>' : ''}</div>`;
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
  else if(hasSaved) draw += `<p class="dash-hint"><b>확정한 팀</b> (칠판용)</p>` + ctBoardHtml_(saved.teams);
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
}
