/* ════════════════════════════════════════════════════════
 * 🔐 학생 계정 (v83) — 로그인 비밀번호 관리
 * history26_backend mode=pwAdmin / action=resetStudentPassword·dismissPwRequest·setInitialPassword·setLoginRequired.
 * 비밀번호 자체는 서버에도 해시로만 있어 여기서 보여줄 수 없다. 초기화는 되돌릴 수 없으니 매번 confirm.
 * ════════════════════════════════════════════════════════ */
let PA_DATA = null;
async function dashLoadPwAdmin_(){
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL + '?mode=pwAdmin&token=' + encodeURIComponent(TOKEN));
    if(data.result !== 'success') throw new Error(data.message || '불러오지 못했어요.');
    PA_DATA = data;
    const n = (data.requests || []).length;
    $('paBadge').textContent = n; $('paBadge').style.display = n ? 'inline-block' : 'none';
    dashRenderPwAdmin_();
  }catch(e){
    $('paRequests').textContent = '불러오지 못했어요: ' + e.message + ' (백엔드 v83 재배포 전이면 이 탭은 아직 동작하지 않아요.)';
  }
}
function fmtPaTime_(v){
  if(!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function dashRenderPwAdmin_(){
  const d = PA_DATA; if(!d) return;
  const reqs = d.requests || [];
  $('paRequests').innerHTML = !reqs.length ? '대기 중인 요청이 없어요.' :
    '<div class="table-wrap"><table><thead><tr><th>요청 시각</th><th>학번</th><th>적은 이름</th><th>계정 이름</th><th></th></tr></thead><tbody>' +
    reqs.map(r => {
      const diff = r.accountName && r.accountName !== String(r.name).replace(/\s+/g,'');
      return '<tr><td>' + fmtPaTime_(r.timestamp) + '</td><td>' + escapeHtml(r.studentId) + '</td><td>' + escapeHtml(r.name) + '</td>'
        + '<td>' + (r.accountName ? escapeHtml(r.accountName) : '<span class="muted">(아직 로그인 안 함)</span>') + (diff ? ' ⚠️ 이름 다름' : '') + '</td>'
        + '<td class="pa-actions"><button type="button" class="btn btn-sm" data-sid="' + escapeHtml(r.studentId) + '" data-name="' + escapeHtml(r.accountName || r.name) + '" onclick="dashResetPw(this)">초기화</button> '
        + '<button type="button" class="btn btn-ghost btn-sm" onclick="dashDismissPwRequest(this,' + Number(r.row) + ')">무시</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  $('paInitialStatus').textContent = d.initialSet
    ? '설정돼 있어요. 바꾸면 아직 초기 상태인 학생부터 새 값으로 들어와요(이미 자기 비밀번호로 바꾼 학생은 그대로).'
    : '⚠️ 아직 정하지 않았어요 — 정하기 전엔 아무 학생도 처음 로그인을 할 수 없어요.';
  $('paRequiredStatus').textContent = d.loginRequired
    ? '켜져 있어요 — 비밀번호로 로그인한 학생만 기록을 보고 제출할 수 있어요.'
    : '꺼져 있어요 — 옛 화면(학번·이름만)도 아직 제출돼요. 로그인한 학생의 세션은 이미 학번 일치 검사를 받아요.';
  dashRenderPwAccounts_();
}
function dashRenderPwAccounts_(){
  const d = PA_DATA; if(!d) return;
  const q = $('paSearch').value.trim();
  const list = (d.accounts || []).filter(a => !q || a.studentId.indexOf(q) >= 0 || a.name.indexOf(q.replace(/\s+/g,'')) >= 0);
  const done = (d.accounts || []).filter(a => a.state === '설정').length;
  $('paCount').textContent = '계정 ' + (d.accounts || []).length + '명 · 자기 비밀번호로 바꾼 학생 ' + done + '명';
  $('paSummary').textContent = '· ' + (d.accounts || []).length + '명 (자기 비밀번호 ' + done + '명)'; // v92
  $('paAccounts').innerHTML = !list.length ? '<tr><td colspan="5" class="muted">아직 로그인한 학생이 없어요. (계정은 처음 로그인할 때 생겨요)</td></tr>' :
    list.slice(0, 300).map(a => '<tr><td>' + escapeHtml(a.studentId) + '</td><td>' + escapeHtml(a.name) + '</td>'
      + '<td>' + (a.state === '설정' ? '자기 비밀번호' : '<span class="muted">초기 상태</span>') + '</td>'
      + '<td>' + fmtPaTime_(a.lastLogin) + '</td>'
      + '<td class="pa-actions">' + (a.state === '설정' ? '<button type="button" class="btn btn-ghost btn-sm" data-sid="' + escapeHtml(a.studentId) + '" data-name="' + escapeHtml(a.name) + '" onclick="dashResetPw(this)">초기화</button>' : '') + '</td></tr>').join('');
}
async function dashPwPost_(body){
  const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(Object.assign({ token: TOKEN }, body)) });
  const r = await res.json();
  if(r.result !== 'success') throw new Error(r.message || '실패했어요.');
  return r;
}
async function dashResetPw(btn){
  const sid = btn.dataset.sid, name = btn.dataset.name;
  if(!confirm(sid + ' ' + name + ' 학생의 비밀번호를 초기 비밀번호로 되돌릴까요?\n\n그 학생은 모든 기기에서 로그아웃되고, 초기 비밀번호로 들어와 새 비밀번호를 다시 정해요.')) return;
  btn.disabled = true;
  try{
    await dashPwPost_({ action: 'resetStudentPassword', studentIds: [sid] });
    showToast(sid + ' ' + name + ' 학생을 초기화했어요.');
    await dashLoadPwAdmin_();
  }catch(e){ showToast('초기화하지 못했어요: ' + e.message); btn.disabled = false; }
}
async function dashDismissPwRequest(btn, row){
  btn.disabled = true;
  try{ await dashPwPost_({ action: 'dismissPwRequest', row }); await dashLoadPwAdmin_(); }
  catch(e){ showToast('처리하지 못했어요: ' + e.message); btn.disabled = false; }
}
async function dashSetInitialPw(btn){
  const pw = $('paInitialPw').value.trim();
  if(!/^\d{4,12}$/.test(pw)){ showToast('초기 비밀번호는 숫자 4~12자리로 정해 주세요.'); return; }
  if(!confirm('공통 초기 비밀번호를 지금 적은 값으로 저장할까요?\n저장하면 이 화면에서도 다시 볼 수 없으니 따로 적어 두세요.')) return;
  btn.disabled = true;
  try{
    await dashPwPost_({ action: 'setInitialPassword', password: pw });
    $('paInitialPw').value = '';
    showToast('초기 비밀번호를 저장했어요.');
    await dashLoadPwAdmin_();
  }catch(e){ showToast('저장하지 못했어요: ' + e.message); }
  finally{ btn.disabled = false; }
}
async function dashSetLoginRequired(btn, on){
  if(on && !confirm('로그인 필수를 켤까요?\n\n비밀번호로 로그인하지 않은 화면(로그인 연결이 없는 옛 웹앱 포함)의 제출·조회가 바로 막혀요.')) return;
  btn.disabled = true;
  try{
    await dashPwPost_({ action: 'setLoginRequired', on });
    showToast(on ? '로그인 필수를 켰어요.' : '로그인 필수를 껐어요.');
    await dashLoadPwAdmin_();
  }catch(e){ showToast('바꾸지 못했어요: ' + e.message); }
  finally{ btn.disabled = false; }
}
async function dashResetAllPw(btn){
  const n = PA_DATA ? (PA_DATA.accounts || []).length : 0;
  const typed = prompt('모든 학생(' + n + '명)의 비밀번호를 초기화해요. 모두 로그아웃되고 되돌릴 수 없어요.\n계속하려면 "전체 초기화"라고 적어 주세요.');
  if(typed !== '전체 초기화') { if(typed !== null) showToast('입력이 달라서 취소했어요.'); return; }
  btn.disabled = true;
  try{
    const r = await dashPwPost_({ action: 'resetStudentPassword', all: true });
    showToast(r.reset + '명을 초기화했어요.');
    await dashLoadPwAdmin_();
  }catch(e){ showToast('초기화하지 못했어요: ' + e.message); }
  finally{ btn.disabled = false; }
}

async function dashUploadGradeExcel(btn){
  const fileInput = $('gradeExcelFile');
  const file = fileInput.files[0];
  const statusEl = $('gradeUploadStatus');
  if(!file){ statusEl.textContent = '❌ 파일을 선택해 주세요.'; return; }
  btn.disabled = true; btn.textContent = '업로드 중…';
  statusEl.textContent = '';
  try{
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'uploadGradeExcel', token:TOKEN, fileBase64: base64, filename: file.name })
    });
    const data = await res.json();
    if(data.result === 'success'){
      statusEl.textContent = '✅ 업로드 완료 — 이제 이 시트가 조회 대상이에요.';
      fileInput.value = '';
      dashLoadGradeStatus_();
    } else {
      statusEl.textContent = `❌ ${data.message || '업로드 실패'}`;
    }
  }catch(e){
    statusEl.textContent = '❌ 업로드하지 못했어: ' + e.message;
  }finally{
    btn.disabled = false; btn.textContent = '업로드';
  }
}

