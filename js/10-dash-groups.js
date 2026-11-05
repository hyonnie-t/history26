/* ══════════════════════════════════════════════════════
 * v145 — 대시보드 «👥 모둠 배정» 탭 (2026-11-05 효니 요청, 수능 던전 기숙사 배정과 같은 흐름)
 *  - 미리보기(백엔드 groupAssign이 계산) → 평균 차이 확인 → 확정하면 시트 `모둠배정`에 번호만 저장 → 칠판에 크게 띄우기.
 *  - 성적: 시트에 그 반 점수가 있으면 학기말 합계(수행 30 + 지필 70), 없으면 붙여 넣은 표. 붙여 넣은 점수는 이 화면 메모리에만 있고
 *    미리보기·확정 요청에 실어 보낼 뿐 어디에도 저장하지 않는다. 이름은 읽지도 보내지도 않는다.
 *  - 상·중·하 띠와 모둠 평균은 접힌 칸 안에만 둔다(칠판에 띄우지 말 것). «크게 보기»에는 번호만 나온다.
 *  - 붙여 넣은 표: 머리글로 번호 칸·점수 칸을 짐작해 보여 주고, 애매하면 교사가 고른다(석차·응시자 수를 점수로 읽지 않게). 미리보기 뒤에는 접고, 확정하면 지운다.
 *  - 확정은 미리보기 때 보낸 요청(GR.draft.req)을 그대로 다시 보낸다. 계산이 결정적이라 본 판이 그대로 저장되고, 그사이 입력을 고치면 미리보기를 버린다.
 *  - 계산 함수는 백엔드 84_groups.gs 하나뿐이다. 화면은 받은 결과를 그리기만 한다.
 * ══════════════════════════════════════════════════════ */
const GR = { key: '', saved: null, draft: null, err: '', busy: false, nums: {}, paste: {}, cols: {}, fold: {}, titles: {}, title: {}, size: 4, seed: 1, full: false, rev: 0 };
const GR_MAX_NUM = 50; // 백엔드 GROUP_MAX_NUM과 같게

/* 내 반 목록(['2-1', …]). 담당 구분이 있으면 내 담당 반, 없으면 config BAN_SIZE에서 인원이 있는 반. */
function grKeys_(){
  const out = [];
  Object.keys(CONFIG.BAN_SIZE || {}).sort().forEach(g => {
    const mine = typeof dashMyBans_ === 'function' ? dashMyBans_(g) : null;
    const bans = mine || Object.keys(CONFIG.BAN_SIZE[g]).map(Number).filter(b => CONFIG.BAN_SIZE[g][b] > 0);
    bans.forEach(b => out.push(g + '-' + b));
  });
  return out;
}
function grPrefix_(key){ const [g, b] = String(key).split('-'); return g + String(b).padStart(2, '0'); }

/* '1-13, 21-27' → 번호 배열 */
function grParseNums_(text){
  const out = [];
  String(text || '').replace(/\s*[-~]\s*/g, '-').replace(/번/g, '').split(/[,\s]+/).forEach(part => {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if(!m) return;
    const x = Number(m[1]), y = m[2] ? Number(m[2]) : x, a = Math.min(x, y), b = Math.max(x, y);
    for(let i = a; i <= b && i <= GR_MAX_NUM; i++) if(i >= 1 && !out.includes(i)) out.push(i);
  });
  return out.sort((x, y) => x - y);
}

