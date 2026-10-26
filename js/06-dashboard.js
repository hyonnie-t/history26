/* ════════════════════════════════════════════════════════
 * 교사 대시보드
 * ════════════════════════════════════════════════════════ */
let TOKEN = '';
let TEACHER_NAME = null; // v29 — 로그인 토큰으로 식별된 교사('효니'/'미현쌤'). 서버 권한엔 영향 없고,
                          // 대시보드 기본 필터·커리큘럼 "담당" 기본값을 여기에 맞춰 보여주는 용도.
let ROWS = [];
let FEEDBACKS = [];
let CLASS_FEEDBACKS = []; // v34 — 학급 공통 피드백. { grade, ban, activityId, feedback, studentText, misconceptions, timestamp, studentCount } 형태.
                          // ban은 특정 반 번호("6") 또는 "내 담당 반" 선택 시 콤마 목록("5,6,7,8", dashClassFeedbackBanParam_ 참고).
                          // misconceptions는 2026-09-09 신규, 교사 전용.
let QUESTIONS = [];
let MESSAGES = []; // v62 — 개인메시지 전체(교사용). { _row, timestamp, studentId, studentName, grade, ban, from:'교사'|'학생', content, read, teacher }
let ANNOUNCEMENTS_ADMIN = [];
let LESSONS_ADMIN = [];
let GRADE_INFO_ADMIN = {};
// v24: 칭호명 자동완성 후보 — backend_v24.gs curriculumAdminGet_의 badgeNamePool을 그대로 씀.
// 강제 목록이 아니라 참고용 datalist라, 옛 백엔드(badgeNamePool 필드 없음)에도 안전하게
// 동작하도록 기본값(사고유형 4그룹의 대표 이름만)을 미리 채워둔다.
let BADGE_NAME_POOL = {
  '판단': ['결정왕'], '비교': ['비교왕'], '해석': ['해석왕'], '관점': ['다른 눈으로 본 사람']
};
let openDetailSid = null;
// v33 — 발표 탐구포인트 "빠른 지급" 탭에서 방금 지급한 내역을 세션 메모리에만
// 쌓아두는 목록(새로고침하면 비워짐 — 영구 기록은 아니고 "방금 확실히 지급됐다"는
// 확인용). grantPresentationPoint 응답이 새로 만든 행 정보를 안 돌려주므로
// 서버 재조회 없이 클라이언트에서만 관리.
let PP_RECENT = [];

/* v105 — <details data-fold="이름"> 접힘 상태를 localStorage(dash_fold_이름)에 기억. 기본은 접힘.
 * 내용이 renderDash 등으로 다시 그려져도 같은 키로 복원되고, 리스너는 요소마다 한 번만 단다. */
function dashFoldInit_(el){
  if(!el || !el.dataset.fold) return;
  const key = 'dash_fold_' + el.dataset.fold;
  el.open = store.get(key) === '1';
  if(el.dataset.foldBound) return;
  el.dataset.foldBound = '1';
  el.addEventListener('toggle', () => store.set(key, el.open ? '1' : '0'));
}

/* v22: 5개 요청 전부 fetchJsonRetry_로 재시도 처리. 이전엔 fetch 하나라도
 * 404(재배포 직후 googleusercontent 리다이렉트 불안정) 등으로 실패하면
 * Promise.all이 그대로 reject → 대시보드가 통째로 0/빈 값으로 뜨는 문제가 있었음. */
async function dashLoadData(){
  const base = CONFIG.WEBAPP_URL;
  const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    fetchJsonRetry_(base + '?token=' + encodeURIComponent(TOKEN)),
    fetchJsonRetry_(base + '?mode=feedback&token=' + encodeURIComponent(TOKEN)),
    fetchJsonRetry_(base + '?mode=questions&token=' + encodeURIComponent(TOKEN)),
    fetchJsonRetry_(base + '?mode=announcementsAdmin&token=' + encodeURIComponent(TOKEN)),
    fetchJsonRetry_(base + '?mode=curriculumAdmin&token=' + encodeURIComponent(TOKEN)),
    // v34: 백엔드에 아직 없을 수 있는 새 mode라 이 요청만 실패를 따로 흡수 —
    // 배포 전(또는 재배포 중)에도 나머지 4개 요청이 물려서 대시보드 전체가
    // 안 뜨는 v22식 사고를 반복하지 않기 위함. 실패하면 빈 배열로 취급.
    fetchJsonRetry_(base + '?mode=classFeedback&token=' + encodeURIComponent(TOKEN)).catch(() => ({ rows: [] })),
    // v62: 개인메시지도 백엔드 배포 전엔 없는 mode — 같은 이유로 실패를 따로 흡수.
    fetchJsonRetry_(base + '?mode=messagesAdmin&token=' + encodeURIComponent(TOKEN)).catch(() => ({ rows: [] }))
  ]);
  if(r1.result === 'error') throw new Error(r1.message);
  ROWS = (r1.rows || []).filter(r => parseStudentId(String(r.studentId)));
  TEACHER_NAME = r1.teacher || null; // v29
  FEEDBACKS = (r2.rows || []);
  QUESTIONS = (r3.rows || []);
  ANNOUNCEMENTS_ADMIN = (r4.rows || []);
  LESSONS_ADMIN = (r5.lessons || []);
  GRADE_INFO_ADMIN = (r5.gradeInfo || {});
  if(r5.badgeNamePool) BADGE_NAME_POOL = r5.badgeNamePool; // v24
  CLASS_FEEDBACKS = (r6.rows || []); // v34
  MESSAGES = (r7.result === 'error' ? [] : (r7.rows || [])); // v62
}

async function enterDash(token){
  TOKEN = token;
  const btn = $('btnGate'); btn.disabled = true; btn.textContent = '확인 중…';
  $('gateError').style.display = 'none';
  try{
    await dashLoadData();
    /* v67 — 토큰은 "이 기기에서 로그인 유지"를 켠 경우에만 저장. 끄면 기존 저장분도 지운다. */
    if($('tokenRemember').checked) store.set('dash_token_saved', token);
    else store.del('dash_token_saved');
    $('loginView').style.display = 'none';
    $('portalView').style.display = 'none';
    $('dashView').style.display = 'block';
    dashInitFilters();
    dashInitAnnounceForm();
    dashInitCurriculumForm();
    renderDash();
    dashRenderQuestions();
    dashRenderAnnouncements();
    dashRenderLessons();
    dashRenderGradeInfoForm();
    dashRenderGongminBonus_();
    dashLoadPwAdmin_(); // v83 — 초기화 요청 수 배지(기다리지 않음)
  }catch(e){
    $('gateError').textContent = '들어가지 못했어요: ' + e.message;
    $('gateError').style.display = 'block';
  }finally{
    btn.disabled = false; btn.textContent = '대시보드 열기';
  }
}

/* ── 대시보드 탭 전환 ── */
function switchDashTab(tab){
  ['records','questions','announce','curriculum','checkin','points','grades','accounts'].forEach(t => {
    $('panel' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = (t === tab) ? 'block' : 'none';
  });
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    if(btn.dataset.tab === tab && btn.scrollIntoView) btn.scrollIntoView({ inline:'center', block:'nearest' }); // v63 — 모바일에선 탭 줄이 가로 스크롤
  });
  if(tab === 'grades'){
    document.querySelectorAll('#panelGrades details[data-fold]').forEach(dashFoldInit_); // v105
    dashLoadGradeStatus_(); dashLoadPerfStatus_();
  }
  if(tab === 'points') ppRenderRecent_(); // v105 — 탭을 열 때마다 최근 지급 5건 갱신
  if(tab === 'accounts') dashLoadPwAdmin_(); // v83
  if(tab === 'checkin' && !CK_ADMIN_LOADED){ CK_ADMIN_LOADED = true; dashInitCheckinForm(); }
}

const SEL_APP_URL = 'https://script.google.com/macros/s/AKfycbzQnKFwxatWB8od042GSGVuID9fn2aPy73S5v4v-Eh9EtFjOd7ha6ZUz9DXsdRq2M2H/exec';

function openSelPopup(sid){
  const url = SEL_APP_URL + '?sid=' + encodeURIComponent(sid);
  const w = 480, h = 720;
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  window.open(url, 'selProfile', `width=${w},height=${h},left=${left},top=${top}`);
}

/* ── 커리큘럼 관리 — 서브탭 전환 (새 활동 추가 / 등록된 활동) v13 ── */
function switchClSubtab(sub){
  $('clSubAdd').style.display = sub === 'add' ? 'block' : 'none';
  $('clSubList').style.display = sub === 'list' ? 'block' : 'none';
  document.querySelectorAll('#panelCurriculum .cl-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === sub);
  });
}

function switchCkSubtab(sub){
  $('ckSubToday').style.display = sub === 'today' ? '' : 'none'; // v90 — 'block'로 박으면 PC 2단 grid(style.css)를 덮어씀
  $('ckSubLessons').style.display = sub === 'lessons' ? 'block' : 'none';
  document.querySelectorAll('#panelCheckin .cl-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === sub);
  });
}

/* v52(2026-09-14) 신규 — 체크인 "문항 관리" 학년 탭 전환. 진행중/지난 문항 목록(#ckqActiveList·
 * #ckqPastList)만 이 학년으로 다시 그린다. v58부터 "새 문항 추가" 폼도 자기 select 없이 이
 * CKQ_GRADE를 그대로 저장 대상 학년으로 쓴다(ckqCollectFormData 참고) — 탭을 바꾸면 새 문항이
 * 저장될 학년도 같이 바뀐다는 뜻이라, 편집 중 탭을 바꾸는 것도 자연스럽게 반영된다. */
function switchCkqGradeTab_(grade){
  CKQ_GRADE = grade;
  document.querySelectorAll('#ckqGradeTabs .cl-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.grade === grade);
  });
  dashRenderCheckinLessonsList();
}

/* ── 공지 관리 (교사) ── */
function dashInitAnnounceForm(){
  const grades = Object.keys(CONFIG.CURRICULUM);
  $('anGrade').innerHTML = '<option value="전체">전체 학년</option>' +
    grades.map(g => `<option value="${g}">${g}학년</option>`).join('');
  dashOnAnnounceTargetChange_();
  // v92 — 담당 학급을 아는 교사는 처음부터 "내 학급에 보이는 공지"만 보이게(건수가 옆에 나와 가려진 건 알 수 있다)
  if(grades.some(g => dashMyBans_(g))) $('anFilterScope').value = 'visible';
  $('anFilterStatus').value = '게시'; // v95 — 보류 공지는 기본으로 접어 두고 "게시중"만 보여 줌(필터에서 바꾸면 그대로 보임)
}

/* v30: "담당 학급반" 대상 라디오가 선택된 상태에서 학년을 바꾸면 힌트 문구(담당 반 목록)도
 * 같이 갱신돼야 하므로 학년 변경 시에도 힌트 갱신 함수를 다시 호출한다. */
function dashOnAnnounceGradeChange_(){
  dashOnAnnounceTargetChange_();
}

/* v30: 대상 라디오 선택에 따라 "개별 반" select 표시 여부와 안내 문구를 갱신.
 * "담당 학급반"은 anGrade에서 고른 학년 기준으로 dashMyBans_()가 담당 반을 돌려줄 때만
 * 쓸 수 있음 — 학년을 "전체 학년"으로 두었거나 그 학년에 트랙(담당 구분) 자체가 없으면
 * 게시 시점에 안내하고 막는다(여기서는 힌트로만 미리 알려줌). */
function dashOnAnnounceTargetChange_(){
  const type = document.querySelector('input[name="anTargetType"]:checked').value;
  $('anBanSingle').style.display = (type === 'one') ? '' : 'none';
  const hint = $('anTargetHint');
  if(type === 'mine'){
    const grade = $('anGrade').value;
    const mine = (grade !== '전체') ? dashMyBans_(grade) : null;
    hint.textContent = mine
      ? `${grade}학년 ${mine.join(',')}반에 게시돼요.`
      : (grade === '전체' ? '학년을 하나 선택해야 담당 학급반을 알 수 있어요.' : '이 학년은 담당 구분이 없어요 — "전체"를 선택해 주세요.');
  } else {
    hint.textContent = '';
  }
}

/* v92 — 공지가 내 학급 대상인지. ban은 '전체' / '5' / '5,6,7,8'. grade가 '전체'면 모든 학년의 내 담당 반을 본다.
 * mode 'visible': 내 반 학생에게 보이는 공지('전체' 대상 포함). 'mine': 반을 직접 지정했고 전부 내 담당 반인 공지. */
function dashAnnounceVisible_(a, mode){
  if(mode === 'all') return true;
  const grades = String(a.grade) === '전체' ? Object.keys(CONFIG.CURRICULUM) : [String(a.grade)];
  const isAll = String(a.ban) === '전체';
  const bans = isAll ? [] : String(a.ban).split(',').map(b => Number(b.trim())).filter(Boolean);
  return grades.some(g => {
    const mine = dashMyBans_(g);
    if(!mine) return false;
    if(mode === 'visible') return isAll || bans.some(b => mine.includes(b));
    return bans.length > 0 && bans.every(b => mine.includes(b));
  });
}

function dashRenderAnnouncements(){
  const list = $('anList');
  if(!ANNOUNCEMENTS_ADMIN.length){
    list.innerHTML = '<p class="empty-hint">등록된 공지가 없어요.</p>';
    $('anFilterCount').textContent = '';
    return;
  }
  const scope = $('anFilterScope').value, status = $('anFilterStatus').value;
  const shown = ANNOUNCEMENTS_ADMIN.filter(a => dashAnnounceVisible_(a, scope) && (!status || a.status === status));
  $('anFilterCount').textContent = `전체 ${ANNOUNCEMENTS_ADMIN.length}건 중 ${shown.length}건`;
  if(!shown.length){
    list.innerHTML = '<p class="empty-hint">조건에 맞는 공지가 없어요.' + (scope !== 'all' && !TEACHER_NAME ? ' (담당 학급을 알 수 없어 "전체 공지"로 봐야 해요.)' : '') + '</p>';
    return;
  }
  const sorted = shown.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  list.innerHTML = sorted.map(a => {
    const live = a.status === '게시';
    // v30: "담당 학급반"으로 게시하면 ban이 "5,6,7,8" 같은 콤마 리스트로 저장됨 — 목록에서는
    // 읽기 좋게 "5·6·7·8반"으로 표시(기존 단일 반·전체 표기는 그대로 유지).
    const banLabel = (a.ban === '전체') ? '전체'
      : String(a.ban).includes(',') ? String(a.ban).split(',').map(b => b.trim()).join('·') + '반'
      : a.ban + '반';
    return `
      <div class="an-item">
        <div>
          <div class="an-meta">${formatDate(a.timestamp)} · ${a.grade}${a.grade==='전체'?'':'학년'} ${banLabel}
            <span class="an-status ${live?'live':'hidden'}">${live?'게시중':'보류'}</span>
          </div>
          <div class="an-text">${escapeHtml(a.content)}</div>
        </div>
        <button class="an-toggle" data-row="${a._row}" onclick="dashToggleAnnouncement(this)">${live?'보류로 전환':'다시 게시'}</button>
      </div>`;
  }).join('');
}

/* v30: 대상 3분류("담당 학급반"/"전체"/"개별 반")를 ban 필드 하나로 환원해서 기존
 * addAnnouncement 액션 그대로 재사용. "담당 학급반"은 dashMyBans_()가 돌려주는 콤마 리스트
 * 문자열(예: "5,6,7,8")을 그대로 ban에 실어 보낸다 — 서버 announcementsGet_이 ban 필드의
 * 콤마 리스트를 parseBanListField_()로 풀어 매칭하도록 함께 바뀌어야 의도대로 동작한다
 * (기존 단일 반·"전체" 공지는 콤마가 없으니 하위 호환 그대로 유지되어야 함). */
async function dashAddAnnouncement(btn){
  const grade = $('anGrade').value;
  const targetType = document.querySelector('input[name="anTargetType"]:checked').value;
  let ban;
  if(targetType === 'all'){
    ban = '전체';
  } else if(targetType === 'one'){
    ban = $('anBanSingle').value;
  } else { // 'mine'
    if(grade === '전체'){ showToast('담당 학급반은 학년을 하나 선택한 뒤 사용해 주세요.'); return; }
    const mine = dashMyBans_(grade);
    if(!mine){ showToast('이 학년은 담당 구분이 없어요 — "전체"를 선택해 주세요.'); return; }
    ban = mine.join(',');
  }
  const content = $('anContent').value.trim();
  if(!content){ showToast('공지 내용을 입력해 주세요.'); return; }
  btn.disabled = true; btn.textContent = '게시하는 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'addAnnouncement', token:TOKEN, grade, ban, content })
    });
    $('anContent').value = '';
    showToast('공지를 게시했어요.');
    await dashLoadData();
    dashRenderAnnouncements();
  }catch(e){
    showToast('게시하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '게시';
  }
}

async function dashToggleAnnouncement(btn){
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'toggleAnnouncement', token:TOKEN, row })
    });
    const a = ANNOUNCEMENTS_ADMIN.find(x => String(x._row) === String(row));
    if(a){ a.status = (a.status === '게시') ? '보류' : '게시'; }
    dashRenderAnnouncements();
  }catch(e){
    showToast('처리하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false;
  }
}

/* ── 커리큘럼 관리 (교사) ── */
function dashInitCurriculumForm(){
  const grades = Object.keys(GRADE_INFO_ADMIN);
  $('clGrade').innerHTML = grades.map(g => `<option value="${g}">${g}학년</option>`).join('');
  // v29: "담당" 기본값을 로그인한 교사 이름으로 — 수동으로 매번 고를 필요 없이, 내가
  // 만드는 활동은 기본으로 내 반 것으로 잡히고, 공통으로 등록하려면 직접 바꾸면 됨.
  if(TEACHER_NAME) $('clOwner').value = TEACHER_NAME;
  clRefreshOwnerHint();
  clRefreshBadgeNameOptions(); // v24 — 데이터 로드 후 최신 BADGE_NAME_POOL로 초기 상태 맞춤
}

/* v80 — 학년 전환(2학년/3학년). 학년정보 폼과 등록된 활동 목록이 같은 학년을 보여준다.
 * 두 학년 블록을 모두 그려 두고 숨김만 바꿔서, 다른 학년으로 넘어가도 입력 중인 내용이 지워지지 않는다. */
let CL_GRADE = null;
function clGradeList_(){
  const set = new Set([...Object.keys(GRADE_INFO_ADMIN), ...LESSONS_ADMIN.map(l => String(l.grade))]);
  return [...set].filter(Boolean).sort();
}
function clCurGrade_(){
  const grades = clGradeList_();
  if(!grades.includes(CL_GRADE)) CL_GRADE = grades[0] || null;
  return CL_GRADE;
}
function clRenderGradeSeg_(){
  const wrap = $('clGradeSeg');
  if(!wrap) return;
  const grades = clGradeList_();
  const cur = clCurGrade_();
  wrap.style.display = grades.length > 1 ? 'flex' : 'none';
  wrap.innerHTML = grades.map(g => {
    const subj = (GRADE_INFO_ADMIN[g] && GRADE_INFO_ADMIN[g].subject) || '';
    const n = LESSONS_ADMIN.filter(l => String(l.grade) === g).length;
    return `<button type="button" class="grade-seg-btn ${g === cur ? 'active' : ''}" role="tab" aria-selected="${g === cur}" onclick="clSetGrade_('${g}')">
      <b>${g}학년</b> ${escapeHtml(subj)}<span class="grade-seg-count">${n}개 활동</span></button>`;
  }).join('');
}
function clSetGrade_(g){
  CL_GRADE = g;
  clRenderGradeSeg_();
  document.querySelectorAll('#giForm .gi-block, #clList .cl-grade-group').forEach(el => {
    el.style.display = el.dataset.grade === g ? '' : 'none';
  });
  // "새 활동 추가" 폼의 학년도 맞춰 둔다(직접 바꿀 수도 있음)
  const sel = $('clGrade');
  if(sel && [...sel.options].some(o => o.value === g) && sel.value !== g){
    sel.value = g; sel.dispatchEvent(new Event('change'));
  }
}

function giLinkCardHtml_(icon, name, key, title, desc, url, titlePh){
  const on = !!String(url || '').trim();
  return `
    <div class="gi-link-card">
      <div class="gi-link-head">
        <span class="gi-link-ico" aria-hidden="true">${icon}</span>
        <b>${name}</b>
        <span class="gi-pill ${on ? 'on' : ''}">${on ? '학생에게 보임' : '링크 없음 · 숨김'}</span>
      </div>
      <label>제목<input type="text" class="gi-${key}-title" placeholder="${titlePh}" value="${escapeHtml(title || '')}"></label>
      <label>설명<input type="text" class="gi-${key}-desc" placeholder="한 줄 안내 (선택)" value="${escapeHtml(desc || '')}"></label>
      <label>링크<textarea class="gi-${key}-url" placeholder="https://…  (반마다 다르면 5:https://… 처럼 한 줄에 하나)">${escapeHtml(url || '')}</textarea></label>
    </div>`;
}
function giBlockHtml_(g){
  const gi = GRADE_INFO_ADMIN[g];
  const trackConfigured = (gi.hyoBansText || '').trim() || (gi.mihyunBansText || '').trim();
  return `
      <div class="gi-block" data-grade="${g}" style="${g === clCurGrade_() ? '' : 'display:none;'}">
        <div class="gi-head"><h4>${g}학년 ${escapeHtml(gi.subject || '')}</h4><span class="gi-sub">학생 포털에 보이는 정보예요</span></div>
        <section class="gi-sec">
          <p class="gi-sec-title">단원 관통 질문</p>
          <textarea class="gi-uq" placeholder="학생 포털 상단 배너에 보이는 질문">${escapeHtml(gi.unitQuestion || '')}</textarea>
        </section>
        <section class="gi-sec">
          <p class="gi-sec-title">학생 화면 링크 카드</p>
          <p class="gi-sec-hint">학습 연표 위 탭으로 보여요. 링크를 비워 두면 그 탭은 학생에게 안 보여요.</p>
          <div class="gi-link-grid">
            ${giLinkCardHtml_('📝', '패들렛(포트폴리오)', 'pf', gi.portfolioTitle, gi.portfolioDesc, gi.portfolioUrlText, '나의 패들렛')}
            ${giLinkCardHtml_('🃏', '복습용 클래스카드', 'cc', gi.classcardTitle, gi.classcardDesc, gi.classcardUrlText, '복습용 클래스카드')}
            ${giLinkCardHtml_('📖', '시험범위 교과서', 'tb', gi.textbookTitle, gi.textbookDesc, gi.textbookUrlText, '시험범위 교과서')}
          </div>
        </section>
        <section class="gi-sec">
          <p class="gi-sec-title">담당 반</p>
          <div class="gi-two">
            <label>효니 담당 반<input type="text" class="gi-hyo-bans" placeholder="예: 1,2,3,4" value="${escapeHtml(gi.hyoBansText || '')}"></label>
            <label>미현쌤 담당 반<input type="text" class="gi-mihyun-bans" placeholder="예: 5,6,7,8" value="${escapeHtml(gi.mihyunBansText || '')}"></label>
          </div>
          <p class="gi-sec-hint">쉼표로 구분해요. 커리큘럼에서 담당을 효니/미현쌤으로 지정한 차시는 그 반에만 보여요.</p>
          ${!trackConfigured ? '<p class="cl-hint">⚠️ 아직 비어있어요 — 이 상태에서 커리큘럼 "담당"을 효니/미현쌤으로 지정하면 그 차시는 <b>아무 반에도 안 보여요</b>. 담당을 나누려면 여기부터 채워야 해요.</p>' : ''}
        </section>
        <div class="gi-save-bar"><button onclick="dashSaveGradeInfo('${g}', this)">${g}학년 정보 저장</button></div>
      </div>`;
}
/* grade를 주면 그 학년 블록만 다시 그린다(저장 직후 — 다른 학년 블록의 입력 중인 내용을 지우지 않으려고). */
function dashRenderGradeInfoForm(grade){
  const wrap = $('giForm');
  clRenderGradeSeg_();
  const grades = Object.keys(GRADE_INFO_ADMIN).sort();
  if(!grades.length){
    wrap.innerHTML = '<p class="empty-hint">학년정보가 아직 없어요. (마이그레이션이 필요할 수 있어요)</p>';
    return;
  }
  const old = grade && wrap.querySelector(`.gi-block[data-grade="${grade}"]`);
  if(old){ old.outerHTML = giBlockHtml_(grade); return; }
  wrap.innerHTML = grades.map(giBlockHtml_).join('');
}