/* ── 성적 열람 상태 조회·전환 (교사, 2026-09-15 신규) ── */
async function dashLoadGradeStatus_(){
  const box = $('gradeStatusBox');
  box.textContent = '불러오는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL + '?mode=gradeStatus&token=' + encodeURIComponent(TOKEN));
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    const statusLabel = data.status === 'ON' ? '🟢 열람 중' : '⚪ 닫힘';
    const sheetLine = data.sheetUrl
      ? ' · <a href="' + data.sheetUrl + '" target="_blank" rel="noopener">활성 시트 열기</a>'
      : ' · 등록된 시트 없음';
    box.innerHTML = statusLabel + sheetLine;
  }catch(e){
    box.textContent = '❌ 상태를 불러오지 못했어: ' + e.message;
  }
}
/* v101 — 학생이 응답한 뒤 점수가 바뀌었는지(응답 때 점수 ≠ 지금 점수). */
function perfAdminChanged_(r){
  return !!r.response && r.answeredScore !== '' && r.answeredScore != null && Number(r.answeredScore) !== Number(r.score);
}
/* ── 수행평가 점수 확인 현황 (교사, v96) — 반별 응답 수와 "이상 있음" 학생 목록 ── */
async function dashLoadPerfStatus_(){
  const box = $('perfAdminBox');
  box.textContent = '불러오는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL + '?mode=perfScoreAdmin&token=' + encodeURIComponent(TOKEN));
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    const rows = data.rows || [];
    PERF_ADMIN_ROWS = rows;
    if(!rows.length){ box.textContent = '올라온 수행평가 점수가 없어요.'; return; }
    const byBan = {};
    rows.forEach(r => { (byBan[r.studentId.slice(0, 3)] = byBan[r.studentId.slice(0, 3)] || []).push(r); });
    // v101: 응답한 뒤 점수가 바뀐 학생은 «재확인 대기»로 따로 센다(학생이 새 점수를 다시 눌러야 풀림). 한 행 합계 = 학생 수.
    const head = '<tr><th class="l">반</th><th>학생 수</th><th>이상 없음</th><th>이상 있음</th><th>재확인 대기</th><th>아직 안 누름</th></tr>';
    const trs = Object.keys(byBan).sort().map(k => {
      const list = byBan[k];
      const wait = list.filter(perfAdminChanged_).length;
      const ok = list.filter(r => r.response === '이상 없음' && !perfAdminChanged_(r)).length;
      const ask = list.filter(r => r.response === '이상 있음' && !perfAdminChanged_(r)).length;
      return '<tr><td class="l">' + Number(k.slice(0, 1)) + '학년 ' + Number(k.slice(1)) + '반</td><td>' + list.length + '</td><td>' + ok
        + '</td><td>' + ask + '</td><td' + (wait ? ' class="perf-wait"' : '') + '>' + wait + '</td><td>' + perfNoneCell_(k, list.length - ok - ask - wait) + '</td></tr>'; // v107: 아직 안 누름 숫자를 누르면 명단 팝업
    }).join('');
    const asks = rows.filter(r => r.response === '이상 있음' && !perfAdminChanged_(r)).sort((a, b) => a.studentId.localeCompare(b.studentId));
    const changed = rows.filter(perfAdminChanged_).sort((a, b) => a.studentId.localeCompare(b.studentId));
    // v105: 표까지 내려가지 않아도 보이게 반별 응답 수(응답함/학생 수)를 칩으로 먼저 보여 준다.
    const banSum = '<div class="perf-bansum">' + Object.keys(byBan).sort().map(k => {
      const list = byBan[k];
      return '<span class="perf-bansum-chip">' + Number(k.slice(0, 1)) + '학년 ' + Number(k.slice(1)) + '반 ' + list.filter(r => r.response).length + '/' + list.length + '</span>';
    }).join('') + '</div>';
    const noneAll = rows.filter(r => !r.response).length; // v107
    box.innerHTML = banSum + '<div class="perf-toolbar"><button type="button" class="perf-askbtn perf-askbtn-ov" onclick="perfOverviewOpen_(\'\')">🗂️ 반별 한눈에 보기</button> <button type="button" class="perf-askbtn perf-askbtn-none" onclick="perfNoneOpen_(\'\')">👀 아직 안 누른 학생 보기 (' + noneAll + '명)</button></div>'
      + '<div class="perf-stat-wrap"><table class="grade-table perf-stat">' + head + trs + '</table></div>'
      + (changed.length ? '<p class="dash-section-title">🔔 점수가 바뀌어 재확인 대기 (' + changed.length + '명)</p>' // v101
          + '<p class="dash-hint">응답 뒤에 점수가 바뀐 학생이에요. 학생 화면에 «점수가 달라졌어요» 안내가 뜨고, 새 점수를 보고 다시 누르면 이 목록에서 빠져요.</p>'
          + '<div class="perf-asklist">' + changed.map(r => '<button type="button" class="perf-askbtn perf-askbtn-wait" onclick="dashLoadPerfEvidence_(\'' + escapeHtml(r.studentId) + '\')">'
          + escapeHtml(r.studentId + ' ' + r.name + ' ' + r.answeredScore + '→' + r.score + '점') + '</button>').join('') + '</div>' : '')
      + '<p class="dash-section-title">이상 있음 (' + asks.length + '명)</p>'
      + (asks.length ? '<p class="dash-hint">확인 완료 ' + asks.filter(r => r.checked).length + '명 / ' + asks.length + '명</p>' // v99
          + '<div class="perf-asklist">' + asks.map(r => '<button type="button" id="perfAsk_' + escapeHtml(r.studentId) + '" class="perf-askbtn' + (r.checked ? ' is-checked' : '') + '" onclick="dashLoadPerfEvidence_(\'' + escapeHtml(r.studentId) + '\')">'
          + escapeHtml(perfAskLabel_(r)) + '</button>').join('') + '</div>' : '<p class="dash-hint">없어요.</p>')
      + '<p class="dash-section-title">학생별 점수·조정</p>'
      + '<div class="filters"><select id="perfBanSel" onchange="dashRenderPerfStudents_()">'
      + Object.keys(byBan).sort().map(k => '<option value="' + k + '">' + Number(k.slice(0, 1)) + '학년 ' + Number(k.slice(1)) + '반</option>').join('')
      + '</select></div><div id="perfStudentBox"></div>';
    dashRenderPerfStudents_();
  }catch(e){
    box.textContent = '❌ 현황을 불러오지 못했어: ' + e.message;
  }
}
/* v97 — 이상 있음 학생 한 명의 점수 산출 근거 팝업 (교사 전용, mode=perfEvidenceAdmin). 학생 화면에는 이 데이터가 내려가지 않는다.
 * 순서: ① 점수 산출 근거(글 수·3/2/1/0점 개수·반영 합계) ② 점수별 토글 ③ 글마다 패들렛 원문 + 채점 근거. */
let PERF_EVID_LAST = null;
function perfModalEl_(){
  let m = $('perfModal');
  if(m) return m;
  m = document.createElement('div');
  m.id = 'perfModal'; m.className = 'perf-modal'; m.hidden = true;
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'perfModalTitle');
  m.innerHTML = '<div class="perf-modal-card"><div class="perf-modal-top"><h3 class="perf-modal-title" id="perfModalTitle"></h3>'
    + '<button type="button" class="perf-modal-x" aria-label="닫기" onclick="perfModalClose_()">✕</button></div>'
    + '<div class="perf-modal-body" id="perfModalBody"></div></div>';
  m.addEventListener('click', ev => { if(ev.target === m) perfModalClose_(); });
  document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !m.hidden) perfModalClose_(); });
  document.body.appendChild(m);
  return m;
}
function perfModalClose_(){
  const m = $('perfModal');
  if(m) m.hidden = true;
  document.body.classList.remove('perf-modal-open');
}
function perfModalOpen_(title, sub, html){
  const m = perfModalEl_();
  $('perfModalTitle').innerHTML = escapeHtml(title) + (sub ? '<small>' + escapeHtml(sub) + '</small>' : '');
  $('perfModalBody').innerHTML = html;
  $('perfModalBody').scrollTop = 0;
  m.hidden = false;
  document.body.classList.add('perf-modal-open');
  m.querySelector('.perf-modal-x').focus();
}
/* v98 — 글 첫 줄에서 «어떤 주제의 글인지» 읽어 온다(저장된 주제 칸은 없다). 못 읽으면 첫 줄 앞부분을 그대로 보여 준다. */
function perfTopic_(text){
  const first = String(text || '').trim().split('\n')[0].trim();
  let m;
  if((m = first.match(/^\[이자겸의 사대 수용에 대한 나의 입장:\s*(찬성|반대)\]/))) return '이자겸의 사대 수용 입장 (' + m[1] + ')';
  if((m = first.match(/^최씨정권의 강화도 천도, 나는 \((.+?)\)/))) return '최씨 정권의 강화도 천도 (' + m[1] + ')';
  if((m = first.match(/^1\.\s*\[(.+?)\]/))) return '조선 제도 비유 글 (' + m[1] + ')';
  if((m = first.match(/^\[(.+?)\]/))) return m[1];
  if(/^Q\./.test(first)) return '활동 뒤 질문 답변 — ' + first.replace(/^Q\.\s*/, '').slice(0, 26) + '…';
  if(/^나는 신하 \d의 입장/.test(first)) return '왕권 vs 신권 입장 글 (' + first.slice(0, 12) + '…)';
  return first ? '주제 표시 없음 — ' + first.slice(0, 20) + '…' : '(내용 없음)';
}
/* v107 — «아직 안 누름» 명단 팝업(교사 전용, 읽기 전용이라 PREVIEW_MODE 가드 불필요). 반 키(예 101) 또는 ''(전체)를 받아
 * 반별로 묶어 보여 주고, 복사 버튼은 알림장·메신저에 붙여 쓸 "1학년 1반 (N명): 이름, 이름" 줄을 만든다. 데이터는 PERF_ADMIN_ROWS 그대로(추가 fetch 없음). */
function perfBanName_(k){ return Number(k.slice(0, 1)) + '학년 ' + Number(k.slice(1)) + '반'; }
function perfNoneCell_(k, n){
  return n ? '<button type="button" class="perf-none-num" title="누르면 명단이 열려요" onclick="perfNoneOpen_(\'' + escapeHtml(k) + '\')">' + n + '</button>' : '0';
}
function perfNoneGroups_(ban){
  const g = {};
  PERF_ADMIN_ROWS.filter(r => !r.response && (!ban || r.studentId.slice(0, 3) === ban)).forEach(r => {
    (g[r.studentId.slice(0, 3)] = g[r.studentId.slice(0, 3)] || []).push(r);
  });
  Object.keys(g).forEach(k => g[k].sort((a, b) => a.studentId.localeCompare(b.studentId)));
  return g;
}
function perfNoneOpen_(ban){
  const g = perfNoneGroups_(ban), keys = Object.keys(g).sort();
  const total = keys.reduce((n, k) => n + g[k].length, 0);
  const all = PERF_ADMIN_ROWS.filter(r => !ban || r.studentId.slice(0, 3) === ban).length;
  const title = (ban ? perfBanName_(ban) + ' ' : '') + '아직 안 누른 학생 ' + total + '명';
  if(!total){ perfModalOpen_(title, '', '<p class="dash-hint">모두 눌렀어요 🎉</p>'); return; }
  const body = '<p class="dash-hint">«이상 없음/이상 있음»을 한 번도 누르지 않은 학생이에요. 전체 ' + all + '명 중 ' + total + '명. 점수가 바뀌어 다시 눌러야 하는 학생은 «재확인 대기»라서 여기엔 안 들어와요.</p>'
    + '<div class="perf-none-actions"><button type="button" class="perf-askbtn" onclick="perfNoneCopy_(\'' + escapeHtml(ban) + '\')">📋 명단 복사</button>'
    + '<button type="button" class="perf-askbtn" onclick="dashLoadPerfStatus_().then(() => perfNoneOpen_(\'' + escapeHtml(ban) + '\'))">↻ 새로고침</button></div>'
    + keys.map(k => '<details class="perf-grp perf-none-grp" open><summary>' + perfBanName_(k) + ' <span class="perf-none-cnt">' + g[k].length + '명</span></summary>'
      + '<div class="perf-asklist perf-none-list">' + g[k].map(r => '<span class="perf-none-chip">' + escapeHtml(Number(r.studentId.slice(3)) + '번 ' + r.name) + '</span>').join('') + '</div></details>').join('');
  perfModalOpen_(title, '수행평가 점수 확인', body);
}
async function perfNoneCopy_(ban){
  const g = perfNoneGroups_(ban), keys = Object.keys(g).sort();
  const lines = keys.map(k => perfBanName_(k) + ' (' + g[k].length + '명): ' + g[k].map(r => r.name).join(', '));
  try{ await navigator.clipboard.writeText('수행평가 점수 확인 — 아직 안 누른 학생\n' + lines.join('\n')); showToast('명단을 복사했어요.'); }
  catch(e){ showToast('복사에 실패했어요.'); }
}
/* v108 — 반별 한눈에 보기(교사 전용, 읽기 전용). 반마다 «아직 안 누름 / 재확인 대기 / 이상 있음 / 이상 없음»을 번호·이름 칩으로 나눠 보여 준다.
 * 챙길 학생(앞 3칸)은 펼치고 이상 없음은 접어 둔다. 상태 판정은 현황 표와 같은 규칙(재확인 대기 = perfAdminChanged_). 데이터는 PERF_ADMIN_ROWS 그대로. */