/* 붙여 넣은 표 → 줄·칸. 탭이 있으면 탭으로(엑셀·나이스 복사), 없으면 공백·쉼표로 나눈다. */
function grTable_(text){
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  const tab = lines.some(l => l.includes('\t'));
  const rows = lines.map(l => (tab ? l.split('\t') : l.trim().split(/[\s,]+/)).map(c => c.trim()));
  rows.tabbed = tab;
  return rows;
}
const GR_NUMERIC = /^\d+(\.\d+)?$/;
const GR_NOT_SCORE = /석차|순위|등수|등위|등급|응시|수강|만점|평균|표준|편차|연번|일련|순번|학년|반$|번호|학번/;
const GR_TOTAL_NAME = /^(합계|총점|총합|총계|학기말|학기말(합계|성적|점수)|최종|최종(점수|성적)|환산|환산(점수|총점))$/; // 이름이 딱 이것일 때만 전체 합계로 본다. «수행합계»는 아니다
const GR_NOT_ID = /연번|일련|순번/;
/* 칸 이름과 짐작한 칸. 첫 줄에 글자 칸이 있으면 머리글로 본다. 점수 칸은 전체 합계 이름의 칸이 딱 하나일 때나, 점수로 쓸 만한 숫자 칸이 하나뿐일 때만 짐작하고 나머지는 교사가 고른다. */
function grColumns_(rows, key){
  const prefix = grPrefix_(key);
  const hasHeader = rows.length > 1 && rows[0].some(c => c && !GR_NUMERIC.test(c)) && rows[0].some(c => /번호|학번|점수|합계|총점|성적|이름|성명/.test(c));
  const header = hasHeader ? rows[0] : [];
  const body = hasHeader ? rows.slice(1) : rows;
  const width = Math.max(0, ...rows.map(r => r.length));
  const cols = [];
  for(let i = 0; i < width; i++){
    const vals = body.map(r => r[i]).filter(v => v != null && v !== '');
    const nums = vals.filter(v => GR_NUMERIC.test(v));
    if(!vals.length || nums.length * 2 <= vals.length) continue;
    cols.push({ i, name: header[i] || (i + 1) + '번째 칸', nums, sid: nums.filter(v => /^\d{5}$/.test(v) && v.slice(0, 3) === prefix).length * 2 > nums.length, small: nums.every(v => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= GR_MAX_NUM) });
  }
  const idCol = cols.find(c => c.sid) || cols.find(c => /번호/.test(header[c.i] || '') && !GR_NOT_ID.test(header[c.i])) || (hasHeader ? null : cols.find(c => c.small));
  const others = cols.filter(c => !idCol || c.i !== idCol.i);
  const scoreable = others.filter(c => !GR_NOT_SCORE.test(header[c.i] || ''));
  const totals = scoreable.filter(c => GR_TOTAL_NAME.test((header[c.i] || '').replace(/\s/g, '')));
  const scoreCol = totals.length === 1 ? totals[0] : (scoreable.length === 1 ? scoreable[0] : null);
  return { hasHeader, body, cols, idGuess: idCol ? idCol.i : null, scoreGuess: scoreCol ? scoreCol.i : null };
}
/* 표 + 고른 칸 → {scores, cols, id, score, skipped, dup, same, ready}. 이름 칸은 읽지 않는다. */
function grParsePaste_(text, key){
  const rows = grTable_(text);
  const info = grColumns_(rows, key);
  const pick = GR.cols[key] || {};
  const id = pick.id != null ? pick.id : info.idGuess, score = pick.score != null ? pick.score : info.scoreGuess;
  const out = { scores: {}, cols: info.cols, id, score, skipped: 0, dup: [], same: false, ready: false, empty: !rows.length, uneven: 0 };
  if(id == null || score == null || id === score) return out;
  // 탭 없이 공백으로만 나뉜 표는 빈칸이 있으면 칸이 밀려 석차 같은 값을 점수로 읽는다 — 칸 수가 다른 줄이 있으면 멈춘다
  if(!rows.tabbed){
    const width = info.hasHeader ? rows[0].length : Math.max(...rows.map(r => r.length));
    out.uneven = info.body.filter(r => r.length !== width).length;
    if(out.uneven) return out;
  }
  const prefix = grPrefix_(key);
  info.body.forEach(r => {
    const a = r[id], b = r[score];
    if(a == null || b == null || !GR_NUMERIC.test(a) || !GR_NUMERIC.test(b)){ if(r.some(c => GR_NUMERIC.test(c))) out.skipped++; return; }
    let no;
    if(/^\d{5}$/.test(a)){ if(a.slice(0, 3) !== prefix){ out.skipped++; return; } no = Number(a.slice(3)); }
    else if(/^\d{1,2}$/.test(a)) no = Number(a);
    else { out.skipped++; return; }
    if(!(no >= 1 && no <= GR_MAX_NUM)){ out.skipped++; return; }
    if(no in out.scores && !out.dup.includes(no)) out.dup.push(no);
    out.scores[no] = Number(b);
  });
  const v = Object.values(out.scores);
  out.same = v.length > 1 && v.every(x => x === v[0]);
  out.ready = v.length > 0 && !out.dup.length;
  return out;
}
/* 붙여 넣은 표의 칸 고르기 + 읽은 결과 한 줄. 이름·점수 값은 보여 주지 않고 칸 이름과 범위만. */
function grPasteNoteHtml_(){
  const p = grParsePaste_(GR.paste[GR.key], GR.key);
  if(p.empty) return '';
  const sel = (which, cur) => `<select class="gr-size" onchange="grPickCol_('${which}',this.value)"><option value="">고르기</option>${p.cols.map(c => `<option value="${c.i}"${c.i === cur ? ' selected' : ''}>${ctEsc_(c.name)}</option>`).join('')}</select>`;
  const v = Object.values(p.scores);
  let msg = '';
  if(p.id == null || p.score == null) msg = '<b>번호 칸과 점수 칸을 골라 주세요.</b> 합계 칸이 없으면 엑셀에서 합계를 만든 뒤 붙여 넣어 주세요.';
  else if(p.id === p.score) msg = '<b>번호 칸과 점수 칸이 같아요.</b>';
  else if(p.uneven) msg = '<b>칸 수가 다른 줄이 ' + p.uneven + '개라 칸이 밀릴 수 있어요.</b> 엑셀에서 복사해 붙여 넣어 주세요.';
  else if(p.dup.length) msg = '<b>같은 번호가 여러 줄이에요(' + p.dup.join(', ') + '번).</b> 이 반 표만 붙여 넣어 주세요.';
  else if(!v.length) msg = '<b>읽은 점수가 없어요.</b> 번호 칸·점수 칸을 확인해 주세요.';
  else msg = `${v.length}명 읽음 · 점수 ${Math.min(...v)}~${Math.max(...v)}${p.skipped ? ' · 못 읽은 줄 ' + p.skipped + '개' : ''}${p.same ? ' · <b>점수가 전부 같아요. 점수 칸이 맞는지 확인해 주세요.</b>' : ''}`;
  return `<label class="dash-hint">번호 칸 ${sel('id', p.id)}</label> <label class="dash-hint">점수 칸 ${sel('score', p.score)}</label><p class="dash-hint">${msg}</p>`;
}
function grPickCol_(which, val){
  const c = GR.cols[GR.key] = GR.cols[GR.key] || {};
  c[which] = val === '' ? null : Number(val);
  grInputChanged_(); grPasteNote_();
}
/* 발표자 뽑기와 같은 순서: 이 기기에서 고친 번호 → config BAN_NUMS */
function grRosterText_(key){
  if(GR.nums[key] != null) return GR.nums[key];
  try { const n = JSON.parse(localStorage.getItem('h26_picker_v1') || '{}').nums; if(n && n[key]) return n[key]; } catch(e){ /* 저장소를 못 읽으면 config로 */ }
  return (CONFIG.BAN_NUMS || {})[key] || '';
}
/* 입력이 바뀌면 미리보기는 더 이상 그 입력의 결과가 아니다 — 옛 판과 확정 버튼을 치운다. 글자 칸 포커스가 날아가지 않게 그 부분만 다시 그린다. */
function grInputChanged_(){
  GR.rev++; GR.draft = null; GR.seed = 1;
  const a = $('grActions'); if(a) a.innerHTML = grActionsHtml_();
}