async function dashSaveGradeInfo(grade, btn){
  const block = btn.closest('.gi-block');
  const payload = {
    action: 'updateGradeInfo', token: TOKEN, grade,
    subject: (GRADE_INFO_ADMIN[grade] && GRADE_INFO_ADMIN[grade].subject) || '',
    unitQuestion: block.querySelector('.gi-uq').value.trim(),
    portfolioTitle: block.querySelector('.gi-pf-title').value.trim(),
    portfolioDesc: block.querySelector('.gi-pf-desc').value.trim(),
    portfolioUrlText: block.querySelector('.gi-pf-url').value.trim(),
    classcardTitle: block.querySelector('.gi-cc-title').value.trim(),   // v45
    classcardDesc: block.querySelector('.gi-cc-desc').value.trim(),     // v45
    classcardUrlText: block.querySelector('.gi-cc-url').value.trim(),   // v45
    textbookTitle: block.querySelector('.gi-tb-title').value.trim(),   // v79
    textbookDesc: block.querySelector('.gi-tb-desc').value.trim(),     // v79
    textbookUrlText: block.querySelector('.gi-tb-url').value.trim(),   // v79
    hyoBans: block.querySelector('.gi-hyo-bans').value.trim(),       // v28
    mihyunBans: block.querySelector('.gi-mihyun-bans').value.trim() // v28
  };
  const btnLabel = btn.textContent;
  btn.disabled = true; btn.textContent = '저장하는 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, { method:'POST', body: JSON.stringify(payload) });
    Object.assign(GRADE_INFO_ADMIN[grade], {
      unitQuestion: payload.unitQuestion, portfolioTitle: payload.portfolioTitle,
      portfolioDesc: payload.portfolioDesc, portfolioUrlText: payload.portfolioUrlText,
      classcardTitle: payload.classcardTitle, classcardDesc: payload.classcardDesc,
      classcardUrlText: payload.classcardUrlText,
      textbookTitle: payload.textbookTitle, textbookDesc: payload.textbookDesc,
      textbookUrlText: payload.textbookUrlText,
      hyoBansText: payload.hyoBans, mihyunBansText: payload.mihyunBans
    });
    showToast(`${grade}학년 정보를 저장했어요. 학생 화면엔 다음 새로고침부터 반영돼요.`);
    dashRenderGradeInfoForm(grade); // v80 — 그 학년 블록만 새로 그림(다른 학년 입력 중인 내용 보존)
  }catch(e){
    showToast('저장하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = btnLabel;
  }
}

/* ── 웰컴 체크인 (교사) — 핸드오프_웰컴체크인_v2 2-3, 2-4 + v16: 반별 차시 ──
 * checkin_data.js가 없으면 패널을 조용히 비활성 안내로 대체 (다른 탭엔 영향 없음).
 * v16: 체크인설정이 (학년,반)당 1행으로 바뀜 — 반="전체"는 그 학년 공통,
 * 특정 반 행이 있으면 그 반에서는 그게 우선(백엔드 checkinTodayGet_와 동일 규칙). */
let CK_TODAY_LESSON = {}; // "grade-ban" → 오늘 설정된 lessonId (recall 조회용 캐시. ckFetchTodayLessonId_가 채움)
const CHECKIN_LOW_TEMP_DISPLAY = 2; // 온도 분포 막대에서 "저온도"로 강조할 기준값 (백엔드 CHECKIN_LOW_TEMP와 동일하게 맞춤)
/* v56 — 체크인 탭 관리 데이터(학년×반 조합마다 mode=checkinToday를 따로 쏘는 요약표 포함,
 * 총 10개 안팎의 GAS 요청)를 대시보드 진입 때마다 무조건 병렬로 쏘던 걸 "체크인" 탭을
 * 실제로 열 때 1회만 불러오도록 미룸. dashLoadData()의 6개 요청과 겹쳐 한 번에 15~20개
 * 요청이 몰리면서 GAS 쪽 동시 실행 한도에 걸려 일부가 404 나고 대시보드 전체 체감 속도도
 * 느려졌던 문제였음(다른 탭은 이 데이터를 참조하지 않아 미뤄도 안전). */
let CK_ADMIN_LOADED = false;

/* v40 — config.js BAN_SIZE에서 인원수가 채워진(=실제 수업 맡은) 반만 뽑아낸다.
 * 학번체계상 2학년(1~4반)/3학년(5~8반)이 겹치지 않는다는 전제(핸드오프 "체크인 대시보드:
 * 반별 요약 테이블 + 2단 배치")를 그대로 반영 — 담당 학년이 바뀌면 config.js의 BAN_SIZE 표만
 * 고치면 이 표·2단 배치도 자동으로 따라온다. */
function dashTeachingBans_(grade){
  const sizes = CONFIG.BAN_SIZE && CONFIG.BAN_SIZE[grade];
  if(!sizes) return [];
  return Object.keys(sizes).map(Number).filter(b => sizes[b] > 0).sort((a,b) => a - b);
}
/* v40 — 담당 반이 있는(=실제로 보여줄) 학년 목록. CHECKIN_PLAN에 학년이 있어도
 * BAN_SIZE가 비어 있으면(담당 학급 없음) 요약 표·통계 컬럼 둘 다에서 제외한다. */
function dashCheckinGrades_(){
  return Object.keys(CHECKIN_PLAN || {}).filter(g => dashTeachingBans_(g).length > 0)
    .sort((a,b) => Number(a) - Number(b));
}
/* v40 — "오늘의 체크인 차시" 조회를 캐시까지 포함해 한 곳으로 모음(요약 표·통계 컬럼의
 * 회수 질문 조회가 같은 (학년,반) 조합을 중복 요청하지 않도록). dashLoadCkSetCurrent()는
 * "설정 편집" 폼용이라 항상 최신값이 필요해 이 캐시를 거치지 않고 직접 조회한다. */
const CK_TODAY_PENDING = {}; // v111: 키별 진행 중 조회(요약 렌더가 동시에 여러 번 돌아도 GAS 요청은 한 번만)
async function ckFetchTodayLessonId_(grade, ban){
  const cacheKey = grade + '-' + ban;
  if(CK_TODAY_LESSON[cacheKey] !== undefined) return CK_TODAY_LESSON[cacheKey];
  if(CK_TODAY_PENDING[cacheKey]) return CK_TODAY_PENDING[cacheKey];
  const p = (async () => {
    try{
      const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL
        + '?mode=checkinToday&grade=' + encodeURIComponent(grade) + '&ban=' + encodeURIComponent(ban)
        + '&token=' + encodeURIComponent(TOKEN)); // v110: v83 로그인 게이트가 token 없는 조회를 막아 요약표가 전부 «감정 체크인(기본)»으로 보였다
      const lessonId = (data.result === 'success') ? (data.lessonId || '') : '';
      if(CK_TODAY_LESSON[cacheKey] === undefined) CK_TODAY_LESSON[cacheKey] = lessonId; // v111: 조회 중에 «적용»으로 새 값이 들어갔으면 옛 응답으로 덮지 않는다
      return CK_TODAY_LESSON[cacheKey];
    }catch(e){
      return '';
    }finally{
      delete CK_TODAY_PENDING[cacheKey];
    }
  })();
  CK_TODAY_PENDING[cacheKey] = p;
  return p;
}

async function dashInitCheckinForm(){
  await loadCheckinPlan(); // 대시보드 들어올 때마다 시트에서 최신 문항으로 새로고침
  if(!CHECKIN_PLAN){
    $('panelCheckin').innerHTML = '<p style="color:var(--ink-soft); padding:16px;">체크인문항 시트를 불러오지 못했어요. 새로고침해 주세요.</p>';
    return;
  }
  const grades = Object.keys(CHECKIN_PLAN);
  $('ckSetGrade').innerHTML = grades.map(g => `<option value="${g}">${g}학년</option>`).join('');
  // v58 — "새 문항 추가" 폼 안에 있던 ckqFormGrade select를 제거. 위 학년 탭(ckqGradeTabs)이
  // 이미 같은 값을 고르게 해주는데 폼 안에 똑같은 select가 하나 더 있는 게 중복이었음 — 이제
  // 새 문항은 항상 지금 선택된 CKQ_GRADE로 저장된다(ckqCollectFormData 참고).
  // v52 — 학년 선택을 select 대신 탭으로. 처음 들어올 때만 CKQ_GRADE를 첫 학년으로 초기화하고,
  // 이미 고른 탭이 여전히 유효한 학년이면(문항 관리 탭을 여러 번 드나들 때) 유지한다.
  if(!CKQ_GRADE || !grades.includes(CKQ_GRADE)) CKQ_GRADE = grades[0] || '';
  $('ckqGradeTabs').innerHTML = grades.map(g =>
    `<button type="button" class="cl-subtab${g === CKQ_GRADE ? ' active' : ''}" data-grade="${g}" onclick="switchCkqGradeTab_('${g}')">${g}학년</button>`
  ).join('');
  document.querySelectorAll('#panelCheckin details[data-fold]').forEach(dashFoldInit_); // v111
  dashRefreshCkSetLessons();
  dashOnCkSetTargetChange_();
  dashRenderCkSummaryTable_();
  dashRenderCkStatColumns_();
  await dashLoadCheckinLessonsAdmin();
  dashRenderCheckinLessonsList();
  dashRefreshCkSetLessons(); // v55 — CHECKIN_LESSONS_ADMIN(isPast)이 이제 막 채워졌으니 다시 걸러서 그림
}

/* v111 — 요약 표를 «반 카드»로 바꿨다. 카드마다 오늘 차시(수업=초록 칩, 기본 감정=회색 칩) + 출처 + 응답 n/총원 + 연속 저온도 + «바꾸기».
 * 응답 수·저온도는 dashLoadCheckinAdmin이 CK_ROWS(학년→오늘 응답, 학생당 최신 1건)에 담아 두면 거기서 읽는다(추가 fetch 없음).
 * v112부터 담당 반(BAN_SIZE)만 보여 준다(다른 선생님 반은 카드·알림·팝업·응답 상세에서 뺀다).
 * 연속 저온도는 교사 전용 값(lowStreakAlert)이라 학생 화면과 무관하다. */
let CK_ROWS = {};
let CK_SUM_SEQ = 0;
function ckBanKey_(grade, ban){ return String(grade) + String(ban).padStart(2, '0'); }
function ckRowsOfBan_(grade, ban){
  return (CK_ROWS[grade] || []).filter(r => String(r.studentId).slice(0, 3) === ckBanKey_(grade, ban));
}
/* v112: 담당 반(BAN_SIZE>0)만 본다 — 다른 선생님 반 학생은 카드·알림·팝업에 넣지 않는다. */
function ckMineRows_(grade){
  const mine = dashTeachingBans_(grade).map(b => ckBanKey_(grade, b));
  return (CK_ROWS[grade] || []).filter(r => mine.includes(String(r.studentId).slice(0, 3)));
}
function ckLowRows_(grade, ban){
  return ckMineRows_(grade).filter(r => r.lowStreakAlert && (!ban || String(r.studentId).slice(0, 3) === ckBanKey_(grade, ban)));
}
async function dashRenderCkSummaryTable_(){
  const box = $('ckSummaryTables');
  const grades = dashCheckinGrades_();
  if(!grades.length){
    box.innerHTML = '<p class="muted">담당 반 정보(config.js의 BAN_SIZE)가 없어요.</p>';
    $('ckAlertBox').innerHTML = '';
    return;
  }
  const seq = ++CK_SUM_SEQ;
  /* v115: 카드를 먼저 그려 두고(차시는 «확인 중…»), 반마다 차시 조회가 끝나는 대로 그 칩만 채운다.
   * 예전엔 학년×(전체+반) 10여 개 요청이 전부 끝날 때까지 «불러오는 중…» 한 줄이었고, 전체→반 순서로 직렬이라 두 배 걸렸다. */
  let settled = false; // 모든 차시 조회가 끝났는데도 값이 없으면 조회 실패
  const paint = () => {
    if(seq !== CK_SUM_SEQ) return; // 더 새 렌더가 이미 시작됨
    let lowTotal = 0;
    box.innerHTML = grades.map(grade => {
      const allLessonId = CK_TODAY_LESSON[grade + '-전체'];
      const cards = dashTeachingBans_(grade).map(ban => { // v112: 내가 맡은 반만
        const lessonId = CK_TODAY_LESSON[grade + '-' + ban]; // undefined = 아직 조회 중(또는 실패)
        const known = lessonId !== undefined;
        const lesson = lessonId ? (CHECKIN_PLAN[grade].lessons || []).find(l => l.id === lessonId) : null;
        const chip = !known
          ? `<span class="ck-chip is-default">${settled ? '차시를 불러오지 못했어요' : '차시 확인 중…'}</span>`
          : lesson
            ? `<span class="ck-chip is-lesson">${escapeHtml(lesson.topic)}</span>`
            : '<span class="ck-chip is-default">감정 체크인 (기본)</span>'; // v88: 미지정 = 기본 감정 체크인
        const src = !known || allLessonId === undefined ? ''
          : (lessonId !== allLessonId ? '<span class="ck-src-tag override">반별 지정</span>' : '<span class="ck-src-tag">전체 설정</span>');
        const total = CONFIG.BAN_SIZE[grade][ban];
        const done = CK_ROWS[grade] ? ckRowsOfBan_(grade, ban).length : null; // null = 아직 안 불러옴
        const pct = (total && done !== null) ? Math.min(100, Math.round(done / total * 100)) : 0;
        const prog = done === null ? '응답 불러오는 중…' : (total ? `<b>${done}</b> / ${total}명 응답` : `<b>${done}</b>명 응답`);
        const low = CK_ROWS[grade] ? ckLowRows_(grade, ban).length : 0;
        lowTotal += low;
        const lowBtn = low
          ? `<button type="button" class="ck-low-btn" title="최근 3회 연속 저온도 — 누르면 명단이 열려요" onclick="ckLowOpen_('${grade}','${ban}')">⚠ 저온도 ${low}명</button>` : '';
        return `
          <div class="ck-card">
            <div class="ck-card-head"><span class="ck-card-ban">${ban}반</span>${src}</div>
            ${chip}
            <div class="ck-prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
            <div class="ck-card-meta">${prog}</div>
            <div class="ck-card-actions">${lowBtn}<button type="button" class="btn btn-ghost btn-sm" onclick="ckEditFromCard_('${grade}','${ban}')">바꾸기</button></div>
          </div>`;
      }).join('');
      return `<p class="ck-grade-title">${grade}학년</p><div class="ck-cards">${cards}</div>`;
    }).join('');
    $('ckAlertBox').innerHTML = lowTotal
      ? `<div class="ck-alert"><span><b>⚠ 최근 3회 연속 저온도 ${lowTotal}명</b> — 오늘 응답 기준, 선생님만 보는 값이에요.</span><button type="button" class="btn btn-ghost btn-sm" onclick="ckLowOpen_('','')">명단 보기</button></div>`
      : '';
  };
  try{
    paint();
    const jobs = [];
    grades.forEach(grade => ['전체'].concat(dashTeachingBans_(grade).map(String)).forEach(b => jobs.push(ckFetchTodayLessonId_(grade, b).then(paint)))); // v115: 전체·반 조회를 한꺼번에(직렬 아님)
    await Promise.all(jobs);
    settled = true;
    paint();
  }catch(e){
    box.innerHTML = '<p class="muted">요약을 불러오지 못했어요: ' + escapeHtml(e.message) + '</p>';
  }
}

/* v111 — 카드의 «바꾸기»: 아래 «오늘의 체크인 차시 설정» 폼을 그 학년·반(개별 반)·현재 차시로 채우고 폼으로 스크롤한다.
 * 쓰기는 하지 않는다(눌러야 하는 건 기존 «적용» 버튼 — token 처리는 dashApplyCkSet 그대로). */
function ckEditFromCard_(grade, ban){
  /* 반 목록(ckSetBanOne)은 1~8반 고정이라 그 밖의 반이면 폼을 건드리지 않는다 — 건드리면 이전에 골라 둔 다른 반에 적용될 수 있다. */
  if(!$('ckSetGrade').querySelector('option[value="' + grade + '"]') || !$('ckSetBanOne').querySelector('option[value="' + ban + '"]')){
    showToast(grade + '학년 ' + ban + '반은 설정 목록에 없어요.');
    return;
  }
  $('ckSetGrade').value = grade;
  dashRefreshCkSetLessons();
  document.querySelector('input[name="ckSetTargetType"][value="one"]').checked = true;
  $('ckSetBanOne').value = ban;
  const cur = CK_TODAY_LESSON[grade + '-' + ban];
  const want = cur || (typeof CHECKIN_EMOTION !== 'undefined' ? CHECKIN_EMOTION.id : '');
  const lessonFilled = !!want && [...$('ckSetLesson').options].some(o => o.value === want);
  if(lessonFilled) $('ckSetLesson').value = want;
  dashOnCkSetTargetChange_();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('ckSetCard').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  $('ckSetLesson').focus({ preventScroll: true });
  showToast(lessonFilled
    ? grade + '학년 ' + ban + '반 설정으로 맞췄어요. 차시를 고르고 «적용»을 눌러요.'
    : grade + '학년 ' + ban + '반으로 맞췄어요. 현재 차시가 목록에 없어서 차시는 직접 골라야 해요.');
}

/* v111 — 연속 저온도 명단 팝업(v107 perfModalOpen_ 재사용, 읽기 전용이라 PREVIEW_MODE 가드 불필요). grade ''면 전체 학년, ban ''면 그 학년 전체 반. */
function ckLowGroups_(grade, ban){
  const g = {};
  (grade ? [grade] : dashCheckinGrades_()).forEach(gr => ckLowRows_(gr, ban).forEach(r => {
    const k = String(r.studentId).slice(0, 3);
    (g[k] = g[k] || []).push(r);
  }));
  Object.keys(g).forEach(k => g[k].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId))));
  return g;
}
function ckLowOpen_(grade, ban){
  const g = ckLowGroups_(grade, ban), keys = Object.keys(g).sort();
  const total = keys.reduce((n, k) => n + g[k].length, 0);
  const title = (grade && ban ? grade + '학년 ' + ban + '반 ' : '') + '연속 저온도 학생 ' + total + '명';
  if(!total){ perfModalOpen_(title, '', '<p class="dash-hint">오늘 응답 기준으로 해당하는 학생이 없어요.</p>'); return; }
  const body = '<p class="dash-hint">오늘 체크인에 응답한 학생 중, 가장 최근 기록부터 3회 연속 온도가 낮았던 학생이에요(선생님만 보는 값 — 학생 화면엔 나오지 않아요).</p>'
    + '<div class="perf-none-actions"><button type="button" class="perf-askbtn" onclick="ckLowCopy_(\'' + grade + '\',\'' + ban + '\')">📋 명단 복사</button>'
    + '<button type="button" class="perf-askbtn" onclick="ckLowRefresh_(\'' + grade + '\',\'' + ban + '\')">↻ 새로고침</button></div>'
    + keys.map(k => '<details class="perf-grp perf-none-grp" open><summary>' + perfBanName_(k) + ' <span class="perf-none-cnt">' + g[k].length + '명</span></summary>'
      + '<div class="perf-asklist perf-none-list">' + g[k].map(r => '<span class="perf-none-chip">' + escapeHtml(Number(String(r.studentId).slice(3)) + '번 ' + r.studentName + ' · 온도 ' + r.temperature) + '</span>').join('') + '</div></details>').join('');
  perfModalOpen_(title, '웰컴 체크인', body);
}
async function ckLowCopy_(grade, ban){
  const g = ckLowGroups_(grade, ban), keys = Object.keys(g).sort();
  const lines = keys.map(k => perfBanName_(k) + ' (' + g[k].length + '명): ' + g[k].map(r => r.studentName).join(', '));
  try{ await navigator.clipboard.writeText('체크인 — 최근 3회 연속 저온도 학생\n' + lines.join('\n')); showToast('명단을 복사했어요.'); }
  catch(e){ showToast('복사에 실패했어요.'); }
}
async function ckLowRefresh_(grade, ban){
  await Promise.all((grade ? [grade] : dashCheckinGrades_()).map(g => dashLoadCheckinAdmin(g)));
  ckLowOpen_(grade, ban);
}

/* v40 — 학년별 2단 독립 배치. 담당 반 번호가 학년마다 겹치지 않아(2학년 1~4반/3학년 5~8반)
 * 반 선택을 좌우가 공유할 수 없어서, 컬럼마다 학년을 고정하고 반 select·새로고침·통계를
 * 통째로 따로 둔다(완전 독립형). 컬럼 DOM은 여기서 학년마다 동적으로 만들어지므로, 그 안의
 * select/버튼 리스너는 정적 addEventListener 대신 #ckStatCols에 이벤트 위임으로 붙인다. */