function perfStatusOf_(r){
  if(!r.response) return 'none';
  if(perfAdminChanged_(r)) return 'wait';
  return r.response === '이상 있음' ? 'ask' : 'ok';
}
function perfOverviewOpen_(ban){
  const rows = PERF_ADMIN_ROWS.slice().sort((a, b) => a.studentId.localeCompare(b.studentId));
  const bans = Array.from(new Set(rows.map(r => r.studentId.slice(0, 3)))).sort();
  const show = ban ? [ban] : bans;
  const defs = [['none', '❔ 아직 안 누름', 'perf-ov-none'], ['wait', '🔔 재확인 대기', 'perf-ov-wait'], ['ask', '⚠️ 이상 있음', 'perf-ov-ask'], ['ok', '✅ 이상 없음', 'perf-ov-ok']];
  const chip = (r, st) => {
    const extra = st === 'wait' ? ' ' + r.answeredScore + '→' + r.score + '점' : (st === 'ask' && r.checked ? ' ✓확인함' : '');
    return '<span class="perf-ov-chip ' + st + '">' + escapeHtml(Number(r.studentId.slice(3)) + '번 ' + r.name + extra) + '</span>';
  };
  const cards = show.map(k => {
    const list = rows.filter(r => r.studentId.slice(0, 3) === k);
    const by = { none: [], wait: [], ask: [], ok: [] };
    list.forEach(r => by[perfStatusOf_(r)].push(r));
    const todo = by.none.length + by.wait.length + by.ask.filter(r => !r.checked).length;
    const sum = defs.map(d => '<span class="perf-ov-n ' + d[0] + '">' + d[1].slice(0, 2).trim() + ' ' + by[d[0]].length + '</span>').join('');
    const secs = defs.map((d, i) => by[d[0]].length
      ? '<details class="perf-ov-sec ' + d[2] + '"' + (i < 3 ? ' open' : '') + '><summary>' + d[1] + ' <b>' + by[d[0]].length + '명</b></summary><div class="perf-ov-chips">' + by[d[0]].map(r => chip(r, d[0])).join('') + '</div></details>'
      : '<div class="perf-ov-sec ' + d[2] + ' is-empty">' + d[1] + ' <b>0명</b></div>').join('');
    return '<section class="perf-ov-card"><h4>' + perfBanName_(k) + ' <small>' + list.length + '명 · ' + (todo ? '챙길 학생 ' + todo + '명' : '챙길 학생 없음 🎉') + '</small></h4><div class="perf-ov-sum">' + sum + '</div>' + secs + '</section>';
  }).join('');
  const tabs = '<div class="perf-ov-tabs"><button type="button" class="perf-askbtn' + (ban ? '' : ' is-checked') + '" onclick="perfOverviewOpen_(\'\')">전체 반</button>'
    + bans.map(k => '<button type="button" class="perf-askbtn' + (k === ban ? ' is-checked' : '') + '" onclick="perfOverviewOpen_(\'' + k + '\')">' + perfBanName_(k) + '</button>').join('')
    + '<button type="button" class="perf-askbtn" onclick="dashLoadPerfStatus_().then(() => perfOverviewOpen_(\'' + ban + '\'))">↻ 새로고침</button></div>';
  perfModalOpen_((ban ? perfBanName_(ban) + ' ' : '') + '반별 한눈에 보기', '수행평가 점수 확인', tabs + (cards || '<p class="dash-hint">올라온 학생이 없어요.</p>')
    + '<p class="dash-hint">«이상 있음»의 ✓는 선생님이 확인 완료한 학생이에요. 이상 있음 학생의 근거는 현황 화면의 이상 있음 버튼에서 열어요.</p>');
}
let PERF_UI_KEEP = null;
/* v98 — 글 하나의 점수 조정(교사). POST adjustPerfPostScore → 반영 글·총점 재계산은 백엔드가 한다. */
async function dashAdjustPerfPost_(order, score){
  const d = PERF_EVID_LAST;
  if(!d) return;
  if(PREVIEW_MODE){ showToast('미리보기에서는 점수를 바꿀 수 없어요.'); return; }
  const r = d.rows.find(x => x.order === order);
  if(!r || Number(r.score) === score) return;
  const reason = prompt(d.name + ' ' + order + '번째 글: ' + r.score + '점 → ' + score + '점으로 조정할게요.\n사유를 적어 주세요 (이력에 남아요, 비워도 돼요)', '');
  if(reason === null) return;
  const body = $('perfModalBody');
  PERF_UI_KEEP = { sid: d.sid, scroll: body.scrollTop, open: {} };
  body.querySelectorAll('.perf-grp').forEach(g => { PERF_UI_KEEP.open[g.dataset.s] = g.open; });
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'adjustPerfPostScore', token:TOKEN, studentId:d.sid, title:d.title, order, score, reason })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조정 실패');
    const stu = PERF_ADMIN_ROWS.find(x => x.studentId === d.sid);
    if(stu) stu.score = data.total;
    showToast('✅ ' + order + '번째 글 ' + data.previousPost + '점 → ' + data.score + '점, 총점 ' + data.previousTotal + '점 → ' + data.total + '점');
    await dashLoadPerfEvidence_(d.sid);
    if(typeof dashRenderPerfStudents_ === 'function') dashRenderPerfStudents_();
  }catch(e){
    showToast('❌ ' + e.message + ' (백엔드 재배포 전이면 안 돼요)');
  }
}
async function dashLoadPerfEvidence_(sid){
  const stu = PERF_ADMIN_ROWS.find(x => x.studentId === sid);
  if(!(PERF_UI_KEEP && PERF_UI_KEEP.sid === sid)) PERF_UI_KEEP = null; // 조정 뒤 다시 불러올 때만 펼침·스크롤 유지
  perfModalOpen_(sid + ' ' + (stu ? stu.name : ''), '수행평가 점수 근거', '<p class="dash-hint">불러오는 중…</p>');
  try{
    const res = await fetch(CONFIG.WEBAPP_URL + '?mode=perfEvidenceAdmin&token=' + encodeURIComponent(TOKEN) + '&studentId=' + encodeURIComponent(sid));
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    const rows = (data.rows || []).sort((a, b) => a.order - b.order);
    if(!rows.length){ $('perfModalBody').innerHTML = '<p class="dash-hint">올라온 근거가 없어요.</p>'; return; }
    perfModalRender_(sid, stu, rows, (data.memos || []).filter(m => m.title === rows[0].title)); // v99: 교사 메모(재배포 전엔 없음)
  }catch(e){
    $('perfModalBody').innerHTML = '<p class="dash-hint">❌ 근거를 불러오지 못했어: ' + escapeHtml(e.message) + ' (백엔드 재배포 전이면 안 열려요)</p>';
  }
}
function perfModalRender_(sid, stu, rows, memos){
  const name = stu ? stu.name : rows[0].name;
  memos = memos || [];
  const checked = memos.some(m => m.order === 0 && m.checked);
  const fmtAt = v => { const d = new Date(v); return isNaN(d) ? String(v) : (d.getMonth() + 1) + '/' + d.getDate() + ((d.getHours() || d.getMinutes()) ? ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''); };
  const used = rows.filter(r => r.used === 'O');
  const usedSum = used.reduce((t, r) => t + Number(r.score || 0), 0);
  const cnt = (list, s) => list.filter(r => Number(r.score) === s).length;
  const max = stu ? stu.max : '';
  const showScore = stu ? stu.score : usedSum;
  const usedParts = [3, 2, 1, 0].filter(s => cnt(used, s)).map(s => s + '점 ' + cnt(used, s) + '개');
  const warn = (stu && Math.abs(Number(stu.score) - usedSum) > 0.001)
    ? '<p class="perf-sum-warn">⚠ 반영 글 점수 합(' + usedSum + '점)과 현재 점수(' + stu.score + '점)가 달라요 — 교사가 점수를 조정했거나 글이 바뀐 경우예요.</p>' : '';
  const sum = '<div class="perf-sum"><p class="perf-sum-total">' + escapeHtml(String(showScore)) + '점' + (max !== '' ? '<span>/ ' + escapeHtml(String(max)) + '점 만점</span>' : '') + '</p>'
    + '<p class="perf-sum-line">작성한 글 <b>' + rows.length + '개</b> 중 점수가 높은 <b>' + used.length + '개</b>를 반영 → ' + (usedParts.length ? escapeHtml(usedParts.join(' + ')) + ' = <b>' + usedSum + '점</b>' : '반영된 글 없음') + '</p>'
    + '<div class="perf-chips">' + [3, 2, 1, 0].map(s => '<span class="perf-chip s' + s + '">' + s + '점 <b>' + cnt(rows, s) + '</b>개</span>').join('') + '</div>' + warn + '</div>';
  const grp = [3, 2, 1, 0].map(s => {
    const list = rows.filter(r => Number(r.score) === s);
    if(!list.length) return '';
    const usedN = cnt(used, s);
    const items = list.map(r => {
      const cut = r.preview && (r.preview.length === 300 || r.preview.length === 3000);
      const excluded = String(r.used).indexOf('제외') === 0;
      /* v98 — 글 점수 조정(0~3, 3점 글도 가능). 눌러 바꾸면 반영 글·총점이 다시 계산된다. */
      const adj = excluded ? '' : '<div class="perf-adj"><span class="perf-adj-lbl">점수 조정</span>'
        + [3, 2, 1, 0].map(v => '<button type="button" class="perf-adj-btn' + (v === Number(r.score) ? ' is-now' : '') + '"'
          + (v === Number(r.score) ? ' disabled aria-pressed="true"' : '') + ' onclick="dashAdjustPerfPost_(' + r.order + ',' + v + ')">' + v + '점</button>').join('') + '</div>';
      const flagged = memos.some(m => m.order === r.order && m.memo); // v100: 메모가 달린 글은 눈에 띄게
      return '<div class="perf-evid-item' + (r.used === 'O' ? '' : ' perf-evid-off') + (flagged ? ' perf-evid-flag' : '') + '">'
        + '<div class="perf-evid-head"><span class="perf-evid-no">' + r.order + '번째 글</span><span>' + escapeHtml(fmtAt(r.date)) + '</span>'
        + '<span class="perf-evid-used">' + (r.used === 'O' ? '점수에 반영' : (excluded ? '점수 제외' : '미반영')) + '</span></div>'
        + '<p class="perf-evid-topic"><span>주제</span>' + escapeHtml(perfTopic_(r.preview)) + '</p>'
        + '<p class="perf-evid-lbl">왜 ' + s + '점인가 (채점 근거)</p><p class="perf-evid-reason">' + escapeHtml(r.reason || '근거가 없어요') + '</p>'
        + '<p class="perf-evid-lbl">패들렛 원문</p><p class="perf-evid-prev">' + escapeHtml(r.preview || '(원문이 올라와 있지 않아요)') + '</p>'
        + (cut ? '<p class="perf-evid-cut">※ 원문이 길어 앞부분만 저장돼 있어요. 전체는 패들렛에서 확인해 주세요.</p>' : '')
        + '<div class="perf-memo" id="perfMemo_' + r.order + '">' + perfMemoHtml_(r.order, memos) + '</div>' + adj + '</div>';
    }).join('');
    const keep = PERF_UI_KEEP && PERF_UI_KEEP.sid === sid ? PERF_UI_KEEP.open[s] : undefined; // v98: 조정 뒤 다시 그려도 펼침 상태 유지
    return '<details class="perf-grp" data-s="' + s + '"' + ((keep === undefined ? (s < 3 || list.some(r => memos.some(m => m.order === r.order && m.memo))) : keep) ? ' open' : '') + '><summary>' + s + '점짜리 글 ' + list.length + '개<span class="perf-grp-note">반영 ' + usedN + '개</span></summary>'
      + '<div class="perf-grp-body">' + items + '</div></details>';
  }).join('');
  PERF_EVID_LAST = { sid, name, showScore, max, rows, usedSum, used, title: rows[0].title, memos, checked };
  /* v99 — 확인 완료 표시 + 학생 전체 메모. 글별 메모는 각 글 카드 안(perfMemo_글순서). */
  const bar = '<div class="perf-memo-bar"><button type="button" id="perfCheckBtn" class="btn-sm btn-ghost perf-check-btn' + (checked ? ' is-on' : '') + '"'
    + ' aria-pressed="' + checked + '" onclick="perfCheckToggle_()">' + (checked ? '✓ 확인 완료' : '확인 완료로 표시') + '</button>'
    + '<div class="perf-memo" id="perfMemo_0">' + perfMemoHtml_(0, memos) + '</div></div>';
  perfModalOpen_(sid + ' ' + name, '수행평가 점수 근거 · 패들렛 원문 기준 · 주제는 글 첫 줄에서 읽어 온 거예요',
    sum + bar + grp + '<div class="perf-modal-foot"><button type="button" class="btn-sm" onclick="perfCopyFeedback_()">피드백용 요약 복사</button>'
    + '<button type="button" class="btn-sm btn-ghost" onclick="perfModalClose_()">닫기</button></div>');
  if(PERF_UI_KEEP && PERF_UI_KEEP.sid === sid){ $('perfModalBody').scrollTop = PERF_UI_KEEP.scroll; PERF_UI_KEEP = null; }
  else{ const fl = $('perfModalBody').querySelector('.perf-evid-flag'); if(fl) fl.scrollIntoView({ block:'start' }); } // v100: 처음 열 땐 메모 달린 글부터
}
/* v99 — 교사 메모(글마다·학생 전체, order 0)와 확인 완료 표시. 저장은 POST savePerfMemo → 백엔드 시트 `수행평가메모`.
 * 평소엔 «✎ 교사 메모 남기기» 버튼만 보이고, 누르면 그 자리에 입력창이 열린다. 학생 화면에는 내려가지 않는다. */