async function grLoadSaved_(){
  const r = await fetchJsonRetry_(CONFIG.WEBAPP_URL + '?mode=groups&token=' + encodeURIComponent(TOKEN));
  if(r.result !== 'success') throw new Error(r.message || '모둠을 못 불러왔어요');
  if(!r.groups || typeof r.groups !== 'object') throw new Error('백엔드에 모둠 배정이 아직 없어요'); // 재배포 전 옛 백엔드는 이 mode를 모르고 기록 목록을 돌려준다
  GR.saved = r.groups;
}
/* 저장된 모둠을 이 반 기준으로: [{no, nums}] */
function grSavedBan_(){
  const pre = grPrefix_(GR.key), by = {};
  Object.keys(GR.saved || {}).forEach(sid => {
    if(sid.slice(0, 3) !== pre) return;
    (by[GR.saved[sid]] = by[GR.saved[sid]] || []).push(Number(sid.slice(3)));
  });
  return Object.keys(by).map(Number).sort((a, b) => a - b).map(no => ({ no, nums: by[no].sort((a, b) => a - b) }));
}

/* switchDashTab('groups')에서 부른다 */
async function dashGroupsOpen_(){
  if(!GR.key) GR.key = grKeys_()[0] || '';
  grRender_();
  try { if(GR.saved === null) await grLoadSaved_(); GR.err = ''; }
  catch(e){ GR.err = e.message; }
  grRender_();
}
function grPick_(key){ if(GR.busy) return; GR.key = key; GR.draft = null; GR.seed = 1; GR.rev++; grRender_(); }

