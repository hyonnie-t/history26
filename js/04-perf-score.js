/* ════════════════════════════════════════════════════════
 * 수행평가 점수 확인 (v96) — mode=perfScore로 본인 점수를 보고, 두 버튼 중 하나를 누른다.
 * 응답은 action=perfScoreConfirm(response 'ok'=이상 없음 / 'ask'=이상 있음)으로 저장되고 다시 눌러 바꿀 수 있다.
 * 점수 행이 없으면(아직 안 올림·글 없는 번호) 안내만 보여 준다.
 * ════════════════════════════════════════════════════════ */
let PERF_ITEMS = [];
/* v139 — 카드 안내 문구. 학기말 성적(성취도·공부 길잡이)은 GRADE_TARGET이 있는 학년만 계산하므로 그 학년에만 약속한다.
 * 점수를 불러와 지필 성적이 내려왔으면(공개됨) «나오면»이 아니라 «볼 수 있어요»로 바꾼다. */
function perfDescUpdate_(published){
  const el = $('perfDesc');
  if(!el) return;
  const base = '지금까지 쓴 글로 매긴 점수예요.';
  const hasSem = !!(CONFIG.GRADE_TARGET && SESSION && CONFIG.GRADE_TARGET[SESSION.grade]);
  el.textContent = !hasSem ? base
    : base + (published ? ' 학기말 성적과 성취도, 공부 길잡이도 여기서 볼 수 있어요.' : ' 학기말 성적이 나오면 성취도와 공부 길잡이도 여기서 볼 수 있어요.');
}
let PERF_EXAMS = []; // v136 — 지필평가 점수·단원별 점수·개별 피드백(교사가 올리고 공개했을 때만 내려온다)
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
    PERF_EXAMS = data.exams || [];
    perfDescUpdate_(PERF_EXAMS.length > 0); // v139
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
  const semester = perfSemesterHtml_(); // v136 — 학기말 성적이 나오면 맨 위에, 목표 점수 계산과 «최종 점수 아님» 안내는 뺀다
  body.innerHTML = semester + PERF_ITEMS.map((it, i) => {
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
      + (semester ? '' : '<p class="perf-final-note">⚠ 이 점수는 <b>최종 점수가 아니에요.</b> 학기말에 나오는 점수가 최종 점수이고, 그때 점수가 달라질 수 있어요.</p>')
      + '<div class="perf-actions" id="perfActions' + i + '">' + answer + '</div>'
      + '</div>';
  }).join('') + (semester ? '' : perfTargetHtml_()) + '<button class="btn-logout" style="margin-top:10px;" onclick="closePerfScore_()">닫기</button>';
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
/* v136 — 학기말 성적: 수행 반영(Σscore/Σmax×perfWeight) + 지필 반영(score/max×examWeight) = 합계, 등급은 GRADE_TARGET.cuts(모자라면 lowest).
 * 합계는 여기서 계산한다(수행평가 점수를 조정하면 바로 반영). 등급은 정수로 반올림하지 않은 합계(소수 둘째 자리)로 정하고, 화면에도 그 값을 그대로 보인다. 지필 점수·단원별 점수·피드백은 교사가 올린 값. */
function perfSemesterGrade_(cfg, total){
  return (cfg.cuts.find(c => total >= c.min) || { g: cfg.lowest || 'E' }).g;
}
function perfSemesterHtml_(){
  const cfg = CONFIG.GRADE_TARGET && CONFIG.GRADE_TARGET[SESSION.grade];
  const ex = PERF_EXAMS[0];
  if(!cfg || !ex || !(Number(ex.max) > 0)) return '';
  const pMax = PERF_ITEMS.reduce((s, it) => s + (Number(it.max) || 0), 0);
  const pGot = PERF_ITEMS.reduce((s, it) => s + (Number(it.score) || 0), 0);
  const r2 = n => Math.round(n * 100) / 100;
  const perf = pMax ? r2(pGot / pMax * cfg.perfWeight) : 0;
  const exam = r2(Number(ex.score) / Number(ex.max) * cfg.examWeight);
  const total = r2(perf + exam);
  const grade = perfSemesterGrade_(cfg, total);
  const fmt = n => String(Math.round(n * 10) / 10);
  const areas = (ex.areas || []).filter(a => Number(a.max) > 0);
  const areaHtml = areas.length ? '<p class="sem-sec">단원별 기말고사 점수</p><ul class="sem-areas">' + areas.map(a => {
      const pct = Math.round(Number(a.got) / Number(a.max) * 100);
      return '<li><span class="sem-area-name">' + escapeHtml(a.name) + '</span><span class="sem-bar"><i style="--w:' + pct + '%"></i></span>'
        + '<span class="sem-area-num">' + Number(a.got) + '/' + Number(a.max) + '</span></li>';
    }).join('') + '</ul>' : '';
  const fbHtml = ex.feedback ? '<div class="sem-fb"><p class="sem-sec">💌 선생님이 보내는 공부 길잡이</p>'
    + String(ex.feedback).split('\n').filter(l => l.trim()).map(l => {
        const m = l.match(/^(\S+\s[^:]{1,8}):\s*(.*)$/); // «💪 잘한 점: …» → 머리말 굵게
        return '<p class="sem-fb-line">' + (m ? '<b>' + escapeHtml(m[1]) + '</b> ' + escapeHtml(m[2]) : escapeHtml(l)) + '</p>';
      }).join('') + '</div>' : '';
  return '<section class="sem-card" aria-label="학기말 성적">'
    + '<p class="sem-eyebrow">📊 ' + escapeHtml(ex.title || '학기말 성적') + '</p>'
    + '<div class="sem-top"><div class="sem-total"><span class="sem-total-label">학기말 합계</span><b>' + String(total) + '</b><span class="sem-total-max">/ 100점</span></div>'
    + '<div class="sem-grade sem-g-' + escapeHtml(grade) + '" aria-label="성취도 ' + escapeHtml(grade) + '">' + escapeHtml(grade) + '</div></div>'
    + '<div class="sem-rows"><div class="sem-row"><b>수행평가</b><span>' + fmt(pGot) + ' / ' + fmt(pMax) + '점</span><small>→ ' + fmt(perf) + '점 반영 (' + cfg.perfWeight + '%)</small></div>'
    + '<div class="sem-row"><b>기말고사</b><span>' + fmt(Number(ex.score)) + ' / ' + fmt(Number(ex.max)) + '점</span><small>→ ' + fmt(exam) + '점 반영 (' + cfg.examWeight + '%)</small></div></div>'
    + '<p class="perf-sub">성취도는 합계로 정해요: ' + cfg.cuts.map(c => c.g + ' ' + c.min + '점 이상').join(' · ') + ' · 그 아래 ' + (cfg.lowest || 'E') + '. 최종 성적은 학교 성적표로 확정돼요.</p>'
    + areaHtml + fbHtml + '</section>';
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