function perfMemoHtml_(order, memos){
  const m = (memos || (PERF_EVID_LAST && PERF_EVID_LAST.memos) || []).find(x => x.order === order);
  const text = m && m.memo ? m.memo : '';
  const label = order === 0 ? '학생 전체 메모' : '교사 메모';
  if(!text) return '<button type="button" class="btn-sm btn-ghost perf-memo-open" onclick="perfMemoEdit_(' + order + ')">✎ ' + label + ' 남기기</button>';
  return '<div class="perf-memo-note"><div class="perf-memo-head"><span class="perf-evid-lbl">' + label + '</span>'
    + '<button type="button" class="btn-sm btn-ghost perf-memo-open" onclick="perfMemoEdit_(' + order + ')">수정</button></div>'
    + '<p class="perf-memo-text">' + escapeHtml(text) + '</p></div>';
}
function perfMemoEdit_(order){
  const box = $('perfMemo_' + order), d = PERF_EVID_LAST;
  if(!box || !d) return;
  const m = d.memos.find(x => x.order === order);
  const label = order === 0 ? '학생 전체 메모' : order + '번째 글 교사 메모';
  box.innerHTML = '<label class="perf-evid-lbl" for="perfMemoTa_' + order + '">' + label + '</label>'
    + '<textarea id="perfMemoTa_' + order + '" class="perf-memo-ta" rows="3" maxlength="1000" placeholder="학생에게 줄 피드백이나 추가 채점 근거를 적어 두세요">' + escapeHtml(m ? m.memo : '') + '</textarea>'
    + '<div class="perf-memo-acts"><button type="button" class="btn-sm" onclick="perfMemoSave_(' + order + ', this)">저장</button>'
    + '<button type="button" class="btn-sm btn-ghost" onclick="perfMemoCancel_(' + order + ')">취소</button></div>';
  $('perfMemoTa_' + order).focus();
}
function perfMemoCancel_(order){
  const box = $('perfMemo_' + order);
  if(box) box.innerHTML = perfMemoHtml_(order);
}
async function perfMemoPost_(body){
  const d = PERF_EVID_LAST;
  const res = await fetch(CONFIG.WEBAPP_URL, {
    method:'POST',
    body: JSON.stringify(Object.assign({ action:'savePerfMemo', token:TOKEN, studentId:d.sid, name:d.name, title:d.title }, body))
  });
  const data = await res.json();
  if(data.result !== 'success') throw new Error(data.message || '저장 실패');
  let m = d.memos.find(x => x.order === data.order);
  if(!m){ m = { title:d.title, order:data.order, memo:'', checked:false }; d.memos.push(m); }
  m.memo = data.memo; m.checked = data.checked; m.at = data.at;
  const stu = PERF_ADMIN_ROWS.find(x => x.studentId === d.sid);
  if(stu){ stu.checked = d.memos.some(x => x.order === 0 && x.checked); stu.memoCount = d.memos.filter(x => x.memo).length; }
  return data;
}
async function perfMemoSave_(order, btn){
  if(PREVIEW_MODE){ showToast('미리보기에서는 메모를 저장할 수 없어요.'); return; }
  const ta = $('perfMemoTa_' + order);
  if(!ta) return;
  btn.disabled = true; btn.textContent = '저장 중…';
  try{
    await perfMemoPost_({ order, memo: ta.value.trim() });
    perfMemoCancel_(order);
    showToast(ta.value.trim() ? '✅ 메모를 저장했어요.' : '메모를 지웠어요.');
    perfRefreshAdminLists_();
  }catch(e){
    btn.disabled = false; btn.textContent = '저장';
    showToast('❌ ' + e.message + ' (백엔드 재배포 전이면 안 돼요)');
  }
}
async function perfCheckToggle_(){
  if(PREVIEW_MODE){ showToast('미리보기에서는 표시를 바꿀 수 없어요.'); return; }
  const d = PERF_EVID_LAST, btn = $('perfCheckBtn');
  if(!d || !btn) return;
  const next = !d.memos.some(x => x.order === 0 && x.checked);
  btn.disabled = true;
  try{
    await perfMemoPost_({ order: 0, checked: next });
    btn.classList.toggle('is-on', next);
    btn.setAttribute('aria-pressed', String(next));
    btn.textContent = next ? '✓ 확인 완료' : '확인 완료로 표시';
    showToast(next ? '✅ ' + d.name + ' 확인 완료로 표시했어요.' : '확인 완료 표시를 풀었어요.');
    perfRefreshAdminLists_();
  }catch(e){
    showToast('❌ ' + e.message + ' (백엔드 재배포 전이면 안 돼요)');
  }finally{
    btn.disabled = false;
  }
}
/* 확인 완료·메모가 바뀌면 «이상 있음» 목록 버튼과 학생별 표의 표시를 바로 고친다. */
function perfAskLabel_(r){
  return (r.checked ? '✓ ' : '') + r.studentId + ' ' + r.name + ' ' + r.score + '점 · ' + (r.checked ? '확인 완료' : '근거 보기');
}
function perfRefreshAdminLists_(){
  const d = PERF_EVID_LAST;
  const r = d && PERF_ADMIN_ROWS.find(x => x.studentId === d.sid);
  const b = d && $('perfAsk_' + d.sid);
  if(r && b){ b.textContent = perfAskLabel_(r); b.classList.toggle('is-checked', !!r.checked); }
  dashRenderPerfStudents_();
}
/* 학생에게 알려 줄 때 붙여 쓸 수 있는 요약 텍스트(클립보드). 원문은 길어서 빼고 점수·근거만 담는다. v99: 교사 메모도 함께. */
async function perfCopyFeedback_(){
  const d = PERF_EVID_LAST;
  if(!d) return;
  const memoOf = o => { const m = (d.memos || []).find(x => x.order === o); return m && m.memo ? m.memo : ''; };
  const lines = [d.name + ' 수행평가 ' + d.showScore + '점' + (d.max !== '' ? '/' + d.max : '') + ' (글 ' + d.rows.length + '개 중 반영 ' + d.used.length + '개)'];
  if(memoOf(0)) lines.push('※ ' + memoOf(0));
  [3, 2, 1, 0].forEach(s => {
    d.rows.filter(r => Number(r.score) === s).forEach(r => {
      lines.push('- ' + r.order + '번째 글 ' + s + '점' + (r.used === 'O' ? '' : '(미반영)') + ': ' + (r.reason || ''));
      if(memoOf(r.order)) lines.push('  ↳ 선생님 메모: ' + memoOf(r.order));
    });
  });
  try{ await navigator.clipboard.writeText(lines.join('\n')); showToast('피드백용 요약을 복사했어요.'); }
  catch(e){ showToast('복사에 실패했어요.'); }
}
/* v96g — 학생별 점수 표와 수동 조정(교사 전용). 조정은 POST adjustPerfScore, 이력은 백엔드 시트 `수행평가조정`. */
let PERF_ADMIN_ROWS = [];
/* v109 — «학생별 점수·조정»: 좁은 표 대신 학생 한 줄 카드(점수 크게·상태 색 칩·큰 버튼) + 상태 필터. */
let PERF_STU_FILTER = 'all';
function perfStuFilter_(f){ PERF_STU_FILTER = f; dashRenderPerfStudents_(); }
function dashRenderPerfStudents_(){
  const sel = $('perfBanSel'), box = $('perfStudentBox');
  if(!sel || !box) return;
  const all = PERF_ADMIN_ROWS.filter(r => r.studentId.slice(0, 3) === sel.value)
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
  const st = r => perfStatusOf_(r);
  const todo = r => st(r) === 'none' || st(r) === 'wait' || (st(r) === 'ask' && !r.checked);
  const FILTERS = [['all', '전체', all.length], ['todo', '챙길 학생', all.filter(todo).length], ['none', '안 누름', all.filter(r => st(r) === 'none').length],
    ['wait', '재확인', all.filter(r => st(r) === 'wait').length], ['ask', '이상 있음', all.filter(r => st(r) === 'ask').length]];
  const f = PERF_STU_FILTER;
  const list = all.filter(r => f === 'all' || (f === 'todo' ? todo(r) : st(r) === f));
  const LBL = { none:'아직 안 누름', wait:'재확인 대기', ask:'이상 있음', ok:'이상 없음' };
  const tabs = '<div class="perf-stu-tabs">' + FILTERS.map(x => '<button type="button" class="perf-stu-tab' + (f === x[0] ? ' is-on' : '') + '" onclick="perfStuFilter_(\'' + x[0] + '\')">' + x[1] + ' <b>' + x[2] + '</b></button>').join('') + '</div>';
  const rowsHtml = list.map(r => {
    const k = st(r), sid = escapeHtml(r.studentId);
    const chip = '<span class="perf-stu-st s-' + k + '">' + LBL[k] + (k === 'wait' ? ' ' + escapeHtml(String(r.answeredScore)) + '→' + r.score + '점' : '') + '</span>'
      + (r.checked ? '<span class="perf-checked-tag">✓ 확인함</span>' : '') + (r.memoCount ? '<span class="perf-memo-tag">메모 ' + r.memoCount + '</span>' : '');
    return '<div class="perf-stu s-' + k + '"><div class="perf-stu-who"><span class="perf-stu-no">' + sid + '</span><b class="perf-stu-name">' + escapeHtml(r.name) + '</b></div>'
      + '<div class="perf-stu-score"><b>' + r.score + '</b><span>/ ' + r.max + '점</span></div>'
      + '<div class="perf-stu-state">' + chip + '</div>'
      + '<div class="perf-stu-acts"><button type="button" class="perf-stu-btn" onclick="dashAdjustPerfScore_(\'' + sid + '\')">점수 조정</button>'
      + '<button type="button" class="perf-stu-btn perf-stu-btn-main" onclick="dashLoadPerfEvidence_(\'' + sid + '\')">근거 보기</button></div></div>';
  }).join('');
  box.innerHTML = tabs + '<div class="perf-stu-list">' + (rowsHtml || '<p class="dash-hint">이 조건에 맞는 학생이 없어요 🎉</p>') + '</div>';
}
async function dashAdjustPerfScore_(sid){
  const r = PERF_ADMIN_ROWS.find(x => x.studentId === sid);
  if(!r) return;
  const v = prompt(r.studentId + ' ' + r.name + ' — 현재 ' + r.score + '점 / ' + r.max + '점\n새 점수를 입력하세요 (0~' + r.max + ', 소수 가능)', String(r.score));
  if(v === null) return;
  const score = Number(String(v).trim());
  if(!isFinite(score) || String(v).trim() === '' || score < 0 || score > r.max){ showToast('❌ 점수는 0~' + r.max + ' 사이 숫자로 입력해 주세요.'); return; }
  if(score === r.score){ showToast('점수가 그대로예요.'); return; }
  const reason = prompt('조정 사유를 적어 주세요 (이력에 남아요, 비워도 돼요)', '');
  if(reason === null) return;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'adjustPerfScore', token:TOKEN, studentId:sid, title:r.title, score, reason })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조정 실패');
    r.score = score;
    showToast('✅ ' + r.name + ' ' + data.previous + '점 → ' + score + '점으로 조정했어요.');
    dashRenderPerfStudents_();
  }catch(e){
    showToast('❌ ' + e.message + ' (백엔드 재배포 전이면 안 돼요)');
  }
}
async function dashSetGradeDisplayStatus(btn, status){
  btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'setGradeDisplayStatus', token:TOKEN, status })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '전환 실패');
    dashLoadGradeStatus_();
  }catch(e){
    showToast('❌ ' + e.message);
  }finally{
    btn.disabled = false;
  }
}