/* 미리보기 요청 본문. 붙여 넣은 표가 있는데 다 못 읽었으면 시트로 넘어가지 않게 멈춘다. */
function grBody_(){
  const [grade, ban] = GR.key.split('-');
  const body = { action: 'groupAssign', token: TOKEN, grade, ban: Number(ban), size: GR.size, seed: GR.seed, roster: grParseNums_(grRosterText_(GR.key)) };
  if(String(GR.paste[GR.key] || '').trim()){
    if(!body.roster.length) throw new Error('번호 칸을 먼저 적어 주세요(예: 1-13, 21-33).');
    const p = grParsePaste_(GR.paste[GR.key], GR.key);
    if(!p.ready) throw new Error('붙여 넣은 표를 아직 못 읽었어요. 번호 칸·점수 칸을 확인해 주세요.');
    body.scores = p.scores;
  } else if(GR.title[GR.key]) body.examTitle = GR.title[GR.key];
  return body;
}
async function grPost_(body){
  const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}
/* 옛 백엔드는 모르는 action을 기본 제출 경로로 보내 gameName 오류를 돌려준다 — 그 문구 대신 재배포 안내를 보여 준다 */
function grErrText_(j){
  const m = (j && j.message) || '';
  return /gameName/.test(m) ? '백엔드 v145 «새 버전» 재배포 전이에요' : (m || '계산하지 못했어요');
}
async function grPreview_(nextSeed){
  if(GR.busy) return;
  const rev = GR.rev, key = GR.key;
  if(nextSeed) GR.seed += 1;
  let body;
  try { body = grBody_(); } catch(e){ showToast(e.message); return; }
  GR.busy = true; grRender_();
  try {
    const j = await grPost_(body);
    if(j.result !== 'success'){
      if(j.needExamTitle){ GR.titles[key] = j.titles; showToast('어느 지필 평가로 할지 골라 주세요.'); }
      else showToast(grErrText_(j));
    } else if(!Array.isArray(j.groups)) showToast('백엔드 v145 «새 버전» 재배포 전이에요');
    else if(rev !== GR.rev || key !== GR.key) showToast('입력이 바뀌어서 다시 미리보기를 눌러 주세요.');
    else {
      GR.draft = Object.assign(j, { key, req: body, skipped: body.scores ? grParsePaste_(GR.paste[key], key).skipped : 0 });
      GR.fold[key] = true; // 표에 이름·성적이 있으니 결과를 본 뒤에는 접어 둔다
    }
  } catch(e){ GR.draft = null; showToast('계산하지 못했어요: ' + e.message); }
  GR.busy = false; grRender_();
}
async function grConfirm_(){
  if(!GR.draft || GR.busy) return;
  if(typeof PREVIEW_MODE !== 'undefined' && PREVIEW_MODE){ showToast('미리보기라 저장하지 않았어요.'); return; }
  const d = GR.draft, key = d.key;
  GR.busy = true; grRender_();
  try {
    await grLoadSaved_(); // 다른 PC에서 그새 확정했는지 다시 본다
    const had = grSavedBan_().length > 0;
    if(had && !confirm(key + '반은 이미 확정한 모둠이 있어요. 지금 모둠으로 바꿀까요?')){ GR.busy = false; grRender_(); return; }
    const j = await grPost_(Object.assign({}, d.req, { confirm: true, overwrite: had })); // 미리보기와 같은 요청 → 본 판 그대로
    if(j.result !== 'success') throw new Error(grErrText_(j));
    await grLoadSaved_();
    GR.draft = null;
    delete GR.paste[key]; delete GR.cols[key]; delete GR.fold[key]; // 이름·성적 표는 쓸모가 끝나면 화면에서 지운다
    showToast(key + '반 모둠을 확정했어요. «크게 보기»로 칠판에 띄워 주세요.');
  } catch(e){ showToast('저장 못 했어요: ' + e.message); }
  GR.busy = false; grRender_();
}

