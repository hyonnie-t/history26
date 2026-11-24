/* ══════════════ 교과 독서기록장 (v189, 2026-11-24) ══════════════
 * 2027 1학기 교과 독서. 독서로(read365)는 공개 API·교사 일괄 등록이 없어(2026-11-24 확인) 공식 기록은 학생이 독서로에 직접 붙이고,
 * 여기는 수업 활동 기록(밑줄·내 질문·한 줄 평·150자 글)과 교사 채점 보조다. 백엔드 history26_backend `99_reading.gs`(v192).
 * 학생: 포털 상단 탭 «📚 독서기록장»(#qpReading). 탭을 열 때만 mode=readingMine을 읽는다(로그인 묶음 studentBoot엔 안 넣음 — 로그인 조회 수 그대로).
 *   새로 쓰기·고치기 = action=readingSave(기록ID는 이 화면이 만들어 재시도에도 같은 값 → 백엔드 upsert라 행이 하나), 지우기 = readingDelete(상태만 바꿈).
 *   PREVIEW_MODE(교사 미리보기)에서는 읽지도 쓰지도 않는다. 학생 화면에는 교사 판정(인정·보류·메모)을 아예 받지도 그리지도 않는다.
 *   쓰던 글은 기기에 임시 저장(h26_reading_draft_학번) — 새로고침·탭 이동으로 150자 글이 날아가지 않게.
 * 교사: 대시보드 «📚 독서» 탭(#panelReading). mode=readingAdmin 한 번에 전 학년을 받아 학년·반 고르기는 화면에서만 거른다.
 *   반별 표 숫자 → 명단 팝업(복사·새로고침), 인정 후보 한꺼번에 고르기 → readingJudge 한 번, 학생별 판정 바꾸기는 모아 두었다가 한 번에 저장.
 *   CSV 3종(반별 독서 목록·기록 전체·점수), 도서 목록 관리(붙여넣기 → 미리보기 → 저장 readingBooksSave).
 * 로드 시점 코드는 상태 객체뿐(앞 파일의 $·SESSION·showToast, 뒤 파일의 TOKEN·perfModalOpen_·dashMyBans_는 함수 안에서만 쓴다). */
const READING_FROM = '2027-03-01';   // 학생 탭이 보이기 시작하는 날(그 전엔 ?reading=1이나 «학생 화면 테스트»에서만) — 효니가 바꾸면 여기만
const READING_TARGET = 5;            // 채점에 들어가는 최대 회차(인정 회당 2점, 최대 5회 = 10점)
const READING_POINT = 2;
const READING_ESSAY_GOAL = 150;      // 글 목표 글자 수(인정 후보 기준과 같음)
const READING_MAX = { title: 100, author: 60, under: 300, q: 200, review: 100, essay: 400 }; // 백엔드 READING_LIMITS와 같게
const READING_SITE = 'https://read365.edunet.net/';
const RD = { sid: '', state: 'idle', records: [], books: [], err: '', editId: '', isNew: false, busy: false, delId: '' };
const RDA = { state: 'idle', data: null, err: '', grade: '', ban: 'mine', pending: {}, open: {}, busy: false, bookPreview: null, cand: null };