function dashRenderCkStatColumns_(){
  const grades = dashCheckinGrades_();
  $('ckStatCols').innerHTML = grades.map(grade => `
    <div class="dash-card ck-stat-col">
      <div class="cl-row ck-stat-head">
        <span class="ck-stat-grade">${grade}학년</span>
        <select id="ckViewBan_${grade}"></select>
        <button class="btn btn-ghost btn-sm" id="btnCkViewRefresh_${grade}">새로고침</button>
      </div>
      <p id="ckRecall_${grade}" style="display:none; font-size:.9rem; background:rgba(46,74,122,.06); border-left:3px solid var(--indigo); border-radius:8px; padding:10px 14px; margin-bottom:12px;"></p>
      <p id="ckCounter_${grade}" style="font-weight:700; margin-bottom:10px;"></p>
      <div id="ckStats_${grade}"></div>
      <div id="ckList_${grade}"></div>
    </div>`).join('');
  grades.forEach(grade => { dashRefreshCkViewBans(grade); dashLoadCheckinAdmin(grade); });
}

/* v55 — "오늘의 체크인 차시 설정" 드롭다운은 학생용 mode=checkinPlan(CHECKIN_PLAN, isPast 필드
 * 없음)을 그대로 나열해왔다 — 문항 관리 탭에서 "지난 체크인으로 표시"한 문항도 이 목록엔 계속
 * 남아 오늘의 체크인으로 잘못 지정될 수 있었다. CHECKIN_LESSONS_ADMIN(교사용, isPast 있음)과
 * 같은 (학년,id) 기준으로 대조해서 지난 체크인은 목록에서 뺀다. */