/* ── 고민리스트 자원 카드 보너스 일괄 지급 (2026-09-07 신규) ──
 * gongmin(공민왕의 개혁 "고민리스트") 웹앱은 학생용이라 교사 토큰을 심을 수
 * 없어서 grantPresentationPoint를 직접 못 부른다 — 대신 2단계에서 카드를
 * 1장 더 자원했는지만 choicesJson.volunteer로 기록해 보내고, 여기서 교사가
 * 확인 후 자원자에게만 탐구포인트를 몰아서 지급한다(1장만 쓴 학생은 대상 제외
 * — 이게 곧 차등 지급).
 * 중복 지급 방지용 별도 서버 dedupe는 없음 — 이미 지급된 학생은 ROWS 안에
 * choiceSummary가 GONGMIN_BONUS_REASON과 정확히 같은 행이 있는지로 걸러낸다
 * (grantPresentationPointPost_가 reason을 그 컬럼에 그대로 저장하는 걸 이용). */
const GONGMIN_GAME_NAME = '4차시_공민왕개혁_고민리스트';
const GONGMIN_BONUS_REASON = '고민리스트 2단계 자원 카드 보너스';
let GM_BONUS_LEVEL = '중';
function gmBonusVolunteers_(){
  return ROWS.filter(r => r.gameName === GONGMIN_GAME_NAME).map(r => {
    let cj = {};
    try{ cj = JSON.parse(r.choicesJson || '{}'); }catch(e){ /* 파싱 실패 시 자원 안 한 것으로 취급 */ }
    return { sid: r.studentId, name: r.studentName, volunteer: !!cj.volunteer };
  }).filter(v => v.volunteer);
}
function gmBonusAlreadyGranted_(){
  return new Set(ROWS.filter(r => r.choiceSummary === GONGMIN_BONUS_REASON).map(r => String(r.studentId)));
}
function dashRenderGongminBonus_(){
  const box = $('gmBonusBox');
  if(!box) return;
  const total = ROWS.filter(r => r.gameName === GONGMIN_GAME_NAME).length;
  if(!total){
    box.innerHTML = `<p class="dash-hint">아직 이 활동(${escapeHtml(GONGMIN_GAME_NAME)}) 제출이 없어요.</p>`;
    return;
  }
  const volunteers = gmBonusVolunteers_();
  const granted = gmBonusAlreadyGranted_();
  const pending = volunteers.filter(v => !granted.has(String(v.sid)));
  box.innerHTML = `
    <p class="dash-hint">전체 제출 ${total}명 중 자원 ${volunteers.length}명 — 이미 지급 ${volunteers.length - pending.length}명, 대기 ${pending.length}명.</p>
    <div class="pp-levels" id="gmBonusLevels">
      ${PP_LEVELS.map(l => `<button type="button" class="pp-level-btn${l.key === GM_BONUS_LEVEL ? ' is-selected' : ''}" data-level="${l.key}" data-points="${l.points}">${l.key} (+${l.points})</button>`).join('')}
    </div>
    ${pending.length ? `
      <ul class="gm-bonus-list">${pending.map(v => `<li>${escapeHtml(v.name)} (${escapeHtml(v.sid)})</li>`).join('')}</ul>
      <button type="button" id="gmBonusBtn" onclick="dashGrantGongminBonus_(this)">대기 중인 ${pending.length}명에게 일괄 지급</button>
      <div id="gmBonusStatus" class="dash-hint" style="min-height:18px;"></div>
    ` : `<p class="dash-hint">지급 대기 중인 학생이 없어요.</p>`}
  `;
  box.querySelectorAll('#gmBonusLevels .pp-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      GM_BONUS_LEVEL = btn.dataset.level;
      box.querySelectorAll('#gmBonusLevels .pp-level-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
    });
  });
}
async function dashGrantGongminBonus_(btn){
  const pending = gmBonusVolunteers_().filter(v => !gmBonusAlreadyGranted_().has(String(v.sid)));
  if(!pending.length) return;
  btn.disabled = true; btn.textContent = '지급 중…';
  const statusEl = $('gmBonusStatus');
  let done = 0, failed = 0;
  for(const v of pending){
    try{
      const res = await fetch(CONFIG.WEBAPP_URL, {
        method:'POST',
        body: JSON.stringify({
          action:'grantPresentationPoint', token:TOKEN,
          studentId: v.sid, studentName: v.name,
          thinkingType: '', reason: GONGMIN_BONUS_REASON, level: GM_BONUS_LEVEL
        })
      });
      const data = await res.json();
      if(data.result === 'success'){
        done++;
        // 재조회 없이 dedupe 판단이 바로 반영되도록 ROWS에 최소 필드만 채운 가짜 행을 얹는다.
        ROWS.push({ studentId: v.sid, studentName: v.name, gameName: '', choiceSummary: GONGMIN_BONUS_REASON, choicesJson: '' });
      } else {
        failed++;
      }
    }catch(e){ failed++; }
    if(statusEl) statusEl.textContent = `진행 중… ${done + failed}/${pending.length}`;
  }
  showToast(`고민리스트 보너스 지급 완료 — 성공 ${done}명${failed ? `, 실패 ${failed}명` : ''}.`);
  dashRenderGongminBonus_();
}