function grBoardHtml_(groups, big){
  return `<div class="gr-board${big ? ' big' : ''}">` + groups.map((g, i) => `<div class="gr-col" style="--i:${i}"><div class="gr-head">${g.no}모둠 <small>${g.nums.length}명</small></div><div class="gr-nos">${g.nums.map(n => `<span>${n}</span>`).join('')}</div></div>`).join('') + '</div>';
}
function grDraftHtml_(d){
  const notes = [];
  if(d.source === 'paste') notes.push('붙여 넣은 점수로 계산했어요(저장 안 함).');
  else notes.push('시트 성적으로 계산했어요 — 지필: ' + ctEsc_(d.examTitle || '없음') + ' · 수행: ' + ctEsc_(d.perfTitle || '없음'));
  if(d.missing.length) notes.push('점수가 없어 반 평균으로 넣은 번호: ' + d.missing.join(', '));
  if(d.stray.length) notes.push('번호 명단에 없어 뺀 번호: ' + d.stray.join(', '));
  if(d.source === 'paste' && (d.missing.length || d.stray.length)) notes.push('<b>번호가 안 맞아요. 다른 반 표나 다른 번호 칸이 아닌지 확인해 주세요.</b>');
  if(d.skipped) notes.push('못 읽은 줄 ' + d.skipped + '개(다른 반 학번 등)');
  const tierOf = n => d.tiers[n] || '';
  const detail = d.groups.map(g => `<tr><td>${g.no}모둠</td><td>${g.nums.map(n => `${n}<small class="gr-tier">${tierOf(n)}</small>`).join(' ')}</td><td>${g.avg}</td></tr>`).join('');
  return `<p class="dash-hint"><b>미리보기(아직 저장 안 됨)</b> ${d.count}명 → ${d.groups.length}모둠</p>
    ${notes.map(x => `<p class="dash-hint">${x}</p>`).join('')}
    ${grBoardHtml_(d.groups)}
    <details class="gr-detail"><summary>모둠 평균·상중하 보기 — 평균 차이 ${d.spread}점 (칠판에 띄우지 마세요)</summary>
      <table class="ct-table"><thead><tr><th>모둠</th><th>번호(반 안 순위 세 등분)</th><th>평균</th></tr></thead><tbody>${detail}</tbody></table></details>`;
}