function dashRefreshCkSetLessons(){
  const grade = $('ckSetGrade').value;
  const lessons = (CHECKIN_PLAN[grade] && CHECKIN_PLAN[grade].lessons) || [];
  const pastIds = new Set(CHECKIN_LESSONS_ADMIN.filter(l => l.grade === grade && l.isPast).map(l => l.id));
  const visible = lessons.filter(l => !pastIds.has(l.id));
  /* v88: 맨 위에 기본 '감정 체크인'을 둔다 — 수업 체크인을 걸었다가 다시 기본으로 돌아올 때 이걸 적용한다. */
  const emoOpt = (typeof CHECKIN_EMOTION !== 'undefined')
    ? `<option value="${escapeHtml(CHECKIN_EMOTION.id)}">${escapeHtml(CHECKIN_EMOTION.label)}</option>` : '';
  $('ckSetLesson').innerHTML = emoOpt + visible.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.topic)}</option>`).join('');
}

/* v41 — "체크인 차시 적용 대상" 라디오 3분류(담당 학급반/전체/개별 반)에 따라
 * ckSetBanOne select 표시 여부를 바꾸고, "현재 설정" 문구를 갱신한다.
 * "담당 학급반"은 여러 반을 한 번에 가리키는 값이라 단일 lessonId로 나타낼 수 없어서
 * (반마다 값이 다를 수 있음) 위 "반별 오늘의 체크인 차시 요약" 표를 보라고 안내만 한다. */
function dashOnCkSetTargetChange_(){
  const type = document.querySelector('input[name="ckSetTargetType"]:checked').value;
  $('ckSetBanOne').style.display = (type === 'one') ? '' : 'none';
  if(type === 'mine'){
    const grade = $('ckSetGrade').value;
    const mine = dashMyBans_(grade);
    $('ckSetCurrent').textContent = mine
      ? `적용하면 ${grade}학년 담당 반(${mine.join(',')}반) 전체에 각각 따로 지정돼요. 반별 현재 값은 위 반 카드를 확인하세요.`
      : '이 학년은 담당 반 트랙이 설정돼 있지 않아요 — "전체"나 "개별 반"을 선택해 주세요.';
  } else {
    dashLoadCkSetCurrent();
  }
}

/* v41: "전체"·"개별 반" 모드에서만 쓰임 — 이 두 모드는 (학년,반) 하나에 대응하는 단일
 * lessonId가 실제로 존재하므로 조회해서 보여줄 수 있다. */
async function dashLoadCkSetCurrent(){
  const grade = $('ckSetGrade').value;
  const type = document.querySelector('input[name="ckSetTargetType"]:checked').value;
  const ban = (type === 'all') ? '전체' : $('ckSetBanOne').value;
  if(!grade) return;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL
      + '?mode=checkinToday&grade=' + encodeURIComponent(grade) + '&ban=' + encodeURIComponent(ban)
      + '&token=' + encodeURIComponent(TOKEN)); // v110: 같은 이유(교사 token으로 게이트 통과)
    const data = await res.json();
    if(data.result === 'success'){
      CK_TODAY_LESSON[grade + '-' + ban] = data.lessonId || '';
      if(data.lessonId) $('ckSetLesson').value = data.lessonId;
      const lesson = (CHECKIN_PLAN[grade].lessons || []).find(l => l.id === data.lessonId);
      const scope = ban === '전체' ? '전체 반' : (ban + '반');
      $('ckSetCurrent').textContent = lesson
        ? `현재 설정(${scope}): ${lesson.topic}`
        : `현재 설정(${scope}): 감정 체크인 (기본) — 수업 체크인을 고르면 그걸로 바뀌어요.`;
    }
  }catch(e){
    $('ckSetCurrent').textContent = '현재 설정을 불러오지 못했어요.';
  }
}

/* v41 — "담당 학급반"은 백엔드에 콤마 리스트를 한 번에 보내는 방식(공지 관리 v30) 대신,
 * 이미 검증된 단일 (학년,반) 저장 방식(setTodayCheckin)을 담당 반 개수만큼 반복 호출한다.
 * 체크인설정 시트가 "(학년,반)당 1행" 구조라는 것만 확인돼 있고, checkinTodayGet_이 ban
 * 필드의 콤마 리스트도 풀어 읽는지는 이 저장소에서 알 수 없어서(체크인 백엔드는 이 저장소에
 * 없음) — 새 파싱 지원을 가정하지 않는 쪽을 택함. */
async function dashApplyCkSet(){
  const grade = $('ckSetGrade').value;
  const type = document.querySelector('input[name="ckSetTargetType"]:checked').value;
  const lessonId = $('ckSetLesson').value;
  if(!lessonId){ showToast('차시를 먼저 골라 주세요.'); return; }

  let bans, scopeLabel;
  if(type === 'all'){
    /* v95 — 반별 지정이 있으면 그 반은 "전체" 값보다 우선이라 학년 공통을 걸어도 안 바뀌었다.
     * "전체"를 적용할 땐 이 학년 담당 반에도 같은 값을 같이 저장해 반별 지정을 덮어쓴다. */
    bans = ['전체'].concat(dashTeachingBans_(grade).map(String)); scopeLabel = '전체 반(반별 지정 포함)';
  } else if(type === 'one'){
    const ban = $('ckSetBanOne').value;
    bans = [ban]; scopeLabel = ban + '반';
  } else { // 'mine'
    const mine = dashMyBans_(grade);
    if(!mine || !mine.length){ showToast('이 학년은 담당 반 트랙이 설정돼 있지 않아요 — "전체"나 "개별 반"을 선택해 주세요.'); return; }
    bans = mine.map(String); scopeLabel = `담당 반(${bans.join(',')}반)`;
  }

  const btn = $('btnCkSetApply');
  btn.disabled = true; btn.textContent = '적용 중…';
  try{
    await Promise.all(bans.map(ban => fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'setTodayCheckin', token:TOKEN, grade, ban, lessonId })
    })));
    bans.forEach(ban => { CK_TODAY_LESSON[grade + '-' + ban] = lessonId; });
    showToast(scopeLabel + ' 오늘의 체크인 차시를 저장했어요.');
    dashOnCkSetTargetChange_(); // "현재 설정" 문구 갱신(담당 학급반이면 안내 문구, 아니면 재조회)
    dashRenderCkSummaryTable_(); // v40: 요약 표도 즉시 갱신 — 이 설정이 어느 범위든 반영됨
    if($('ckViewBan_' + grade)) dashLoadCheckinAdmin(grade); // v40: 그 학년 컬럼이 떠 있으면 회수 질문도 갱신
  }catch(e){
    showToast('저장하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '적용';
  }
}

/* v40: 컬럼마다 학년이 고정이라 grade를 인자로 받음(과거엔 ckViewGrade select 값이었음). */
function dashRefreshCkViewBans(grade){
  /* v113: 내가 맡은 반(BAN_SIZE>0)만 고른다 — 학생 기록(ROWS)에 있다고 다른 선생님 반을 넣지 않는다(카드·응답 상세 집계와 같은 기준). */
  const bans = dashTeachingBans_(grade);
  $('ckViewBan_' + grade).innerHTML = '<option value="">전체 반</option>'
    + bans.map(b => `<option value="${b}">${b}반</option>`).join('');
}

/* v40: grade를 인자로 받아 그 학년 컬럼(ckViewBan_/ckRecall_/ckCounter_/ckStats_/ckList_)만
 * 갱신한다 — 좌우 컬럼이 서로 독립이라 한쪽을 새로고침해도 다른 쪽엔 영향 없음. */
async function dashLoadCheckinAdmin(grade){
  if(!grade) return;
  $('ckList_' + grade).innerHTML = '<p class="muted">불러오는 중…</p>';
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL
      + '?mode=checkinAdmin&token=' + encodeURIComponent(TOKEN) + '&grade=' + encodeURIComponent(grade));
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    let rows = data.rows || [];
    /* v111: 반 카드(응답 수·연속 저온도)가 읽는 캐시 — 반 필터 전, 학생당 최신 1건으로 걸러 담는다. */
    const latestAll = {};
    rows.forEach(r => {
      const prev = latestAll[r.studentId];
      if(!prev || new Date(r.timestamp) >= new Date(prev.timestamp)) latestAll[r.studentId] = r;
    });
    CK_ROWS[grade] = Object.values(latestAll);
    dashRenderCkSummaryTable_();
    const ban = $('ckViewBan_' + grade).value; // '' = 전체 반 보기
    if(ban) rows = rows.filter(r => { const p = parseStudentId(String(r.studentId)); return p && p.ban === Number(ban); });
    else{ // v112: «전체 반» = 내가 맡은 반 전체 (다른 선생님 반 응답은 세지 않는다)
      const mine = dashTeachingBans_(grade);
      rows = rows.filter(r => { const p = parseStudentId(String(r.studentId)); return p && mine.includes(p.ban); });
    }

    /* 회수 질문 — 특정 반을 골랐을 때만 그 반의 "오늘 차시" 기준으로 표시.
     * "전체 반" 보기에서는 반마다 차시가 다를 수 있어 하나로 특정할 수 없으므로 생략. */
    let lesson = null;
    if(ban){
      const lessonId = await ckFetchTodayLessonId_(grade, ban);
      lesson = lessonId ? (CHECKIN_PLAN[grade].lessons || []).find(l => l.id === lessonId) : null;
    }
    if(lesson && lesson.recall){
      $('ckRecall_' + grade).style.display = 'block';
      $('ckRecall_' + grade).innerHTML = `<b>회수 질문</b> (${escapeHtml(ban)}반) · ${escapeHtml(lesson.recall)}`;
    } else {
      $('ckRecall_' + grade).style.display = 'none';
    }

    /* 방어적 중복 제거 — 시트에 같은 학번의 중복 행이 남아있어도(재배포 전 데이터 등)
     * 화면에는 학생당 가장 최근 타임스탬프 응답 1개만 보이게. 진짜 원인 수정(백엔드 upsert)은
     * 별개로 필요하지만, 이미 쌓인 중복은 코드로 못 지우니 화면에서라도 걸러줌. */
    const latestByStudent = {};
    rows.forEach(r => {
      const prev = latestByStudent[r.studentId];
      if(!prev || new Date(r.timestamp) >= new Date(prev.timestamp)) latestByStudent[r.studentId] = r;
    });
    rows = Object.values(latestByStudent).sort((a,b) => a.temperature - b.temperature);

    /* 카운터 — CONFIG.BAN_SIZE가 있으면 분모까지, 없으면 완료 인원만 (config.js에 반별 총원을 추가하면 자동으로 살아남) */
    const total = (CONFIG.BAN_SIZE && CONFIG.BAN_SIZE[grade] && ban) ? CONFIG.BAN_SIZE[grade][ban] : null;
    $('ckCounter_' + grade).textContent = total ? `${total}명 중 ${rows.length}명 완료` : `${rows.length}명 완료`;

    if(!rows.length){
      $('ckStats_' + grade).innerHTML = '';
      $('ckList_' + grade).innerHTML = '<p class="muted">오늘 응답이 아직 없어요.</p>';
      return;
    }

    /* 온도 분포 요약 (1~5) */
    const tempCount = {1:0,2:0,3:0,4:0,5:0};
    rows.forEach(r => { if(tempCount[r.temperature] !== undefined) tempCount[r.temperature]++; });
    const tempLabels = {1:'완전방전',2:'좀처짐',3:'보통',4:'괜찮음',5:'풀충전'};
    const maxCount = Math.max(1, ...Object.values(tempCount));
    const tempBarsHtml = [5,4,3,2,1].map(t => {
      const c = tempCount[t];
      const pct = Math.round((c / maxCount) * 100);
      const isLow = t <= CHECKIN_LOW_TEMP_DISPLAY;
      return `
        <div class="stat-bar-row">
          <span class="stat-bar-label">${t} · ${tempLabels[t]}</span>
          <div class="stat-bar-track">
            <div class="stat-bar-fill${isLow ? ' low' : ''}" style="width:${pct}%;"></div>
          </div>
          <span class="stat-bar-count">${c}</span>
        </div>`;
    }).join('');

    /* 특이사항 — 연속 저온도 학생만 따로 모음 */
    /* v112: 명단을 본문에 줄줄이 펼치지 않고 숫자 + «명단 보기»(팝업 ckLowOpen_)로 둔다. */
    const alertCount = rows.filter(r => r.lowStreakAlert).length;
    const alertHtml = alertCount
      ? `<div class="stat-alert-box ck-detail-alert">
          <p class="stat-alert-title">⚠ 최근 3회 연속 저온도 (${alertCount}명)</p>
          <button type="button" class="btn btn-ghost btn-sm" onclick="ckLowOpen_('${grade}','${escapeHtml(ban)}')">명단 보기</button>
        </div>`
      : '';

    /* 역사적 선택 분포 — judgment는 옵션A/B, source_emotion은 단어칩별로 학생 이름과 함께 묶어서 표시.
     * "전체 반" 보기처럼 반마다 다른 차시가 섞여 있을 수 있으므로 lessonId 단위로 따로 묶는다. */
    const choiceGroups = {};
    rows.forEach(r => {
      const l = (CHECKIN_PLAN[grade] && CHECKIN_PLAN[grade].lessons || []).find(x => x.id === r.lessonId);
      if(!choiceGroups[r.lessonId]) choiceGroups[r.lessonId] = { topic: l ? l.topic : ((typeof CHECKIN_EMOTION !== 'undefined' && r.lessonId === CHECKIN_EMOTION.id) ? '감정 체크인' : r.lessonId), buckets: {} };
      const g = choiceGroups[r.lessonId];
      let key, label;
      if(r.checkinType === 'judgment'){
        const opt = l ? (l.options || []).find(o => o.id === r.judgment) : null;
        key = r.judgment || '—';
        label = opt ? opt.label : (r.judgment || '—');
      } else {
        key = r.word || '—';
        label = (r.word === '기타') ? `기타: ${r.custom || ''}` : (r.word || '—');
      }
      if(!g.buckets[key]) g.buckets[key] = { label, students: [] };
      g.buckets[key].students.push(`${escapeHtml(r.studentName)}(${escapeHtml(String(r.studentId))})`);
    });
    const choiceHtml = Object.values(choiceGroups).map(g => {
      const bucketsHtml = Object.values(g.buckets)
        .sort((a,b) => b.students.length - a.students.length)
        .map(b => `
          <details class="choice-bucket choice-fold">
            <summary class="choice-bucket-title">${escapeHtml(b.label)} <small>(${b.students.length}명)</small></summary>
            <p class="choice-bucket-names">${b.students.join(', ')}</p>
          </details>`).join('');
      return `
        <div class="stat-block">
          <p class="stat-block-title">${escapeHtml(g.topic)} — 선택 분포</p>
          ${bucketsHtml}
        </div>`;
    }).join('');

    $('ckStats_' + grade).innerHTML = `
      <div class="stat-block">
        <p class="stat-block-title">온도 분포</p>
        ${tempBarsHtml}
      </div>
      ${alertHtml}
      ${choiceHtml}`;

    const itemHtml = r => {
      let choiceText;
      if(r.checkinType === 'judgment'){
        const l = (CHECKIN_PLAN[grade].lessons || []).find(x => x.id === r.lessonId);
        const opt = l ? (l.options || []).find(o => o.id === r.judgment) : null;
        choiceText = opt ? opt.label : (r.judgment || '—');
      } else {
        choiceText = (r.word === '기타') ? `기타: ${r.custom || ''}` : (r.word || '—');
      }
      return `
        <div class="q-item">
          <div class="q-meta">
            ${escapeHtml(r.studentName)} (${escapeHtml(String(r.studentId))})
            ${r.lowStreakAlert ? '<span title="최근 3회 연속 저온도" class="q-meta-dot">●</span>' : ''}
            <span class="q-meta-right">온도 ${r.temperature}</span>
          </div>
          <div class="q-text">${escapeHtml(choiceText)}</div>
        </div>`;
    };
    /* v114: 학생별 응답을 반별로 묶고 반마다 접는다(번호순). 반이 하나면 바로 펼쳐 둔다. */
    const byBan = {};
    rows.forEach(r => { const p = parseStudentId(String(r.studentId)); const b = p ? p.ban : 0; (byBan[b] = byBan[b] || []).push(r); });
    const banKeys = Object.keys(byBan).map(Number).sort((a, b) => a - b);
    const listHtml = banKeys.map(b => {
      const list = byBan[b].slice().sort((x, y) => String(x.studentId).localeCompare(String(y.studentId)));
      const low = list.filter(r => r.lowStreakAlert).length;
      return `<details class="ck-ban-fold"${banKeys.length === 1 ? ' open' : ''}>
        <summary>${b}반 <small>(${list.length}명${low ? ` · <span class="ck-ban-low">⚠ 저온도 ${low}명</span>` : ''})</small></summary>
        ${list.map(itemHtml).join('')}
      </details>`;
    }).join('');
    /* v112: 학생별 응답은 기본 접어 둔다(펼쳤을 때만 줄줄이 보임). */
    $('ckList_' + grade).innerHTML = `<details class="ck-list-fold"><summary>학생별 응답 ${rows.length}명 보기</summary>${listHtml}</details>`;
  }catch(e){
    $('ckStats_' + grade).innerHTML = '';
    $('ckList_' + grade).innerHTML = '<p class="muted">불러오지 못했어요: ' + escapeHtml(e.message) + '</p>';
  }
}

/* ── 체크인 문항 관리 (v17 신규) ──
 * CHECKIN_PLAN(학생용, 구조화됨)과 별개로 CHECKIN_LESSONS_ADMIN(교사용, 평평한 배열 + _row)을
 * 따로 들고 있음 — 커리큘럼 관리와 동일한 이중 구조. */
let CHECKIN_LESSONS_ADMIN = [];
let CKQ_IMAGE_UPLOADING = false; // 2026-09-11 신규 — 이미지 업로드 중엔 저장을 막는다
let CKQ_GRADE = ''; // v52(2026-09-14) 신규 — 문항 관리 학년 탭(ckqGradeTabs)의 현재 선택값

async function dashLoadCheckinLessonsAdmin(){
  try{
    const res = await fetch(CONFIG.WEBAPP_URL + '?mode=checkinPlanAdmin&token=' + encodeURIComponent(TOKEN));
    const data = await res.json();
    if(data.result === 'success') CHECKIN_LESSONS_ADMIN = data.rows || [];
  }catch(e){
    CHECKIN_LESSONS_ADMIN = [];
  }
}

/* v53(2026-09-14) — 커리큘럼 dashRenderLessons()/clLessonItemHtml()과 같은 방식으로
 * 진행중(기본 펼침)/지난(접힘, l.isPast) 두 그룹으로 나눠 그린다. isPast는 서버
 * checkinPlanAdminGet_이 내려주는 필드(history26_backend, 아직 배포 전 — 배포 전까지는
 * 모든 문항이 항상 진행중 그룹에만 표시됨). */
function dashRenderCheckinLessonsList(){
  const grade = CKQ_GRADE;
  const rows = CHECKIN_LESSONS_ADMIN.filter(l => l.grade === grade);
  const active = rows.filter(l => !l.isPast);
  const past = rows.filter(l => l.isPast);
  $('ckqActiveList').innerHTML = active.length
    ? active.map(l => ckqLessonItemHtml_(l, false)).join('')
    : '<p class="cl-past-hint">이 학년에 등록된 문항이 없어요.</p>';
  $('ckqPastCount').textContent = String(past.length);
  $('ckqPastList').innerHTML = past.length
    ? past.map(l => ckqLessonItemHtml_(l, true)).join('')
    : '<p class="cl-past-hint">지난 체크인으로 표시된 문항이 없어요.</p>';
}

function ckqLessonItemHtml_(l, isPastItem){
  const typeLabel = { judgment: '판단형', source_emotion: '사료+단어칩' };
  return `
    <div class="cl-item" data-row="${l._row}">
      <div class="cl-item-body">
        <div class="cl-meta">${escapeHtml(l.id)} · ${escapeHtml(typeLabel[l.type] || l.type)}${l.imageUrl ? ' · 🖼️ 이미지 자료' : ''}${l.verify ? ' · ⚠️ 사실검증 필요' : ''}</div>
        <div class="cl-title">${escapeHtml(l.topic)}</div>
      </div>
      <div class="cl-item-actions">
        <button class="an-toggle" data-row="${l._row}" onclick="dashEditCheckinLesson(this)">수정</button>
        <button class="an-toggle" data-row="${l._row}" onclick="dashToggleCheckinLessonPast(this)">${isPastItem ? '진행중으로 되돌리기' : '지난 체크인으로 표시'}</button>
        <button class="an-toggle" data-row="${l._row}" onclick="dashDeleteCheckinLesson(this)">삭제</button>
      </div>
    </div>`;
}

/* v53(2026-09-14) 신규 — 커리큘럼 dashToggleLessonPast()의 체크인문항 버전. 공개여부
 * 같은 개념이 체크인문항엔 없어서 이 토글 하나만 있음. */
async function dashToggleCheckinLessonPast(btn){
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    await fetch(CONFIG.WEBAPP_URL, { method:'POST', body: JSON.stringify({ action:'toggleCheckinLessonPast', token:TOKEN, row }) });
    const l = CHECKIN_LESSONS_ADMIN.find(x => String(x._row) === String(row));
    if(l){ l.isPast = !l.isPast; }
    dashRenderCheckinLessonsList();
    dashRefreshCkSetLessons(); // v55 — 지난 체크인 토글 즉시 "오늘의 체크인 차시 설정" 목록에도 반영
  }catch(e){
    showToast('처리하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false;
  }
}

/* 2026-09-11 변경 — "자료 형식"(텍스트/이미지)이 두 타입 공통 필드로 분리되면서,
 * 유형 토글은 이제 반응 방식 전용 필드(judgment=옵션A/B, source_emotion=단어칩)만 담당.
 * 자료 형식 전환은 별도의 ckqToggleSourceFormatFields()가 맡는다. */
function ckqToggleTypeFields(){
  const isJudgment = $('ckqFormType').value === 'judgment';
  $('ckqJudgmentFields').style.display = isJudgment ? 'block' : 'none';
  $('ckqWordChipsWrap').style.display = isJudgment ? 'none' : 'block';
}

// v51(2026-09-14) 신규 — 유형별 자료 형식 기본값. judgment는 자료 없이 발문만 쓰는 경우가
// 많아 '없음'이 기본, source_emotion은 자료가 필수라 '텍스트'가 기본(기존 관례 유지).
function ckqDefaultSourceFormatForType_(type){
  return type === 'judgment' ? 'none' : 'text';
}

// v51(2026-09-14) 신규 — 유형 select의 change 이벤트 핸들러. 새 문항을 작성하는 중(수정
// 모드가 아닐 때)에만 자료 형식을 유형별 기본값으로 맞춰준다 — 수정 중엔 이미 저장된
// 자료 형식을 덮어쓰면 안 되므로 손대지 않는다.
function ckqOnTypeChange(){
  if(!$('ckqEditRow').value){
    $('ckqFormSourceFormat').value = ckqDefaultSourceFormatForType_($('ckqFormType').value);
    ckqToggleSourceFormatFields();
  } else {
    // v52 — 수정 모드에선 자료 형식 자체는 안 건드리지만(기존 저장값 보존), *필수
    // 표시는 유형이 바뀌는 즉시 최신 유형 기준으로 맞춰야 하므로 ckqSourceReqTag만 갱신한다.
    $('ckqSourceReqTag').style.display = $('ckqFormType').value === 'source_emotion' ? 'inline' : 'none';
  }
  ckqToggleTypeFields();
}

/* v51(2026-09-14) 변경 — "없음"을 명시적 선택지로 추가. 텍스트/이미지 입력 UI뿐 아니라
 * 사료 출처 필드도 자료가 없을 땐 같이 숨긴다(자료 없이 출처만 있는 건 의미가 없어서). */
function ckqToggleSourceFormatFields(){
  const format = $('ckqFormSourceFormat').value;
  $('ckqSourceTextWrap').style.display = format === 'text' ? 'block' : 'none';
  $('ckqSourceImageWrap').style.display = format === 'image' ? 'block' : 'none';
  $('ckqSourceOriginField').style.display = format === 'none' ? 'none' : 'block';
  // v52 — source_emotion은 자료(텍스트/이미지 중 하나)가 필수라서 그때만 *필수 표시를 띄운다.
  $('ckqSourceReqTag').style.display = $('ckqFormType').value === 'source_emotion' ? 'inline' : 'none';
}

/* ── 체크인문항 이미지 업로드 (2026-09-11 신규) ──
 * 파일 선택 즉시 base64로 읽어 uploadCheckinImage로 보내고, 성공하면 반환된 URL을
 * 숨김 필드에 채운다 — 효니가 URL을 직접 입력할 필요가 없게 하는 게 목적. */
function ckqFileToBase64_(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* v22의 fetchJsonRetry_는 GET 전용이라 이미지 업로드(POST)엔 못 씀 — webapp-builder
 * 스킬 원칙(제출 fetch에 재시도 포함)을 따라 실패 시 최대 2회 더 재시도. */
async function ckqUploadImageWithRetry_(body, maxAttempts){
  maxAttempts = maxAttempts || 3;
  let lastErr;
  for(let attempt = 1; attempt <= maxAttempts; attempt++){
    try{
      const res = await fetch(CONFIG.WEBAPP_URL, { method:'POST', body: JSON.stringify(body) });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    }catch(e){
      lastErr = e;
      if(attempt < maxAttempts) await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

async function ckqHandleImageFileChange(input){
  const file = input.files && input.files[0];
  if(!file) return;
  // 8MB 이내로 프론트에서 먼저 거름 — 이미지 최적화 자체는 효니가 업로드 전에 직접 처리한다는
  // 전제(핸드오프 문서)라 서버는 별도 압축을 하지 않고, 여기서는 안전한 상한선만 둔다.
  const MAX_BYTES = 8 * 1024 * 1024;
  if(file.size > MAX_BYTES){
    showToast('이미지가 너무 커요 — 8MB 이하로 줄여서 다시 올려 주세요.');
    input.value = '';
    return;
  }
  CKQ_IMAGE_UPLOADING = true;
  $('ckqImageUploadStatus').textContent = '업로드하는 중…';
  $('btnCkqSave').disabled = true;
  try{
    const base64 = await ckqFileToBase64_(file);
    const res = await ckqUploadImageWithRetry_({
      action: 'uploadCheckinImage', token: TOKEN,
      imageBase64: base64, mimeType: file.type || 'image/png', filename: file.name || ''
    });
    if(res && res.result === 'success' && res.url){
      $('ckqFormImageUrl').value = res.url;
      $('ckqImagePreviewImg').src = res.url;
      $('ckqImagePreviewWrap').style.display = 'block';
      $('ckqImageUploadStatus').textContent = '업로드 완료';
    } else {
      $('ckqImageUploadStatus').textContent = '업로드 실패: ' + (res && res.message ? res.message : '다시 시도해 주세요.');
      input.value = '';
    }
  }catch(e){
    $('ckqImageUploadStatus').textContent = '업로드 실패 — 다시 시도해 주세요.';
    input.value = '';
  }finally{
    CKQ_IMAGE_UPLOADING = false;
    $('btnCkqSave').disabled = false;
  }
}

function ckqRemoveImage(){
  $('ckqFormImageUrl').value = '';
  $('ckqFormImageFile').value = '';
  $('ckqImagePreviewWrap').style.display = 'none';
  $('ckqImagePreviewImg').src = '';
  $('ckqImageUploadStatus').textContent = '';
}

function dashResetCheckinLessonForm(){
  $('ckqEditRow').value = '';
  ['ckqFormId','ckqFormTopic','ckqFormTextbook','ckqFormPrompt','ckqFormOptionA','ckqFormOptionB',
   'ckqFormSourceText','ckqFormSourceOrigin','ckqFormWordChips','ckqFormNote',
   'ckqFormImageAlt','ckqFormImageUrl']
    .forEach(id => { $(id).value = ''; });
  $('ckqFormId').disabled = false;
  // v51: 자료 형식 기본값은 고정 'text'가 아니라 현재 유형에 맞춰 결정
  // (judgment는 '없음', source_emotion은 '텍스트' — ckqDefaultSourceFormatForType_ 참고)
  $('ckqFormSourceFormat').value = ckqDefaultSourceFormatForType_($('ckqFormType').value);
  $('ckqFormImageFile').value = '';
  $('ckqImagePreviewWrap').style.display = 'none';
  $('ckqImagePreviewImg').src = '';
  $('ckqImageUploadStatus').textContent = '';
  $('ckqMoveGradeWrap').style.display = 'none'; // v86
  $('ckqFormTitle').textContent = '새 문항 추가';
  $('btnCkqSave').textContent = '문항 추가';
  $('btnCkqCancel').style.display = 'none';
  ckqToggleTypeFields();
  ckqToggleSourceFormatFields();
}

function dashEditCheckinLesson(btn){
  const row = btn.dataset.row;
  const l = CHECKIN_LESSONS_ADMIN.find(x => String(x._row) === String(row));
  if(!l){ showToast('문항을 찾지 못했어요.'); return; }
  $('ckqEditRow').value = row;
  // v58 — 학년 select를 없애고 위 탭(CKQ_GRADE)을 그대로 씀. 이 함수는 항상 그 탭이 그리고 있는
  // 목록에서 호출되므로 l.grade는 이미 CKQ_GRADE와 같다 — 별도로 맞출 필요가 없다.
  $('ckqFormType').value = l.type;
  $('ckqFormId').value = l.id;
  $('ckqFormId').disabled = true; // 이미 "오늘 차시"로 지정돼 있을 수 있어 id는 잠가둠
  $('ckqFormTopic').value = l.topic;
  $('ckqFormTextbook').value = l.textbook || '';
  $('ckqFormPrompt').value = l.prompt || '';
  $('ckqFormOptionA').value = l.optionA || '';
  $('ckqFormOptionB').value = l.optionB || '';
  $('ckqFormSourceText').value = l.sourceText || '';
  $('ckqFormSourceOrigin').value = l.sourceOrigin || '';
  $('ckqFormWordChips').value = l.wordChips || '';
  // v58 — 회수 질문(recall)·재확인 체크박스(verify)·검증 메모(verifyNote) 필드를 폼에서 없애고
  // 교사 메모(note) 하나로 합쳤다. 예전 문항에 이 값들이 남아있으면(과거에 쓴 회수 질문 등) 여기서
  // 잃어버리지 않게 note 앞에 합쳐서 보여준다 — 교사가 그대로 두고 저장하면 note 컬럼으로 옮겨
  // 담기고, recall/verify/verifyNote 컬럼은 이후 저장부터 빈 값으로 남는다(폼에 입력 UI가 없어
  // updateCheckinLessonPost_가 항상 빈 값을 씀 — history26_backend 확인, 컬럼 자체는 그대로 있어
  // 스키마 변경 불필요).
  const legacyParts = [];
  if (l.verify) legacyParts.push('[재확인 필요]' + (l.verifyNote ? ' ' + l.verifyNote : ''));
  if (l.recall) legacyParts.push('[예전 회수 질문] ' + l.recall);
  const mergedNote = [...legacyParts, l.note || ''].filter(Boolean).join('\n');
  $('ckqFormNote').value = mergedNote;
  // 2026-09-11 신규 — 이미지 자료 필드 복원(없는 옛 행은 checkinPlanAdminGet_이 sourceFormat
  // 기본값을 'text'로 채워 내려주므로 따로 폴백할 필요 없음).
  $('ckqFormSourceFormat').value = l.sourceFormat || 'text';
  $('ckqFormImageUrl').value = l.imageUrl || '';
  $('ckqFormImageAlt').value = l.imageAlt || '';
  $('ckqFormImageFile').value = '';
  if(l.imageUrl){
    $('ckqImagePreviewImg').src = l.imageUrl;
    $('ckqImagePreviewWrap').style.display = 'block';
  } else {
    $('ckqImagePreviewImg').src = '';
    $('ckqImagePreviewWrap').style.display = 'none';
  }
  $('ckqImageUploadStatus').textContent = '';
  ckqToggleTypeFields();
  ckqToggleSourceFormatFields();
  // v86 — 학년 이동 칸: 수정할 때만 보이고, 기본값은 이 문항의 현재 학년.
  $('ckqFormGrade').innerHTML = Object.keys(CHECKIN_PLAN || {}).map(g =>
    `<option value="${g}"${String(g) === String(l.grade) ? ' selected' : ''}>${g}학년</option>`).join('');
  $('ckqMoveGradeWrap').style.display = '';
  $('ckqFormTitle').textContent = '문항 수정';
  $('btnCkqSave').textContent = '수정 저장';
  $('btnCkqCancel').style.display = 'inline-block';
  $('ckqFormTopic').focus();
}

async function dashDeleteCheckinLesson(btn){
  const row = btn.dataset.row;
  const l = CHECKIN_LESSONS_ADMIN.find(x => String(x._row) === String(row));
  if(!confirm(`"${l ? l.topic : row}" 문항을 삭제할까요? 되돌릴 수 없어요.`)) return;
  btn.disabled = true;
  try{
    await fetch(CONFIG.WEBAPP_URL, { method:'POST', body: JSON.stringify({ action:'deleteCheckinLesson', token:TOKEN, row }) });
    showToast('문항을 삭제했어요.');
    await loadCheckinPlan();
    await dashLoadCheckinLessonsAdmin();
    dashRenderCheckinLessonsList();
  }catch(e){
    btn.disabled = false;
    showToast('삭제하지 못했어요. 다시 시도해 주세요.');
  }
}

function ckqCollectFormData(){
  return {
    // v58 — 학년 select를 없애서 위 탭 값(CKQ_GRADE)을 그대로 쓴다.
    // v86 — 수정 모드에서는 학년 이동 칸(ckqFormGrade) 값을 쓴다(새 문항은 여전히 탭 값).
    grade: ($('ckqEditRow').value && $('ckqFormGrade').value) || CKQ_GRADE,
    id: $('ckqFormId').value.trim(),
    topic: $('ckqFormTopic').value.trim(),
    textbook: $('ckqFormTextbook').value.trim(),
    type: $('ckqFormType').value,
    prompt: $('ckqFormPrompt').value.trim(),
    optionA: $('ckqFormOptionA').value.trim(),
    optionB: $('ckqFormOptionB').value.trim(),
    sourceFormat: $('ckqFormSourceFormat').value,
    sourceText: $('ckqFormSourceText').value.trim(),
    sourceOrigin: $('ckqFormSourceOrigin').value.trim(),
    imageUrl: $('ckqFormImageUrl').value.trim(),
    imageAlt: $('ckqFormImageAlt').value.trim(),
    wordChips: $('ckqFormWordChips').value.trim(),
    // v58 — 회수 질문(recall)·재확인 체크박스(verify)·검증 메모(verifyNote)는 폼에서 빠졌다.
    // 시트 컬럼 자체는 그대로 있어서(하위호환) 그냥 안 보내면 서버가 빈 값으로 저장한다.
    note: $('ckqFormNote').value.trim()
  };
}

async function dashSubmitCheckinLessonForm(btn){
  if(CKQ_IMAGE_UPLOADING){ showToast('이미지 업로드가 끝난 뒤에 저장해 주세요.'); return; }
  const editRow = $('ckqEditRow').value;
  const payload = ckqCollectFormData();
  if(!payload.grade || !payload.id || !payload.topic || !payload.prompt){
    showToast('학년·차시id·제목·발문은 필수예요.'); return;
  }
  if(payload.type === 'judgment' && (!payload.optionA || !payload.optionB)){
    showToast('judgment 타입은 옵션A·옵션B가 필요해요.'); return;
  }
  if(payload.type === 'source_emotion' && !payload.sourceText && !payload.imageUrl){
    showToast('source_emotion 타입은 사료 텍스트 또는 이미지가 필요해요.'); return;
  }
  // v86 — 학년을 옮길 때 도착 학년에 같은 차시id가 있으면 두 문항이 섞이니 막는다.
  if(editRow && CHECKIN_LESSONS_ADMIN.some(x => String(x._row) !== String(editRow)
      && String(x.grade) === String(payload.grade) && String(x.id) === payload.id)){
    showToast(`${payload.grade}학년에 같은 차시id(${payload.id})가 이미 있어서 옮길 수 없어요.`); return;
  }
  btn.disabled = true; btn.textContent = editRow ? '저장하는 중…' : '추가하는 중…';
  try{
    if(editRow){
      await fetch(CONFIG.WEBAPP_URL, {
        method:'POST',
        body: JSON.stringify(Object.assign({ action:'updateCheckinLesson', token:TOKEN, row:editRow }, payload))
      });
      showToast('문항을 수정했어요.');
    } else {
      await fetch(CONFIG.WEBAPP_URL, {
        method:'POST',
        body: JSON.stringify(Object.assign({ action:'addCheckinLesson', token:TOKEN }, payload))
      });
      showToast('문항을 추가했어요.');
    }
    dashResetCheckinLessonForm();
    await loadCheckinPlan();
    await dashLoadCheckinLessonsAdmin();
    dashRenderCheckinLessonsList();
    dashRefreshCkSetLessons();
  }catch(e){
    showToast('저장하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = editRow ? '수정 저장' : '문항 추가';
  }
}

/* ── 등록된 활동 목록 렌더 (v13: 학년별 → 진행중/예정(드래그 정렬) + 지난 활동(접힘)) ── */
function dashRenderLessons(){
  const list = $('clList');
  if(!LESSONS_ADMIN.length){
    list.innerHTML = '<p class="empty-hint">등록된 활동이 없어요.</p>';
    return;
  }
  const grades = [...new Set(LESSONS_ADMIN.map(l => l.grade))].sort();
  const curG = clCurGrade_(); // v80 — 학년 전환 버튼이 고른 학년만 보이게
  let html = '';
  grades.forEach(g => {
    const all = LESSONS_ADMIN.filter(l => l.grade === g).sort((a,b) => a.order - b.order);
    const active = all.filter(l => !l.isPast);
    const past = all.filter(l => l.isPast);
    const pubN = active.filter(l => l.public).length;
    html += `<div class="cl-grade-group" data-grade="${escapeHtml(g)}" style="${String(g) === curG ? '' : 'display:none;'}">`;
    html += `<h4 class="cl-grade-head">${g}학년 <span class="cl-grade-meta">진행 ${active.length}개 · 공개 ${pubN}개 · 지난 활동 ${past.length}개</span></h4>`;
    html += `<div class="cl-active-list" data-grade="${escapeHtml(g)}">`
      + (active.length ? active.map(l => clLessonItemHtml(l, false)).join('') : '<p class="cl-past-hint">진행중/예정 활동이 없어요.</p>')
      + `</div>`;
    html += `
      <details class="cl-past-collapse">
        <summary>지난 활동 (${past.length}) <span class="cl-arrow">▶</span></summary>
        <div class="cl-past-list">
          ${past.length ? past.map(l => clLessonItemHtml(l, true)).join('') : '<p class="cl-past-hint">지난 활동으로 표시된 항목이 없어요.</p>'}
        </div>
      </details>`;
    html += `</div>`;
  });
  clRenderGradeSeg_();
  list.innerHTML = html;
  bindClListEvents();
}

/* v27: 활동목록JSON이 있는(활동 2개 이상) 차시는 목록에서 "활동 2개" 배지 +
 * 순차진행이면 🔒 표시를 덧붙임. urlText 대신 활동 개수/타입을 요약해서 보여줌. */
function clLessonItemHtml(l, isPastItem){
  const multi = (l.activitiesCount || 1) > 1;
  const ownerTag = (l.owner && l.owner !== '공통') ? ` · 👤 ${escapeHtml(l.owner)} 담당` : '';
  const metaText = multi
    ? `${escapeHtml(l.id)} · 활동 ${l.activitiesCount}개${l.sequential ? ' · 🔒 순차' : ''}${ownerTag}`
    : `${escapeHtml(l.id)} · ${escapeHtml(l.type)} · ${l.urlText ? 'URL 있음' : '준비 중(URL 없음)'}${ownerTag}`;
  return `
    <div class="cl-item" ${isPastItem ? '' : 'draggable="true"'} data-row="${l._row}" data-grade="${escapeHtml(l.grade)}">
      ${isPastItem ? '' : '<span class="cl-drag-handle" title="드래그해서 순서 바꾸기">⠿</span>'}
      <div class="cl-item-body">
        <div class="cl-meta">${metaText}</div>
        <div class="cl-title">${escapeHtml(l.title)}</div>
      </div>
      <div class="cl-item-actions">
        ${isPastItem ? '' : `
          <button class="btn-tiny cl-move" data-row="${l._row}" data-dir="up" title="위로 이동">▲</button>
          <button class="btn-tiny cl-move" data-row="${l._row}" data-dir="down" title="아래로 이동">▼</button>`}
        <button class="an-toggle" data-row="${l._row}" onclick="dashEditLesson(this)">수정</button>
        <button class="an-toggle" data-row="${l._row}" onclick="dashToggleLessonPublic(this)">${l.public ? '비공개로 전환' : '공개로 전환'}</button>
        <button class="an-toggle" data-row="${l._row}" onclick="dashToggleLessonPast(this)">${isPastItem ? '진행중으로 되돌리기' : '지난 활동으로 표시'}</button>
        <button class="an-toggle cl-del" data-row="${l._row}" data-id="${escapeHtml(l.id)}" onclick="dashDeleteLesson(this)">삭제</button>
      </div>
    </div>`;
}

/* v66 — 커리큘럼 활동 삭제. 서버는 row와 활동id를 같이 받아 대조한다(행 번호가 밀려 엉뚱한 행을
 * 지우는 사고 방지). 학생 제출 기록(게임활동_로그)은 그대로 남고 커리큘럼 행만 지워진다. */
async function dashDeleteLesson(btn){
  const row = btn.dataset.row;
  const id = btn.dataset.id;
  const l = LESSONS_ADMIN.find(x => String(x._row) === String(row));
  if(!l){ showToast('활동 정보를 찾지 못했어요.'); return; }
  if(!confirm(`"${l.title}" (${l.id}) 활동을 커리큘럼에서 삭제할까요?\n학생이 이미 제출한 기록은 남지만, 되돌릴 수 없어요.`)) return;
  btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'deleteLesson', token:TOKEN, row, id })
    });
    const json = await res.json().catch(() => null);
    if(!json || json.result !== 'success'){
      showToast('삭제하지 못했어요' + (json && json.message ? ': ' + json.message : '') + ' — 백엔드 재배포 전이면 삭제가 안 돼요.');
      return;
    }
    if($('clEditRow').value === String(row)) dashResetLessonForm();
    showToast('활동을 삭제했어요.');
    await dashLoadData();
    dashRenderLessons();
    dashSyncCurriculum_();
  }catch(e){
    showToast('삭제하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false;
  }
}

/* 위/아래 버튼 + 드래그 이벤트 바인딩 (매 렌더 후 재호출) */
function bindClListEvents(){
  document.querySelectorAll('.cl-move').forEach(btn => {
    btn.addEventListener('click', () => dashMoveLesson(btn.dataset.row, btn.dataset.dir));
  });

  document.querySelectorAll('.cl-active-list').forEach(listEl => {
    listEl.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = listEl.querySelector('.cl-item.dragging');
      if(!dragging) return;
      const after = clDragAfterElement(listEl, e.clientY);
      if(after == null) listEl.appendChild(dragging);
      else listEl.insertBefore(dragging, after);
    });
  });

  document.querySelectorAll('.cl-active-list .cl-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', () => { item.classList.add('dragging'); });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dashCommitReorder(item.closest('.cl-active-list'));
    });
  });
}

function clDragAfterElement(container, y){
  const els = [...container.querySelectorAll('.cl-item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if(offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

/* v59 — 순서값은 학년 안에서 "지난 활동(기존 상대 순서 유지) → 진행중/예정(지금 순서)" 순으로
 * 항상 1..N 전체를 다시 매긴다. 예전엔 진행중 목록에만 1..n을 매겨 지난 활동의 옛 번호와 겹쳤고,
 * 학생 화면(지난 활동도 같이 내려옴)에서 차시 순서가 뒤섞이거나 ▲▼가 안 먹혔다.
 * activeRowsInOrder를 주면 그 순서를 진행중 순서로 쓰고(드래그 직후 DOM 순서), 없으면 현재 order 기준. */
async function dashSaveGradeOrder_(grade, activeRowsInOrder){
  const all = LESSONS_ADMIN.filter(x => x.grade === grade);
  const byOrder = (a,b) => (a.order - b.order) || (a._row - b._row);
  const past = all.filter(x => x.isPast).sort(byOrder);
  let active = all.filter(x => !x.isPast).sort(byOrder);
  if(activeRowsInOrder){
    const pos = new Map(activeRowsInOrder.map((r, i) => [Number(r), i]));
    active = active.sort((a,b) => (pos.has(a._row) ? pos.get(a._row) : 1e9) - (pos.has(b._row) ? pos.get(b._row) : 1e9));
  }
  const items = [];
  [...past, ...active].forEach((l, idx) => {
    const order = idx + 1;
    if(l.order !== order) items.push({ row: l._row, order });
    l.order = order;
  });
  if(!items.length) return true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'reorderLessons', token: TOKEN, items })
    });
    const data = await res.json();
    return data.result === 'success';
  }catch(e){
    return false;
  }
}

/* 드래그가 끝난 뒤 현재 DOM 순서를 진행중 순서로 삼아 학년 전체 순서를 저장 */
async function dashCommitReorder(listEl){
  if(!listEl) return;
  const rowsInOrder = [...listEl.querySelectorAll('.cl-item')].map(el => Number(el.dataset.row));
  const ok = await dashSaveGradeOrder_(listEl.dataset.grade, rowsInOrder);
  showToast(ok ? '순서를 저장했어요.' : '순서를 저장하지 못했어요. 새로고침 후 다시 시도해 주세요.');
  dashRenderLessons();
  dashSyncCurriculum_();
}

/* 위/아래 버튼 — 같은 학년의 진행중/예정 목록 안에서 바로 옆 항목과 자리를 맞바꿈 */
async function dashMoveLesson(row, dir){
  const l = LESSONS_ADMIN.find(x => String(x._row) === String(row));
  if(!l) return;
  const rows = LESSONS_ADMIN
    .filter(x => x.grade === l.grade && !x.isPast)
    .sort((a,b) => (a.order - b.order) || (a._row - b._row))
    .map(x => x._row);
  const idx = rows.indexOf(l._row);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if(idx === -1 || swapIdx < 0 || swapIdx >= rows.length) return;
  [rows[idx], rows[swapIdx]] = [rows[swapIdx], rows[idx]];
  const ok = await dashSaveGradeOrder_(l.grade, rows);
  if(!ok) showToast('순서를 저장하지 못했어요. 새로고침 후 다시 시도해 주세요.');
  dashRenderLessons();
  dashSyncCurriculum_();
}

/* 지난 활동 표시 on/off — 공개여부와 별개 (v13). v59: 토글 뒤 학년 순서를 다시 매겨 지난 활동이 앞으로 가게 함 */
async function dashToggleLessonPast(btn){
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'toggleLessonPast', token:TOKEN, row })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || 'fail');
    const l = LESSONS_ADMIN.find(x => String(x._row) === String(row));
    if(l){
      l.isPast = !l.isPast;
      const ok = await dashSaveGradeOrder_(l.grade);
      if(!ok) showToast('순서를 다시 매기지 못했어요. 새로고침 후 확인해 주세요.');
    }
    dashRenderLessons();
    dashSyncCurriculum_();
  }catch(e){
    showToast('처리하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false;
  }
}

/* ── v27: 커리큘럼 "새 활동 추가" 폼 — 활동 2개 모드 토글 ──
 * 체크하면 기존 타입·URL 필드를 숨기고 활동1·활동2 각각의 id·타입·제목·설명·URL을
 * 따로 입력받음. 활동id·제목·설명(clId/clTitle/clDesc)은 이 경우 "차시 전체"를
 * 대표하는 값(체크인·피드백·CSV에서 차시 단위로 쓰임)으로 의미가 바뀐다. */
/* v28 — "담당"을 공통이 아닌 값으로 골랐는데 그 학년의 반 트랙(효니/미현쌤담당반)이
 * 아직 비어있으면 저장해도 그 차시가 아무 반에도 안 보이게 되므로, 폼에서 미리 경고. */
function clRefreshOwnerHint(){
  const grade = $('clGrade').value;
  const owner = $('clOwner').value;
  const gi = GRADE_INFO_ADMIN[grade];
  const configured = gi && ((gi.hyoBansText || '').trim() || (gi.mihyunBansText || '').trim());
  $('clOwnerHint').style.display = (owner !== '공통' && !configured) ? 'block' : 'none';
}

/* v24: 사고유형 선택에 맞춰 칭호명 자동완성(datalist) 후보를 갈아끼운다.
 * 사고유형이 "(선택 안 함)"이면 칭호명 필드 자체가 의미 없으므로(백엔드가 항상
 * 빈칸으로 되돌림) 비활성화 + 값 비움 — 실수로 입력해도 저장 안 되는 걸 미리 보여줌. */
function clRefreshBadgeNameOptions(){
  const thinkingType = $('clThinkingType').value;
  const dl = $('clBadgeNameOptions');
  const input = $('clBadgeName');
  const pool = BADGE_NAME_POOL[thinkingType] || [];
  dl.innerHTML = pool.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
  input.disabled = !thinkingType;
  if(!thinkingType) input.value = '';
  else if(!input.value.trim()) input.placeholder = pool[0] ? `예: ${pool[0]}` : '예: 저울질의 고수';
}

function clToggleMulti(){
  const on = $('clMulti').checked;
  $('clMultiWrap').style.display = on ? 'block' : 'none';
  // v64 — 폼이 라벨 래퍼(.cl-field)로 바뀌어서 select/textarea 자체가 아니라 래퍼째 토글한다.
  $('clTypeField').style.display = on ? 'none' : '';
  $('clUrlField').style.display = on ? 'none' : '';
  $('clId').placeholder = on ? '체크인·피드백·CSV에서 이 차시를 가리킬 때 쓰는 차시id' : '게임 CONFIG.GAME_NAME과 똑같이';
  $('clIdLabel').firstChild.textContent = on ? '차시id ' : '활동id ';
}

function clCollectActivitiesFromForm(){
  if(!$('clMulti').checked) return null;
  const act1 = {
    id: $('clAct1Id').value.trim(), title: $('clAct1Title').value.trim(),
    desc: $('clAct1Desc').value.trim(), type: $('clAct1Type').value, url: $('clAct1Url').value.trim()
  };
  const act2 = {
    id: $('clAct2Id').value.trim(), title: $('clAct2Title').value.trim(),
    desc: $('clAct2Desc').value.trim(), type: $('clAct2Type').value, url: $('clAct2Url').value.trim()
  };
  return [act1, act2];
}

/* v17: 폼 하나를 추가/수정 공용으로 씀. clEditRow가 비어있으면 추가, 값이 있으면 수정. */
async function dashSubmitLessonForm(btn){
  const editRow = $('clEditRow').value;
  if(editRow) return dashUpdateLesson(btn, editRow);
  return dashAddLesson(btn);
}

async function dashAddLesson(btn){
  const grade = $('clGrade').value;
  const id = $('clId').value.trim();
  const title = $('clTitle').value.trim();
  const desc = $('clDesc').value.trim();
  const type = $('clType').value;
  const url = $('clUrl').value.trim();
  const isPublic = $('clPublic').checked;
  const owner = $('clOwner').value;
  const thinkingType = $('clThinkingType').value;
  const badgeName = $('clBadgeName').value.trim(); // v24
  if(!grade || !id || !title){ showToast('학년·활동id·제목은 필수예요.'); return; }

  const activities = clCollectActivitiesFromForm();
  if(activities){
    if(!activities[0].id || !activities[0].title || !activities[1].id || !activities[1].title){
      showToast('활동 2개 모드에서는 각 활동의 id·제목이 필수예요.'); return;
    }
  }
  const sequential = activities ? $('clSequential').checked : false;

  btn.disabled = true; btn.textContent = '추가하는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'addLesson', token:TOKEN, grade, id, title, desc, type, url, public:isPublic, activities, sequential, owner, thinkingType, badgeName })
    });
    // v23 버그 수정 — 지금까지 여기서 서버 응답을 안 읽어서, 백엔드가 에러를 던져도
    // 프론트는 무조건 "저장했어요"를 띄웠음(실패가 조용히 묻힘). 이제 result:'success'가
    // 아니면 실패로 처리하고 실제 에러 메시지를 보여줌 — 아래서 리스트 새로고침도 안 함.
    const json = await res.json().catch(() => null);
    if(!json || json.result !== 'success'){
      showToast('저장하지 못했어요' + (json && json.message ? ': ' + json.message : '') + ' — 다시 시도해 주세요.');
      return;
    }
    // v66 — 서버가 success만 주고 시트엔 안 쓴 경우(배포본 불일치 등)를 걸러내려고, 다시 읽은
    // 목록에 방금 id가 실제로 있는지 확인한다. 없으면 폼을 비우지 않고(입력 보존) 실패로 안내.
    await dashLoadData();
    dashRenderLessons();
    const saved = LESSONS_ADMIN.some(l => String(l.grade) === String(grade) && String(l.id) === id);
    if(!saved){
      showToast('서버는 성공이라고 했지만 커리큘럼 목록에 안 보여요. Apps Script 배포 버전이 최신인지 확인해 주세요.');
      return;
    }
    dashResetLessonForm();
    showToast('활동을 추가했어요.' + (isPublic ? '' : ' (비공개 상태 — 준비되면 목록에서 공개로 전환해 주세요)'));
    dashSyncCurriculum_();
  }catch(e){
    showToast('추가하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '활동 추가';
  }
}

/* v17: 등록된 활동 목록에서 "수정" 클릭 — 폼에 기존 값 채워넣고 새 활동 추가 서브탭으로 전환.
 * 활동id는 CONFIG.GAME_NAME과 연결돼 있어 여기서는 바꾸지 못하게 잠가둠(비활성화).
 * v27: 활동목록JSON이 있으면(activitiesRaw) 활동 2개 모드로 자동 전환해서 채워 넣음. */
function dashEditLesson(btn){
  const row = btn.dataset.row;
  const l = LESSONS_ADMIN.find(x => String(x._row) === String(row));
  if(!l){ showToast('활동 정보를 찾지 못했어요.'); return; }
  $('clEditRow').value = row;
  $('clGrade').value = l.grade;
  $('clType').value = l.type;
  $('clId').value = l.id;
  $('clId').disabled = true;
  $('clTitle').value = l.title;
  $('clDesc').value = l.desc || '';
  $('clUrl').value = l.urlText || '';
  $('clOwner').value = l.owner || '공통';
  clRefreshOwnerHint();
  $('clThinkingType').value = l.thinkingType || '';
  clRefreshBadgeNameOptions();
  $('clBadgeName').value = l.badgeName || ''; // v24
  $('clPublicRow').style.display = 'none'; // 공개여부는 목록에서 토글로만 관리(폼에서는 안 건드림)
  $('clEditBanner').style.display = 'block';
  $('btnAddLesson').textContent = '수정 저장';

  let acts = [];
  if(l.activitiesRaw){
    try{ acts = JSON.parse(l.activitiesRaw); }catch(e){ acts = []; }
  }
  if(acts.length >= 2){
    $('clMulti').checked = true;
    $('clAct1Id').value = acts[0].id || ''; $('clAct1Title').value = acts[0].title || '';
    $('clAct1Desc').value = acts[0].desc || ''; $('clAct1Type').value = acts[0].type || 'module';
    $('clAct1Url').value = acts[0].url || '';
    $('clAct2Id').value = acts[1].id || ''; $('clAct2Title').value = acts[1].title || '';
    $('clAct2Desc').value = acts[1].desc || ''; $('clAct2Type').value = acts[1].type || 'module';
    $('clAct2Url').value = acts[1].url || '';
    $('clSequential').checked = !!l.sequential;
  } else {
    $('clMulti').checked = false;
    ['clAct1Id','clAct1Title','clAct1Desc','clAct1Url','clAct2Id','clAct2Title','clAct2Desc','clAct2Url']
      .forEach(id => { $(id).value = ''; });
    $('clSequential').checked = false;
  }
  clToggleMulti();

  switchClSubtab('add');
  $('clTitle').focus();
}

function dashResetLessonForm(){
  $('clEditRow').value = '';
  $('clId').value = ''; $('clId').disabled = false;
  $('clTitle').value = ''; $('clDesc').value = ''; $('clUrl').value = ''; $('clPublic').checked = false;
  $('clOwner').value = TEACHER_NAME || '공통';
  $('clOwnerHint').style.display = 'none';
  $('clThinkingType').value = '';
  $('clBadgeName').value = ''; // v24
  clRefreshBadgeNameOptions();
  $('clMulti').checked = false;
  ['clAct1Id','clAct1Title','clAct1Desc','clAct1Url','clAct2Id','clAct2Title','clAct2Desc','clAct2Url']
    .forEach(id => { $(id).value = ''; });
  $('clSequential').checked = false;
  clToggleMulti();
  $('clEditBanner').style.display = 'none';
  $('clPublicRow').style.display = 'flex';
  $('btnAddLesson').textContent = '활동 추가';
}

async function dashUpdateLesson(btn, row){
  const title = $('clTitle').value.trim();
  const desc = $('clDesc').value.trim();
  const type = $('clType').value;
  const url = $('clUrl').value.trim();
  const owner = $('clOwner').value;
  const thinkingType = $('clThinkingType').value;
  const badgeName = $('clBadgeName').value.trim(); // v24
  if(!title){ showToast('제목은 필수예요.'); return; }

  const activities = clCollectActivitiesFromForm();
  if(activities){
    if(!activities[0].id || !activities[0].title || !activities[1].id || !activities[1].title){
      showToast('활동 2개 모드에서는 각 활동의 id·제목이 필수예요.'); return;
    }
  }
  const sequential = activities ? $('clSequential').checked : false;

  btn.disabled = true; btn.textContent = '저장하는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'updateLesson', token:TOKEN, row, title, desc, type, url, activities, sequential, owner, thinkingType, badgeName })
    });
    // v23 버그 수정 — addLesson과 동일: 서버 응답을 확인 안 하면 백엔드가 던진 에러가
    // 조용히 묻히고 무조건 "저장했어요"가 뜸. result:'success' 아니면 실패로 처리.
    const json = await res.json().catch(() => null);
    if(!json || json.result !== 'success'){
      showToast('저장하지 못했어요' + (json && json.message ? ': ' + json.message : '') + ' — 다시 시도해 주세요.');
      return;
    }
    dashResetLessonForm();
    showToast('활동 내용을 수정했어요.');
    await dashLoadData();
    dashRenderLessons();
    dashSyncCurriculum_();
  }catch(e){
    showToast('저장하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '활동 추가';
  }
}

async function dashToggleLessonPublic(btn){
  const row = btn.dataset.row;
  btn.disabled = true;
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'toggleLessonPublic', token:TOKEN, row })
    });
    const l = LESSONS_ADMIN.find(x => String(x._row) === String(row));
    if(l){ l.public = !l.public; }
    dashRenderLessons();
    dashSyncCurriculum_();
  }catch(e){
    showToast('처리하지 못했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false;
  }
}

/* ── 질문함 (교사) ── */
/* v30: 로그인한 교사가 담당하지 않는 반의 질문은 목록에서 아예 제외.
 * "전체 보기" 토글은 두지 않음(다른 반 질문을 볼 필요가 없다는 전제) — 필요해지면 그때 추가.
 * dashMyBans_()가 null이면 그 학년은 "담당 구분 없음"이라 필터링하지 않고 전부 노출(기존
 * 학생 화면 필터링 규칙과 동일). */
function dashVisibleQuestions_(){
  return QUESTIONS.filter(q => {
    const mine = dashMyBans_(q.grade);
    return mine ? mine.includes(Number(q.ban)) : true;
  });
}
const DQ_DONE_OPEN = new Set(); // v105 — 펼쳐 둔 «답변 완료» 질문의 시트 행 번호
function dashRenderQuestions(){
  const list = $('dqList');
  const visible = dashVisibleQuestions_();
  const waiting = visible.filter(q => q.status !== '답변완료');
  const done = visible.filter(q => q.status === '답변완료');
  const byNewest = (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0); // v90 — 그룹 안에선 최신 먼저
  const sorted = [...waiting.sort(byNewest), ...done.sort(byNewest)]; // 대기중 먼저
  const badge = $('dqBadge');
  const msgWaiting = dashRenderMessages_(); // v62 — 학생 답장이 마지막인 스레드 수
  const totalWaiting = waiting.length + msgWaiting;
  if(totalWaiting){
    badge.textContent = totalWaiting + '건 대기';
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
  if(!sorted.length){
    list.innerHTML = '<p class="empty-hint">아직 들어온 질문이 없어요.</p>';
    return;
  }
  // v105 — 대기 중 질문은 위에 펼쳐 두고, 답변 완료는 한 줄(상태·학생·질문 앞부분)로 접는다. 펼친 항목은 DQ_DONE_OPEN에 기억해 재렌더(답변 수정 뒤)에도 유지.
  const itemHtml = q => {
    const isDone = q.status === '답변완료';
    return `
      <div class="dq-item">
        <div class="dq-meta">${formatDate(q.timestamp)} · ${escapeHtml(q.studentName)} (${escapeHtml(String(q.studentId))}) · ${q.grade}학년 ${q.ban}반
          <span class="q-status ${isDone ? 'done' : 'wait'}">${isDone ? '답변완료' : '대기중'}</span>
        </div>
        <div class="dq-text">${escapeHtml(q.question)}</div>
        ${isDone ? `<div class="dq-answer"><b>내 답변</b><br>${escapeHtml(q.answer)}</div>` : ''}
        <div class="dq-reply-form">
          <textarea class="dq-reply-text" placeholder="${isDone ? '답변을 수정하려면 다시 입력…' : '답변을 입력…'}"></textarea>
          <button data-row="${q._row}" onclick="dashAnswerQuestion(this)">${isDone ? '답변 수정' : '답변 보내기'}</button>
        </div>
      </div>`;
  };
  list.innerHTML = sorted.map(q => q.status !== '답변완료' ? itemHtml(q) : `
    <details class="dq-done" data-row="${q._row}"${DQ_DONE_OPEN.has(String(q._row)) ? ' open' : ''}>
      <summary>
        <span class="q-status done">답변완료</span>
        <span class="dq-done-text"><b>${escapeHtml(q.studentName)}</b> · ${escapeHtml(q.question)}</span>
        <span class="dq-done-meta">${q.grade}학년 ${q.ban}반 · ${formatDate(q.timestamp)}</span>
      </summary>
      ${itemHtml(q)}
    </details>`).join('');
  list.querySelectorAll('details.dq-done').forEach(d => {
    d.addEventListener('toggle', () => { d.open ? DQ_DONE_OPEN.add(d.dataset.row) : DQ_DONE_OPEN.delete(d.dataset.row); });
  });
}

/* ── 개인 메시지 스레드 (교사, v62) ──
 * 학생 한 명당 스레드 하나. 교사가 먼저 보내야 시작되고(질문함은 학생이 먼저), 학생이 답장하면
 * 같은 스레드에 쌓인다. 스레드 위젯(dashMsgThreadHtml_)은 두 곳에서 같이 쓴다 — ① 질문함 탭의
 * 스레드 목록(아래 dashRenderMessages_), ② 학생 상세 카드 안(dashDetailRowHtml). 새 스레드는
 * ②에서만 시작한다(질문함 탭엔 이미 존재하는 스레드만 보임).
 * "답장 대기"는 별도 읽음 상태 없이 "스레드의 마지막 메시지가 학생 것"으로 판정한다.
 * 담당 반 필터링은 질문함과 같은 규칙(dashMyBans_). */
let dmOpenSid = null;
function dashMsgThreadRows_(sid){
  return MESSAGES.filter(m => String(m.studentId) === String(sid))
    .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
}
function dashMsgThreadHtml_(sid, name){
  const rows = dashMsgThreadRows_(sid);
  const bubbles = rows.map(m => `
    <div class="msg-bubble ${m.from === '교사' ? 'from-me' : 'from-teacher'}">
      <div class="msg-meta">${m.from === '교사' ? '나' : escapeHtml(name)} · ${formatDate(m.timestamp)}${m.from === '교사' ? (m.read ? ' · 읽음' : ' · 안 읽음') : ''}</div>
      <div class="msg-text">${escapeHtml(m.content)}</div>
    </div>`).join('');
  return `
    <div class="msg-wrap" data-sid="${escapeHtml(String(sid))}" data-name="${escapeHtml(name)}">
      ${rows.length ? `<div class="msg-thread">${bubbles}</div>` : '<p class="muted" style="margin:0 0 8px;">아직 주고받은 메시지가 없어요. 보내면 학생 포털에 알림이 떠요.</p>'}
      <div class="dq-reply-form">
        <textarea class="msg-text-input" maxlength="1000" placeholder="${escapeHtml(name)} 학생에게 보낼 메시지…"></textarea>
        <button class="btn btn-sm" onclick="dashSendMessage(this)">${rows.length ? '보내기' : '메시지 시작'}</button>
      </div>
    </div>`;
}
function dashRenderMessages_(){
  const box = $('dmList');
  if(!box) return 0;
  const byStudent = {};
  MESSAGES.forEach(m => {
    const mine = dashMyBans_(m.grade);
    if(mine && !mine.includes(Number(m.ban))) return;
    (byStudent[String(m.studentId)] = byStudent[String(m.studentId)] || []).push(m);
  });
  const threads = Object.values(byStudent).map(list => {
    list.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const last = list[list.length - 1];
    return { sid: String(last.studentId), name: String(last.studentName), grade: last.grade, ban: last.ban,
             last, waiting: last.from === '학생' };
  }).sort((a,b) => (b.waiting - a.waiting) || (new Date(b.last.timestamp) - new Date(a.last.timestamp)));
  if(!threads.length){ box.innerHTML = ''; return 0; }
  const waitingCount = threads.filter(t => t.waiting).length;
  box.innerHTML = `
    <div class="dm-box">
      <h3 class="dm-title">💌 개인 메시지 <span class="muted">— 새 메시지는 학생 상세 카드에서 시작해요</span>${waitingCount ? `<span class="dq-badge">${waitingCount}명 답장 도착</span>` : ''}</h3>
      ${threads.map(t => `
        <details class="dm-thread${t.waiting ? ' waiting' : ''}" ${dmOpenSid === t.sid ? 'open' : ''} data-sid="${escapeHtml(t.sid)}">
          <summary>
            <b>${escapeHtml(t.name)}</b> <span class="muted">${t.grade}학년 ${t.ban}반 · ${escapeHtml(t.sid)}</span>
            ${t.waiting ? '<span class="q-status wait">답장 도착</span>' : ''}
            <span class="dm-last">${escapeHtml(dashShorten(String(t.last.content), 40))}</span>
          </summary>
          ${dashMsgThreadHtml_(t.sid, t.name)}
        </details>`).join('')}
    </div>`;
  box.querySelectorAll('details.dm-thread').forEach(d => {
    d.addEventListener('toggle', () => { if(d.open) dmOpenSid = d.dataset.sid; });
  });
  return waitingCount;
}
async function dashSendMessage(btn){
  const wrap = btn.closest('.msg-wrap');
  const text = wrap.querySelector('.msg-text-input').value.trim();
  if(!text){ showToast('메시지 내용을 입력해 주세요.'); return; }
  const sid = wrap.dataset.sid, name = wrap.dataset.name;
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'sendMessage', token: TOKEN, studentId: sid, studentName: name, content: text })
    });
    const data = await res.json();
    if(data.result !== 'success'){
      // 서버가 준 검증 메시지("메시지는 1000자까지…")만 그대로 보여준다. 재배포 전이라 action을 모르면
      // gameName 에러가 오므로, 그때는 아래 catch의 일반 안내로 떨어지게 한다.
      const err = new Error(data.message || '실패');
      err.fromServer = /메시지|학번/.test(String(data.message || ''));
      throw err;
    }
    const p = parseStudentId(sid);
    MESSAGES.push({ _row: null, timestamp: new Date().toISOString(), studentId: sid, studentName: name,
      grade: p ? p.grade : '', ban: p ? p.ban : '', from: '교사', content: text, read: false, teacher: TEACHER_NAME || '' });
    dmOpenSid = sid;
    showToast('메시지를 보냈어요. 학생 포털에 알림이 떠요.');
    dashRenderQuestions();
    if(openDetailSid === sid) renderDash();
  }catch(e){
    btn.disabled = false; btn.textContent = label;
    showToast(e.fromServer ? e.message : '보내지 못했어요. 다시 시도해 주세요. (백엔드 재배포 전이면 보낼 수 없어요)');
  }
}

async function dashAnswerQuestion(btn){
  const wrap = btn.closest('.dq-item');
  const text = wrap.querySelector('.dq-reply-text').value.trim();
  if(!text){ showToast('답변 내용을 입력해 주세요.'); return; }
  const row = btn.dataset.row;
  btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action:'answerQuestion', token: TOKEN, row, answer: text })
    });
    const q = QUESTIONS.find(x => String(x._row) === String(row));
    if(q){ q.answer = text; q.status = '답변완료'; }
    showToast('답변을 보냈어요. 학생 포털의 질문함에 표시됩니다.');
    dashRenderQuestions();
  }catch(e){
    btn.disabled = false; btn.textContent = '답변 보내기';
    showToast('보내지 못했어요. 다시 시도해 주세요.');
  }
}

/* v29 — 로그인한 교사(TEACHER_NAME)가 이 학년에서 담당하는 반 번호 배열.
 * 학년정보에 트랙이 설정 안 돼 있거나 TEACHER_NAME을 모르면 null. */
function dashMyBans_(grade){
  if(!TEACHER_NAME) return null;
  const cur = CONFIG.CURRICULUM[grade];
  if(!cur) return null;
  if(TEACHER_NAME === '효니') return (cur.hyoBans && cur.hyoBans.length) ? cur.hyoBans : null;
  if(TEACHER_NAME === '미현쌤') return (cur.mihyunBans && cur.mihyunBans.length) ? cur.mihyunBans : null;
  return null;
}
/* v29 — selBan 값 하나로 "전체 반"(''), "내 담당 반"('mine'), 특정 반(숫자 문자열)을
 * 모두 처리하기 위한 판정 함수. 'mine'인데 트랙이 아직 설정 안 돼 있으면 안전하게
 * 전체로 취급(아무도 안 걸러지는 쪽이 "내 반만 봤다고 착각"보다 낫다). */
function banMatches_(banValue, grade, studentBan){
  if(!banValue) return true;
  if(banValue === 'mine'){
    const mine = dashMyBans_(grade);
    return mine ? mine.includes(studentBan) : true;
  }
  return studentBan === Number(banValue);
}
/* v29 — selBan 값에 대응하는 커리큘럼 차시 목록(활동 드롭다운 구성용). */
function lessonsForBanSelection_(cur, banValue){
  if(!banValue) return cur.lessons;
  if(banValue === 'mine') return cur.lessons.filter(l => !l.owner || l.owner === TEACHER_NAME);
  return filterLessonsForBan(cur, Number(banValue));
}

function dashInitFilters(){
  const grades = Object.keys(CONFIG.CURRICULUM);
  $('selGrade').innerHTML = grades.map(g =>
    `<option value="${g}">${g}학년 ${CONFIG.CURRICULUM[g].subject}</option>`).join('');
  const withData = grades.find(g => ROWS.some(r => parseStudentId(String(r.studentId)).grade === Number(g)));
  if(withData) $('selGrade').value = withData;
  dashRefreshBanOptions();
  dashRefreshActivityOptions();
}
/* v29 — "내 담당 반" 옵션을 맨 위(전체 반 다음)에 추가하고, 있으면 기본 선택으로 씀.
 * 학년을 바꿀 때마다 다시 호출되므로, 학년이 바뀌어도 항상 "내 반부터" 보이게 됨. */
function dashRefreshBanOptions(){
  const grade = Number($('selGrade').value);
  const bans = [...new Set(ROWS.map(r => parseStudentId(String(r.studentId)))
    .filter(p => p.grade === grade).map(p => p.ban))].sort((a,b)=>a-b);
  const mine = dashMyBans_(grade);
  const mineOpt = mine ? `<option value="mine">내 담당 반 (${mine.join(',')})</option>` : '';
  $('selBan').innerHTML = '<option value="">전체 반</option>' + mineOpt
    + bans.map(b => `<option value="${b}">${b}반</option>`).join('');
  if(mine) $('selBan').value = 'mine';
}
/* v27: 활동 드롭다운은 "차시"가 아니라 "활동" 단위로 나열 — ROWS의 gameName은
 * 항상 활동 자신의 id(다중활동 차시라면 activities[i].id)와 일치하므로, 필터가
 * 실제로 걸리려면 여기 옵션도 활동 id를 값으로 가져야 함.
 * v28: 특정 반이 선택돼 있으면 그 반 트랙에 맞는 차시만 나열(다른 트랙 차시는 애초에
 * 그 반 학생 누구도 할 수 없으니 필터 옵션에 있을 이유가 없음). "전체 반"이면 트랙
 * 구분 없이 전부 보여줌(여러 트랙 학생이 섞여 있을 수 있으므로). v29: "내 담당 반" 처리 추가.
 * v46(2026-09-09, 효니 리포트 "활동 먼저 고르고 반 바꾸면 활동이 날아감"): innerHTML을
 * 통째로 새로 그리면 브라우저가 선택값을 강제로 첫 옵션("전체 활동")으로 되돌리는데,
 * 지금까지 그 복원을 안 해줘서 반을 바꿀 때마다(호출부는 selBan change 리스너)
 * 골라둔 활동이 매번 초기화됐다. 재구성 전 값을 기억해뒀다가, 새 옵션 목록에 같은
 * 활동id가 그대로 있으면 복원 — 다른 반 트랙이라 그 활동 자체가 없어지는 경우엔
 * (원래도 의미 없는 조합이므로) 예전처럼 "전체 활동"으로 되돌아간다. */
function dashRefreshActivityOptions(){
  const grade = Number($('selGrade').value);
  const ban = $('selBan').value;
  const prevAct = $('selActivity').value;
  const cur = CONFIG.CURRICULUM[grade];
  const lessons = lessonsForBanSelection_(cur, ban);
  /* v60 — 피드백용 드롭다운이라 (1) 학생 기록이 실제로 있는 활동만, (2) 최신 차시부터(역순),
   * (3) 지난 활동은 구분선 아래로 뺀다. 기록 유무는 현재 학년·반 범위의 ROWS 기준.
   * 지난 여부(isPast)는 학생용 커리큘럼 응답에 없어서 교사용 LESSONS_ADMIN에서 id로 찾는다. */
  const recIds = new Set(ROWS.filter(r => {
    const p = parseStudentId(String(r.studentId));
    return p.grade === grade && banMatches_(ban, grade, p.ban);
  }).map(r => String(r.gameName)));
  const pastLessonIds = new Set(LESSONS_ADMIN.filter(x => Number(x.grade) === grade && x.isPast).map(x => x.id));
  const active = [], past = [];
  lessons.slice().reverse().forEach(l => {
    l.activities.forEach((act, idx) => {
      if(!recIds.has(String(act.id))) return;
      const label = l.activities.length > 1
        ? `${l.title} · ${act.title && act.title.trim() ? act.title.trim() : (idx+1)+'활동'}`
        : l.title;
      (pastLessonIds.has(l.id) ? past : active).push({ id: act.id, label });
    });
  });
  const optHtml = o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`;
  $('selActivity').innerHTML = '<option value="">전체 활동</option>'
    + active.map(optHtml).join('')
    + (past.length ? '<option value="" disabled>── 지난 활동 ──</option>' + past.map(optHtml).join('') : '');
  if(prevAct && [...active, ...past].some(o => o.id === prevAct)) $('selActivity').value = prevAct;
}

