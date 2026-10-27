/* ════════════════════════════════════════════════════════
 * 수행평가 점수 확인 (v96) — mode=perfScore로 본인 점수를 보고, 두 버튼 중 하나를 누른다.
 * 응답은 action=perfScoreConfirm(response 'ok'=이상 없음 / 'ask'=이상 있음)으로 저장되고 다시 눌러 바꿀 수 있다.
 * 점수 행이 없으면(아직 안 올림·글 없는 번호) 안내만 보여 준다.
 * ════════════════════════════════════════════════════════ */
let PERF_ITEMS = [];
async function openPerfScore(){
  const body = $('perfBody'), btn = $('perfOpenBtn');
  btn.disabled = true; btn.textContent = '불러오는 중…';
  body.style.display = 'block';
  body.innerHTML = '<p class="perf-msg">불러오는 중…</p>';
  try{
    if(PREVIEW_MODE && !PREVIEW_REAL) throw new Error('샘플 미리보기에서는 점수를 조회하지 않아요. 학생을 골라 미리보기하면 그 학생 점수가 보여요.');
    const url = CONFIG.WEBAPP_URL
      + '?mode=perfScore&studentId=' + encodeURIComponent(SESSION.studentId)
      + '&name=' + encodeURIComponent(SESSION.name)
      + (PREVIEW_MODE ? '&token=' + encodeURIComponent(TOKEN) : ''); // 교사 미리보기는 교사 토큰으로 통과(읽기 전용)
    const res = await fetch(url);
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '조회에 실패했어요.');
    PERF_ITEMS = data.items || [];
    renderPerfScore_();
    $('perfIntro').style.display = 'none';
  }catch(e){
    body.innerHTML = '<p class="login-error">' + escapeHtml(e.message || '조회에 실패했어요. 다시 시도해 주세요.') + '</p>'
      + '<button class="btn-logout" onclick="closePerfScore_()">닫기</button>';
  }finally{
    btn.disabled = false; btn.textContent = '점수 보기 →';
  }
}
function closePerfScore_(){
  $('perfBody').style.display = 'none';
  $('perfIntro').style.display = 'block';
}
function renderPerfScore_(){
  const body = $('perfBody');
  if(!PERF_ITEMS.length){
    body.innerHTML = '<p class="perf-msg">아직 올라온 수행평가 점수가 없어요.</p>'
      + '<button class="btn-logout" onclick="closePerfScore_()">닫기</button>';
    return;
  }
  body.innerHTML = PERF_ITEMS.map((it, i) => {
    const counts = [['3점', it.c3], ['2점', it.c2], ['1점', it.c1], ['0점', it.c0]]
      .filter(c => c[1] > 0).map(c => c[0] + ' ' + c[1] + '개').join(' · ');
    const short = it.used < 10
      ? '<p class="perf-note">글이 10개보다 적어서, 모자란 만큼은 0점으로 계산됐어요.</p>' : '';
    let answer;
    if(perfChanged_(it)){ // v101: 응답한 뒤 점수가 바뀜 → 변동 고지 + 다시 확인
      answer = '<p class="perf-changed">🔔 <b>점수가 달라졌어요.</b> 지난번에 확인할 때 ' + it.answeredScore + '점이었는데 지금은 <b>' + it.score + '점</b>이에요. 새 점수를 보고 한 번 더 눌러 주세요.</p>'
        + perfButtons_(i);
    }else if(it.response){
      const ok = it.response === '이상 없음';
      answer = '<p class="perf-answer ' + (ok ? 'perf-ok' : 'perf-ask') + '">'
        + (ok ? '✓ 확인했어요 (이상 없음)' : '✋ 어디서 감점됐는지 확인하고 싶어요 (이상 있음)') + '</p>'
        + (ok ? '' : '<p class="perf-note">글별 점수는 여기서 보여 주지 않아요. <b>선생님께 와서 직접 확인해요.</b></p>')
        + '<button class="btn-logout" onclick="perfShowButtons_(' + i + ')">다시 선택하기</button>';
    }else{
      answer = perfButtons_(i);
    }
    return '<div class="perf-item" id="perfItem' + i + '">'
      + '<p class="perf-title">' + escapeHtml(it.title) + '</p>'
      + '<p class="perf-score"><b>' + it.score + '</b> / ' + it.max + '점</p>'
      + '<p class="perf-sub">작성한 글 ' + it.written + '개 중 점수가 높은 ' + it.used + '개를 반영했어요'
      + (counts ? ' (' + counts + ')' : '') + '</p>'
      + short
      + '<p class="perf-final-note">⚠ 이 점수는 <b>최종 점수가 아니에요.</b> 학기말에 나오는 점수가 최종 점수이고, 그때 점수가 달라질 수 있어요.</p>'
      + '<div class="perf-actions" id="perfActions' + i + '">' + answer + '</div>'
      + '</div>';
  }).join('') + perfTargetHtml_() + '<button class="btn-logout" style="margin-top:10px;" onclick="closePerfScore_()">닫기</button>';
}
/* v124 — 본인 수행평가 점수로 «기말고사에서 몇 점이면 A»를 계산해 보여 준다(배점·등급 기준은 config.js GRADE_TARGET).
 * 총점 = 수행 점수/만점×perfWeight + 지필/examMax×examWeight. 필요한 지필 점수는 0.1점 단위로 올림(반올림하면 모자랄 수 있어서). */