function grActionsHtml_(){
  const busy = GR.busy ? ' disabled' : '';
  const draft = GR.draft && GR.draft.key === GR.key ? GR.draft : null;
  return `<div class="ct-top"><button type="button" class="btn btn-sm" onclick="grPreview_()"${busy}>👀 미리보기</button>${draft ? `<button type="button" class="btn btn-sm btn-ghost" onclick="grPreview_(true)"${busy}>🔀 다른 조합</button><button type="button" class="btn btn-sm" onclick="grConfirm_()"${busy}>✅ 이 모둠으로 확정</button>` : ''}</div>${draft ? grDraftHtml_(draft) : ''}`;
}
function grRender_(){
  const box = $('grBox');
  if(!box) return;
  const keys = grKeys_();
  const head = `<div class="ct-top">${keys.map(k => `<button type="button" class="btn btn-sm${k === GR.key ? '' : ' btn-ghost'}" onclick="grPick_('${k}')"${GR.busy ? ' disabled' : ''}>${k}</button>`).join('')}${GR.busy ? ' <span class="dash-hint">계산하는 중…</span>' : ''}</div>`;
  if(GR.err){ box.innerHTML = head + `<p class="dash-hint" style="color:var(--seal)">${ctEsc_(GR.err)} — 백엔드 v145 «새 버전» 재배포 전이면 이 탭을 못 써요.</p>`; return; }
  if(GR.saved === null || !GR.key){ box.innerHTML = head + `<p class="dash-hint">${GR.key ? '불러오는 중…' : '담당 반을 찾지 못했어요.'}</p>`; return; }
  const pasteText = GR.paste[GR.key] || '';
  const titles = GR.titles[GR.key];
  const saved = grSavedBan_();
  let html = head + `<section class="dash-card"><h2 class="dash-card-title">① 모둠 짓기 — ${GR.key}반</h2>
    <p class="dash-card-desc">점수순으로 띠를 지어 모둠마다 상·중·하가 고르게 들어가게 짜요(수능 던전 기숙사와 같은 방식). 시트에 이 반 점수가 있으면 학기말 합계(수행 30 + 지필 70)로, 없으면 아래에 붙여 넣은 점수로 계산해요. 칠판에 연결된 PC라면 칠판 화면을 끄고 작업해 주세요.</p>
    <label class="dash-hint">번호 (전출·전입이 있으면 여기서 고쳐요)<input class="ct-nums" value="${ctEsc_(grRosterText_(GR.key))}" placeholder="예: 1-13, 21-33" oninput="GR.nums[GR.key]=this.value;grInputChanged_()"></label>
    <details class="gr-paste-box"${GR.fold[GR.key] ? '' : ' open'}><summary>성적표 붙여 넣기${pasteText ? ' (붙여 넣은 표 있음)' : ''} — 시트 점수보다 먼저 쓰고 저장하지 않아요. 확정하면 지워져요</summary>
      <textarea class="gr-paste" rows="4" aria-label="성적표 붙여 넣기" placeholder="엑셀·나이스 표를 머리글까지 그대로 복사해요. 번호와 합계 칸만 읽고 이름은 쓰지 않아요. 붙여 넣은 글자는 점으로 가려져요." oninput="GR.paste[GR.key]=this.value;delete GR.cols[GR.key];grInputChanged_();grPasteNote_()">${ctEsc_(pasteText)}</textarea></details>
    <div id="grPasteNote">${grPasteNoteHtml_()}</div>
    ${titles && titles.length > 1 ? `<label class="dash-hint">지필 평가 <select class="gr-size" onchange="GR.title[GR.key]=this.value;grInputChanged_()"><option value="">고르기</option>${titles.map(t => `<option value="${ctEsc_(t)}"${t === GR.title[GR.key] ? ' selected' : ''}>${ctEsc_(t)}</option>`).join('')}</select></label>` : ''}
    <label class="dash-hint">한 모둠 최대 인원
      <select class="gr-size" onchange="if(GR.busy){grRender_();return;}GR.size=Number(this.value);GR.draft=null;GR.rev++;grRender_()">${[3, 4, 5].map(n => `<option value="${n}"${n === GR.size ? ' selected' : ''}>${n}명</option>`).join('')}</select>
      ${GR.size !== 4 ? ' <b>국민 국가 3차시 보스 레이드는 모둠 4명·최종전 대표 8명까지예요.</b>' : ''}</label>
    <div id="grActions">${grActionsHtml_()}</div></section>`;
  html += `<section class="dash-card"><h2 class="dash-card-title">② 확정한 모둠 — ${GR.key}반</h2>` + (saved.length
    ? `<div class="ct-top"><button type="button" class="btn btn-sm" onclick="GR.full=true;grRender_()">⛶ 칠판에 크게 보기</button></div>` + grBoardHtml_(saved)
    : '<p class="dash-hint">아직 확정한 모둠이 없어요.</p>') + '</section>';
  if(GR.full && saved.length) html += `<div class="gr-full" onclick="GR.full=false;grRender_()"><h2>${GR.key}반 모둠</h2>${grBoardHtml_(saved, true)}<p>화면을 누르면 닫혀요</p></div>`;
  box.innerHTML = html;
}
/* 입력 중 다시 그리면 글자 칸 포커스가 날아가서 읽은 결과 부분만 고친다 */
function grPasteNote_(){
  const el = $('grPasteNote'); if(el) el.innerHTML = grPasteNoteHtml_();
}