/* v60 — 커리큘럼 관리 탭에서 순서·지난활동·공개·내용을 바꾼 뒤 학생 기록 탭이 쓰는
 * CONFIG.CURRICULUM(페이지 로딩 때 1회만 받음)을 다시 받아 활동 드롭다운·목록에 반영. */
async function dashSyncCurriculum_(){
  if(!(await loadCurriculum())) return;
  dashRefreshActivityOptions();
  renderDash();
}

/* v25 — 학생 검색 (2-1)
 * 현재 선택된 학년·반과 무관하게 ROWS 전체에서 학번/이름으로 찾은 뒤,
 * 클릭하면 그 학생의 학년·반으로 필터를 자동 전환하고 상세 카드를 열어줌.
 * 드롭다운 필터로는 "지금 보고 있는 범위 안"에서만 찾을 수 있었는데,
 * 이 검색은 범위를 몰라도 이름/학번만 알면 바로 찾을 수 있게 하는 게 목적. */
function dashBuildStudentIndex_(){
  const map = {};
  ROWS.forEach(r => {
    const sid = String(r.studentId);
    if(!map[sid]) map[sid] = { sid, name: String(r.studentName||''), p: parseStudentId(sid) };
  });
  return Object.values(map);
}
function dashSearchStudents_(query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  const all = dashBuildStudentIndex_();
  return all.filter(s => s.sid.includes(q) || s.name.toLowerCase().includes(q))
    .sort((a,b) => a.p.grade - b.p.grade || a.p.ban - b.p.ban || a.p.num - b.p.num)
    .slice(0, 8);
}
function dashRenderSearchResults_(matches){
  const box = $('studentSearchResults');
  if(!matches.length){
    box.innerHTML = '<div class="ssr-empty">일치하는 학생이 없어요</div>';
    box.style.display = 'block';
    return;
  }
  box.innerHTML = matches.map(s =>
    `<div class="ssr-item" data-sid="${s.sid}">
       <span class="ssr-name">${escapeHtml(s.name)}</span>
       <span class="ssr-meta">${s.p.grade}학년 ${s.p.ban}반 · ${s.sid}</span>
     </div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.ssr-item').forEach(el => {
    el.addEventListener('click', () => dashJumpToStudent_(el.dataset.sid));
  });
}
function dashJumpToStudent_(sid){
  const p = parseStudentId(sid);
  if(!p) return;
  $('selGrade').value = String(p.grade);
  dashRefreshBanOptions();
  $('selBan').value = String(p.ban);
  dashRefreshActivityOptions();
  $('selActivity').value = '';
  openDetailSid = sid;
  $('studentSearch').value = '';
  $('studentSearchResults').style.display = 'none';
  renderDash();
  const tr = document.querySelector(`tr.student-row[data-sid="${sid}"]`);
  if(tr) tr.scrollIntoView({ behavior:'smooth', block:'center' });
}

/* ── AI 작성 의심 경고 (v61) ──
 * 백엔드(ai_module v9.4)가 행마다 'AI작성의심도'(낮음/중간/높음)·'AI작성의심근거'를 채운다.
 * 행 단위 배지는 이미 있었지만(v23) 한 학생이 여러 번 걸리는지는 행을 하나씩 펼쳐야 보였다.
 * 여기선 학생별로 누적해 "반복"을 드러낸다 — 어휘 수준이 원래 높은 학생은 1번 걸려도 오탐일 수
 * 있으니 1회는 참고, SUSPECT_REPEAT_MIN회 이상이면 주의로 나눈다.
 * - 집계 단위는 활동(gameName): 같은 활동을 다시 제출해 여러 행이 생겨도 1회로 센다.
 *   한 활동에서는 등급이 채워진 행 중 가장 최근 것을 기준으로 삼는다(재제출로 '낮음'이 나오면 해제).
 * - 학년·반 필터만 따르고 활동 필터는 무시한다(활동 하나만 보면 반복 여부를 알 수 없음).
 * - 참고용 판정이며 확정이 아니다. 학생 화면엔 이 값이 내려가지 않는다(백엔드 studentGet_이 안 읽음). */
const SUSPECT_REPEAT_MIN = 2;
let SUSPECT_STATS = {};
/* v65 — 교사 검토 표시(게임활동_로그 23열 '의심검토': ''/문제없음/상담함). ⚠️ 횟수(반복 판정)엔 영향이 없다 — 오탐으로
 * 확인한 건도 그대로 세는 게 효니 확정 사항(반복되는 문제를 놓치지 않으려고). 검토 표시는 "이미 본 건"을 경고에서
 * 구분해 주는 용도일 뿐이다. 백엔드 재배포 전엔 컬럼 자체가 없어 전부 미확인으로 보인다. */
function dashSuspectReview_(r){ return String(r['의심검토'] || '').trim(); }
/* v68 — 작성 과정 신호(게임활동_로그 24~26열: 이탈횟수/이탈초/붙여넣기글자수). 웹앱이 최종 제출 때 같이 보낸 값이라
 * 옛 웹앱 제출은 세 칸이 빈칸이다(0과 구분 — 빈칸이면 신호 없음으로 표시 자체를 생략). 집계·참고용이며 의심도(AI 판정)와
 * 합치지 않고 나란히만 보여준다: 글 판정과 행동 신호는 서로 다른 근거라 섞으면 어느 쪽이 이유인지 흐려진다. 학생 화면 노출 금지. */
const FOCUS_LEAVE_WARN = 3, FOCUS_PASTE_WARN = 80;
function dashFocusSignal_(r){
  const raw = [r.focusLeaveCount, r.focusLeaveSec, r.pasteChars];
  if(raw.every(v => v === '' || v === undefined || v === null)) return null;
  const leaves = Number(raw[0]) || 0, sec = Number(raw[1]) || 0, paste = Number(raw[2]) || 0;
  return { leaves, sec, paste, flagged: leaves >= FOCUS_LEAVE_WARN || paste >= FOCUS_PASTE_WARN };
}
function dashFocusText_(f){
  const m = Math.floor(f.sec / 60), s = f.sec % 60;
  return `화면 이탈 ${f.leaves}회(${m ? m + '분 ' : ''}${s}초) · 붙여넣기 ${f.paste}자`;
}
/* v72 — 평소 대비(게임활동_로그 27열 '평소대비'). 백엔드가 같은 학생의 이전 글(글자 수·문어체 종결 비율)과 비교해 GAS에서
 * 로컬 계산한 메모('평소와 다름: …'/'평소 범위 …'/'기준 부족 …')다. Gemini 판정이 아니고 의심도 등급·반복 횟수(🔍×N)에 영향이
 * 없다 — 이탈·붙여넣기 신호처럼 나란히만 보여준다("높음"인데 평소 범위면 잘 쓰는 학생의 오탐 가능성을 가늠하는 용도).
 * 백엔드 v39 재배포 전엔 컬럼이 없어 빈값이라 표시 자체가 안 나온다. 학생 화면 노출 금지. */
function dashBaselineNote_(r){ return String(r['평소대비'] || '').trim(); }
function dashBaselineKind_(note){ return note.startsWith('평소와 다름') ? 'diff' : note.startsWith('평소 범위') ? 'same' : ''; }
/* v73 — 교차 확인: 글 판정(🔍 중간/높음)과 행동 신호(이탈·붙여넣기가 FOCUS_*_WARN 이상)가 같은 기록에서 함께 걸린 경우.
 * 두 근거가 서로 다른 출처라 겹칠 때 더 눈여겨볼 만하다는 표시일 뿐이다 — ⚠️ 의심도 등급·반복 횟수(items.length)·검토 표시·
 * Gemini 프롬프트엔 영향이 없다(확정 원칙). 박스에서 먼저 정렬하고 칩에 👁을 붙이는 데만 쓴다. 학생 화면 노출 금지. */
function dashCrossCheck_(r){
  const lv = String(r['AI작성의심도']||'').trim();
  if(lv !== '중간' && lv !== '높음') return false;
  const f = dashFocusSignal_(r);
  return !!(f && f.flagged);
}
const REC_OPEN = new Set(); // v65 — 상세 카드에서 펼친 기록(재렌더돼도 안 접히게, 검토 버튼 누른 뒤 자리 유지)
function dashSuspectStats_(){
  const latest = {}; // sid → gameName → 등급이 있는 가장 최근 행
  ROWS.forEach(r => {
    const lv = String(r['AI작성의심도']||'').trim();
    if(!lv) return;
    const sid = String(r.studentId), g = String(r.gameName);
    const m = latest[sid] = latest[sid] || {};
    if(!m[g] || new Date(r.timestamp) > new Date(m[g].timestamp)) m[g] = r;
  });
  const stats = {};
  Object.keys(latest).forEach(sid => {
    const items = Object.values(latest[sid])
      .filter(r => { const lv = String(r['AI작성의심도']).trim(); return lv === '중간' || lv === '높음'; })
      .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    if(!items.length) return;
    stats[sid] = {
      sid, name: String(items[0].studentName||''), p: parseStudentId(sid), items,
      high: items.filter(r => String(r['AI작성의심도']).trim() === '높음').length,
      cross: items.filter(dashCrossCheck_).length,   // v73 — 정렬·표시 전용, 횟수와 무관
      open: items.filter(r => !dashSuspectReview_(r)).length   // v65 — 아직 검토 표시 안 한 건수
    };
  });
  return stats;
}
function dashSuspectChipHtml_(sid){
  const s = SUSPECT_STATS[String(sid)];
  if(!s) return '';
  const rep = s.items.length >= SUSPECT_REPEAT_MIN;
  const done = s.open === 0; // 전부 검토 표시됨 — 횟수는 그대로 두고 ✓만 덧붙임
  return `<span class="suspect-chip${rep ? ' rep' : ''}${done ? ' checked' : ''}" title="AI 작성 의심 ${s.items.length}건${s.cross ? `(글 판정+이탈·붙여넣기가 함께 걸린 기록 ${s.cross}건 👁)` : ''}${done ? ' (전부 확인함)' : `, 미확인 ${s.open}건`} — 참고용, 확정 아님">🔍×${s.items.length}${done ? ' ✓' : ''}${s.cross ? ` 👁${s.cross}` : ''}</span>`;
}
function dashRenderSuspectBox_(){
  SUSPECT_STATS = dashSuspectStats_();
  const box = $('suspectBox');
  const grade = Number($('selGrade').value);
  const ban = $('selBan').value;
  const inScope = Object.values(SUSPECT_STATS).filter(s =>
    s.p && s.p.grade === grade && banMatches_(ban, grade, s.p.ban))
    .sort((a,b) => (b.cross > 0) - (a.cross > 0) || b.items.length - a.items.length || b.high - a.high || a.p.ban - b.p.ban || a.p.num - b.p.num);
  if(!inScope.length){ box.style.display = 'none'; box.innerHTML = ''; return; }
  const needs = inScope.filter(s => s.open > 0);
  const repeat = needs.filter(s => s.items.length >= SUSPECT_REPEAT_MIN);
  const once = needs.filter(s => s.items.length < SUSPECT_REPEAT_MIN);
  const cleared = inScope.filter(s => s.open === 0);
  const openTotal = inScope.reduce((n, s) => n + s.open, 0);
  const crossTotal = inScope.reduce((n, s) => n + s.cross, 0); // v73 — 글 판정+행동 신호가 함께 걸린 기록(표시용)
  const repeatAll = inScope.filter(s => s.items.length >= SUSPECT_REPEAT_MIN).length; // 검토 여부와 무관하게 센다
  const chipHtml = r => {
    const rv = dashSuspectReview_(r);
    const hi = String(r['AI작성의심도']).trim() === '높음';
    const bk = dashBaselineKind_(dashBaselineNote_(r));
    const cx = dashCrossCheck_(r);
    const fs = cx ? dashFocusSignal_(r) : null;
    return `<span class="si-act${hi ? ' hi' : ''}${rv ? ' rv' : ''}${bk === 'same' ? ' bl-same' : ''}${cx ? ' cross' : ''}" title="${escapeHtml((rv ? `[${rv}] ` : '') + String(r['AI작성의심근거']||'근거 없음') + (dashBaselineNote_(r) ? ` / 평소 대비: ${dashBaselineNote_(r)}` : '') + (fs ? ` / 교차 확인: ${dashFocusText_(fs)}` : ''))}">${cx ? '👁 ' : ''}${rv ? (rv === '상담함' ? '💬 ' : '✓ ') : ''}${escapeHtml(dashShorten(dashLessonTitle(String(r.gameName)), 12))}</span>`;
  };
  const rowHtml = s => `
    <li class="suspect-item" data-sid="${s.sid}">
      <span class="si-who"><b>${escapeHtml(s.name)}</b> <span class="muted">${s.p.grade}학년 ${s.p.ban}반 · ${s.sid}</span></span>
      <span class="si-count">${s.items.length}회${s.high ? ` · 높음 ${s.high}` : ''}${s.open < s.items.length ? ` · 확인 ${s.items.length - s.open}` : ''}</span>
      <span class="si-acts">${s.items.map(chipHtml).join('')}</span>
    </li>`;
  box.classList.toggle('clear', openTotal === 0);
  box.innerHTML = `
    <div class="suspect-head">
      🔍 <b>AI 작성 의심 확인</b>
      <span class="suspect-sum">확인 필요 <b>${openTotal}건</b>${crossTotal ? ` · 👁 교차 확인 <b>${crossTotal}건</b>` : ''} · 반복 ${SUSPECT_REPEAT_MIN}회 이상 <b>${repeatAll}명</b></span>
    </div>
    <details class="fold-note" data-fold="suspectNote"><summary>설명 보기</summary>
    <div class="suspect-note">참고용 판정이라 확정이 아니에요. 1회는 평소 어휘 수준이 높은 학생일 수 있어서 참고만, 반복되면 이야기를 나눠 볼 만해요. 학생 상세 카드에서 "확인함/상담함"으로 표시해도 <b>횟수는 그대로</b> 남아요(오탐이어도 반복 여부를 볼 수 있게). 학생 화면에는 보이지 않아요. 👁은 글 판정과 화면 이탈·붙여넣기가 같은 기록에서 함께 걸렸다는 표시로, 먼저 정렬만 되고 <b>횟수·등급엔 영향이 없어요</b>(사료 확인 등 정당한 이탈도 포함).</div></details>
    ${repeat.length ? `<ul class="suspect-list rep">${repeat.map(rowHtml).join('')}</ul>` : ''}
    ${once.length ? `<details class="suspect-once"><summary>1회 해당 학생 ${once.length}명 보기</summary><ul class="suspect-list">${once.map(rowHtml).join('')}</ul></details>` : ''}
    ${cleared.length ? `<details class="suspect-once"><summary>확인 완료 ${cleared.length}명 보기</summary><ul class="suspect-list">${cleared.map(rowHtml).join('')}</ul></details>` : ''}
    <details class="suspect-once suspect-table-wrap" id="suspectTableWrap"${SUSPECT_TABLE.open ? ' open' : ''}><summary>📋 표로 보기 (${inScope.reduce((n, s) => n + s.items.length, 0)}건)</summary><div id="suspectTable"></div></details>`;
  box.style.display = 'block';
  box.querySelectorAll('details[data-fold]').forEach(dashFoldInit_); // v105
  SUSPECT_SCOPE = inScope;
  const tw = $('suspectTableWrap');
  tw.addEventListener('toggle', () => { SUSPECT_TABLE.open = tw.open; if(tw.open) dashRenderSuspectTable_(); });
  if(SUSPECT_TABLE.open) dashRenderSuspectTable_();
  box.querySelectorAll('.suspect-item').forEach(el => {
    el.addEventListener('click', () => dashJumpToStudent_(el.dataset.sid));
  });
}

/* v78 — 의심 기록 표 보기(시트처럼 한눈에). 박스는 학생별 누적이라 "의심 기록 전체를 줄 세워 훑기"엔 불편해서, 같은 집계(SUSPECT_STATS의
 * 학생×활동 최신 행, 중간/높음)를 한 줄에 한 기록으로 펼친다. 학년·반 필터만 따르고 활동 필터는 무시(박스와 같음).
 * ⚠️ 읽기 전용 표시라 PREVIEW_MODE 가드가 필요한 쓰기·ack가 없다. 정렬·"검토 대기만"은 화면용일 뿐 반복 횟수·의심도 등급·
 * 검토 표시에 영향이 없고, 이탈·붙여넣기·평소대비는 의심도와 섞지 않고 열만 나란히 둔다(확정 원칙). 학생 화면 노출 금지(교사 대시보드 전용). */
const SUSPECT_TABLE = { open:false, sort:'level', dir:1, pending:false };
let SUSPECT_SCOPE = [];
function dashSuspectTableRows_(){
  const lvRank = r => String(r['AI작성의심도']).trim() === '높음' ? 0 : 1;
  const sig = r => dashFocusSignal_(r);
  const keys = {
    level:  x => [lvRank(x.r), x.s.p.ban, x.s.p.num],
    who:    x => [x.s.p.ban, x.s.p.num],
    act:    x => [String(dashLessonTitle(String(x.r.gameName)))],
    leaves: x => { const f = sig(x.r); return [f ? -f.leaves : 1]; },   // 신호 없는 옛 제출은 항상 맨 아래
    paste:  x => { const f = sig(x.r); return [f ? -f.paste : 1]; },
    review: x => [dashSuspectReview_(x.r) ? 1 : 0, lvRank(x.r)]
  };
  const kf = keys[SUSPECT_TABLE.sort] || keys.level;
  let rows = [];
  SUSPECT_SCOPE.forEach(s => s.items.forEach(r => rows.push({ s, r })));
  if(SUSPECT_TABLE.pending) rows = rows.filter(x => !dashSuspectReview_(x.r));
  const cmp = (a, b) => {
    const ka = kf(a), kb = kf(b);
    for(let i = 0; i < ka.length; i++){
      if(ka[i] < kb[i]) return -1 * SUSPECT_TABLE.dir;
      if(ka[i] > kb[i]) return 1 * SUSPECT_TABLE.dir;
    }
    return 0;
  };
  return rows.sort(cmp);
}
function dashRenderSuspectTable_(){
  const el = $('suspectTable');
  if(!el) return;
  const rows = dashSuspectTableRows_();
  const th = (key, label) => `<th class="st-sort${SUSPECT_TABLE.sort === key ? ' on' : ''}" data-sort="${key}">${label}${SUSPECT_TABLE.sort === key ? (SUSPECT_TABLE.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`;
  const body = rows.map(({ s, r }) => {
    const hi = String(r['AI작성의심도']).trim() === '높음';
    const f = dashFocusSignal_(r);
    const note = dashBaselineNote_(r), bk = dashBaselineKind_(note);
    const rv = dashSuspectReview_(r);
    return `<tr${rv ? ' class="rv"' : ''}>
      <td class="st-who"><b>${escapeHtml(s.name)}</b><div class="muted">${s.sid}</div><button class="btn btn-sm btn-ghost" data-jump="${s.sid}" type="button">상세 ↗</button></td>
      <td>${escapeHtml(dashShorten(dashLessonTitle(String(r.gameName)), 18))}<div class="muted">${escapeHtml(String(r['성취수준'] || r.achievement || ''))}</div></td>
      <td class="st-lv${hi ? ' hi' : ''}">${escapeHtml(String(r['AI작성의심도']).trim())}</td>
      <td><div class="st-text" title="눌러서 펼치기">${escapeHtml(String(r['AI작성의심근거'] || '근거 없음'))}</div></td>
      <td><div class="st-text" title="눌러서 펼치기">${escapeHtml(String(r.reflection || '—'))}</div></td>
      <td class="st-num${f && f.leaves >= FOCUS_LEAVE_WARN ? ' warn' : ''}">${f ? `${f.leaves}회<div class="muted">${f.sec}초</div>` : '<span class="muted" title="신호 없음(옛 제출)">—</span>'}</td>
      <td class="st-num${f && f.paste >= FOCUS_PASTE_WARN ? ' warn' : ''}">${f ? `${f.paste}자` : '<span class="muted" title="신호 없음(옛 제출)">—</span>'}</td>
      <td class="st-bl${bk ? ' ' + bk : ''}">${escapeHtml(note || '—')}</td>
      <td class="st-rv">${rv ? (rv === '상담함' ? '💬 상담함' : '✓ 문제없음') : '<span class="muted">대기</span>'}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div class="st-tools">
      <label><input type="checkbox" id="stPending"${SUSPECT_TABLE.pending ? ' checked' : ''}> 검토 대기만</label>
      <span class="muted">${rows.length}건 · 열 제목을 누르면 정렬 · 글을 누르면 펼침 · 참고용 판정(확정 아님)</span>
    </div>
    <div class="st-scroll"><table class="st-table">
      <thead><tr>${th('who', '학생')}${th('act', '활동')}${th('level', '의심도')}<th>근거</th><th>학생 서술</th>${th('leaves', '이탈')}${th('paste', '붙여넣기')}<th>평소 대비</th>${th('review', '검토')}</tr></thead>
      <tbody>${body || '<tr><td colspan="9" class="muted">표시할 기록이 없어요.</td></tr>'}</tbody>
    </table></div>`;
  $('stPending').addEventListener('change', e => { SUSPECT_TABLE.pending = e.target.checked; dashRenderSuspectTable_(); });
  el.querySelectorAll('th[data-sort]').forEach(h => h.addEventListener('click', () => {
    const k = h.dataset.sort;
    if(SUSPECT_TABLE.sort === k) SUSPECT_TABLE.dir *= -1; else { SUSPECT_TABLE.sort = k; SUSPECT_TABLE.dir = 1; }
    dashRenderSuspectTable_();
  }));
  el.querySelectorAll('.st-text').forEach(t => t.addEventListener('click', () => t.classList.toggle('open')));
  el.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => dashJumpToStudent_(b.dataset.jump)));
}

function dashFilteredRows(){
  const grade = Number($('selGrade').value);
  const ban = $('selBan').value;
  const act = $('selActivity').value;
  return ROWS.filter(r => {
    const p = parseStudentId(String(r.studentId));
    if(p.grade !== grade) return false;
    if(!banMatches_(ban, grade, p.ban)) return false;
    if(act && String(r.gameName) !== act) return false;
    return true;
  });
}

/* ── 학급 공통 피드백 (v34, v47(2026-09-09)에 오개념 섹션·전체 반 범위 추가) ──
 * 지금까지 AI 코멘트(aiComment)는 학생 한 명 단위였고, 반 전체의 공통 경향을
 * 읽는 건 효니가 기록을 하나씩 펼쳐보며 수동으로 해왔음. 이 섹션은 "학년+활동을
 * 골랐을 때"만 나타나는 박스로, 그 범위에 해당하는 학생 글(선택 요약·학생
 * 서술·1줄요약·판단근거)을 모아 AI에게 학급 공통 피드백(잘한 점/보완점 리포트,
 * 학생 공지용 문구, 대표적인 오개념)을 만들게 하고 결과를 시트에 저장해 다음에
 * 다시 열어도 볼 수 있게 한다.
 *
 * "반"이 '전체 반'(ban==='')이면 켜지 않는다 — 학기 초에 반 구분 없는 범위도 잠깐
 * 지원했었는데(v47), 효니가 그 대신 "내 담당 반" 범위를 원해서 v49에서 되돌리고
 * 바꿨다. 대신 'mine'(내 담당 반 여러 개 묶음)과 개별 반은 둘 다 허용 — 'mine'은
 * `dashClassFeedbackBanParam_()`이 그 시점의 `dashMyBans_()` 결과를 콤마 문자열로
 * 미리 풀어서 서버에 보낸다(공지 대상 "담당 학급반", v30과 완전히 같은 관례 —
 * 저장 키가 "그때 담당 반이 뭐였는지"로 고정되므로, 나중에 담당 반 배정이 바뀌어도
 * 이미 생성된 리포트의 범위는 안 흔들린다). '활동'은 여전히 '전체 활동'이 아니라
 * 하나가 골라졌을 때만 — 활동마다 글의 성격이 달라서 섞으면 의미가 없다.
 *
 * 백엔드(history26_backend)는 2026-09-09~10에 반영·배포 완료. */
function dashClassFeedbackFind_(grade, ban, activityId){
  return CLASS_FEEDBACKS.find(f =>
    Number(f.grade) === grade && String(f.ban) === String(ban) && String(f.activityId) === String(activityId));
}
/* v49 — selBan 값('mine'/숫자문자열/'')을 실제로 서버에 보낼 ban 파라미터로 변환.
 * 'mine'이면 dashMyBans_()로 그 시점의 담당 반을 콤마 문자열로 풀고(담당 반이 아직
 * 안 정해져 있으면 빈 문자열 — 호출부가 박스를 숨김), 숫자 반이면 그대로, ''(전체
 * 반)은 이 기능에서 지원하지 않으므로 호출 전에 걸러져야 한다. */
function dashClassFeedbackBanParam_(grade, banScope){
  if(banScope === 'mine'){
    const mine = dashMyBans_(grade);
    return mine ? mine.join(',') : '';
  }
  return banScope;
}
/* v76 — 범위 표시 정리. ban이 콤마 목록(2개 반 이상)이면 "학년 공통", 반 하나면 "학급"이라고
 * 부른다. 서버(classFeedbackForStudent_)는 개별 반 행을 묶음 행보다 우선해 학생에게 내려주므로,
 * 같은 학년·활동의 다른 범위 행을 함께 보여줘서 어느 반이 어느 피드백을 받는지 대시보드에서 읽히게 한다. */
function dashFbBanList_(ban){
  return String(ban || '').split(',').map(x => Number(String(x).trim())).filter(n => n > 0);
}
function dashFbScopeName_(banList){
  return banList.length > 1 ? '학년 공통' : '학급';
}
function dashFbScopeBans_(banList){
  return banList.length > 1 ? banList.join(',') + '반' : banList[0] + '반';
}
/* 같은 학년·활동의 다른 범위 행 목록. 현재 보고 있는 범위(banParam)는 "지금 보는 중"으로 표시하고,
 * 묶음 행은 개별 반 행에 가려지는 반(=학생에게 개별 것이 나가는 반)을 덧붙인다. */
function dashFbScopeListHtml_(grade, banParam, activityId){
  const rows = CLASS_FEEDBACKS.filter(f =>
    Number(f.grade) === grade && String(f.activityId) === String(activityId) && String(f.studentText || '').trim());
  if(rows.length < 2) return '';
  const singles = new Set();
  rows.forEach(f => { const l = dashFbBanList_(f.ban); if(l.length === 1) singles.add(l[0]); });
  const items = rows
    .map(f => ({ f, list: dashFbBanList_(f.ban) }))
    .sort((a, b) => b.list.length - a.list.length)
    .map(({ f, list }) => {
      const covered = list.length > 1 ? list.filter(b => singles.has(b)) : [];
      const note = covered.length ? ` <span class="muted">(${covered.join(',')}반은 개별 피드백이 우선)</span>` : '';
      const cur = String(f.ban) === String(banParam) ? ' <span class="class-fb-live-badge">지금 보는 중</span>' : '';
      return `<li>${dashFbScopeName_(list)} ${escapeHtml(dashFbScopeBans_(list))}${note}${cur}</li>`;
    }).join('');
  return `<div class="class-fb-section">
      <div class="class-fb-section-label">같은 활동의 다른 범위 피드백</div>
      <ul class="class-fb-scope-list">${items}</ul>
    </div>`;
}
function dashRenderClassFeedback(){
  const box = $('classFbBox');
  if(!box) return;
  const grade = Number($('selGrade').value);
  const banScope = $('selBan').value;
  const act = $('selActivity').value;

  // '전체 반'이거나 활동이 안 골라졌으면 숨김. '내 담당 반'(mine)·개별 반은 허용.
  const banParam = banScope ? dashClassFeedbackBanParam_(grade, banScope) : '';
  if(!banParam || !act){
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'block';

  const scopedRows = dashFilteredRows();
  const studentCount = new Set(scopedRows.map(r => String(r.studentId))).size;
  const activityLabel = dashLessonTitle(act);
  const existing = dashClassFeedbackFind_(grade, banParam, act);
  const banList = dashFbBanList_(banParam);
  const scopeName = dashFbScopeName_(banList);
  const scopeLabel = escapeHtml(dashFbScopeBans_(banList));

  // v35 — 교사용 리포트와 학생 공지용 문구를 나눠서 보여줌. 학생용 문구는
  // studentGet_이 자동으로 학생 포털(활동 완료 카드)에도 실어 보내므로, 여기서는
  // "이미 학생에게 보이고 있다"는 걸 함께 알려주고 복사 버튼으로 패들렛·학급 공지
  // 등 다른 곳에 옮겨 붙일 수 있게 한다.
  let bodyHtml;
  if(existing){
    const studentText = String(existing.studentText || '').trim();
    const studentSection = studentText
      ? `<div class="class-fb-section-label">학생 공지용 문구 <span class="class-fb-live-badge">🟢 학생 포털에 표시 중</span></div>
         <div class="class-fb-text class-fb-student-text">${escapeHtml(studentText)}</div>
         <button type="button" class="btn-tiny class-fb-copy">📋 복사</button>`
      : `<div class="class-fb-section-label">학생 공지용 문구</div>
         <p class="muted" style="margin:0;font-size:.85rem;">⚠️ 생성에 실패했어요 — "다시 생성"을 눌러보세요. (학생 포털엔 안 보이는 상태예요)</p>`;
    // 2026-09-09 신규 — 대표적인 오개념(교사 전용, 학생 화면엔 절대 안 보임).
    // 옛 배포 결과라 misconceptions 필드 자체가 없거나 빈 문자열이면 섹션 자체를 숨긴다.
    const misconceptions = String(existing.misconceptions || '').trim();
    const misconSection = misconceptions
      ? `<div class="class-fb-section">
           <div class="class-fb-section-label">🧩 대표적인 오개념 <span class="class-fb-teacher-badge">교사 전용</span></div>
           <div class="class-fb-text">${escapeHtml(misconceptions)}</div>
         </div>`
      : '';
    bodyHtml = `
      <div class="class-fb-section">
        <div class="class-fb-section-label">교사용 리포트</div>
        <div class="class-fb-text">${escapeHtml(existing.feedback)}</div>
      </div>
      ${misconSection}
      <div class="class-fb-section">${studentSection}</div>
      <div class="class-fb-meta">${formatDate(existing.timestamp)} 생성 · 학생 글 ${existing.studentCount || studentCount}건 기반</div>`;
  } else {
    bodyHtml = `<p class="muted" style="margin:0 0 10px;">아직 이 범위에 대한 학급 공통 피드백이 없어요.</p>`;
  }

  const genLabel = existing ? '🔄 다시 생성' : '🤖 학급 공통 피드백 생성';
  const disabled = studentCount ? '' : 'disabled';

  box.innerHTML = `
    <div class="class-fb-head">
      <span class="class-fb-title">🏫 ${grade}학년 ${scopeLabel} · ${escapeHtml(activityLabel)} — ${scopeName} 피드백</span>
      <span class="class-fb-count">참여 학생 글 ${studentCount}건</span>
    </div>
    ${bodyHtml}
    ${dashFbScopeListHtml_(grade, banParam, act)}
    <button type="button" class="btn btn-sm class-fb-gen" ${disabled}>${genLabel}</button>
    ${studentCount ? '' : '<p class="muted" style="margin:6px 0 0;font-size:.82rem;">이 조건에 해당하는 학생 글이 아직 없어요.</p>'}
  `;
  box.querySelector('.class-fb-gen').addEventListener('click', dashGenerateClassFeedback);
  const copyBtn = box.querySelector('.class-fb-copy');
  if(copyBtn) copyBtn.addEventListener('click', () => dashCopyClassFeedbackText_(existing.studentText, copyBtn));
}
/* v35 — 클립보드 복사(패들렛·학급 공지 등에 바로 붙여넣기용). Clipboard API가
 * 막혀있는 환경(권한 거부, 구형 브라우저)도 있어 실패하면 조용히 넘기지 않고
 * 안내 토스트로 대체 — 학생 공지용 문구는 위 class-fb-student-text에서 직접
 * 드래그해서 복사할 수 있으니 완전히 막히진 않는다. */
async function dashCopyClassFeedbackText_(text, btn){
  try{
    await navigator.clipboard.writeText(String(text || ''));
    showToast('학생 공지용 문구를 복사했어요.');
  }catch(e){
    showToast('복사에 실패했어요 — 문구를 직접 드래그해서 복사해 주세요.');
  }
}
async function dashGenerateClassFeedback(ev){
  const btn = ev.currentTarget;
  const grade = Number($('selGrade').value);
  const banScope = $('selBan').value;
  const ban = dashClassFeedbackBanParam_(grade, banScope); // 'mine'은 담당 반 콤마 문자열로 풀어서 보냄
  const act = $('selActivity').value;
  const prevLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '생성 중… (몇 초 걸릴 수 있어요)';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({ action:'generateClassFeedback', token:TOKEN, grade, ban, activityId: act })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '생성 실패');
    if(!data.entry) throw new Error('서버 응답에 결과가 없어요');
    const idx = CLASS_FEEDBACKS.findIndex(f =>
      Number(f.grade) === grade && String(f.ban) === String(ban) && String(f.activityId) === String(act));
    if(idx >= 0) CLASS_FEEDBACKS[idx] = data.entry; else CLASS_FEEDBACKS.push(data.entry);
    showToast(data.studentTextMissing
      ? '교사용 리포트는 생성됐지만 학생용 문구는 실패했어요 — 다시 생성해 보세요.'
      : '학급 공통 피드백을 생성했어요. (학생 포털에도 바로 표시돼요)');
    dashRenderClassFeedback();
  }catch(e){
    showToast('생성하지 못했어요: ' + e.message);
    btn.disabled = false;
    btn.textContent = prevLabel;
  }
}

/* 미검토 AI 코멘트 수 (전체 기준) */
function aiUnreviewedCount(){
  return ROWS.filter(r =>
    String(r['AI코멘트']||'').trim() && !String(r['AI코멘트확인']||'').trim()
  ).length;
}

/* v27 — 차시(l) 전체 activities id의 Set. 학생별 doneIds/achieve 계산에서
 * "이 차시를 다 끝냈는지" 판정할 때 반복해서 쓰여서 헬퍼로 뺌. */
function lessonAllActivityIds_(l){
  return l.activities.map(a => a.id);
}

function renderDash(){
  const grade = Number($('selGrade').value);
  const ban = $('selBan').value;
  const act = $('selActivity').value;
  const cur = CONFIG.CURRICULUM[grade];
  const rows = dashFilteredRows();

  /* 미검토 AI 코멘트 알림 */
  const unrev = aiUnreviewedCount();
  $('aiNotice').style.display = unrev ? 'block' : 'none';
  $('aiNoticeCount').textContent = unrev;
  dashFoldInit_($('aiNotice')); // v105

  dashRenderClassFeedback(); // v34
  dashRenderSuspectBox_();   // v61

  const gradeRows = ROWS.filter(r => {
    const p = parseStudentId(String(r.studentId));
    return p.grade === grade && banMatches_(ban, grade, p.ban);
  });
  const students = {};
  gradeRows.forEach(r => {
    const sid = String(r.studentId);
    if(!students[sid]) students[sid] = { sid, name:String(r.studentName||''), p:parseStudentId(sid), records:[] };
    students[sid].records.push(r);
  });
  const list = Object.values(students).sort((a,b) => a.p.ban - b.p.ban || a.p.num - b.p.num);

  DASH_STUDENT_ORDER = list.map(s => ({ sid: s.sid, name: s.name })); // v64 — 미리보기 이전/다음 학생 순서
  list.forEach(s => {
    s.doneIds = new Set(s.records.map(r => String(r.gameName)));
    s.achieve = {};
    s.records.forEach(r => {
      const id = String(r.gameName);
      const lv = String(r['성취수준']||'').trim();
      const prev = s.achieve[id];
      if(!prev || lv || !String(prev['성취수준']||'').trim()) s.achieve[id] = r;
    });
    // v28: 진행률 분모는 이 학생 반의 트랙(효니/미현쌤/공통 없음)에 맞는 차시만 —
    // 트랙이 갈리면 반마다 "전체 차시 개수" 자체가 달라지므로 학생별로 따로 계산.
    const myActive = filterLessonsForBan(cur, s.p.ban).filter(l => l.activities.some(a => a.url || a.urlByBan));
    // v27: "완료한 차시"는 그 차시의 활동 id를 전부 doneIds에 갖고 있어야 인정.
    const done = myActive.filter(l => lessonAllActivityIds_(l).every(id => s.doneIds.has(id))).length;
    s.pct = myActive.length ? Math.round(done/myActive.length*100) : 0;
    s.doneCount = done;
    s.totalLessons = myActive.length; // v28
    s.feedbacks = FEEDBACKS.filter(f => String(f.studentId).trim() === s.sid);
    // v37 — fb-dot이 "이 학생한테 피드백을 준 적 있음"(한 번 뜨면 학기 내내 안 꺼짐)이
    // 아니라 "학생이 아직 확인 안 한 피드백이 있음"을 뜻하도록 전환(핸드오프 "피드백
    // 알림/모아보기/읽음 상태" Phase 2). ack는 서버(FEEDBACKS 시트 '확인여부')가 내려주는
    // 값이라 로컬 상태가 아니라 실제 학생이 도착 팝업을 확인했는지를 반영함 — 교사가
    // 여러 기기(컴퓨터/아이패드/휴대폰 등)로 접속해도 항상 같은 값을 본다.
    s.hasUnreadFeedback = s.feedbacks.some(f => !f.ack);
    // v26(2-2): 활동별 열 대신 표에서는 "최근 활동"과 "평균 성취"만 요약해서 보여줌.
    // 개별 활동 성취는 표에서 빼는 대신 상세 카드(펼쳐보기)에 그대로 남겨둠.
    s.recentRecord = dashMostRecentRecord_(s.records);
    s.avgAchieve = dashAvgAchieveInfo_(Object.values(s.achieve));
  });

  /* v92 — 활동을 고르면 그 활동 글을 낸 학생만 표에 남기고(글 미리보기·제출 시각을 같이 보여줌),
   * 기록은 있는데 이 활동만 안 낸 학생은 표 아래에 이름으로 알려 준다. */
  const hasAct = s => s.records.some(r => String(r.gameName) === act);
  const viewList = act ? list.filter(hasAct) : list;
  const missing = act ? list.filter(s => !hasAct(s)) : [];
  const missEl = $('actMissing');
  if(act && missing.length){
    missEl.style.display = '';
    missEl.textContent = `이 활동 기록이 없는 학생 ${missing.length}명(다른 활동 기록은 있음): ` + missing.map(s => s.name).join(', ');
  } else { missEl.style.display = 'none'; }

  $('sumStudents').textContent = viewList.length;
  $('sumProgress').textContent = list.length
    ? Math.round(list.reduce((a,s)=>a+s.pct,0)/list.length) : 0;

  const cnt = { 상:0, 중:0, 하:0 };
  rows.forEach(r => { const l = String(r['성취수준']||'').trim(); if(cnt[l]!==undefined) cnt[l]++; });
  $('cntSang').textContent = cnt['상']; $('cntJung').textContent = cnt['중']; $('cntHa').textContent = cnt['하'];
  $('distScope').textContent = act ? '(선택한 활동)' : '(전체 활동)';
  const total = cnt['상']+cnt['중']+cnt['하'];
  $('distBar').innerHTML = total ?
    `<div class="dist-sang" style="width:${cnt['상']/total*100}%"></div>
     <div class="dist-jung" style="width:${cnt['중']/total*100}%"></div>
     <div class="dist-ha" style="width:${cnt['하']/total*100}%"></div>`
    : '<div style="width:100%;background:var(--line);"></div>';

  const tagCnt = {};
  rows.forEach(r => { const t = String(r['분류태그']||'').trim(); if(t) tagCnt[t]=(tagCnt[t]||0)+1; });
  const topTags = Object.entries(tagCnt).sort((a,b)=>b[1]-a[1]).slice(0,6);
  $('tagList').innerHTML = topTags.length
    ? topTags.map(([t,n]) => `<span class="tag-chip">${escapeHtml(t)} <small>${n}</small></span>`).join('')
    : '<span class="muted">아직 분석된 태그가 없어요</span>';

  $('rowCount').textContent = `기록 ${rows.length}건`;

  $('tableHead').innerHTML = act
    ? '<tr><th>학번</th><th>이름</th><th>제출</th><th>성취</th><th>글 미리보기</th></tr>'
    : '<tr><th>학번</th><th>이름</th><th>진행률</th><th>최근 활동</th><th>평균 성취</th></tr>';

  if(!viewList.length){
    $('tableBody').innerHTML = `<tr><td colspan="5" class="empty-line">아직 이 조건에 해당하는 학생 기록이 없어요.</td></tr>`;
    return;
  }

  $('tableBody').innerHTML = viewList.map(s => {
    let cells3;
    if(act){
      const mine = s.records.filter(r => String(r.gameName) === act)
        .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      const rec = mine[0], lv = String(rec['성취수준']||'').trim();
      const text = String(rec['1줄요약'] || rec.choiceSummary || '').trim();
      cells3 = `<td>${escapeHtml(formatDate(rec.timestamp))}${mine.length > 1 ? ` <span class="dup-badge">${mine.length}건</span>` : ''}</td>
        <td><span class="tbl-dots" title="${escapeHtml(lv || '분석 전')}">${dashDots(lv)} ${escapeHtml(lv || '분석 전')}</span></td>
        <td class="tbl-preview">${text ? escapeHtml(text) : '<span class="muted">—</span>'}</td>`; /* v95 — 70자에서 잘려 뒷부분이 안 보였음: 전체를 보여 줌 */
    }
    const recentCell = s.recentRecord
      ? `<span class="tbl-recent" title="${escapeHtml(formatDate(s.recentRecord.timestamp) + ' · ' + dashLessonTitle(String(s.recentRecord.gameName)))}">
           ${escapeHtml(dashShorten(dashLessonTitle(String(s.recentRecord.gameName)), 20))}<!-- v90 — 10자는 PC에서 너무 잘림, 전체 이름은 title -->
           <span class="tbl-dots" title="${escapeHtml(String(s.recentRecord['성취수준']||'분석 전'))}">${dashDots(String(s.recentRecord['성취수준']||'').trim())}</span>
         </span>`
      : '<span class="muted">—</span>';
    const avgCell = s.avgAchieve
      ? `<span class="tbl-dots" title="분석된 활동 ${s.avgAchieve.count}건 기준">${dashDots(s.avgAchieve.label)} ${s.avgAchieve.label} (${s.avgAchieve.avg})</span>`
      : '<span class="muted">분석 전</span>';
    return `
      <tr class="student-row" data-sid="${s.sid}">
        <td>${s.sid}</td>
        <td>${escapeHtml(s.name)}${s.hasUnreadFeedback ? '<span class="fb-dot" title="학생이 아직 확인 안 한 피드백이 있어요"></span>' : ''}${dashSuspectChipHtml_(s.sid)}</td>
        ${act ? cells3 : `<td><span class="prog-mini"><span class="track"><span class="fill" style="width:${s.pct}%"></span></span>${s.doneCount}/${s.totalLessons}</span></td>
        <td>${recentCell}</td>
        <td>${avgCell}</td>`}
      </tr>
      ${openDetailSid === s.sid ? dashDetailRowHtml(s, filterLessonsForBan(cur, s.p.ban), 5) : ''}`;
  }).join('');

  document.querySelectorAll('tr.student-row').forEach(tr => {
    tr.addEventListener('click', () => {
      openDetailSid = (openDetailSid === tr.dataset.sid) ? null : tr.dataset.sid;
      renderDash();
    });
  });
  document.querySelectorAll('.fb-send').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashSendFeedback(btn); });
  });
  document.querySelectorAll('tr.detail-row').forEach(tr => {
    tr.addEventListener('click', ev => ev.stopPropagation());
  });
  document.querySelectorAll('.ai-confirm').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashAiConfirm(btn); });
  });
  document.querySelectorAll('.ai-editbtn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashAiEditToggle(btn); });
  });
  document.querySelectorAll('.ai-hide').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashAiHide(btn); });
  });
  document.querySelectorAll('.pp-toggle').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashPointToggle(btn); });
  });
  document.querySelectorAll('.pp-type-btn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashPointTypeSelect(btn); });
  });
  document.querySelectorAll('.pp-level-btn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashPointLevelSelect(btn); });
  });
  document.querySelectorAll('.pp-send').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashGrantPresentationPoint(btn); });
  });
  document.querySelectorAll('details.rec-collapse[data-row]').forEach(d => {  // v65 — 펼친 기록 기억
    d.addEventListener('toggle', () => {
      if(!d.dataset.row) return;
      if(d.open) REC_OPEN.add(d.dataset.row); else REC_OPEN.delete(d.dataset.row);
    });
  });
}

/* ── 발표 탐구포인트 지급 (v31 핸드오프, v33에서 빠른 지급 탭 추가,
 * 2026-09-04에 수준별 차등 지급 추가) ──
 * 발표처럼 웹앱 밖에서 일어나는 즉흥 활동에 포인트를 즉시 지급하는 통로.
 * 발표는 1회성(재도전 없음) — 사고유형 선택 시 수준(하4/중6/상9)만큼 점수 +
 * 해당 유형 배지 집계용 기록, 무선택("유형 없이 지급")이면 배지 집계와 무관한
 * 순수 포인트만 적립. 실제 achievement 컬럼/점수 저장 방식은 백엔드
 * (grantPresentationPoint action, PRESENTATION_POINTS_BY_LEVEL) 책임 — 이
 * 레포는 버튼과 결과 표시만.
 * ⚠️ 수준을 '하'/'중'으로 고르면 그 발표는 학습 칭호(결정왕 등) 대상에서
 * 빠진다(백엔드가 achievement==='상'인 것만 집계) — 포인트는 그대로 들어감.
 *
 * v33: 이 상자(pp-box)는 두 군데서 쓰인다 — ① 학생 상세 카드 안(접힌 채 시작,
 * 토글 버튼으로 펼침), ② "탐구포인트" 탭에서 학생 검색으로 고른 직후(처음부터
 * 펼쳐진 채로 렌더링, 토글 버튼 없음 — openByDefault=true). 어느 쪽인지는
 * DOM 위치(#ppSelected 안인지)로 dashGrantPresentationPoint가 판단해서,
 * 지급 성공 시 ①은 폼만 접고 ②는 선택 자체를 지워 다음 학생 검색으로 돌아간다. */
const PP_THINKING_TYPES = ['판단', '비교', '해석', '관점'];
const PP_LEVELS = [
  { key:'하', points:4 },
  { key:'중', points:6 },
  { key:'상', points:9 }
];
function dashPointBoxHtml_(s, openByDefault){
  const toggleBtn = openByDefault ? '' : `<button type="button" class="btn btn-sm pp-toggle">🎤 + 탐구포인트</button>`;
  const formHidden = openByDefault ? '' : ' hidden';
  return `<div class="pp-box" data-sid="${s.sid}" data-name="${escapeHtml(s.name)}">
    ${toggleBtn}
    <div class="pp-form"${formHidden}>
      <!-- v95 — 발표는 유형을 고민하지 않게 기본 '판단'으로 두고, 바꾸고 싶을 때만 펼친다. -->
      <details class="pp-types-wrap">
        <summary class="pp-types-sum">유형: <b>판단</b> (기본) — 바꾸려면 펼치기</summary>
        <div class="pp-types">
          ${PP_THINKING_TYPES.map(t => `<button type="button" class="pp-type-btn${t === '판단' ? ' is-selected' : ''}" data-type="${t}">${t}</button>`).join('')}
          <button type="button" class="pp-type-btn pp-type-none" data-type="">유형 없이 지급</button>
        </div>
      </details>
      <div class="pp-levels">
        ${PP_LEVELS.map(l => `<button type="button" class="pp-level-btn${l.key === '중' ? ' is-selected' : ''}" data-level="${l.key}" data-points="${l.points}">${l.key} (+${l.points})</button>`).join('')}
      </div>
      <textarea class="pp-reason" placeholder="사유(선택) — 예: 1차 세계사 발표, 원인 분석 논리적"></textarea>
      <button type="button" class="btn btn-sm pp-send">지급 (+6점)</button>
    </div>
  </div>`;
}
function dashPointToggle(btn){
  const form = btn.closest('.pp-box').querySelector('.pp-form');
  form.hidden = !form.hidden;
}
function dashPointTypeSelect(btn){
  btn.closest('.pp-types').querySelectorAll('.pp-type-btn').forEach(b => b.classList.remove('is-selected'));
  btn.classList.add('is-selected');
  const sum = btn.closest('.pp-types-wrap').querySelector('.pp-types-sum');
  sum.innerHTML = '유형: <b>' + (btn.dataset.type || '없음') + '</b>' + (btn.dataset.type === '판단' ? ' (기본)' : '') + ' — 바꾸려면 펼치기';
}
function dashPointLevelSelect(btn){
  btn.closest('.pp-levels').querySelectorAll('.pp-level-btn').forEach(b => b.classList.remove('is-selected'));
  btn.classList.add('is-selected');
  btn.closest('.pp-form').querySelector('.pp-send').textContent = `지급 (+${btn.dataset.points}점)`;
}
async function dashGrantPresentationPoint(btn){
  const box = btn.closest('.pp-box');
  const sid = box.dataset.sid, name = box.dataset.name;
  const typeBtn = box.querySelector('.pp-type-btn.is-selected');
  const thinkingType = typeBtn ? typeBtn.dataset.type : '';
  const levelBtn = box.querySelector('.pp-level-btn.is-selected');
  const level = levelBtn ? levelBtn.dataset.level : '중';
  const reason = box.querySelector('.pp-reason').value.trim();
  const inQuickTab = !!box.closest('#ppSelected');
  btn.disabled = true; btn.textContent = '지급 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({
        action:'grantPresentationPoint', token:TOKEN,
        studentId: sid, studentName: name, thinkingType, reason, level
      })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '지급 실패');
    const grantedPoints = data.points || 6;
    showToast(`${name} 학생에게 ${thinkingType ? thinkingType + ' ' : ''}탐구포인트 +${grantedPoints}점을 지급했어요.`);
    // v33 — "방금 지급함" 목록에 추가(세션 메모리만, 새로고침하면 비워짐).
    PP_RECENT.unshift({ sid, name, thinkingType, level: data.level || level, points: grantedPoints, timestamp: new Date().toISOString() });
    if(PP_RECENT.length > 20) PP_RECENT.length = 20;
    ppRenderRecent_();
    if(inQuickTab){
      $('ppSelected').innerHTML = ''; // 다음 학생 검색으로 바로 이어가게 비움
      return;
    }
    box.querySelector('.pp-reason').value = '';
    box.querySelectorAll('.pp-type-btn').forEach(b => b.classList.remove('is-selected'));
    box.querySelector('.pp-type-none').classList.add('is-selected');
    box.querySelectorAll('.pp-level-btn').forEach(b => b.classList.remove('is-selected'));
    box.querySelector('.pp-level-btn[data-level="중"]').classList.add('is-selected');
    box.querySelector('.pp-form').hidden = true;
  }catch(e){
    showToast('지급하지 못했어요: ' + e.message);
  }finally{
    btn.disabled = false;
    const curLevelBtn = box.querySelector('.pp-level-btn.is-selected');
    btn.textContent = `지급 (+${curLevelBtn ? curLevelBtn.dataset.points : 6}점)`;
  }
}

/* ── 탐구포인트 빠른 지급 탭 (v33 신규) ──
 * 학생 기록 탭에서 학년·반 드롭다운으로 걸러 표 안에서 행을 찾고, 그 상세
 * 카드를 펼쳐야만 있던 "+ 탐구포인트" 버튼을 전용 탭으로 분리 — 발표는 수업
 * 중 바로바로 눌러야 하는데 그 경로가 너무 길었음(효니 피드백). 학생 검색은
 * v25에 이미 있던 dashSearchStudents_(학번/이름, 학년·반 몰라도 전체에서 찾음)를
 * 그대로 재사용하고, 결과를 클릭하면 dashJumpToStudent_처럼 상세로 점프하는
 * 대신 이 자리에서 바로 펼쳐진 지급 폼을 보여준다. */
function ppRenderSearchResults_(matches){
  const box = $('ppSearchResults');
  if(!matches.length){
    box.innerHTML = '<div class="ssr-empty">일치하는 학생이 없어요</div>';
    box.style.display = 'block';
    return;
  }
  box.innerHTML = matches.map(s =>
    `<div class="ssr-item" data-sid="${s.sid}" data-name="${escapeHtml(s.name)}">
       <span class="ssr-name">${escapeHtml(s.name)}</span>
       <span class="ssr-meta">${s.p.grade}학년 ${s.p.ban}반 · ${s.sid}</span>
     </div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.ssr-item').forEach(el => {
    el.addEventListener('click', () => ppPickStudent_(el.dataset.sid, el.dataset.name));
  });
}
function ppPickStudent_(sid, name){
  $('ppSearch').value = '';
  $('ppSearchResults').style.display = 'none';
  $('ppSelected').innerHTML = `
    <div class="pp-picked">
      <span class="pp-picked-name">${escapeHtml(name)}</span>
      <span class="pp-picked-meta">${escapeHtml(sid)}</span>
      <button type="button" class="btn-tiny" onclick="ppClearSelected_()">다른 학생 검색</button>
    </div>
    ${dashPointBoxHtml_({ sid, name }, true)}`;
  document.querySelectorAll('#ppSelected .pp-type-btn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashPointTypeSelect(btn); });
  });
  document.querySelectorAll('#ppSelected .pp-level-btn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashPointLevelSelect(btn); });
  });
  document.querySelectorAll('#ppSelected .pp-send').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); dashGrantPresentationPoint(btn); });
  });
}
function ppClearSelected_(){
  $('ppSelected').innerHTML = '';
}
/* v105 — 최근 지급 5건. 이미 불러온 ROWS 중 발표 지급 행(gameName이 '발표_'로 시작 — 백엔드 PRESENTATION_PREFIX)을 최신순으로 5건 보여 준다.
 * 이번 화면에서 방금 지급했지만 ROWS에는 아직 없는 건(PP_RECENT)도 합친다. 같은 학생·2분 이내 행이 ROWS에 있으면 같은 건으로 보고 한 번만 센다.
 * 새 요청은 없고 읽기만 하므로 PREVIEW_MODE 분기는 필요 없다. 점수는 시트 22열(헤더 '탐구포인트(발표)'), 수준은 11열('성취수준'). */