function perfTargetHtml_(){
  const cfg = CONFIG.GRADE_TARGET && CONFIG.GRADE_TARGET[SESSION.grade];
  if(!cfg || !PERF_ITEMS.length) return '';
  const max = PERF_ITEMS.reduce((s, it) => s + (Number(it.max) || 0), 0);
  if(!max) return '';
  const got = PERF_ITEMS.reduce((s, it) => s + (Number(it.score) || 0), 0);
  const perf = Math.round(got / max * cfg.perfWeight * 100) / 100;
  const need = min => Math.max(0, Math.ceil((min - perf) * cfg.examMax / cfg.examWeight * 10 - 1e-6) / 10);
  const fmt = n => String(Math.round(n * 10) / 10);
  const needTxt = n => n >= cfg.examMax ? '<b>' + cfg.examMax + '점(만점)</b>' : '<b>' + fmt(n) + '점 이상</b>';
  const rows = cfg.cuts.map(c => ({ g: c.g, min: c.min, need: need(c.min) })).filter(r => r.need <= cfg.examMax);
  const a = cfg.cuts[0];
  let head;
  if(rows.length && rows[0].g === a.g){
    head = rows[0].need > 0
      ? '기말고사에서 ' + needTxt(rows[0].need) + '이면 ' + a.g + '예요'
      : '수행평가만으로 이미 ' + a.g + ' 점수를 넘었어요';
  }else if(rows.length){
    head = '기말고사에서 ' + needTxt(rows[0].need) + '이면 ' + rows[0].g + '예요';
  }else{
    return '';
  }
  const others = rows.slice(1).map(r => r.g + ' ' + fmt(r.need) + '점').join(' · ');
  return '<div class="perf-target">'
    + '<p class="perf-target-eyebrow">🎯 기말고사 목표 점수 (예상)</p>'
    + '<p class="perf-target-head">' + head + '</p>'
    + (rows[0].g !== a.g ? '<p class="perf-sub">' + a.g + '는 이번 기말고사 점수만으로는 닿기 어려워요. 한 등급이라도 더 올려 보자!</p>' : '')
    + (others ? '<p class="perf-sub">그 밖의 등급: ' + others + ' 이상</p>' : '')
    + '<p class="perf-sub">계산: 수행평가 ' + fmt(got) + '/' + fmt(max) + '점 → ' + fmt(perf) + '점 반영(' + cfg.perfWeight + '%) + 기말고사 점수 × '
    + (cfg.examWeight / cfg.examMax) + '(' + cfg.examWeight + '%). ' + a.g + '는 합계 ' + a.min + '점 이상이에요.</p>'
    + '<p class="perf-note">수행평가 점수가 바뀌면 목표 점수도 달라져요. 소수점 처리에 따라 실제와 조금 다를 수 있어요.</p>'
    + '</div>';
}
/* v101 — 학생이 «이상 없음/이상 있음»을 누른 뒤 점수가 바뀌었는지. answeredScore는 응답 때 저장된 점수(백엔드 v101부터 내려옴, 없으면 변동 없음으로 본다). */
function perfChanged_(it){
  return !!it.response && it.answeredScore !== undefined && it.answeredScore !== '' && it.answeredScore !== null
    && Number(it.answeredScore) !== Number(it.score);
}
function perfButtons_(i){
  return '<button class="btn-go perf-btn-ok" onclick="submitPerfResponse(' + i + ', \'ok\')">확인했어요 (이상 없음)</button>'
    + '<button class="btn-logout perf-btn-ask" onclick="submitPerfResponse(' + i + ', \'ask\')">어디서 감점됐는지 확인하고 싶어요 (이상 있음)</button>';
}
function perfShowButtons_(i){
  $('perfActions' + i).innerHTML = perfButtons_(i);
}
async function submitPerfResponse(i, response){
  if(PREVIEW_MODE){ showToast('미리보기에서는 응답을 저장하지 않아요.'); return; }
  const it = PERF_ITEMS[i];
  const box = $('perfActions' + i);
  box.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'perfScoreConfirm', studentId: SESSION.studentId, studentName: SESSION.name, title: it.title, response })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '저장 실패');
    it.response = data.response;
    renderPerfScore_();
    showToast(response === 'ok' ? '확인했어요. 고마워요!' : '요청을 남겼어요. 선생님께 와서 직접 확인해 주세요.');
  }catch(e){
    box.querySelectorAll('button').forEach(b => { b.disabled = false; });
    showToast('저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
  }
}

