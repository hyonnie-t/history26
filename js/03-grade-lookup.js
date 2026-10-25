/* ════════════════════════════════════════════════════════
 * 성적조회 (v54, 2026-09-15 신규 — 핸드오프 "성적조회 통합 v2" 옵션 A)
 * 포털 로그인(login())과 완전히 분리된 별도 인증 — SESSION.studentId·SESSION.name은
 * 그대로 쓰되 비밀번호는 매번 새로 입력받아 mode=grade(학번+이름+비밀번호 3중
 * 매칭, history26_backend gradeGet_)로 조회한다. 서버가 실패 사유를 이미
 * 뭉뚱그려 반환하므로("정보가 일치하지 않습니다") 프론트는 그 메시지를 그대로
 * 보여줄 뿐, 어떤 값이 틀렸는지 추측해서 알려주는 로직을 두지 않는다.
 * ════════════════════════════════════════════════════════ */
function openGradeGate(){
  // v83 — 성적용 비밀번호 없음. 로그인 세션(portal_auth.js가 &session=을 붙임)으로 바로 조회한다.
  $('gradeIntro').style.display = 'none';
  $('gradeForm').style.display = 'block';
  $('gradeError').style.display = 'none';
  submitGradeLookup();
}
function closeGradeGate_(){
  $('gradeForm').style.display = 'none';
  $('gradeIntro').style.display = 'block';
}
async function submitGradeLookup(){
  const btn = $('gradeSubmitBtn');
  btn.disabled = true; btn.textContent = '확인 중…';
  $('gradeError').style.display = 'none';
  try{
    if(PREVIEW_MODE) throw new Error('미리보기에서는 성적을 조회하지 않아요.');
    const url = CONFIG.WEBAPP_URL
      + "?mode=grade&studentId=" + encodeURIComponent(SESSION.studentId)
      + "&name=" + encodeURIComponent(SESSION.name);
    const res = await fetch(url);
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조회에 실패했어요.');
    renderGradeResult_(data.headers || [], data.data || []);
  }catch(e){
    showGradeError_(e.message || '조회에 실패했어요. 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '다시 확인';
  }
}
function showGradeError_(msg){
  const el = $('gradeError');
  el.textContent = msg;
  el.style.display = 'block';
}
function renderGradeResult_(headers, data){
  $('gradeForm').style.display = 'none';
  $('gradeTable').innerHTML = headers.map((h, i) =>
    '<tr><th>' + escapeHtml(String(h)) + '</th><td>' + escapeHtml(String(data[i] == null ? '' : data[i])) + '</td></tr>'
  ).join('');
  $('gradeResultWrap').style.display = 'block';
}
function closeGradeResult_(){
  $('gradeResultWrap').style.display = 'none';
  $('gradeIntro').style.display = 'block';
}