function ppRecentGrants_(){
  const fromRows = ROWS.filter(r => String(r.gameName || '').indexOf('발표_') === 0).map(r => ({
    sid: String(r.studentId), name: String(r.studentName || ''),
    thinkingType: String(r.gameName).replace('발표_', '').replace('기타', ''),
    level: String(r['성취수준'] || '').trim(), points: Number(r['탐구포인트(발표)']) || 0,
    reason: String(r.choiceSummary || '').trim(), timestamp: r.timestamp
  }));
  const fresh = PP_RECENT.filter(g => !fromRows.some(r => r.sid === String(g.sid)
    && Math.abs((Date.parse(r.timestamp) || 0) - (Date.parse(g.timestamp) || 0)) < 120000));
  return [...fromRows, ...fresh]
    .sort((x, y) => (Date.parse(y.timestamp) || 0) - (Date.parse(x.timestamp) || 0)).slice(0, 5);
}
function ppRenderRecent_(){
  const el = $('ppRecent');
  if(!el) return;
  const list = ppRecentGrants_();
  if(!list.length){ el.innerHTML = ''; return; }
  el.innerHTML = `<p class="pp-recent-title">✅ 최근 지급 ${list.length}건</p>`
    + list.map(g => `
      <div class="pp-recent-item">
        <span class="pp-recent-name">${escapeHtml(g.name)} <small>(${escapeHtml(g.sid)})</small></span>
        <span class="pp-recent-type">${g.thinkingType ? escapeHtml(g.thinkingType) : '유형 없음'} · ${escapeHtml(g.level || '중')}(+${g.points || 6}점)${g.reason ? ' · ' + escapeHtml(dashShorten(g.reason, 24)) : ''}</span>
        <span class="pp-recent-time">${formatDate(g.timestamp)}</span>
      </div>`).join('');
}