function dashDetailRowHtml(s, lessons, colspan){
  const act = $('selActivity').value;
  const recs = s.records.filter(r => !act || String(r.gameName) === act);

  /* v24: 세로로 쭉 나열되던 걸 활동별로 묶은 접이식(<details>) 카드로 변경.
   * 1) 같은 활동끼리 묶어서(그 안에서는 최신순) 보여주면 중복 제출이 자연스럽게
   *    옆에 붙어 비교하기 쉬움 — 예전엔 시간순 전체 나열이라 다른 활동이 사이에 끼었음.
   * 2) 기본은 접혀 있고 클릭해야 펼쳐지므로, 활동 개수가 많아도 목록 자체는 짧게 유지됨.
   * 3) 같은 활동에 제출이 2건 이상이면 "중복 N건" 배지 + 각 카드에 삭제 버튼을 붙여서
   *    바로 정리할 수 있게 함(dashDeleteActivityRow, 백엔드 action=deleteActivityRow). */
  const byGame = {};
  recs.forEach(r => { const g = String(r.gameName); (byGame[g] = byGame[g] || []).push(r); });
  Object.values(byGame).forEach(list => list.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));

  // v27: 커리큘럼 정의 순서를 우선으로 정렬(수업 순서대로 보이게) — 이제 lesson.id가 아니라
  // 차시 안의 각 activity.id 기준으로 펼쳐서 순서를 만든다. 없는 게임명(옛 활동 등)은 뒤에 붙임.
  const knownActIds = lessons.flatMap(l => l.activities.map(a => a.id));
  const orderedGameNames = [
    ...knownActIds.filter(id => byGame[id]),
    ...Object.keys(byGame).filter(g => !knownActIds.includes(g))
  ];

  /* v26(2-2) — 활동 개수가 많아지면 접힌 카드가 세로로 계속 쌓여서 가독성이
   * 떨어지던 문제. 활동별 최신 제출 기준으로 가장 최근 3개만 바로 보이게 하고,
   * 나머지는 curriculum 순서 그대로 "이전 활동 N건 더보기" 안에 묶어둠. */
  const gameNamesByRecency = [...orderedGameNames]
    .sort((a, b) => new Date(byGame[b][0].timestamp) - new Date(byGame[a][0].timestamp));
  const recentGameNames = new Set(gameNamesByRecency.slice(0, 3));
  const recentOrdered = orderedGameNames.filter(g => recentGameNames.has(g));
  const pastOrdered = orderedGameNames.filter(g => !recentGameNames.has(g));

  const renderGameGroup = gameName => {
    const group = byGame[gameName];
    const dupCount = group.length;
    return group.map((r, idx) => {
      const aiComment = String(r['AI코멘트']||'').trim();
      const aiChecked = String(r['AI코멘트확인']||'').trim();
      const rowNum = r._row || '';
      let aiBox = '';
      if (aiComment && rowNum) {
        aiBox = `
          <div class="ai-box" data-row="${rowNum}">
            <div class="ai-head">
              <span class="ai-title">🤖 AI 코멘트 (학생에게 표시 중)</span>
              <span class="ai-chip ${aiChecked ? 'ok' : 'wait'}">${aiChecked ? '검토 완료' : '미검토'}</span>
              <span class="ai-actions">
                ${aiChecked ? '' : `<button class="btn-tiny ai-confirm" data-row="${rowNum}">확인</button>`}
                <button class="btn-tiny ai-editbtn" data-row="${rowNum}">수정</button>
                <button class="btn-tiny ai-hide" data-row="${rowNum}">숨기기</button>
              </span>
            </div>
            <div class="ai-text">${escapeHtml(aiComment)}</div>
          </div>`;
      }
      const dupBadge = dupCount > 1
        ? `<span class="dup-badge" title="같은 활동에 제출이 ${dupCount}건 있어요">중복 ${idx+1}/${dupCount}${idx===0 ? ' · 최신' : ''}</span>`
        : '';
      // v23(핸드오프 "AI 작성 판독") — ai_module_v9.gs가 채운 참고용 등급.
      // "중간" 이상일 때만 노출, 낮음/빈값이면 아예 표시 안 함(과신 방지 — 참고 배지일 뿐 확정 아님).
      const suspectLevel = String(r['AI작성의심도']||'').trim();
      const suspectReason = String(r['AI작성의심근거']||'').trim();
      const showSuspect = suspectLevel === '중간' || suspectLevel === '높음';
      const suspectReview = dashSuspectReview_(r); // v65
      const suspectBadge = showSuspect
        ? `<span class="ai-suspect-badge${suspectReview ? ' reviewed' : ''}" title="근거는 아래 펼쳐서 확인 — 참고용 판정이며 확정 아님">🔍 ${suspectReview ? escapeHtml(suspectReview === '상담함' ? '상담함' : '확인함') : '확인 요청'} · ${escapeHtml(suspectLevel)}</span>`
        : '';
      const blNote = dashBaselineNote_(r); // v72
      const blKind = dashBaselineKind_(blNote);
      const crossBadge = dashCrossCheck_(r)
        ? `<span class="cross-badge" title="글 판정(${escapeHtml(suspectLevel)})과 작성 중 이탈·붙여넣기가 함께 걸렸어요 — 서로 다른 근거가 겹친 경우라 먼저 살펴볼 만하지만, 사료 확인 등 정당한 이탈도 포함돼요(참고용)">👁 교차 확인</span>`
        : '';
      const baselineBadge = showSuspect && blKind
        ? `<span class="bl-badge ${blKind}" title="${escapeHtml(blNote)} — 같은 학생 이전 글과 비교한 참고 메모">${blKind === 'diff' ? '↗ 평소와 다름' : '≈ 평소 범위'}</span>`
        : '';
      const focus = dashFocusSignal_(r); // v68
      const focusBadge = focus && focus.flagged
        ? `<span class="focus-badge" title="${escapeHtml(dashFocusText_(focus))} — 참고용 신호, 사료 확인 등 정당한 이탈도 포함돼요">👁 작성 중 이탈·붙여넣기</span>`
        : '';
      const reviewBtns = suspectReview
        ? `<span class="suspect-status">${suspectReview === '상담함' ? '💬 상담함' : '✓ 문제없음으로 확인함'}</span>
           <button type="button" class="btn-tiny" data-status="" onclick="dashReviewSuspect(event,this)">되돌리기</button>`
        : `<button type="button" class="btn-tiny" data-status="문제없음" onclick="dashReviewSuspect(event,this)">✓ 확인함(문제없음)</button>
           <button type="button" class="btn-tiny" data-status="상담함" onclick="dashReviewSuspect(event,this)">💬 상담함</button>`;
      return `
      <details class="rec-collapse${dupCount > 1 ? ' rec-dup' : ''}" data-row="${rowNum || ''}" ${rowNum && REC_OPEN.has(String(rowNum)) ? 'open' : ''}>
        <summary class="rec-summary">
          <span class="rec-summary-main">
            <span class="rec-title">${escapeHtml(dashLessonTitle(gameName))}</span>
            ${dupBadge}
            ${suspectBadge}
            ${crossBadge}
            ${baselineBadge}
            ${focusBadge}
          </span>
          <span class="rec-summary-side">
            <span class="rec-meta">${formatDate(r.timestamp)} · 성취 ${escapeHtml(String(r['성취수준']||'분석 전'))}</span>
            ${rowNum ? `<button class="btn-tiny rec-delete" data-row="${rowNum}" onclick="dashDeleteActivityRow(event, this)">삭제</button>` : ''}
          </span>
        </summary>
        <div class="rec-body">
          <dl>
            <dt>선택 요약</dt><dd>${escapeHtml(String(r.choiceSummary||'—'))}</dd>
            <dt>학생 서술</dt><dd>${escapeHtml(String(r.reflection||'—'))}</dd>
            <dt>1줄요약</dt><dd>${escapeHtml(String(r['1줄요약']||'—'))}</dd>
            <dt>판단근거</dt><dd>${escapeHtml(String(r['판단근거']||'—'))}</dd>
            ${focus ? `<dt>작성 과정</dt><dd>${escapeHtml(dashFocusText_(focus))} <span class="muted">(참고용 — 사료 확인·검색 등 정당한 이탈도 포함)</span></dd>` : ''}
            ${showSuspect && blNote ? `<dt>평소 대비</dt><dd>${escapeHtml(blNote)} <span class="muted">(이전 글과 비교한 단순 통계 — 의심도와 별개, 참고용)</span></dd>` : ''}
            ${showSuspect ? `<dt>🔍 AI 작성 의심 근거</dt><dd>${escapeHtml(suspectReason||'—')} <span class="muted">(참고용 판정 — 확정 아님, 최종 판단은 교사)</span></dd>
            <dt>검토</dt><dd class="suspect-review" data-row="${rowNum || ''}">${reviewBtns} <span class="muted">표시해도 횟수(🔍×N)는 그대로 남아요.</span></dd>` : ''}
          </dl>
          ${aiBox}
        </div>
      </details>`;
    }).join('');
  };

  const recentHtml = recentOrdered.map(renderGameGroup).join('');
  const pastHtml = pastOrdered.length
    ? `<details class="cl-past-collapse">
         <summary>이전 활동 ${pastOrdered.length}건 더보기 <span class="cl-arrow">▶</span></summary>
         <div class="cl-past-list">${pastOrdered.map(renderGameGroup).join('')}</div>
       </details>`
    : '';
  const recHtml = orderedGameNames.length ? (recentHtml + pastHtml) : '<p class="muted" style="margin-bottom:10px">표시할 기록이 없어요.</p>';

  // v37 — 항목별로 학생이 확인했는지(ack) 표시. q-status 클래스는 질문함에서 쓰던
  // "대기중/답변완료" 알약 스타일 그대로 재사용(의미상 미확인/확인함으로 대응).
  const fbHtml = s.feedbacks.length ? `<div class="fb-history">${
    s.feedbacks.map(f => `<div class="fb-item">
      <div class="fb-meta">${formatDate(f.timestamp)} · ${escapeHtml(dashLessonTitle(String(f.activityId)))}
        <span class="q-status ${f.ack ? 'done' : 'wait'}">${f.ack ? '확인함' : '미확인'}</span>
      </div>
      ${escapeHtml(String(f.feedback))}</div>`).join('')}</div>` : '';

  const options = '<option value="전체">전체(학기 총평)</option>'
    + lessons.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.title)}</option>`).join('');

const selBtnHtml = `<div class="dash-detail-actions">
  <button class="btn btn-sm" data-sid="${s.sid}" data-name="${escapeHtml(s.name)}" onclick="dashPreviewStudent(this)">👀 학생 화면 보기</button>
  <button class="btn btn-sm" onclick="openSelPopup('${s.sid}')">🧭 SEL 특성 보기</button>
  ${dashPointBoxHtml_(s)}