function rdEsc_(s){ return escapeHtml(s == null ? '' : s); }
function rdToday_(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rdLen_(s){ return Array.from(String(s || '').replace(/\s+/g, ' ').trim()).length; }
function rdBookLabel_(title, author){ return String(title || '') + (author ? '(' + author + ')' : ''); }

/* ── 학생 ── */
function readingTabVisible_(){
  if(!SESSION) return false;
  if(TEST_WRITE_MODE) return true;
  try{ if(new URLSearchParams(location.search).get('reading') === '1') return true; }catch(e){}
  return rdToday_() >= READING_FROM;
}
/* renderPortal에서 부른다 — 탭 단추를 보이거나 숨기고, 다른 학생으로 바뀌었으면 비운다 */
function readingPortalInit_(){
  const btn = $('qtabReading');
  if(!btn) return;
  const sid = SESSION ? SESSION.studentId : '';
  const changed = RD.sid !== sid;
  if(changed){ Object.assign(RD, { sid: sid, state: 'idle', records: [], books: [], err: '', editId: '', isNew: false, delId: '' }); if($('readingBox')) $('readingBox').innerHTML = ''; }
  const show = readingTabVisible_();
  btn.style.display = show ? '' : 'none';
  const open = $('qpReading') && $('qpReading').style.display === 'block';
  if(!show && open) switchQuickTab('question');
  else if(show && open && changed) readingTabOpen_(); // 탭을 연 채 다른 학생이 들어오면 그 학생 것을 새로 읽는다
}
/* «책 덮기»·미리보기 학생 바꾸기(resetPortalState_)에서 부른다 — 앞 학생 기록을 화면·메모리에서 비운다.
 * clearDraft: 진짜 로그아웃일 때 이 기기의 쓰던 글도 지운다(교실 태블릿을 여럿이 같이 쓰므로) */
function readingResetPortal_(clearDraft){
  if(clearDraft && SESSION) readingDraftSet_(null);
  Object.assign(RD, { sid: '', state: 'idle', records: [], books: [], err: '', editId: '', isNew: false, delId: '', busy: false });
  if($('readingBox')) $('readingBox').innerHTML = '';
  const d = $('rdConfirm'); if(d){ if(d.close && d.open) d.close(); else d.removeAttribute('open'); }
}
/* switchQuickTab('reading')에서 부른다 */
function readingTabOpen_(){
  if(PREVIEW_MODE){ RD.state = 'preview'; readingRender_(); return; }
  if(RD.state === 'idle' || RD.state === 'error') readingLoad_();
  else readingRender_();
}
async function readingLoad_(){
  if(!SESSION || PREVIEW_MODE) return;
  const sid = SESSION.studentId;
  RD.state = 'loading'; RD.err = ''; readingRender_();
  try{
    const url = CONFIG.WEBAPP_URL + '?mode=readingMine&studentId=' + encodeURIComponent(sid) + '&name=' + encodeURIComponent(SESSION.name); // studentId가 있어 portal_auth.js가 세션을 붙인다
    const data = await fetchJsonRetry_(url);
    if(RD.sid !== sid) return; // 그새 다른 학생으로 바뀜
    if(data.result !== 'success' || !Array.isArray(data.records)){
      RD.state = 'error';
      RD.err = data.needLogin ? (data.message || '로그인이 끝났어요. 다시 로그인해 주세요.') : '독서기록장을 아직 열 수 없어요. 잠깐 뒤에 다시 시도해 주세요.';
    } else {
      RD.state = 'ready'; RD.records = data.records; RD.books = Array.isArray(data.books) ? data.books : [];
    }
  }catch(e){
    if(RD.sid !== sid) return;
    RD.state = 'error'; RD.err = '불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  }
  readingRender_();
}
function readingPadletUrl_(){
  const p = padletParam_(); // 이 학생 반 패들렛(https padlet.com만)
  return p ? decodeURIComponent(p.replace(/^&padlet=/, '')) : '';
}
function readingRender_(){
  const box = $('readingBox');
  if(!box) return;
  const padlet = readingPadletUrl_();
  const links = '<div class="rd-links">'
    + (padlet ? '<a class="btn btn-sm btn-ghost" href="' + rdEsc_(padlet) + '" target="_blank" rel="noopener">📌 우리 반 패들렛 열기</a>' : '')
    + '<a class="btn btn-sm btn-ghost" href="' + READING_SITE + '" target="_blank" rel="noopener">📖 독서로 열기</a>'
    + (RD.state === 'ready' && !RD.editId ? '<button type="button" class="btn btn-sm btn-ghost" onclick="readingLoad_()" aria-label="내 독서 기록 새로 불러오기">↻</button>' : '') + '</div>'; // 다른 기기에서 쓴 기록 다시 읽기
  if(RD.state === 'preview'){
    box.innerHTML = '<p class="q-hint">미리보기에서는 독서 기록을 불러오거나 저장하지 않아요. 학생은 여기서 책 한 권을 읽을 때마다 밑줄·질문·한 줄 평·150자 글을 쓰고, «독서로에 옮겨 적기»로 복사해 독서로에 붙여요.</p>' + links;
    return;
  }
  if(RD.state === 'loading' || RD.state === 'idle'){ box.innerHTML = '<p class="q-hint">불러오는 중…</p>'; return; }
  if(RD.state === 'error'){
    box.innerHTML = '<p class="q-hint rd-err">' + rdEsc_(RD.err) + '</p><button type="button" class="btn btn-sm" onclick="readingLoad_()">다시 시도</button>';
    return;
  }
  const n = RD.records.length;
  const dots = Array.from({ length: READING_TARGET }, (_, i) => '<span class="rd-dot' + (i < n ? ' is-on' : '') + '"></span>').join('');
  let html = '<div class="rd-head"><p class="rd-count">내 독서 기록 <b>' + n + '</b>개 <span class="rd-dots" aria-hidden="true">' + dots + '</span></p>'
    + (RD.editId ? '' : '<button type="button" class="btn" onclick="readingNew_()">＋ 새 기록 쓰기</button>') + '</div>' + links;
  if(RD.editId) html += readingFormHtml_();
  if(!n && !RD.editId) html += '<p class="q-hint">아직 기록이 없어요. 책을 읽었으면 «새 기록 쓰기»를 눌러 남겨 보세요.</p>';
  html += '<div class="rd-list">' + RD.records.map(readingCardHtml_).join('') + '</div>';
  box.innerHTML = html;
  if(RD.editId) readingFormAfter_();
}
function readingCardHtml_(r){
  const page = (r.pageFrom || r.pageTo) ? ' · ' + (r.pageFrom || '') + (r.pageTo ? '~' + r.pageTo : '') + '쪽' : '';
  const block = (label, text) => text ? '<div class="rd-block"><p class="rd-block-label">' + label + '</p><p class="rd-block-text">' + rdEsc_(text) + '</p></div>' : '';
  return '<article class="rd-card' + (RD.editId === r.id ? ' is-editing' : '') + '">'
    + '<p class="rd-card-title"><b>' + rdEsc_(r.title) + '</b>' + (r.author ? ' <span>' + rdEsc_(r.author) + '</span>' : '') + '</p>'
    + '<p class="rd-meta">' + rdEsc_(r.date || '') + page + (r.essay ? ' · 글 ' + rdLen_(r.essay) + '자' : '') + '</p>'
    + (r.review ? '<p class="rd-review">' + rdEsc_(r.review) + '</p>' : '')
    + '<button type="button" class="btn btn-sm" onclick="readingCopy_(\'' + rdEsc_(r.id) + '\')">📋 독서로에 옮겨 적기</button>'
    + '<details class="rd-more"><summary>내 기록 펼쳐 보기</summary>'
    + block('✏️ 밑줄 친 문장', r.underline) + block('❓ 내가 만든 질문', r.question) + block('📝 내 글', r.essay)
    + '<div class="rd-card-actions"><button type="button" class="btn btn-sm btn-ghost" onclick="readingEdit_(\'' + rdEsc_(r.id) + '\')">고치기</button>'
    + '<button type="button" class="btn btn-sm btn-ghost" onclick="readingAskDelete_(\'' + rdEsc_(r.id) + '\')">지우기</button></div>'
    + '</details></article>';
}
/* 독서로 «독서활동» 감상 칸에 붙일 글: 1줄 도서명(저자), 다음 줄 내 글(없으면 한 줄 평) */
function readingCopyText_(r){
  return rdBookLabel_(r.title, r.author) + '\n' + (r.essay || r.review || r.underline || r.question || '');
}
async function readingCopy_(id){
  const r = RD.records.find(x => x.id === id);
  if(!r) return;
  try{ await navigator.clipboard.writeText(readingCopyText_(r)); showToast('복사했어요. 독서로를 열어 감상 칸에 붙여 넣으세요.'); }
  catch(e){ showToast('복사가 안 됐어요. 내 기록을 펼쳐 직접 골라 복사해 주세요.'); }
}

/* 쓰기 창 — 탭 안에 펼쳐지는 폼(새 창 없음). 쓰던 내용은 기기에 임시 저장 */
function readingDraftKey_(){ return 'h26_reading_draft_' + (SESSION ? SESSION.studentId : ''); }
function readingDraftGet_(){ try{ return JSON.parse(localStorage.getItem(readingDraftKey_()) || 'null'); }catch(e){ return null; } }
function readingDraftSet_(o){ try{ if(o) localStorage.setItem(readingDraftKey_(), JSON.stringify(o)); else localStorage.removeItem(readingDraftKey_()); }catch(e){} }
function readingNew_(){
  if(PREVIEW_MODE){ showToast('미리보기 모드예요 — 실제로 기록되지 않아요.'); return; }
  const d = readingDraftGet_();
  RD.isNew = true;
  RD.editId = (d && d.isNew && d.id) ? d.id : portalClientId_(); // 쓰던 새 기록이 있으면 같은 번호로 이어 쓴다
  readingRender_();
}
function readingEdit_(id){
  if(PREVIEW_MODE) return;
  RD.isNew = false; RD.editId = id;
  readingRender_();
}
function readingCancel_(){
  readingDraftSet_(null);
  RD.editId = ''; RD.isNew = false;
  readingRender_();
}
function readingFormHtml_(){
  const opts = RD.books.map((b, i) => '<option value="' + i + '">' + rdEsc_(rdBookLabel_(b.title, b.author)) + '</option>').join('');
  return '<form class="rd-form" id="rdForm" onsubmit="event.preventDefault(); readingSave_();" oninput="readingFormInput_()">'
    + '<p class="rd-form-title">' + (RD.isNew ? '✍️ 새 독서 기록' : '✍️ 기록 고치기') + '</p>'
    + (RD.books.length ? '<label class="rd-label" for="rdBook">선생님 추천 책</label><select id="rdBook" onchange="readingPickBook_()"><option value="">목록에 없는 책 — 직접 쓰기</option>' + opts + '</select>' : '')
    + '<div class="rd-row"><div><label class="rd-label" for="rdTitle">책 제목 <small>(꼭)</small></label><input type="text" id="rdTitle" maxlength="' + READING_MAX.title + '" autocomplete="off"></div>'
    + '<div><label class="rd-label" for="rdAuthor">지은이</label><input type="text" id="rdAuthor" maxlength="' + READING_MAX.author + '" autocomplete="off"></div></div>'
    + '<div class="rd-row rd-row-3"><div><label class="rd-label" for="rdDate">읽은 날</label><input type="date" id="rdDate"></div>'
    + '<div><label class="rd-label" for="rdP1">몇 쪽부터</label><input type="number" id="rdP1" min="1" max="9999" inputmode="numeric"></div>'
    + '<div><label class="rd-label" for="rdP2">몇 쪽까지</label><input type="number" id="rdP2" min="1" max="9999" inputmode="numeric"></div></div>'
    + '<label class="rd-label" for="rdUnder">✏️ 밑줄 친 문장 <small>(책에서 그대로 옮겨요)</small></label><textarea id="rdUnder" rows="2" maxlength="' + READING_MAX.under + '"></textarea>'
    + '<label class="rd-label" for="rdQ">❓ 내가 만든 질문</label><textarea id="rdQ" rows="2" maxlength="' + READING_MAX.q + '"></textarea>'
    + '<label class="rd-label" for="rdReview">💬 한 줄 평</label><input type="text" id="rdReview" maxlength="' + READING_MAX.review + '" autocomplete="off">'
    + '<label class="rd-label" for="rdEssay">📝 내 글 <small>(' + READING_ESSAY_GOAL + '자쯤)</small></label><textarea id="rdEssay" rows="5" maxlength="' + READING_MAX.essay + '"></textarea>'
    + '<p class="rd-cnt" id="rdEssayCnt" aria-live="polite"></p>'
    + '<p class="rd-form-err" id="rdFormErr" role="alert"></p>'
    + '<div class="rd-form-actions"><button type="submit" class="btn" id="rdSaveBtn">저장하기</button><button type="button" class="btn btn-ghost" onclick="readingCancel_()">그만 쓰기</button></div>'
    + '</form>';
}
const RD_FIELDS = [['title', 'rdTitle'], ['author', 'rdAuthor'], ['date', 'rdDate'], ['pageFrom', 'rdP1'], ['pageTo', 'rdP2'], ['underline', 'rdUnder'], ['question', 'rdQ'], ['review', 'rdReview'], ['essay', 'rdEssay']];
function readingFormAfter_(){
  const d = readingDraftGet_();
  let src = null;
  const rec = RD.isNew ? null : (RD.records.find(x => x.id === RD.editId) || null);
  // 쓰던 것 이어서 — 단 고치기는 그 뒤 다른 기기에서 저장된 것보다 오래된 초안이면 버린다(검토 지적)
  if(d && d.id === RD.editId && (!rec || !rec.updatedAt || (d.at && d.at > Date.parse(rec.updatedAt)))) src = d.v;
  else src = rec;
  RD_FIELDS.forEach(([k, id]) => { const el = $(id); if(el) el.value = (src && src[k] != null) ? src[k] : ''; });
  if(!$('rdDate').value) $('rdDate').value = rdToday_();
  if($('rdBook')){
    const t = $('rdTitle').value.trim();
    const i = RD.books.findIndex(b => b.title === t);
    $('rdBook').value = i >= 0 ? String(i) : '';
  }
  readingEssayCount_();
  const form = $('rdForm');
  if(form && form.scrollIntoView) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function readingPickBook_(){
  const i = $('rdBook').value;
  if(i === '') return;
  const b = RD.books[Number(i)];
  if(!b) return;
  $('rdTitle').value = b.title; $('rdAuthor').value = b.author || '';
  readingFormInput_();
}
function readingFormVals_(){
  const v = {};
  RD_FIELDS.forEach(([k, id]) => { v[k] = $(id) ? $(id).value : ''; });
  return v;
}
function readingFormInput_(){
  readingEssayCount_();
  readingDraftSet_({ id: RD.editId, isNew: RD.isNew, at: Date.now(), v: readingFormVals_() });
}
function readingEssayCount_(){
  const el = $('rdEssayCnt');
  if(!el) return;
  const n = rdLen_($('rdEssay').value);
  el.textContent = n + '자 / ' + READING_ESSAY_GOAL + '자' + (n >= READING_ESSAY_GOAL ? ' ✓' : '');
  el.classList.toggle('is-done', n >= READING_ESSAY_GOAL);
}
async function readingSave_(){
  if(PREVIEW_MODE){ showToast('미리보기 모드예요 — 실제로 기록되지 않아요.'); return; }
  if(RD.busy || !SESSION) return;
  const v = readingFormVals_();
  const err = $('rdFormErr');
  err.textContent = '';
  if(!v.title.trim()){ err.textContent = '책 제목을 써 주세요.'; $('rdTitle').focus(); return; }
  if(!v.underline.trim() && !v.question.trim() && !v.review.trim() && !v.essay.trim()){ err.textContent = '밑줄·질문·한 줄 평·글 중 하나는 써 주세요.'; $('rdUnder').focus(); return; }
  const btn = $('rdSaveBtn');
  RD.busy = true; btn.disabled = true; btn.textContent = '저장하는 중…';
  const sid = SESSION.studentId;
  try{
    const data = await portalPost_({ action: 'readingSave', studentId: sid, studentName: SESSION.name, record: Object.assign({ id: RD.editId }, v) }); // 같은 기록ID라 다시 보내도 한 행
    if(RD.sid !== sid) return;
    if(data.result !== 'success' || !data.record){ err.textContent = data.message || '저장하지 못했어요. 새로고침한 뒤 다시 해 주세요.'; return; }
    const i = RD.records.findIndex(x => x.id === data.record.id);
    if(i >= 0) RD.records[i] = data.record; else RD.records.unshift(data.record);
    readingDraftSet_(null);
    RD.editId = ''; RD.isNew = false;
    readingRender_();
    showToast(data.created ? '저장했어요. «독서로에 옮겨 적기»로 독서로에도 남겨요.' : '고쳤어요.');
  }catch(e){
    err.textContent = '저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 쓴 글은 이 기기에 남아 있어요.';
  }finally{
    RD.busy = false;
    const b2 = $('rdSaveBtn'); if(b2){ b2.disabled = false; b2.textContent = '저장하기'; }
  }
}
/* 지우기 — 브라우저 confirm 대신 앱 안 <dialog id="rdConfirm"> */
function readingAskDelete_(id){
  if(PREVIEW_MODE) return;
  const r = RD.records.find(x => x.id === id);
  const d = $('rdConfirm');
  if(!r || !d) return;
  RD.delId = id;
  $('rdConfirmDesc').textContent = '«' + rdBookLabel_(r.title, r.author) + '» 기록을 지울까요? 지우면 되돌릴 수 없어요.';
  $('rdConfirmErr').textContent = '';
  if(d.showModal){ if(!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function readingCloseDelete_(){
  const d = $('rdConfirm');
  RD.delId = '';
  if(d){ if(d.close && d.open) d.close(); else d.removeAttribute('open'); }
}
async function readingDelete_(){
  if(PREVIEW_MODE || RD.busy || !RD.delId || !SESSION) return;
  const id = RD.delId, sid = SESSION.studentId;
  const btn = $('rdConfirmYes');
  RD.busy = true; btn.disabled = true;
  try{
    const data = await portalPost_({ action: 'readingDelete', studentId: sid, studentName: SESSION.name, id: id }); // 상태만 바꿔 다시 보내도 같음
    if(data.result !== 'success'){ $('rdConfirmErr').textContent = data.message || '지우지 못했어요.'; return; }
    if(RD.sid === sid){
      RD.records = RD.records.filter(x => x.id !== id);
      if(RD.editId === id){ RD.editId = ''; readingDraftSet_(null); }
    }
    readingCloseDelete_();
    readingRender_();
    showToast('지웠어요.');
  }catch(e){
    $('rdConfirmErr').textContent = '지우지 못했어요. 인터넷 연결을 확인해 주세요.';
  }finally{
    RD.busy = false; btn.disabled = false;
  }
}

/* ── 교사 대시보드 «📚 독서» 탭 ── */
function rdaGrade_(){
  if(!RDA.grade){ try{ RDA.grade = localStorage.getItem('dash_reading_grade') || ''; }catch(e){} }
  if(RDA.grade !== '2' && RDA.grade !== '3') RDA.grade = '2';
  return RDA.grade;
}
function dashReadingOpen_(){
  if(PREVIEW_MODE || !TOKEN) return;
  if(RDA.state === 'idle' || RDA.state === 'error') rdaLoad_();
  else rdaRender_();
}
async function rdaLoad_(){
  if(!TOKEN) return;
  RDA.state = 'loading'; RDA.err = ''; rdaRender_();
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL + '?mode=readingAdmin&token=' + encodeURIComponent(TOKEN));
    if(!TOKEN) return; // 그새 나감
    if(data.result !== 'success' || !Array.isArray(data.records)){
      RDA.state = 'error';
      RDA.err = data.message === '인증 실패' ? '토큰이 맞지 않아요. 다시 들어와 주세요.' : '독서 기록을 불러오지 못했어요(백엔드 v192가 배포되지 않았으면 이렇게 보여요).';
    } else {
      RDA.state = 'ready'; RDA.data = data;
      Object.keys(RDA.pending).forEach(id => { if(!data.records.some(r => r.id === id)) delete RDA.pending[id]; });
    }
  }catch(e){
    if(!TOKEN) return;
    RDA.state = 'error'; RDA.err = '불러오지 못했어요. 인터넷 연결을 확인해 주세요.';
  }
  rdaRender_();
}
function dashReadingClear_(){ // «나가기» — 학생 기록을 화면·메모리에서 비운다
  Object.assign(RDA, { state: 'idle', data: null, err: '', pending: {}, open: {}, bookPreview: null, cand: null });
  const box = $('rdaBox'); if(box) box.innerHTML = '';
}
function rdaPickGrade_(g){ RDA.grade = g; RDA.ban = 'mine'; RDA.cand = null; try{ localStorage.setItem('dash_reading_grade', g); }catch(e){} rdaRender_(); }
function rdaPickBan_(v){ RDA.ban = v; RDA.cand = null; rdaRender_(); }
function rdaBanName_(k){ return Number(k.slice(0, 1)) + '학년 ' + Number(k.slice(1, 3)) + '반'; }
function rdaInBan_(sid){ const g = rdaGrade_(); return sid.charAt(0) === g && sid.slice(3) !== '99' && banMatches_(RDA.ban, g, Number(sid.slice(1, 3))); } // 99번 = «학생 화면 테스트» 계정(검토 지적) — 현황·채점·CSV에서 뺀다
/* 판정은 아직 저장 안 한 것(pending)을 먼저 본다 */
function rdaJudge_(r){ return Object.prototype.hasOwnProperty.call(RDA.pending, r.id) ? RDA.pending[r.id] : (r.judge || ''); }
function rdaIsCandidate_(r){ return !r.judge && !!String(r.underline || '').trim() && !!String(r.question || '').trim() && rdLen_(r.essay) >= READING_ESSAY_GOAL; }
function rdaEditedAfter_(r){ return !!(r.judge && r.judgedAt && r.updatedAt && Date.parse(r.updatedAt) > Date.parse(r.judgedAt) + 1000); }
function rdaScore_(n){ return Math.min(n, READING_TARGET) * READING_POINT; }
/* 고른 학년·반의 학생별 묶음 [{sid, name, recs, books, ok, hold}] — 명단(roster)에 없는 기록 학생도 넣는다 */
function rdaStudents_(){
  const d = RDA.data || { records: [], roster: [] };
  const map = {};
  (d.roster || []).forEach(s => { if(rdaInBan_(s.studentId)) map[s.studentId] = { sid: s.studentId, name: s.studentName, recs: [] }; });
  d.records.forEach(r => {
    if(!rdaInBan_(r.studentId)) return;
    const s = map[r.studentId] = map[r.studentId] || { sid: r.studentId, name: r.studentName, recs: [] };
    if(!s.name) s.name = r.studentName;
    s.recs.push(r);
  });
  return Object.keys(map).sort().map(k => {
    const s = map[k];
    s.recs.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const bk = {};
    s.recs.forEach(r => { bk[rdBookLabel_(r.title, r.author)] = 1; });
    s.books = Object.keys(bk);
    s.ok = s.recs.filter(r => rdaJudge_(r) === '인정').length;
    s.hold = s.recs.filter(r => rdaJudge_(r) === '보류').length;
    return s;
  });
}
function rdaBanRows_(students){
  const g = {};
  students.forEach(s => { const k = s.sid.slice(0, 3); (g[k] = g[k] || []).push(s); });
  return Object.keys(g).sort().map(k => {
    const list = g[k];
    const wrote = list.filter(s => s.recs.length);
    return { key: k, list: list, n: list.length, wrote: wrote.length,
      avg: list.length ? (list.reduce((a, s) => a + s.recs.length, 0) / list.length) : 0,
      full: list.filter(s => s.recs.length >= READING_TARGET).length, zero: list.filter(s => !s.recs.length).length,
      cand: list.reduce((a, s) => a + s.recs.filter(r => rdaIsCandidate_(r) && !RDA.pending[r.id]).length, 0) };
  });
}
function rdaNum_(k, kind, n){
  return n ? '<button type="button" class="perf-none-num rd-num" title="누르면 명단이 열려요" onclick="rdaListOpen_(\'' + k + '\',\'' + kind + '\')">' + n + '</button>' : '0';
}
const RDA_KINDS = { all: '학생', wrote: '기록한 학생', full: READING_TARGET + '회 채운 학생', zero: '아직 0회인 학생', cand: '인정 후보가 있는 학생' };
function rdaKindFilter_(kind){
  return ({ all: () => true, wrote: s => s.recs.length > 0, full: s => s.recs.length >= READING_TARGET, zero: s => !s.recs.length,
    cand: s => s.recs.some(r => rdaIsCandidate_(r) && !RDA.pending[r.id]) })[kind] || (() => true);
}
function rdaListGroups_(k, kind){
  const f = rdaKindFilter_(kind);
  const g = {};
  rdaStudents_().filter(s => (!k || s.sid.slice(0, 3) === k) && f(s)).forEach(s => { (g[s.sid.slice(0, 3)] = g[s.sid.slice(0, 3)] || []).push(s); });
  return g;
}
function rdaListOpen_(k, kind){
  const g = rdaListGroups_(k, kind), keys = Object.keys(g).sort();
  const total = keys.reduce((a, x) => a + g[x].length, 0);
  const title = (k ? rdaBanName_(k) : rdaGrade_() + '학년') + ' ' + RDA_KINDS[kind] + ' ' + total + '명';
  const body = '<div class="perf-none-actions"><button type="button" class="perf-askbtn" onclick="rdaListCopy_(\'' + k + '\',\'' + kind + '\')">📋 명단 복사</button>'
    + '<button type="button" class="perf-askbtn" onclick="rdaLoad_().then(() => rdaListOpen_(\'' + k + '\',\'' + kind + '\'))">↻ 새로고침</button></div>'
    + (total ? keys.map(x => '<details class="perf-grp perf-none-grp" open><summary>' + rdaBanName_(x) + ' <span class="perf-none-cnt">' + g[x].length + '명</span></summary>'
      + '<div class="perf-asklist perf-none-list">' + g[x].map(s => '<span class="perf-none-chip">' + rdEsc_(Number(s.sid.slice(3)) + '번 ' + s.name + ' · ' + s.recs.length + '회') + '</span>').join('') + '</div></details>').join('')
      : '<p class="dash-hint">해당하는 학생이 없어요.</p>');
  perfModalOpen_(title, '교과 독서', body);
}
async function rdaListCopy_(k, kind){
  const g = rdaListGroups_(k, kind), keys = Object.keys(g).sort();
  const lines = keys.map(x => rdaBanName_(x) + ' (' + g[x].length + '명): ' + g[x].map(s => s.name).join(', '));
  try{ await navigator.clipboard.writeText('교과 독서 — ' + RDA_KINDS[kind] + '\n' + lines.join('\n')); showToast('명단을 복사했어요.'); }
  catch(e){ showToast('복사에 실패했어요.'); }
}
function rdaRender_(){
  const box = $('rdaBox');
  if(!box) return;
  const g = rdaGrade_();
  const head = '<div class="gt-head"><div class="gt-years" role="tablist" aria-label="학년 고르기">'
    + ['2', '3'].map(y => '<button type="button" role="tab" class="gt-year' + (y === g ? ' is-on' : '') + '" aria-selected="' + (y === g) + '" onclick="rdaPickGrade_(\'' + y + '\')">' + y + '학년</button>').join('')
    + '</div><button type="button" class="btn btn-sm btn-ghost" onclick="rdaLoad_()">↻ 새로고침</button></div>';
  if(RDA.state === 'loading' && !RDA.data){ box.innerHTML = head + '<p class="dash-hint">불러오는 중…</p>'; return; }
  if(RDA.state === 'error'){ box.innerHTML = head + '<p class="dash-hint rd-err">' + rdEsc_(RDA.err) + dashRetryBtn_('rdaLoad_()') + '</p>'; return; }
  if(!RDA.data){ box.innerHTML = head; return; }
  const bset = {}; // 반 목록 = 이 학년 명단·기록에 있는 반(새 학년도에 반 구성이 바뀌어도 config를 안 고쳐도 됨)
  (RDA.data.roster || []).concat(RDA.data.records || []).forEach(x => { const sid = String(x.studentId || ''); if(sid.charAt(0) === g) bset[Number(sid.slice(1, 3))] = 1; });
  const bans = Object.keys(bset).map(Number).sort((x, y) => x - y);
  const banSel = '<label class="rd-bansel">반 <select onchange="rdaPickBan_(this.value)">'
    + '<option value="mine"' + (RDA.ban === 'mine' ? ' selected' : '') + '>내 담당 반</option><option value=""' + (RDA.ban === '' ? ' selected' : '') + '>전체</option>'
    + bans.map(b => '<option value="' + b + '"' + (String(RDA.ban) === String(b) ? ' selected' : '') + '>' + b + '반</option>').join('') + '</select></label>';
  const students = rdaStudents_();
  const banRows = rdaBanRows_(students);
  const allRecs = [].concat(...students.map(s => s.recs));
  const cands = allRecs.filter(r => rdaIsCandidate_(r) && !RDA.pending[r.id]);
  const undecided = allRecs.filter(r => !rdaJudge_(r)).length;
  const edited = allRecs.filter(rdaEditedAfter_);
  const zero = students.filter(s => !s.recs.length).length;
  const pendN = Object.keys(RDA.pending).length;
  let html = head + '<div class="rd-tools">' + banSel + '</div>'
    + '<section class="gt-todo" aria-live="polite"><p class="gt-todo-label">지금 할 일</p><div class="gt-chips">'
    + (cands.length ? '<button type="button" class="gt-chip is-warn" onclick="rdaScrollTo_(\'rdaCandCard\')">인정 후보 ' + cands.length + '개 확인</button>' : '<span class="gt-chip is-zero">인정 후보 없음</span>')
    + '<span class="gt-chip' + (undecided ? '' : ' is-zero') + '">판정 안 한 기록 ' + undecided + '개</span>'
    + (edited.length ? '<button type="button" class="gt-chip is-warn" onclick="rdaScrollTo_(\'rdaStuCard\')">판정 뒤 고친 기록 ' + edited.length + '개</button>' : '')
    + (zero ? '<button type="button" class="gt-chip" onclick="rdaListOpen_(\'\',\'zero\')">0회 학생 ' + zero + '명</button>' : '')
    + (pendN ? '<button type="button" class="gt-chip is-warn" onclick="rdaSavePending_()">판정 ' + pendN + '개 저장 안 함</button>' : '')
    + '</div></section>';
  // 반별 표
  html += '<section class="dash-card"><h2 class="dash-card-title">📊 반별 현황 <small>숫자를 누르면 명단</small></h2>'
    + (banRows.length ? '<div class="rd-table-wrap"><table class="rd-table"><thead><tr><th>반</th><th>학생</th><th>기록한 학생</th><th>평균 횟수</th><th>' + READING_TARGET + '회 채움</th><th>0회</th><th>인정 후보</th></tr></thead><tbody>'
      + banRows.map(b => '<tr><th scope="row">' + rdaBanName_(b.key) + '</th><td>' + rdaNum_(b.key, 'all', b.n) + '</td><td>' + rdaNum_(b.key, 'wrote', b.wrote) + '</td><td>' + b.avg.toFixed(1)
        + '</td><td>' + rdaNum_(b.key, 'full', b.full) + '</td><td>' + rdaNum_(b.key, 'zero', b.zero) + '</td><td>' + rdaNum_(b.key, 'cand', b.cand) + '</td></tr>').join('')
      + '</tbody></table></div>' : '<p class="dash-hint">고른 반에 학생·기록이 없어요.</p>')
    + '</section>';
  // 인정 후보
  html += rdaCandHtml_(cands);
  // 학생별
  html += '<section class="dash-card" id="rdaStuCard"><h2 class="dash-card-title">🧑‍🎓 학생별 <small>점수 = 인정 회당 ' + READING_POINT + '점, 최대 ' + READING_TARGET + '회(' + rdaScore_(READING_TARGET) + '점)</small></h2>'
    + (students.length ? '<div class="rd-table-wrap"><table class="rd-table rd-stu"><thead><tr><th>반-번호</th><th>이름</th><th>기록</th><th>권수</th><th>인정</th><th>보류</th><th>점수</th></tr></thead><tbody>'
      + students.map(rdaStuRowHtml_).join('') + '</tbody></table></div>' : '<p class="dash-hint">학생이 없어요.</p>')
    + '</section>';
  if(pendN) html += '<div class="rd-pendbar" role="status"><span>바꾼 판정 ' + pendN + '개</span><button type="button" class="btn btn-sm" onclick="rdaSavePending_()"' + (RDA.busy ? ' disabled' : '') + '>한 번에 저장</button><button type="button" class="btn btn-sm btn-ghost" onclick="rdaDropPending_()">되돌리기</button></div>';
  // 내보내기
  html += '<section class="dash-card"><h2 class="dash-card-title">⬇️ 내보내기 <small>고른 학년·반 기준, 엑셀로 열려요</small></h2><div class="rd-export">'
    + '<button type="button" class="btn btn-sm" onclick="rdaCsv_(\'books\')">반별 독서 목록 «도서명(저자)»</button>'
    + '<button type="button" class="btn btn-sm btn-ghost" onclick="rdaCsv_(\'records\')">기록 전체</button>'
    + '<button type="button" class="btn btn-sm btn-ghost" onclick="rdaCsv_(\'score\')">점수(인정 회당 ' + READING_POINT + '점)</button></div>'
    + '<p class="dash-hint">독서활동상황·세특 근거는 «반별 독서 목록», 성적관리 올리기는 «점수» 파일을 쓰세요. 저장 안 한 판정은 들어가지 않아요.</p></section>';
  // 도서 목록 관리
  html += rdaBooksHtml_();
  box.innerHTML = html;
}
function rdaScrollTo_(id){ const el = $(id); if(el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
function rdaCandHtml_(cands){
  if(!RDA.cand) RDA.cand = {};
  cands.forEach(r => { if(!(r.id in RDA.cand)) RDA.cand[r.id] = true; });
  const picked = cands.filter(r => RDA.cand[r.id]).length;
  return '<section class="dash-card" id="rdaCandCard"><h2 class="dash-card-title">✅ 인정 후보 <small>밑줄·질문이 있고 글이 ' + READING_ESSAY_GOAL + '자 넘는 기록 — 골라서 한 번에</small></h2>'
    + (cands.length ? '<div class="rd-cand-tools"><button type="button" class="btn btn-sm" onclick="rdaJudgeCands_(\'인정\')"' + (RDA.busy || !picked ? ' disabled' : '') + '>고른 ' + picked + '개 인정</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" onclick="rdaJudgeCands_(\'보류\')"' + (RDA.busy || !picked ? ' disabled' : '') + '>고른 ' + picked + '개 보류</button>'
      + '<button type="button" class="btn btn-sm btn-ghost" onclick="rdaCandAll_(' + (picked < cands.length) + ')">' + (picked < cands.length ? '모두 고르기' : '모두 빼기') + '</button></div>'
      + '<ul class="rd-cand">' + cands.map(r => '<li><label><input type="checkbox"' + (RDA.cand[r.id] ? ' checked' : '') + ' onchange="rdaCandPick_(\'' + rdEsc_(r.id) + '\', this.checked)">'
        + '<span><b>' + rdEsc_(Number(r.studentId.slice(3)) + '번 ' + r.studentName) + '</b> · ' + rdEsc_(rdBookLabel_(r.title, r.author)) + ' · 글 ' + rdLen_(r.essay) + '자</span></label>'
        + '<details><summary>내용 보기</summary>' + rdaRecDetail_(r) + '</details></li>').join('') + '</ul>'
      : '<p class="dash-hint">지금 인정 후보가 없어요. 판정은 아래 «학생별»에서도 바꿀 수 있어요.</p>')
    + '</section>';
}
function rdaCandPick_(id, on){ if(RDA.cand) RDA.cand[id] = on; rdaRender_(); }
function rdaCandAll_(on){ Object.keys(RDA.cand || {}).forEach(id => { RDA.cand[id] = on; }); rdaRender_(); }
function rdaRecDetail_(r){
  const b = (label, t) => t ? '<p class="rd-d"><span>' + label + '</span>' + rdEsc_(t) + '</p>' : '';
  return '<div class="rd-detail">' + b('날짜·쪽', (r.date || '') + ((r.pageFrom || r.pageTo) ? ' · ' + (r.pageFrom || '') + '~' + (r.pageTo || '') + '쪽' : ''))
    + b('밑줄', r.underline) + b('질문', r.question) + b('한 줄 평', r.review) + b('글', r.essay) + b('교사 메모', r.memo) + '</div>';
}
function rdaStuRowHtml_(s){
  const open = !!RDA.open[s.sid];
  const edited = s.recs.some(rdaEditedAfter_);
  let html = '<tr class="rd-stu-row' + (open ? ' is-open' : '') + '"><td>' + Number(s.sid.slice(1, 3)) + '-' + Number(s.sid.slice(3)) + '</td><td><button type="button" class="rd-name" aria-expanded="' + open + '" onclick="rdaToggle_(\'' + s.sid + '\')">' + rdEsc_(s.name || s.sid) + (edited ? ' <span class="rd-flag" title="판정 뒤 학생이 고친 기록이 있어요">고침</span>' : '') + '</button></td>'
    + '<td>' + s.recs.length + '</td><td>' + s.books.length + '</td><td>' + s.ok + '</td><td>' + (s.hold || '') + '</td><td><b>' + rdaScore_(s.ok) + '</b>'
    + (s.recs.some(r => RDA.pending[r.id] !== undefined) ? ' <span class="rd-flag is-pend" title="아래 «한 번에 저장»을 눌러야 CSV·다른 기기에 반영돼요">저장 전</span>' : '') + '</td></tr>'; // 제미나이 의견: 저장 안 한 판정이 점수에 섞여 보이는 것을 표시
  if(open){
    html += '<tr class="rd-stu-detail"><td colspan="7">' + (s.recs.length ? s.recs.map((r, i) => {
      const j = rdaJudge_(r);
      const seg = ['인정', '보류', ''].map(v => '<button type="button" class="rd-seg' + (j === v ? ' is-on' : '') + '" onclick="rdaSetJudge_(\'' + rdEsc_(r.id) + '\',\'' + v + '\')">' + (v || '안 함') + '</button>').join('');
      return '<div class="rd-rec"><p class="rd-rec-head"><b>' + (i + 1) + '회</b> ' + rdEsc_(rdBookLabel_(r.title, r.author))
        + (rdaEditedAfter_(r) ? ' <span class="rd-flag">판정 뒤 고침</span>' : '') + (RDA.pending[r.id] !== undefined ? ' <span class="rd-flag is-pend">저장 전</span>' : '') + '</p>'
        + '<div class="rd-segs" role="group" aria-label="판정">' + seg + '</div>' + rdaRecDetail_(r) + '</div>';
    }).join('') : '<p class="dash-hint">아직 기록이 없어요.</p>') + '</td></tr>';
  }
  return html;
}
function rdaToggle_(sid){ RDA.open[sid] = !RDA.open[sid]; rdaRender_(); }
function rdaSetJudge_(id, v){
  const r = ((RDA.data || {}).records || []).find(x => x.id === id);
  if(!r) return;
  if((r.judge || '') === v) delete RDA.pending[id]; else RDA.pending[id] = v;
  rdaRender_();
}
function rdaDropPending_(){ RDA.pending = {}; rdaRender_(); }
async function rdaPostJudge_(items){
  if(PREVIEW_MODE || !TOKEN || RDA.busy || !items.length) return false;
  RDA.busy = true; rdaRender_();
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({ action: 'readingJudge', token: TOKEN, items: items }) });
    const data = await res.json();
    if(data.result !== 'success'){ showToast('저장하지 못했어요. ' + (data.message || '')); return false; }
    const map = {}; items.forEach(it => { map[it.id] = it.judge; });
    (RDA.data.records || []).forEach(r => { if(r.id in map){ r.judge = map[r.id]; r.judgedBy = map[r.id] ? TEACHER_NAME : ''; r.judgedAt = map[r.id] ? new Date().toISOString() : ''; } });
    items.forEach(it => { delete RDA.pending[it.id]; if(RDA.cand) delete RDA.cand[it.id]; });
    showToast('판정 ' + items.length + '개를 저장했어요.');
    return true;
  }catch(e){
    showToast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
    return false;
  }finally{
    RDA.busy = false; rdaRender_();
  }
}
function rdaJudgeCands_(v){
  const ids = Object.keys(RDA.cand || {}).filter(id => RDA.cand[id]);
  const recs = ((RDA.data || {}).records || []).filter(r => ids.includes(r.id) && rdaIsCandidate_(r) && rdaInBan_(r.studentId));
  return rdaPostJudge_(recs.map(r => ({ id: r.id, judge: v })));
}
function rdaSavePending_(){
  return rdaPostJudge_(Object.keys(RDA.pending).map(id => ({ id: id, judge: RDA.pending[id] })));
}
/* CSV(BOM) — 고른 학년·반, 저장된 판정 기준 */
function rdaCsv_(kind){
  const studs = rdaStudents_();
  const savedOk = s => s.recs.filter(r => r.judge === '인정').length;
  let header, rows;
  if(kind === 'books'){
    header = ['학번', '이름', '권수', '독서 목록(도서명(저자))'];
    rows = studs.filter(s => s.recs.length).map(s => [s.sid, s.name, s.books.length, s.books.join(', ')]);
  } else if(kind === 'records'){
    header = ['학번', '이름', '회차', '도서명', '저자', 'ISBN', '읽은 날', '시작쪽', '끝쪽', '밑줄', '내 질문', '한 줄 평', '글', '글자 수', '판정', '교사 메모', '작성', '수정'];
    rows = [];
    studs.forEach(s => s.recs.forEach((r, i) => rows.push([s.sid, s.name, i + 1, r.title, r.author, r.isbn, r.date, r.pageFrom, r.pageTo, r.underline, r.question, r.review, r.essay, rdLen_(r.essay), r.judge, r.memo, r.createdAt, r.updatedAt])));
  } else {
    header = ['학번', '이름', '평가명', '점수', '만점', '인정 수', '기록 수', '보류 수'];
    rows = studs.map(s => [s.sid, s.name, '교과 독서', rdaScore_(savedOk(s)), rdaScore_(READING_TARGET), savedOk(s), s.recs.length, s.recs.filter(r => r.judge === '보류').length]);
  }
  if(!rows.length){ showToast('내려받을 기록이 없어요.'); return; }
  const esc = v => { let t = String(v == null ? '' : v); if(/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }; // 엑셀 수식 주입 막기
  const csv = '﻿' + [header].concat(rows).map(r => r.map(esc).join(',')).join('\r\n');
  const banLabel = RDA.ban === 'mine' ? '내담당반' : (RDA.ban ? RDA.ban + '반' : '전체');
  const name = { books: '독서목록', records: '독서기록', score: '독서점수' }[kind] + '_' + rdaGrade_() + '학년_' + banLabel + '_' + rdToday_() + '.csv';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/* 도서 목록 관리 — 한 줄에 한 권 «제목 / 저자 / ISBN / 출판사»(탭으로 나눠도 됨, 엑셀에서 붙여넣기) → 미리보기 → 저장 */
function rdaBooksHtml_(){
  const g = rdaGrade_();
  const books = ((RDA.data || {}).books || []).filter(b => b.grade === g);
  const text = books.map(b => [b.title, b.author, b.isbn, b.publisher].join(' / ').replace(/( \/ )+$/, '') + (b.shown ? '' : ' / / / / 숨김')).join('\n');
  const pv = RDA.bookPreview;
  return '<details class="dash-card cl-collapse rd-books"' + (pv ? ' open' : '') + '><summary><span class="gt-fold-title">📚 ' + g + '학년 추천 도서 목록</span> <small>' + books.length + '권 — 학생 쓰기 창에서 고를 수 있어요</small></summary>'
    + '<div class="cl-collapse-body"><p class="dash-hint">한 줄에 한 권: <b>제목 / 저자 / ISBN / 출판사</b> (엑셀에서 붙여넣으면 탭으로 나뉘어도 돼요). 저장하면 ' + g + '학년 목록이 통째로 바뀌어요. 줄 끝에 «숨김»을 쓰면 학생에게 안 보여요.</p>'
    + '<textarea id="rdaBooksInput" rows="8" class="rd-books-input">' + rdEsc_(pv ? pv.raw : text) + '</textarea>'
    + '<div class="rd-cand-tools"><button type="button" class="btn btn-sm btn-ghost" onclick="rdaBooksPreview_()">미리보기</button>'
    + (pv ? '<button type="button" class="btn btn-sm" onclick="rdaBooksSave_()"' + (RDA.busy ? ' disabled' : '') + '>이대로 ' + pv.books.length + '권 저장</button><button type="button" class="btn btn-sm btn-ghost" onclick="RDA.bookPreview=null; rdaRender_()">취소</button>' : '') + '</div>'
    + (pv ? '<div class="rd-table-wrap"><table class="rd-table"><thead><tr><th>#</th><th>제목</th><th>저자</th><th>ISBN</th><th>출판사</th><th>학생에게</th></tr></thead><tbody>'
      + pv.books.map((b, i) => '<tr><td>' + (i + 1) + '</td><td>' + rdEsc_(b.title) + '</td><td>' + rdEsc_(b.author) + '</td><td>' + rdEsc_(b.isbn) + '</td><td>' + rdEsc_(b.publisher) + '</td><td>' + (b.shown ? '보임' : '숨김') + '</td></tr>').join('')
      + '</tbody></table></div>' + (pv.skipped ? '<p class="dash-hint">제목이 없는 줄 ' + pv.skipped + '개는 뺐어요.</p>' : '') : '')
    + '</div></details>';
}
function rdaParseBooks_(raw){
  const books = []; let skipped = 0;
  String(raw || '').split(/\r?\n/).forEach(line => {
    if(!line.trim()) return;
    const p = (line.indexOf('\t') >= 0 ? line.split('\t') : line.split('/')).map(x => x.trim());
    const hidden = p.some(x => x === '숨김');
    const f = p.filter(x => x !== '숨김');
    if(!f[0]){ skipped++; return; }
    books.push({ title: f[0].slice(0, READING_MAX.title), author: (f[1] || '').slice(0, READING_MAX.author), isbn: (f[2] || '').replace(/[^0-9Xx]/g, ''), publisher: (f[3] || '').slice(0, 60), shown: !hidden });
  });
  return { books: books, skipped: skipped };
}
function rdaBooksPreview_(){
  const raw = $('rdaBooksInput').value;
  const p = rdaParseBooks_(raw);
  if(p.books.length > 100){ showToast('학년마다 100권까지예요.'); return; }
  RDA.bookPreview = { raw: raw, books: p.books, skipped: p.skipped };
  rdaRender_();
}
async function rdaBooksSave_(){
  if(PREVIEW_MODE || !TOKEN || RDA.busy || !RDA.bookPreview) return;
  const g = rdaGrade_();
  RDA.busy = true; rdaRender_();
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({ action: 'readingBooksSave', token: TOKEN, grade: g, books: RDA.bookPreview.books }) });
    const data = await res.json();
    if(data.result !== 'success'){ showToast('저장하지 못했어요. ' + (data.message || '')); return; }
    RDA.data.books = (RDA.data.books || []).filter(b => b.grade !== g).concat(data.books || []);
    RDA.bookPreview = null;
    showToast(g + '학년 도서 목록 ' + data.saved + '권을 저장했어요.');
  }catch(e){
    showToast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }finally{
    RDA.busy = false; rdaRender_();
  }
}