/* ── 역사법정 결과 re_judge 자동 등록 (2026-09-04 신규) ──
 * 백엔드 courtCasePush action이 검사/변호인/배심원 제출을 모아 re_judge의
 * createCase→updateStatements를 대신 호출해준다. 이 활동은 3학년 5~8반 전용이라
 * 학년은 고정하고 반만 고른다. gameName은 his_judge_goryeo의 CONFIG.GAME_NAME과
 * 반드시 일치해야 함 — 다른 역할극 웹앱이 생기면 이 상수도 같이 늘릴 것.
 * 서버가 result:'partial'을 돌려주면(re_judge 응답에서 caseId를 못 찾은 경우) 사건은
 * 만들어졌지만 진술은 자동으로 안 채워진 상태 — 안내 메시지 그대로 보여준다. */
const COURT_CASE_GAME_NAME = '3차시_권문세족_역사법정';
async function dashCourtCasePush(btn){
  const ban = $('ccPushBan').value;
  const statusEl = $('ccPushStatus');
  btn.disabled = true; btn.textContent = '등록 중…';
  statusEl.textContent = '';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method:'POST',
      body: JSON.stringify({
        action:'courtCasePush', token:TOKEN,
        gameName: COURT_CASE_GAME_NAME, grade:'3', ban
      })
    });
    const data = await res.json();
    if(data.result === 'success'){
      statusEl.textContent = `✅ 등록 완료 — 검사 ${data.prosecutionCount}명 · 변호인 ${data.defenseCount}명 · 배심원 ${data.juryCount}명. re_judge 목록에서 확인해줘.`;
    } else if(data.result === 'partial'){
      statusEl.textContent = `⚠️ ${data.message}`;
    } else {
      statusEl.textContent = `❌ ${data.message || '등록 실패'}`;
    }
  }catch(e){
    statusEl.textContent = '❌ 등록하지 못했어: ' + e.message;
  }finally{
    btn.disabled = false; btn.textContent = 're_judge에 자동 등록';
  }
}

/* ── 성적 엑셀 업로드 (교사, 2026-09-15 신규 — 핸드오프 "성적조회 통합 v2") ──
 * 파일을 base64로 읽어 action=uploadGradeExcel로 보낸다. 업로드에 성공하면
 * 그 시트가 즉시 활성 조회 대상이 된다(이전 시트는 더 이상 조회되지 않음 —
 * 원본 스크립트와 동일한 "덮어쓰기" 방식). */