</div>`;

  // v62: 학생 개인 메시지 스레드 — 이미 주고받은 게 있으면 펼쳐 둔다.
  const msgRows = dashMsgThreadRows_(s.sid);
  const msgHtml = `<details class="dm-detail" ${msgRows.length ? 'open' : ''}>
    <summary>💌 개인 메시지${msgRows.length ? ` (${msgRows.length})` : ''}</summary>
    ${dashMsgThreadHtml_(s.sid, s.name)}
  </details>`;

  return `
    <tr class="detail-row"><td colspan="${colspan}">
      ${selBtnHtml}
      ${msgHtml}
      ${recHtml}
      ${fbHtml}
      <div class="fb-form">
        <select class="fb-activity">${options}</select>
        <textarea class="fb-text" placeholder="${escapeHtml(s.name)} 학생에게 보낼 피드백 — 학생 포털의 해당 활동 카드에 표시됩니다"></textarea>
        <button class="btn btn-sm fb-send" data-sid="${s.sid}" data-name="${escapeHtml(s.name)}">보내기</button>
      </div>
    </td></tr>`;
}

/* ── AI 작성 의심 검토 표시 (v65) ──
 * status: '문제없음' | '상담함' | ''(되돌리기). 서버(action=reviewSuspect)가 성공을 돌려줘야만 화면 상태를 바꾼다 —
 * 백엔드 재배포 전엔 "알 수 없는 action" 에러라 저장 실패 토스트가 뜨고 ROWS는 그대로다. */
async function dashReviewSuspect(ev, btn){
  ev.preventDefault(); ev.stopPropagation();
  const wrap = btn.closest('.suspect-review');
  const row = wrap && wrap.dataset.row;
  if(!row){ showToast('기록 행을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.'); return; }
  const status = btn.dataset.status;
  btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST', body: JSON.stringify(Object.assign({ action:'reviewSuspect', token: TOKEN, row, status }, dashRowIdent_(row))) // v122
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '실패');
    const rec = dashFindRowRec(row);
    if(rec) rec['의심검토'] = status;
    REC_OPEN.add(String(row)); // 방금 누른 기록이 재렌더 뒤에도 펼쳐진 채로
    showToast(status ? `'${status}'으로 표시했어요.` : '검토 표시를 되돌렸어요.');
    renderDash();
  }catch(e){
    btn.disabled = false;
    showToast('저장하지 못했어요. (백엔드를 새 버전으로 재배포하기 전이면 저장할 수 없어요)');
  }
}

/* ── 중복/오류 제출 삭제 (v18-3) ──
 * event.preventDefault()로 <summary> 안 버튼을 눌러도 <details>가 열리지
 * 않게 막음(안 막으면 삭제 버튼 클릭이 아코디언 토글도 같이 실행시킴). */
async function dashDeleteActivityRow(ev, btn){
  ev.preventDefault();
  ev.stopPropagation();
  const row = btn.dataset.row;
  const rec = dashFindRowRec(row);
  const label = rec ? dashLessonTitle(String(rec.gameName)) : '이';
  if(!confirm(`"${label}" 제출 기록을 삭제할까요? 되돌릴 수 없고, 학생 포털에서도 즉시 사라져요.`)) return;
  btn.disabled = true; btn.textContent = '삭제 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'deleteActivityRow', token:TOKEN, row,
        studentId: rec ? rec.studentId : '', gameName: rec ? rec.gameName : '' }) // v122 — 백엔드 v104가 행과 대조(행이 밀렸으면 거절)
    });
    ROWS = ROWS.filter(r => String(r._row) !== String(row));
    showToast('기록을 삭제했어요.');
    renderDash();
  }catch(e){
    btn.disabled = false; btn.textContent = '삭제';
    showToast('삭제하지 못했어요. 다시 시도해 주세요.');
  }
}

/* ── AI 코멘트 관리 ── */
function dashFindRowRec(rowNum){
  return ROWS.find(r => String(r._row) === String(rowNum));
}
/* v122 — 행 번호로 쓰는 action에 학번·게임명을 같이 보낸다. 백엔드 v104가 그 행과 대조해, 대시보드가 받은 _row가 그 사이
 * 밀렸으면(다른 탭·학생 자가체크 취소로 위쪽 행이 지워짐) 남의 기록을 건드리지 않고 거절한다. 재배포 전 백엔드는 값을 무시한다. */
function dashRowIdent_(rowNum){
  const rec = dashFindRowRec(rowNum);
  return { studentId: rec ? rec.studentId : '', gameName: rec ? rec.gameName : '' };
}
async function dashAiPost(payload){
  const res = await fetch(CONFIG.WEBAPP_URL, {
    method:'POST',
    body: JSON.stringify(Object.assign({ token: TOKEN }, payload))
  });
  const data = await res.json();
  if (data.result !== 'success') throw new Error(data.message || '요청 실패');
}
async function dashAiConfirm(btn){
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    await dashAiPost(Object.assign({ action:'aiReview', row }, dashRowIdent_(row))); // v122
    const rec = dashFindRowRec(row);
    if(rec) rec['AI코멘트확인'] = '확인';
    showToast('검토 완료로 표시했어요.');
    renderDash();
  }catch(e){
    btn.disabled = false;
    showToast('처리하지 못했어요: ' + e.message);
  }
}
function dashAiEditToggle(btn){
  const box = btn.closest('.ai-box');
  if(box.querySelector('.ai-edit-area')) return;
  const rec = dashFindRowRec(box.dataset.row);
  const current = rec ? String(rec['AI코멘트']||'') : '';
  const textEl = box.querySelector('.ai-text');
  textEl.innerHTML = `
    <textarea class="ai-edit-area">${escapeHtml(current)}</textarea>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button class="btn-tiny ai-save" data-row="${box.dataset.row}">저장</button>
      <button class="btn-tiny ai-cancel">취소</button>
    </div>`;
  textEl.querySelector('.ai-save').addEventListener('click', async ev => {
    ev.stopPropagation();
    const saveBtn = ev.currentTarget;
    const newText = textEl.querySelector('.ai-edit-area').value.trim();
    saveBtn.disabled = true;
    try{
      await dashAiPost(Object.assign({ action:'aiEdit', row: box.dataset.row, comment: newText }, dashRowIdent_(box.dataset.row))); // v122
      if(rec){ rec['AI코멘트'] = newText; rec['AI코멘트확인'] = '확인'; }
      showToast('AI 코멘트를 수정했어요. 학생 화면에 바로 반영됩니다.');
      renderDash();
    }catch(e){
      saveBtn.disabled = false;
      showToast('저장하지 못했어요: ' + e.message);
    }
  });
  textEl.querySelector('.ai-cancel').addEventListener('click', ev => {
    ev.stopPropagation(); renderDash();
  });
}
async function dashAiHide(btn){
  if(!confirm('이 AI 코멘트를 학생 화면에서 숨길까요? (내용이 지워집니다)')) return;
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    await dashAiPost(Object.assign({ action:'aiEdit', row, comment: '' }, dashRowIdent_(row))); // v122
    const rec = dashFindRowRec(row);
    if(rec){ rec['AI코멘트'] = ''; rec['AI코멘트확인'] = '확인'; }
    showToast('AI 코멘트를 숨겼어요.');
    renderDash();
  }catch(e){
    btn.disabled = false;
    showToast('처리하지 못했어요: ' + e.message);
  }
}

async function dashSendFeedback(btn){
  const wrap = btn.closest('.fb-form');
  const text = wrap.querySelector('.fb-text').value.trim();
  const activityId = wrap.querySelector('.fb-activity').value;
  if(!text){ showToast('피드백 내용을 입력해 주세요.'); return; }
  btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({
        action:'feedback', token:TOKEN,
        studentId:btn.dataset.sid, studentName:btn.dataset.name,
        activityId, feedback:text
      })
    });
    FEEDBACKS.push({ timestamp:new Date().toISOString(), studentId:btn.dataset.sid,
      studentName:btn.dataset.name, activityId, feedback:text, ack:false }); // v37 — 방금 보낸 피드백은 당연히 미확인
    showToast('피드백을 보냈어요. 학생 포털의 해당 활동 카드에 표시됩니다.');
    renderDash();
  }catch(e){
    btn.disabled = false; btn.textContent = '보내기';
    showToast('보내지 못했어요. 다시 시도해 주세요.');
  }
}

function dashDownloadCsv(){
  const rows = dashFilteredRows();
  if(!rows.length){ showToast('내려받을 기록이 없어요.'); return; }
  const cols = [
    ['타임스탬프', r=>{ const d=new Date(r.timestamp); return isNaN(d)?'':d.toLocaleString('ko-KR'); }],
    ['학번', r=>r.studentId], ['이름', r=>r.studentName],
    ['활동', r=>dashLessonTitle(String(r.gameName))], ['게임명(원본)', r=>r.gameName],
    ['선택 요약', r=>r.choiceSummary], ['실제 역사와의 차이', r=>r.diffSummary],
    ['학생 서술', r=>r.reflection],
    ['분류태그', r=>r['분류태그']||''], ['1줄요약', r=>r['1줄요약']||''],
    ['성취수준', r=>r['성취수준']||''], ['판단근거', r=>r['판단근거']||''],
    ['AI코멘트', r=>r['AI코멘트']||''], ['AI코멘트확인', r=>r['AI코멘트확인']||'']
  ];
  const esc = v => '"' + String(v==null?'':v).replace(/"/g,'""') + '"';
  const csv = '\uFEFF' + cols.map(c=>esc(c[0])).join(',') + '\n'
    + rows.map(r => cols.map(c=>esc(c[1](r))).join(',')).join('\n');
  const grade = $('selGrade').value, ban = $('selBan').value;
  const banLabel = ban === 'mine' ? '내담당반' : (ban ? ban+'반' : '');
  const name = `학습기록_${grade}학년${banLabel? '_'+banLabel:''}_${new Date().toISOString().slice(0,10)}.csv`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function dashLessonTitle(id){
  if(id === '전체') return '전체(학기 총평)';
  return lessonTitle(id);
}
function dashDots(lv){ return lv==='상'?'●●●':lv==='중'?'●●○':lv==='하'?'●○○':'◌'; }
/* v26(2-2) — 평균 성취 계산: 상=3/중=2/하=1로 환산해 평균 낸 뒤 다시 텍스트 등급으로 되돌림.
 * 미분석(성취수준 빈값) 행은 평균 계산에서 제외한다. */
const ACHIEVE_SCORE_ = { 상:3, 중:2, 하:1 };
function dashAvgAchieveInfo_(records){
  const scored = records.map(r => ACHIEVE_SCORE_[String(r['성취수준']||'').trim()]).filter(v => v !== undefined);
  if(!scored.length) return null;
  const avg = scored.reduce((a,b) => a+b, 0) / scored.length;
  const label = avg >= 2.5 ? '상' : avg >= 1.5 ? '중' : '하';
  return { label, avg: avg.toFixed(1), count: scored.length };
}
/* v26(2-2) — 학생의 records 중 타임스탬프가 가장 최근인 것 하나. 반·활동 순서와 무관하게
 * 개인별로 계산하므로 반마다 진도가 달라도 문제없음. */
function dashMostRecentRecord_(records){
  if(!records.length) return null;
  return records.reduce((a,b) => new Date(b.timestamp) - new Date(a.timestamp) > 0 ? b : a);
}
function dashShorten(s,n){ return s.length>n ? s.slice(0,n)+'…' : s; }

/* 대시보드 이벤트 */
$('btnTeacherMode').addEventListener('click', () => {
  const g = $('teacherGate');
  const open = g.style.display === 'block';
  g.style.display = open ? 'none' : 'block';
  if(!open){
    const saved = store.get('dash_token_saved');
    if(saved){ $('tokenInput').value = saved; $('tokenRemember').checked = true; }
    $('tokenInput').focus();
  }
});

/* ── 학생 화면 미리보기 (교사용) ──
 * 실제 학생 로그인 없이 특정 학년·반 화면을 바로 확인. 백엔드 조회 없이
 * SESSION·STUDENT_DATA를 클라이언트에서 채워 넣는 방식이라 실제 기록에 영향 없음.
 * 단, 모듈형 활동(게임 등)의 "하러 가기" 링크는 실제 활동 페이지로 이동하므로
 * 거기서 실제로 제출하면 시트에 남을 수 있음 — 화면만 확인하는 용도로 안내함. */
function previewInitGradeOptions(){
  const grades = Object.keys(CONFIG.CURRICULUM);
  $('previewGrade').innerHTML = grades.map(g =>
    `<option value="${g}">${g}학년 ${CONFIG.CURRICULUM[g].subject}</option>`).join('');
}
async function startPreview(){
  const grade = Number($('previewGrade').value);
  const ban = Math.max(1, Number($('previewBan').value) || 1);
  const cur = CONFIG.CURRICULUM[grade];
  if(!cur){ showToast('해당 학년 설정을 찾을 수 없어요.'); return; }

  /* v70 — 기록 테스트 모드: 읽기 전용 미리보기가 아니라 그 반 99번 테스트 계정으로 실제 로그인한다.
   * 로그인 유지(portal_session)는 지운다 — 안 그러면 다음에 이 기기로 열 때 테스트 계정으로 자동 입장한다. */
  const sid = `${grade}${String(ban).padStart(2,'0')}99`;
  /* v83 — 학생 로그인에 비밀번호가 생겨서 테스트 계정은 교사 토큰으로 세션을 받는다(issueTestSession). */
  const token = $('previewToken').value.trim() || TOKEN || ''; // 공용·학교 PC에서도 쓰므로 기기에 저장된 토큰은 읽지 않는다
  if(!token){ showToast('교사 토큰을 입력해 주세요.'); $('previewToken').focus(); return; }
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST',
      body: JSON.stringify({ action: 'issueTestSession', token, studentId: sid, name: TEST_STUDENT_NAME }) });
    const r = await res.json();
    if(r.result !== 'success'){ showToast(r.message === '인증 실패' ? '교사 토큰이 맞지 않아요.' : (r.message || '테스트 계정으로 들어가지 못했어요.')); return; }
    H26Auth.set(r.session);
  }catch(e){ showToast('테스트 계정으로 들어가지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
  $('previewToken').value = '';
  $('teacherGate').style.display = 'none';
  $('previewGate').style.display = 'none';
  TEST_WRITE_MODE = true;
  $('inputPw').value = '';
  await login(sid, TEST_STUDENT_NAME, false, true);
  store.del('portal_session');
  /* v81 — 기출 오답노트·체크리스트 웹앱이 읽는 별도 키. portal_session은 위처럼 지워야 하므로(자동 입장 방지) 따로 둔다. 테스트 계정만 넣는다. */
  if(SESSION) store.set('portal_handoff', JSON.stringify({ sid, name: TEST_STUDENT_NAME }));
  if(!SESSION){ TEST_WRITE_MODE = false; } // 로그인 실패 — 로그인 화면의 오류 메시지를 그대로 보여준다
}
$('btnPreviewMode').addEventListener('click', () => {
  const g = $('previewGate');
  const open = g.style.display === 'block';
  g.style.display = open ? 'none' : 'block';
});
$('btnPreviewStart').addEventListener('click', startPreview);
$('btnGate').addEventListener('click', () => enterDash($('tokenInput').value.trim()));
$('tokenInput').addEventListener('keydown', e => { if(e.key==='Enter') $('btnGate').click(); });
$('selGrade').addEventListener('change', () => { openDetailSid=null; dashRefreshBanOptions(); dashRefreshActivityOptions(); renderDash(); });
$('selBan').addEventListener('change', () => { openDetailSid=null; dashRefreshActivityOptions(); renderDash(); });
$('selActivity').addEventListener('change', () => renderDash());
$('studentSearch').addEventListener('input', () => {
  const matches = dashSearchStudents_($('studentSearch').value);
  if(!$('studentSearch').value.trim()){ $('studentSearchResults').style.display = 'none'; return; }
  dashRenderSearchResults_(matches);
});
$('studentSearch').addEventListener('keydown', ev => {
  if(ev.key !== 'Enter') return;
  const matches = dashSearchStudents_($('studentSearch').value);
  if(matches.length === 1) dashJumpToStudent_(matches[0].sid);
});
document.addEventListener('click', ev => {
  if(!$('studentSearchWrap').contains(ev.target)) $('studentSearchResults').style.display = 'none';
});
// v33 — 탐구포인트 탭 학생 검색. dashSearchStudents_는 학년·반 무관 전체 검색이라
// 반 필터를 안 건드리는 이 탭에도 그대로 재사용 가능.
$('ppSearch').addEventListener('input', () => {
  const matches = dashSearchStudents_($('ppSearch').value);
  if(!$('ppSearch').value.trim()){ $('ppSearchResults').style.display = 'none'; return; }
  ppRenderSearchResults_(matches);
});
$('ppSearch').addEventListener('keydown', ev => {
  if(ev.key !== 'Enter') return;
  const matches = dashSearchStudents_($('ppSearch').value);
  if(matches.length === 1) ppPickStudent_(matches[0].sid, matches[0].name);
});
document.addEventListener('click', ev => {
  if(!$('ppSearchWrap').contains(ev.target)) $('ppSearchResults').style.display = 'none';
});
$('btnCsv').addEventListener('click', dashDownloadCsv);
$('btnClCancelEdit').addEventListener('click', dashResetLessonForm);
$('clMulti').addEventListener('change', clToggleMulti);
$('clOwner').addEventListener('change', clRefreshOwnerHint);
$('clGrade').addEventListener('change', clRefreshOwnerHint);
$('clThinkingType').addEventListener('change', clRefreshBadgeNameOptions);
$('ckqFormType').addEventListener('change', ckqOnTypeChange); // v51: 자료 형식 기본값도 같이 맞춤 (v52: *필수 표시도 같이)
$('btnCkqCancel').addEventListener('click', dashResetCheckinLessonForm);
$('ckSetGrade').addEventListener('change', () => { dashRefreshCkSetLessons(); dashOnCkSetTargetChange_(); });
$('ckSetBanOne').addEventListener('change', dashLoadCkSetCurrent);
$('btnCkSetApply').addEventListener('click', dashApplyCkSet);
/* v40: ckStatCols 안 반 select/새로고침 버튼은 학년마다 동적으로 생성되므로
 * (dashRenderCkStatColumns_) 정적 리스너 대신 컨테이너에 이벤트 위임으로 붙인다. */
$('ckStatCols').addEventListener('change', (e) => {
  const m = e.target.id.match(/^ckViewBan_(\d+)$/);
  if(m) dashLoadCheckinAdmin(m[1]);
});
$('ckStatCols').addEventListener('click', (e) => {
  const m = e.target.id.match(/^btnCkViewRefresh_(\d+)$/);
  if(m){ CK_ADMIN_CACHE = null; dashLoadCheckinAdmin(m[1]); } // v118: 새로고침은 캐시를 버리고 다시 받는다
});
$('btnCkViewRefreshAll').addEventListener('click', () => {
  CK_ADMIN_CACHE = null; // v118
  dashRenderCkSummaryTable_();
  dashCheckinGrades_().forEach(grade => dashLoadCheckinAdmin(grade));
});
$('btnDashRefresh').addEventListener('click', async () => {
  showToast('새로고침 중…');
  try{
    await dashLoadData();
    await loadCurriculum(); dashRefreshActivityOptions();
    renderDash(); dashRenderQuestions(); dashRenderAnnouncements(); dashRenderLessons(); dashRenderGradeInfoForm();
    dashRenderGongminBonus_();
    if(CK_ADMIN_LOADED && CHECKIN_PLAN){
      CK_TODAY_LESSON = {};
      CK_ADMIN_CACHE = null; // v118
      await dashLoadCkSetCurrent();
      dashRenderCkSummaryTable_();
      dashCheckinGrades_().forEach(grade => dashLoadCheckinAdmin(grade));
      await dashLoadCheckinLessonsAdmin(); dashRenderCheckinLessonsList();
    }
    showToast('최신 기록으로 갱신했어요.');
  }
  catch(e){ showToast('갱신 실패: ' + e.message); }
});
$('btnDashOut').addEventListener('click', () => {
  $('dashView').style.display = 'none';
  $('loginView').style.display = 'flex';
  $('teacherGate').style.display = 'none';
});

/* ── 초기 부팅: 커리큘럼(시트)을 먼저 불러온 뒤에야 로그인·미리보기·대시보드 필터가
 * 의미 있는 CONFIG.CURRICULUM을 참조할 수 있음. 그 전엔 로그인 버튼을 잠가 둠. ── */
(async function initPortal(){
  const btn = $('btnLogin');
  btn.disabled = true; btn.textContent = '커리큘럼 불러오는 중…';

  const ok = await loadCurriculum();
  if(!ok){
    showLoginError('커리큘럼 정보를 불러오지 못했어요. 새로고침해 주세요.');
  }
  loadCheckinPlan(); // 실패해도 로그인은 막지 않음 — 백그라운드로 진행, maybeStartCheckin이 필요시 재시도

  btn.disabled = false; btn.textContent = '책 펼치기';
  previewInitGradeOptions();

  /* 자동 로그인 (이전 접속 기억) */
  const saved = store.get('portal_session');
  if(saved){
    try{
      const { sid, name } = JSON.parse(saved);
      $('inputId').value = sid; $('inputName').value = name;
      login(sid, name, true);
    }catch(e){}
  }
})();
