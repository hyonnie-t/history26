/* ════════════════════════════════════════════════════════
 * 웰컴 체크인 (v15 백엔드 연동) — 핸드오프_웰컴체크인_v2 2-2
 * checkin_data.js(CHECKIN_CONFIG, CHECKIN_PLAN)가 없거나 서버 오류가 나도
 * 학생이 포털에 못 들어가는 일이 없도록 전부 "실패하면 조용히 건너뛰기"로 처리.
 * ════════════════════════════════════════════════════════ */
let CHECKIN_CTX = null; // { grade, lessonId, lesson, temperature }
let CK_SUBMITTING = false; // 응답 전송 중 중복 클릭 방지 — 버튼 반응이 느려도 두 번째 클릭을 무시

async function maybeStartCheckin(){
  if(CHECKIN_PLAN === null) await loadCheckinPlan(); // 아직 백그라운드 로딩 중이면 여기서 기다림
  /* v88: 수업 체크인 문항을 못 불러와도(시트 실패·그 학년 문항 없음) 기본 감정 체크인은 뜬다.
   * checkin_data.js 자체가 없을 때만(CHECKIN_EMOTION 미정의) 예전처럼 조용히 건너뜀. */
  const plan = CHECKIN_PLAN && CHECKIN_PLAN[SESSION.grade];
  const emo = (typeof CHECKIN_EMOTION !== 'undefined') ? CHECKIN_EMOTION : null;
  try{
    const url = CONFIG.WEBAPP_URL
      + "?mode=checkinToday&grade=" + encodeURIComponent(SESSION.grade)
      + "&ban=" + encodeURIComponent(SESSION.ban)
      + "&studentId=" + encodeURIComponent(SESSION.studentId)
      + "&name=" + encodeURIComponent(SESSION.name);
    const res = await fetch(url);
    const data = await res.json();
    if(data.result !== 'success') return false;
    const lessonId = data.lessonId || ''; // v88: 비어 있으면(교사가 안 골랐으면) 기본 감정 체크인
    /* v18: 하루 1번만 체크인하도록 복원. 백엔드는 계속 alreadyChecked를 계산해서
     * 내려주고 있었는데(v15부터), v17에서 프론트가 이 값을 무시하도록 바뀌어 있던 것.
     * 이미 오늘 체크인했으면 체크인 화면 없이 바로 포털로 들어감. */
    if(data.alreadyChecked) return false;
    const lesson = (plan && lessonId && !(emo && lessonId === emo.id))
      ? (plan.lessons || []).find(l => l.id === lessonId) : null;
    if(lesson){
      CHECKIN_CTX = { grade: SESSION.grade, lessonId, lesson, temperature: null };
      return true;
    }
    /* v88: 수업 체크인이 지정되지 않았거나, 지정된 문항을 못 찾으면(삭제 등) 감정 체크인으로. */
    if(!emo) return false;
    CHECKIN_CTX = { grade: SESSION.grade, lessonId: emo.id, lesson: { type: 'emotion_default' }, temperature: null };
    return true;
  }catch(e){
    return false;
  }
}

function enterCheckinFlow(){
  CK_SUBMITTING = false;
  $('loginView').style.display = 'none';
  $('checkinView').style.display = 'flex';
  renderCheckinSpread();
}

function finishCheckinFlow(){
  $('checkinView').style.display = 'none';
  openBook(true); // 이미 체크인으로 한 번 화면 전환을 거쳤으니 책 애니메이션 없이 바로 포털
}

/* v17: 책을 펼치면 왼쪽 페이지=감정 온도, 오른쪽 페이지=발문이 함께 보이는 두 페이지 스프레드.
 * "온도를 먼저 본다" 원칙은 유지하되(오른쪽은 왼쪽에서 온도를 고르기 전엔 비활성),
 * 화면 자체는 책의 한 페이지처럼 한 번에 보이게 구성. */
function renderCheckinSpread(){
  const spread = $('checkinCard');
  const lesson = CHECKIN_CTX.lesson;
  const tempCfg = CHECKIN_CONFIG.temperature;

  spread.innerHTML = `
    <div class="book-page book-page-left">
      <p class="checkin-eyebrow">웰컴 체크인</p>
      <p class="checkin-q">${escapeHtml(tempCfg.prompt)}</p>
      <div class="temp-grid">
        ${[1,2,3,4,5].map(n => `
          <button class="temp-btn" data-temp="${n}" type="button">
            <span class="temp-num">${n}</span>
            <span class="temp-label">${escapeHtml(tempCfg.labels[n] || '')}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="book-page book-page-right locked" id="ckRightPage">
      <div class="ck-lock-hint" id="ckLockHint">👈 먼저 왼쪽에서 오늘 상태부터 골라줘</div>
      <div class="ck-right-body" id="ckRightBody"></div>
    </div>`;

  renderCheckinQuestionBody($('ckRightBody'), lesson);

  spread.querySelectorAll('.temp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      CHECKIN_CTX.temperature = Number(btn.dataset.temp);
      spread.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('selected', b === btn));
      $('ckRightPage').classList.remove('locked');
      $('ckLockHint').style.display = 'none';
    });
  });
}

/* 2026-09-11 신규 — 자료(source) 박스를 텍스트/이미지 공통 렌더러로 분리.
 * judgment/source_emotion 둘 다 lesson.source가 있을 수 있고(judgment는 없어도 됨),
 * source.format이 'image'면 <img>, 그 외엔 기존처럼 텍스트로 그린다. */
function renderCheckinSourceBoxHtml_(source){
  if(!source) return '';
  const body = source.format === 'image'
    ? `<img class="source-image" src="${escapeHtml(source.imageUrl)}" alt="${escapeHtml(source.imageAlt || '')}">`
    : `<p class="source-text">${escapeHtml(source.text).replace(/\n/g,'<br>')}</p>`;
  return `<div class="source-box">
      ${body}
      ${source.origin ? `<p class="source-origin">— ${escapeHtml(source.origin)}</p>` : ''}
    </div>`;
}

/* v88: 보기 순서·감정칩을 학생·날짜마다 다르게 섞되, 같은 학생이 같은 날 새로고침하면 그대로 나오게
 * 문자열 시드로 고정한 가짜 난수를 쓴다(학생회 웹앱과 같은 방식). */
function ckRng_(seed){
  let h = 1779033703 ^ seed.length;
  for(let i = 0; i < seed.length; i++){ h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  const next = function(){
    h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  for(let i = 0; i < 6; i++) next(); // 비슷한 시드(학번만 다른 경우)의 첫 값이 서로 닮아 보기 순서가 한쪽으로 쏠리던 것을 풀어 준다
  return next;
}
function ckShuffle_(arr, rnd){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function ckSeed_(tag){
  const d = new Date();
  const day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  return String(SESSION.studentId) + '|' + day + '|' + tag;
}

/* v88: 오늘의 감정칩 — 유쾌 3 + 불쾌 3. 네 분면(r·y·b·g)에서 하나씩 뽑고, 유쾌 쪽(y·g)과 불쾌 쪽(r·b)에서
 * 한 분면씩 더 골라 하나씩 보탠다. 단어 풀은 checkin_data.js의 CHECKIN_EMOTION.pool. */
function ckTodayEmotionChips_(){
  const emo = CHECKIN_EMOTION, rnd = ckRng_(ckSeed_('emotion'));
  const by = {};
  emo.pool.forEach(m => (by[m.q] = by[m.q] || []).push(m));
  const sh = {};
  ['r','y','b','g'].forEach(q => { sh[q] = ckShuffle_(by[q] || [], rnd); });
  const picks = ['r','y','b','g'].map(q => sh[q][0]).filter(Boolean);
  ['yg','rb'].forEach(side => { const q = side[Math.floor(rnd() * 2)]; if(sh[q][1]) picks.push(sh[q][1]); });
  return ckShuffle_(picks, rnd).slice(0, emo.chipCount);
}

function ckFortuneText_(q){
  const emo = CHECKIN_EMOTION, rnd = ckRng_(ckSeed_('fortune|' + q));
  const key = emo.fortunes[q] ? q : ['r','y','b','g'][Math.floor(rnd() * 4)]; // 기타(직접 쓰기)는 아무 분면에서
  const arr = emo.fortunes[key];
  return arr[Math.floor(rnd() * arr.length)];
}

/* v88: 기본 감정 체크인 — 오른쪽 페이지에 감정칩 6개(+직접 쓰기). 고르면 바로 저장하고 포춘쿠키 단계로. */
function renderEmotionDefaultBody_(body){
  const emo = CHECKIN_EMOTION, chips = ckTodayEmotionChips_();
  const customOn = CHECKIN_CONFIG.customInput && CHECKIN_CONFIG.customInput.enabled;
  body.innerHTML = `
    <p class="checkin-eyebrow">오늘의 마음</p>
    <p class="checkin-q">${escapeHtml(emo.prompt)}</p>
    <div class="chip-grid emo-grid">
      ${chips.map((m, i) => `<button class="chip-btn emo-chip" data-i="${i}" type="button"><span class="emo-e" aria-hidden="true">${m.e}</span>${escapeHtml(m.t)}</button>`).join('')}
      ${customOn ? `<button class="chip-btn chip-custom" id="chipCustomBtn" type="button">기타</button>` : ''}
    </div>
    ${customOn ? `
    <div class="custom-input-wrap" id="customInputWrap" style="display:none;">
      <input type="text" id="customInputField" maxlength="${CHECKIN_CONFIG.customInput.maxLength}" placeholder="${escapeHtml(CHECKIN_CONFIG.customInput.placeholder)}">
      <p class="custom-notice">${escapeHtml(CHECKIN_CONFIG.customInput.notice)}</p>
      <button class="btn-open" id="customInputSubmit" type="button" style="background:var(--indigo); color:#fff;">확인</button>
    </div>` : ''}`;

  const pick = (fields, q) => {
    CK_SUBMITTING = true;
    body.querySelectorAll('.chip-btn').forEach(b => b.disabled = true);
    document.querySelector('.book-page-left').classList.add('done'); // 저장이 시작됐으니 왼쪽 온도는 더 못 바꾼다
    submitCheckin(fields, { keepOpen: true }); // 저장은 바로 시작하고, 학생은 쿠키 단계로 넘어감
    setTimeout(() => renderFortuneStep_(body, q), 380);
  };
  body.querySelectorAll('.emo-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      const m = chips[Number(btn.dataset.i)];
      btn.classList.add('selected');
      pick({ checkinType: 'source_emotion', word: m.t, custom: '' }, m.q);
    });
  });
  const customBtn = $('chipCustomBtn');
  if(customBtn){
    customBtn.addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      $('customInputWrap').style.display = 'block';
      $('customInputField').focus();
    });
    $('customInputSubmit').addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      const val = $('customInputField').value.trim();
      if(!val){ $('customInputField').focus(); return; }
      pick({ checkinType: 'source_emotion', word: '기타', custom: val }, '');
    });
    $('customInputField').addEventListener('keydown', e => { if(e.key === 'Enter') $('customInputSubmit').click(); });
  }
}

/* v88: 포춘쿠키 — 눌러서 쿠키를 깨면 고른 감정의 분면에 맞는 한마디가 나온다. */
function renderFortuneStep_(body, q){
  const text = ckFortuneText_(q);
  body.innerHTML = `
    <p class="checkin-eyebrow">오늘의 포춘쿠키</p>
    <p class="checkin-q" id="fcPrompt">쿠키를 눌러 오늘의 한마디를 꺼내 봐</p>
    <div class="fortune-stage">
      <button type="button" class="fortune-cookie" id="fcCookie" aria-label="포춘쿠키 열기">
        <img class="fc-img fc-whole" src="images/fortune_cookie.webp" alt="" width="480" height="365" aria-hidden="true">
        <img class="fc-img fc-open" src="images/fortune_cookie_open.webp" alt="" width="480" height="365" aria-hidden="true">
      </button>
      <p class="fortune-slip" id="fcSlip" aria-live="polite" hidden>${escapeHtml(text)}</p>
    </div>
    <button type="button" class="fortune-go" id="fcGo" hidden>포털로 들어가기</button>`;
  const cookie = $('fcCookie');
  cookie.addEventListener('click', () => {
    if(cookie.classList.contains('cracked')) return;
    cookie.classList.add('cracked');
    cookie.disabled = true;
    $('fcPrompt').textContent = '오늘의 한마디';
    $('fcSlip').hidden = false;
    $('fcGo').hidden = false;
    $('fcGo').focus();
  });
  $('fcGo').addEventListener('click', finishCheckinFlow);
  cookie.focus();
}

function renderCheckinQuestionBody(body, lesson){
  if(lesson.type === 'emotion_default'){ renderEmotionDefaultBody_(body); return; }
  if(lesson.type === 'judgment'){
    body.innerHTML = `
      <p class="checkin-eyebrow">발문</p>
      ${renderCheckinSourceBoxHtml_(lesson.source)}
      <p class="checkin-q" style="white-space:pre-wrap;">${escapeHtml(lesson.prompt)}</p>
      <div class="judg-options">
        ${ckShuffle_(lesson.options, ckRng_(ckSeed_('judg|' + CHECKIN_CTX.lessonId))).map(o => `
          <button class="judg-btn" data-id="${escapeHtml(o.id)}" type="button">${escapeHtml(o.label)}</button>`).join('')}
      </div>`;
    body.querySelectorAll('.judg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return; // 잠금 상태 또는 이미 전송 중이면 무시
        CK_SUBMITTING = true;
        btn.classList.add('selected');
        body.querySelectorAll('.judg-btn').forEach(b => b.disabled = true);
        submitCheckin({ checkinType: 'judgment', judgment: btn.dataset.id });
      });
    });
    return;
  }

  const chips = lesson.wordChips || CHECKIN_CONFIG.defaultWordChips;
  const customOn = CHECKIN_CONFIG.customInput && CHECKIN_CONFIG.customInput.enabled;
  body.innerHTML = `
    <p class="checkin-eyebrow">발문</p>
    ${renderCheckinSourceBoxHtml_(lesson.source)}
    <p class="checkin-q" style="white-space:pre-wrap;">${escapeHtml(lesson.prompt)}</p>
    <div class="chip-grid">
      ${chips.map(w => `<button class="chip-btn" data-word="${escapeHtml(w)}" type="button">${escapeHtml(w)}</button>`).join('')}
      ${customOn ? `<button class="chip-btn chip-custom" id="chipCustomBtn" type="button">기타</button>` : ''}
    </div>
    ${customOn ? `
    <div class="custom-input-wrap" id="customInputWrap" style="display:none;">
      <input type="text" id="customInputField" maxlength="${CHECKIN_CONFIG.customInput.maxLength}" placeholder="${escapeHtml(CHECKIN_CONFIG.customInput.placeholder)}">
      <p class="custom-notice">${escapeHtml(CHECKIN_CONFIG.customInput.notice)}</p>
      <button class="btn-open" id="customInputSubmit" type="button" style="background:var(--indigo); color:#fff;">확인</button>
    </div>` : ''}`;

  body.querySelectorAll('.chip-btn:not(.chip-custom)').forEach(btn => {
    btn.addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      CK_SUBMITTING = true;
      btn.classList.add('selected');
      body.querySelectorAll('.chip-btn').forEach(b => b.disabled = true);
      submitCheckin({ checkinType: 'source_emotion', word: btn.dataset.word, custom: '' });
    });
  });
  const customBtn = $('chipCustomBtn');
  if(customBtn){
    customBtn.addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      $('customInputWrap').style.display = 'block';
      $('customInputField').focus();
    });
  }
  const customSubmit = $('customInputSubmit');
  if(customSubmit){
    customSubmit.addEventListener('click', () => {
      if(CHECKIN_CTX.temperature == null || CK_SUBMITTING) return;
      const val = $('customInputField').value.trim();
      if(!val){ $('customInputField').focus(); return; }
      CK_SUBMITTING = true;
      customSubmit.disabled = true;
      body.querySelectorAll('.chip-btn').forEach(b => b.disabled = true);
      submitCheckin({ checkinType: 'source_emotion', word: '기타', custom: val });
    });
    $('customInputField').addEventListener('keydown', e => {
      if(e.key === 'Enter') customSubmit.click();
    });
  }
}

async function submitCheckin(fields, opts){
  const keepOpen = !!(opts && opts.keepOpen); // v88: 감정 체크인은 저장 뒤 포춘쿠키 단계가 이어진다
  const payload = Object.assign({
    action: 'checkin',
    studentId: SESSION.studentId,
    studentName: SESSION.name,
    lessonId: CHECKIN_CTX.lessonId,
    temperature: CHECKIN_CTX.temperature,
    judgment: '', word: '', custom: ''
  }, fields);
  if(PREVIEW_MODE){
    /* 교사용 미리보기 — 화면 흐름만 보여주고 실제 시트에는 기록하지 않음 */
    if(!keepOpen) finishCheckinFlow();
    return;
  }
  try{
    await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify(payload) });
  }catch(e){
    /* 체크인 기록 실패는 학생 흐름을 막지 않음 — 조용히 포털로 진입 */
  }
  if(!keepOpen) finishCheckinFlow();
}

/* ── 탐구 나무 SVG ──
 * stage(0~7) = 칭호 단계 / leaves·totalLessons = 완료 활동 수·전체 차시 수
 * (참여 기반만 반영, 달성도와 무관) */
/* v32(핸드오프 "나무 8단계 전환"): RANK가 학년별 8단계로 늘어나면서(v31) 나무도
 * stage 0~7까지 8단계로 확장 — RANK가 오르는 시점 = 나무 stage가 오르는 시점(1:1).
 * 기존 4단계(0/1/2/"3 이상") 중 0·1·"3 이상"의 손그림 좌표는 그대로 두고(검증된
 * 모양), 그 사이 5단계를 같은 원·가지 문법으로 보간해 채웠다.
 * leaves(완료 차시 수)는 원래 원시 개수를 그대로 썼는데, 이제 학년마다 분모(2학년
 * 30차시·3학년 15차시)가 달라 원시 개수로는 나무가 꽉 차는 시점이 학년마다 어긋난다
 * — totalLessons(그 학생 트랙의 "웹앱 활동 있는 차시" 수, active.length)를 받아
 * leaves/totalLessons 비율로 0~10(leafSpots 풀 크기)에 정규화한 뒤, 단계별 캡
 * (dotCap/flowerCap/fruitCap)으로 한 번 더 눌러 어린 나무엔 조금만, 큰 나무엔
 * 넉넉히 붙게 했다. */
/* treeSvg()는 v64부터 tree.js로 분리(단풍 계절 팔레트 포함). */

/* v28 — 반 트랙(효니/미현쌤) 필터. 학년정보에 hyoBans/mihyunBans가 설정돼 있으면
 * 그 반이 어느 트랙인지 판정하고, 커리큘럼도 "공통" + "본인 트랙"만 걸러서 보여준다.
 * 둘 다 비어있는 학년(트랙 구분을 아직 안 쓰는 학년)은 전부 그대로 보임. */
function myTrackOf(cur, ban){
  if((cur.hyoBans||[]).includes(ban)) return '효니';
  if((cur.mihyunBans||[]).includes(ban)) return '미현쌤';
  return null;
}
function filterLessonsForBan(cur, ban){
  const track = myTrackOf(cur, ban);
  return cur.lessons.filter(l => !l.owner || l.owner === track);
}

/* ── 포털 렌더 ── */
function renderPortal(){
  const cur = CONFIG.CURRICULUM[SESSION.grade];
  const lessons = filterLessonsForBan(cur, SESSION.ban); // v28: 담당 트랙 필터링된 차시 목록
  $('loginView').style.display = 'none';
  $('dashView').style.display = 'none';
  const pv = $('portalView');
  pv.style.display = 'block';
  requestAnimationFrame(() => pv.classList.add('shown'));

  $('portalEyebrow').textContent = `2학기 · ${SESSION.grade}학년 ${cur.subject}`;
  $('previewBanner').style.display = (PREVIEW_MODE || TEST_WRITE_MODE) ? 'flex' : 'none';
  if(TEST_WRITE_MODE){
    $('previewBannerText').textContent = `🧪 기록 테스트 모드 — ${SESSION.studentId}(${TEST_STUDENT_NAME}) 계정으로 실제 저장돼요. 끝나면 대시보드/시트에서 이 학번 기록을 지워 주세요.`;
    $('btnExitPreview').textContent = '종료';
    $('btnPrevStudent').style.display = $('btnNextStudent').style.display = 'none';
  }
  if(PREVIEW_MODE){
    $('previewBannerText').textContent = PREVIEW_REAL
      ? `👀 ${SESSION.name} 학생(${SESSION.studentId})의 실제 화면 — 읽기 전용이에요. 기록·읽음 처리는 일어나지 않고, 활동 링크도 미리보기 모드로 열려요.`
      : '👀 샘플 미리보기 — 실제 학생 기록이 아니에요. 특정 학생의 진짜 화면은 대시보드 학생 카드의 "학생 화면 보기"로 볼 수 있어요.';
    $('btnExitPreview').textContent = PREVIEW_FROM_DASH ? '대시보드로' : '종료';
    $('btnPrevStudent').style.display = $('btnNextStudent').style.display = PREVIEW_FROM_DASH ? '' : 'none';
  }
  $('sideName').textContent = SESSION.name;
  $('sideClass').textContent = `${SESSION.grade}학년 ${SESSION.ban}반 ${SESSION.num}번`;

  renderAnnouncements();

  const doneIds = new Set(STUDENT_DATA.activities.map(a => String(a.activityId)));
  /* 활동별 성취 기록: "성취수준이 있는 가장 최근 기록" 우선 */
  const achieveMap = {};
  STUDENT_DATA.activities.forEach(a => {
    const id = String(a.activityId);
    const prev = achieveMap[id];
    const hasA = a.achievement && String(a.achievement).trim();
    const prevHasA = prev && prev.achievement && String(prev.achievement).trim();
    if (!prev || hasA || !prevHasA) achieveMap[id] = a;
  });
  /* 활동별 진짜 최근 기록 (분석 여부 무관) — "새 기록 분석 대기 중" 표시용 */
  const latestMap = {};
  STUDENT_DATA.activities.forEach(a => {
    const id = String(a.activityId);
    const prev = latestMap[id];
    if (!prev || new Date(a.timestamp) - new Date(prev.timestamp) >= 0) latestMap[id] = a;
  });

  /* 피드백을 활동별로 분류 — 차시 id와 일치하면 인라인, 아니면 총평 */
  const lessonIds = new Set(lessons.map(l => l.id));
  const fbAll = STUDENT_DATA.feedback || [];
  const fbByLesson = {};
  const fbGeneral = [];
  fbAll.forEach(f => {
    const aid = String(f.activityId || '').trim();
    if (lessonIds.has(aid)) {
      (fbByLesson[aid] = fbByLesson[aid] || []).push(f);
    } else {
      fbGeneral.push(f);
    }
  });

  /* v35 — 학급 공통 피드백(교사 대시보드에서 반+활동 단위로 생성) 중 학생용 문구만
   * activityId 기준 맵으로. 개인 AI 코멘트·개인 피드백과 달리 이 학생 개인 기록이
   * 아니라 "이 반 전체"에 대한 문구라 STUDENT_DATA.activities가 아니라 서버가 이미
   * 이 학생의 반으로 걸러서 내려준 STUDENT_DATA.classFeedback을 그대로 씀. */
  const classFeedbackMap = {};
  (STUDENT_DATA.classFeedback || []).forEach(f => {
    const aid = String(f.activityId || '').trim();
    if (aid) classFeedbackMap[aid] = f;
  });

  /* v27: 차시 하나에 활동이 여러 개(cur.lessons[].activities) 있을 수 있음.
   * "완료했다"는 그 차시의 activities를 전부 doneIds에 넣었을 때만 인정 —
   * 진행률·나무·포인트 계산에서 "차시" 단위 숫자는 전부 이 기준으로 통일. */
  function lessonHasUrl(l){ return l.activities.some(a => a.url || a.urlByBan); }
  function lessonDone(l){ return l.activities.every(a => doneIds.has(a.id)); }

  renderNextActivity_(lessons, doneIds, lessonDone); // v105

  /* KPI: 진행률 (차시 단위) */
  const active = lessons.filter(lessonHasUrl);
  const doneCount = active.filter(lessonDone).length;
  const pct = active.length ? Math.round(doneCount / active.length * 100) : 0;
  $('progressDone').textContent = doneCount;
  $('progressTotal').textContent = active.length;
  requestAnimationFrame(() => { $('progressFill').style.width = pct + '%'; });

  /* 포인트·칭호·나무 (참여·노력 기반 — 달성도와 무관)
   * v27: 포인트는 활동 단위로 지급(첫 완료 FIRST점 + 재도전 1회당 RETRY점, 활동당
   * RETRY_MAX회까지) — 차시에 활동이 2개면 둘 다 채워야 그만큼 포인트가 쌓임.
   * 나무 잎(leaves)·칭호 단계는 기존처럼 "완료한 차시" 개수 기준 유지. */
  const P = CONFIG.POINTS || { FIRST: 10, RETRY: 5, RETRY_MAX: 2 };
  const attemptCnt = {};
  STUDENT_DATA.activities.forEach(a => {
    const id = String(a.activityId);
    attemptCnt[id] = (attemptCnt[id] || 0) + 1;
  });
  let points = 0;
  lessons.forEach(l => {
    l.activities.forEach(act => {
      if (!doneIds.has(act.id)) return;
      points += P.FIRST;
      const retries = Math.max((attemptCnt[act.id] || 1) - 1, 0);
      points += Math.min(retries, P.RETRY_MAX) * P.RETRY;
    });
  });
  /* v31: 발표 탐구포인트(교사 대시보드 "+ 탐구포인트") — 커리큘럼의 lessons/activities
   * 순회에 안 걸리는 별도 지급이라(가상 활동이라 학생 화면 차시 목록엔 없음) 여기서
   * STUDENT_DATA.presentationGrants를 따로 합산해 points에 얹는다. 필드 자체가 없는
   * 경우(구버전 백엔드, 미리보기 모드) 방어적으로 빈 배열 처리. */
  const ppGrants = STUDENT_DATA.presentationGrants || [];
  const presentationPoints = ppGrants.reduce((sum, g) => sum + (Number(g.points) || 6), 0);
  points += presentationPoints;
  const sidePpEl = $('sidePp');
  if (sidePpEl) {
    if (ppGrants.length) {
      sidePpEl.hidden = false;
      sidePpEl.textContent = `🎤 발표 인정 ${ppGrants.length}회 · +${presentationPoints}점`;
    } else {
      sidePpEl.hidden = true;
    }
  }
  const doneLessonsCount = lessons.filter(lessonDone).length;
  /* v31: RANKS가 학년 공통 배열 → 학년별 배열(2/3)로 바뀜(핸드오프 "발표 탐구포인트 +
   * RANK 재설계") — 2학년 30차시·3학년 15차시로 진도량이 달라 문턱을 분리했기 때문.
   * 학생 학년에 해당하는 배열이 없으면(설정 누락 방어) 2학년 스케일로 폴백. */
  const ranks = CONFIG.RANKS[SESSION.grade] || CONFIG.RANKS[2] || [{ min: 0, name: '견습 사관' }];
  let rank = ranks[0], rankIdx = 0;
  ranks.forEach((r, i) => { if (points >= r.min) { rank = r; rankIdx = i; } });
  const nextRank = ranks.find(r => r.min > points) || null;
  $('pointsNum').textContent = points;
  $('kpiPoints').textContent = points;
  $('rankName').textContent = rank.name;
  $('kpiFeedback').textContent = fbAll.length;
  if (nextRank) {
    $('rankNext').textContent = `다음 칭호(${nextRank.name})까지 ${nextRank.min - points}점`;
    const span = nextRank.min - rank.min;
    const p = span > 0 ? Math.round((points - rank.min) / span * 100) : 0;
    requestAnimationFrame(() => { $('rankFill').style.width = p + '%'; });
  } else {
    $('rankNext').textContent = '최고 칭호에 도달했어요!';
    requestAnimationFrame(() => { $('rankFill').style.width = '100%'; });
  }
  /* v94: 그림 나무 장면(단풍철) + 3학년 시험기간 연출. 응원 문구는 시험기간에만 보인다. */
  $('treeBox').innerHTML = treeScene(rankIdx, doneLessonsCount, active.length, SESSION.grade);
  const examOn_ = !!$('treeBox').querySelector('.is-exam');
  $('treeBox').classList.toggle('is-exam', examOn_);
  const cheerEl_ = $('examCheer');
  if(cheerEl_){ cheerEl_.hidden = !examOn_; if(examOn_) cheerEl_.textContent = treeExamCheer_(); }
  $('treeBox').setAttribute('aria-label',
    `탐구 나무 ${rankIdx + 1}단계, 완료한 활동 ${doneLessonsCount}개`);

  /* 칭호첩(특별 칭호) — renderPortal은 로그인 직후·refreshStudentData 재조회 시
   * 둘 다에서 호출되므로 여기 한 곳에서만 처리하면 두 트리거를 모두 커버한다. */
  renderBadges(STUDENT_DATA.badges);
  checkNewBadges(STUDENT_DATA.badges);
  checkNewPresentationGrants(ppGrants);
  checkNewFeedback(fbAll); // v36
  renderMessages();        // v62
  checkNewMessages_();     // v62
  checkNewAnnouncements_(STUDENT_DATA.announcements); // v103
  // v44 — 사이드카드 높이 재계산은 배지 목록이 그려진 뒤(내용이 바뀌어야 다시 잴 의미가
  // 있음) 페인트 한 번 지난 다음에 해야 정확한 위치를 잰다(레이아웃 함수 정의는 아래).
  requestAnimationFrame(layoutSideCard_);

  /* 단원 관통 질문 배너 */
  const uq = (cur.unitQuestion || '').trim();
  if (uq) {
    $('unitBanner').style.display = 'block';
    $('unitQuestion').textContent = uq;
  } else {
    $('unitBanner').style.display = 'none';
  }

  /* 패들렛 포트폴리오 등 — 학기 내내 반마다 고정으로 쓰는 링크 카드 (차시가 아니라 완료·포인트 대상 아님) */
  const pf = cur.portfolio;
  const pfUrl = pf ? (pf.urlByBan ? (pf.urlByBan[SESSION.ban] || '') : (pf.url || '')) : '';
  const pfHas = !!(pf && pfUrl);
  if (pfHas) {
    $('portfolioTitle').textContent = pf.title || '나의 패들렛';
    $('portfolioDesc').textContent = pf.desc || '';
    $('portfolioLinkBtn').href = ensureUrlScheme_(pfUrl);
  }

  /* v45 — 복습용 클래스카드. 포트폴리오와 같은 패턴(반별 urlByBan 우선, 없으면 공통 url). */
  const cc = cur.classcard;
  const ccUrl = cc ? (cc.urlByBan ? (cc.urlByBan[SESSION.ban] || '') : (cc.url || '')) : '';
  const ccHas = !!(cc && ccUrl);
  if (ccHas) {
    $('classcardTitle').textContent = cc.title || '복습용 클래스카드';
    $('classcardDesc').textContent = cc.desc || '';
    $('classcardLinkBtn').href = ensureUrlScheme_(ccUrl);
  }

  /* v79 — 시험범위 교과서(PDF 등). 클래스카드와 같은 패턴(반별 urlByBan 우선, 없으면 공통 url). */
  const tb = cur.textbook;
  const tbUrl = tb ? (tb.urlByBan ? (tb.urlByBan[SESSION.ban] || '') : (tb.url || '')) : '';
  const tbHas = !!(tb && tbUrl);
  if (tbHas) {
    $('textbookTitle').textContent = tb.title || '시험범위 교과서';
    $('textbookDesc').textContent = tb.desc || '';
    $('textbookLinkBtn').href = ensureUrlScheme_(tbUrl);
  }

  /* v57 — 패들렛·클래스카드 탭 카드. 데이터가 전혀 없으면 카드 자체를 숨기고,
   * 하나만 있으면 탭 내비게이션을 숨긴 채(누를 탭이 하나뿐이면 의미 없음) 그 패널만 보여준다. */
  $('refTabBtnPortfolio').style.display = pfHas ? '' : 'none';
  $('refTabBtnClasscard').style.display = ccHas ? '' : 'none';
  $('refTabBtnTextbook').style.display = tbHas ? '' : 'none';
  if (pfHas || ccHas || tbHas) {
    $('refTabsCard').style.display = 'block';
    $('refTabNav').style.display = ((pfHas ? 1 : 0) + (ccHas ? 1 : 0) + (tbHas ? 1 : 0)) > 1 ? 'flex' : 'none';
    switchRefTab(pfHas ? 'portfolio' : (ccHas ? 'classcard' : 'textbook'));
  } else {
    $('refTabsCard').style.display = 'none';
  }

  /* v42 — "학기 총평" 전용 카드(#feedbackCard)를 없애면서 이 렌더 블록도 함께 제거.
   * fbGeneral은 아래 renderFeedbackInbox(fbAll)에 "학기 총평" 라벨로 이미 포함돼
   * 그려지므로(feedbackLabel_) 별도 처리가 필요 없다 — fbGeneral 계산 자체는
   * ackFeedbackItems_ 주석에서 설명하는 공유 참조 구조상 그대로 둔다. */
  renderFeedbackInbox(fbAll);
  /* v119 — «그 밖의 기록» 머리글은 아래에 보일 카드(성적조회·피드백 모아보기)가 하나라도 있을 때만. 둘 다 숨겨지면 빈 제목만 남아 있었다. */
  const otherHead = $('otherHead');
  if(otherHead){
    const visible = ['gradeCard','feedbackInboxCard'].some(id => { const el = $(id); return el && !el.hidden && el.style.display !== 'none'; });
    otherHead.style.display = visible ? '' : 'none';
  }

  /* 질문함 (학생 ↔ 교사) */
  renderQuestions();

  /* 달성도 모아보기 — v27: 활동 단위로 나열(차시에 활동이 2개면 각각 따로 뜸).
   * v57: 최근순으로 정렬해 3개만 기본 노출, 나머지는 "더 보기" 토글로 펼친다. */
  const analyzedActs = [];
  lessons.forEach(l => {
    l.activities.forEach(act => {
      const rec = achieveMap[act.id];
      if (rec && rec.achievement && String(rec.achievement).trim()) {
        analyzedActs.push({ lesson: l, act, rec });
      }
    });
  });
  analyzedActs.sort((a, b) => new Date(b.rec.timestamp) - new Date(a.rec.timestamp));
  const ovItemHtml_ = x => `
      <div class="overview-item">
        <span class="dots">${achieveDots(x.rec.achievement)}</span>
        <span class="ov-title">${escapeHtml(activityDisplayTitle(x.lesson, x.act))}</span>
      </div>`;
  const OVERVIEW_VISIBLE = 3;
  const ovVisible = analyzedActs.slice(0, OVERVIEW_VISIBLE);
  const ovRest = analyzedActs.slice(OVERVIEW_VISIBLE);
  const ovMoreBtn = $('overviewMoreBtn');
  const ovMoreList = $('overviewMoreList');
  if (analyzedActs.length) {
    $('overviewList').innerHTML = ovVisible.map(ovItemHtml_).join('');
  } else {
    $('overviewList').innerHTML = '<p class="q-hint" style="margin:0;">아직 분석된 활동이 없어요.</p>';
  }
  ovMoreList.innerHTML = ovRest.map(ovItemHtml_).join('');
  ovMoreList.style.display = 'none';
  ovMoreBtn.dataset.open = 'false';
  ovMoreBtn.dataset.count = ovRest.length;
  ovMoreBtn.style.display = ovRest.length ? 'block' : 'none';
  ovMoreBtn.textContent = `더 보기 (${ovRest.length})`;

  /* 내 기록 보관함 — 내가 쓴 서술 다시 보기 (백엔드 v5부터 reflection 제공) */
  const myWritings = STUDENT_DATA.activities
    .filter(a => a.reflection && String(a.reflection).trim())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  $('archiveList').innerHTML = myWritings.length
    ? myWritings.map(a => `
      <div class="archive-item">
        <div class="ar-meta"><b>${escapeHtml(lessonTitle(String(a.activityId)))}</b> · ${formatDate(a.timestamp)}</div>
        <div class="ar-text">${escapeHtml(String(a.reflection))}</div>
      </div>`).join('')
    : '<p class="q-hint" style="margin:0;">아직 기록이 없어요.</p>';

  /* 연표 */
  const tl = $('timeline');
  if(lessons.length === 0){
    $('timelineTools').style.display = 'none';
    tl.innerHTML = '';
    $('statusLine').style.display = 'block';
    $('statusLine').textContent = "이번 학기 활동이 준비되면 여기에 하나씩 나타나요.";
    return;
  }
  $('statusLine').style.display = 'none';

  const cardCtx = { doneIds, achieveMap, latestMap, fbByLesson, classFeedbackMap, lessonDone, lessonHasUrl };
  // v20: 화면 노출 순서만 최신순(역순)으로. "N차시" 라벨은 원래 순서 기준 i+1로 계산돼 번호는 그대로 유지됨.
  // v79: 차시를 중단원별로 묶어 접고 펴게 함(UNIT_GROUPS는 config.js). 설정 없는 학년은 예전처럼 한 줄로 나열.
  const unitOf = unitOfLessons_(SESSION.grade, lessons);
  const groups = [];
  lessons.forEach((l, i) => {
    const name = unitOf[i];
    let g = groups.find(x => x.name === name);
    if(!g){ g = { name, items: [] }; groups.push(g); }
    g.items.push({ l, i });
  });
  if(!groups.some(g => g.name)){
    tl.innerHTML = lessons.map((l, i) => renderLessonCard(l, i, cardCtx)).reverse().join('');
  } else {
    tl.innerHTML = groups.slice().reverse().map((g, gi) => {
      const doneN = g.items.filter(x => lessonDone(x.l)).length;
      const open = unitIsOpen_(g.name, gi === 0);
      return `<section class="unit-group ${open ? '' : 'collapsed'}" data-unit="${escapeHtml(g.name)}">
        <button type="button" class="unit-head" aria-expanded="${open}">
          <span class="unit-name">${escapeHtml(g.name)}</span>
          <span class="unit-count">${doneN} / ${g.items.length}차시 완료</span>
          <span class="unit-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="unit-body">${g.items.slice().reverse().map(x => renderLessonCard(x.l, x.i, cardCtx)).join('')}</div>
      </section>`;
    }).join('');
  }

  tl.querySelectorAll('.btn-check').forEach(btn => {
    btn.addEventListener('click', () => selfCheck(btn));
  });
  tl.querySelectorAll('.btn-uncheck').forEach(btn => {
    btn.addEventListener('click', () => cancelSelfCheck(btn));
  });

  // v64 — 접기 도구(완료 개수 표시) + 헤더 토글은 이벤트 위임으로 한 번만 연결
  const doneN = lessons.filter(lessonDone).length;
  $('timelineTools').style.display = 'flex';
  $('timelineCount').textContent = `완료 ${doneN} / ${lessons.length}차시`;
  if(!tl.dataset.bound){
    tl.dataset.bound = '1';
    const toggle = ev => {
      const uh = ev.target.closest('.unit-head');
      if(uh){ const ug = uh.closest('.unit-group'); setUnitOpen_(ug, ug.classList.contains('collapsed')); return; }
      const head = ev.target.closest('.lesson-toggle');
      if(!head) return;
      const lesson = head.closest('.lesson');
      setLessonOpen_(lesson, lesson.classList.contains('collapsed'));
    };
    tl.addEventListener('click', toggle);
    tl.addEventListener('keydown', ev => {
      if((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('lesson-toggle')){
        ev.preventDefault(); toggle(ev);
      }
    });
  }
}

/* v105 — 첫 화면 «지금 할 활동» 카드. 교육과정 순서에서 아직 안 끝낸(lessonDone 거짓) 차시 가운데 첫 미완료 활동에
 * 링크가 있는 것을 후보로 모아, v119부터는 그중 **가장 최근(순서상 마지막)** 차시를 한 줄로 보여 주고 앞선 후보 수를 «밀린 차시 N개»로 덧붙인다.
 * 링크는 카드의 "하러 가기"와 같은 규칙(module은 withStudentParams, 그 밖엔 원래 주소). 첫 미완료 활동은 앞 활동이 모두 끝난 상태라 순차 잠금에 걸리지 않는다.
 * 읽기만 하는 표시라 PREVIEW_MODE 분기는 필요 없다(링크의 preview=1은 withStudentParams가 붙인다). */
function renderNextActivity_(lessons, doneIds, lessonDone){
  const card = $('nextCard');
  if(!card) return;
  /* v119 — 교육과정 순서에서 «가장 최근» 미완료 차시를 고른다(이전엔 가장 오래된 것).
   * 수업은 늘 최신 차시를 하므로 1학기 복습처럼 몇 주 지난 활동이 «지금 할 활동»에 걸려 있으면
   * 학생이 오늘 수업 활동을 못 찾는다. 더 오래된 미완료 활동은 «밀린 활동 N개»로 따로 세어 보여 준다. */
  const open = [];
  lessons.forEach((l, i) => {
    if(lessonDone(l)) return;
    const idx = l.activities.findIndex(a => !doneIds.has(a.id));
    const act = l.activities[idx];
    if(act && lessonActivityUrl(act)) open.push({ l, i, act, idx });
  });
  const pick = open.length ? open[open.length - 1] : null;
  if(!pick){ card.hidden = true; return; }
  const url = lessonActivityUrl(pick.act);
  $('nextTitle').textContent = `${pick.i + 1}차시 · ${activityDisplayTitle(pick.l, pick.act, pick.idx)}`;
  $('nextGo').href = pick.act.type === 'module' ? withStudentParams(url) : ensureUrlScheme_(url);
  const sub = $('nextSub');
  if(sub){
    const behind = open.length - 1;
    sub.hidden = behind <= 0;
    sub.textContent = behind > 0 ? `밀린 차시 ${behind}개 더 있어요 · 아래 연표에서 단원을 펼쳐 찾아요` : ''; // v119: 단위는 차시(활동 2개짜리도 1로 셈)
  }
  card.hidden = false;
}

/* v27 — 활동 하나를 화면에 보여줄 이름. 차시에 활동이 1개뿐이면 차시 제목 그대로,
 * 2개 이상이면 활동 자체 제목(없으면 "N활동")을 붙여서 구분되게 함. */
function activityDisplayTitle(l, act, idx){
  if(l.activities.length <= 1) return l.title;
  const label = act.title && act.title.trim() ? act.title.trim() : `${(idx!=null?idx:l.activities.indexOf(act))+1}활동`;
  return `${l.title} · ${label}`;
}

/* v27 — 차시 카드 하나를 통째로 렌더링. 활동이 1개면 기존(v26 이전)과 동일한 모양,
 * 2개 이상이면 카드 하나 안에 활동별 블록을 순서대로 나열.
 * 순차 진행(l.sequential)이 켜져 있으면 앞 활동을 끝내야 다음 활동 버튼이 열림. */
function renderLessonCard(l, i, ctx){
  const { doneIds, achieveMap, latestMap, fbByLesson, classFeedbackMap, lessonDone, lessonHasUrl } = ctx;
  const done = lessonDone(l);
  const building = !lessonHasUrl(l);
  const multi = l.activities.length > 1;
  const typeLabel = { module:"탐구 활동", padlet:"패들렛 글쓰기", link:"외부 활동" };
  const typeClass = { padlet:"t-padlet", link:"t-link" };

  const headerTypeLabel = multi ? `활동 ${l.activities.length}개` : (typeLabel[l.activities[0].type] || "활동");
  const headerTypeClass = multi ? '' : (typeClass[l.activities[0].type] || '');

  const activitiesHtml = l.activities.map((act, idx) => {
    const locked = !!(l.sequential && idx > 0 && !doneIds.has(l.activities[idx - 1].id));
    return renderActivityBlock(l, act, idx, { multi, locked, doneIds, achieveMap, latestMap, classFeedbackMap });
  }).join('');

  /* 이 차시에 대한 선생님 피드백 (활동이 아니라 차시 단위 — 기존과 동일) */
  let teaHtml = '';
  const fbs = fbByLesson[l.id] || [];
  if(fbs.length){
    teaHtml = fbs.map(f => `
      <div class="note note-teacher">
        <div class="note-label">👩‍🏫 선생님 피드백
          <span class="note-date">${formatDate(f.timestamp)}</span>
        </div>
        <div class="note-text">${escapeHtml(String(f.feedback))}</div>
      </div>`).join('');
  }

  /* v64 — 카드 접기. 완료한 차시는 기본으로 접혀 제목 한 줄(+달성도)만 보이고, 진행할 차시는 펼쳐 둔다.
   * 헤더를 누르면 어느 카드든 토글되고 상태는 LESSON_OPEN에 기억돼 재렌더(새로고침 버튼·제출 뒤 재조회)에도 유지된다.
   * 접힌 줄에 보일 달성도는 이 차시 활동 중 가장 높은 값. */
  const open = lessonIsOpen_(l, done);
  const rankOf = { '상':3, '중':2, '하':1 };
  let best = '';
  l.activities.forEach(a => {
    const r = achieveMap[a.id];
    const lv = r && r.achievement ? String(r.achievement).trim() : '';
    if(lv && (rankOf[lv] || 0) > (rankOf[best] || 0)) best = lv;
  });
  const sumHtml = best
    ? `<div class="lesson-sum"><span class="dots">${achieveDots(best)}</span> 달성도 ${escapeHtml(best)}</div>` : '';

  return `
    <div class="lesson ${done ? 'done' : ''} ${building ? 'pending-build' : ''} ${open ? '' : 'collapsed'}" data-lid="${escapeHtml(String(l.id))}">
      <div class="lesson-card">
        <div class="lesson-top lesson-toggle" role="button" tabindex="0" aria-expanded="${open}" aria-label="${escapeHtml(l.title)} 펼치기/접기">
          <div class="lesson-info">
            <span class="lesson-type ${headerTypeClass}">${i+1}차시 · ${headerTypeLabel}</span>
            <h2 class="lesson-title">${escapeHtml(l.title)}</h2>
            ${l.desc ? `<p class="lesson-desc">${escapeHtml(l.desc)}</p>` : ''}
            ${sumHtml}
          </div>
          <div class="lesson-top-side">
            ${done ? `<div class="seal-stamp" aria-label="완료">완</div>` : ''}
            <span class="lesson-chevron" aria-hidden="true">▾</span>
          </div>
        </div>
        <div class="lesson-body">
          ${activitiesHtml}
          ${teaHtml}
        </div>
      </div>
    </div>`;
}

/* v64 — 연표 카드 접기 상태. 없으면 기본값(완료=접힘, 미완료=펼침). */
let LESSON_OPEN = {};
function lessonIsOpen_(l, done){
  const k = String(l.id);
  return (k in LESSON_OPEN) ? LESSON_OPEN[k] : !done;
}
function setLessonOpen_(el, open){
  el.classList.toggle('collapsed', !open);
  const t = el.querySelector('.lesson-toggle');
  if(t) t.setAttribute('aria-expanded', String(open));
  LESSON_OPEN[el.dataset.lid] = open;
}
/* v79 — 중단원 묶음 접기. 기본은 가장 최근 단원만 펼침. 상태는 UNIT_OPEN에 기억(재렌더 유지). */
const UNIT_OPEN = {};
function unitIsOpen_(name, dflt){
  return (name in UNIT_OPEN) ? UNIT_OPEN[name] : dflt;
}
function setUnitOpen_(el, open){
  el.classList.toggle('collapsed', !open);
  const h = el.querySelector('.unit-head');
  if(h) h.setAttribute('aria-expanded', String(open));
  UNIT_OPEN[el.dataset.unit] = open;
}
/* 차시 목록(교육과정 순서)에 중단원 이름을 붙인다. config.js의 UNIT_GROUPS[학년]에 id가 적힌 차시는 그 단원,
 * 적히지 않은 차시(새로 추가한 것)는 바로 앞 차시의 단원을 이어받는다. 학년에 설정이 없으면 전부 ''. */
function unitOfLessons_(grade, lessons){
  const cfg = (CONFIG.UNIT_GROUPS && CONFIG.UNIT_GROUPS[grade]) || [];
  if(!cfg.length) return lessons.map(() => '');
  const byId = {};
  cfg.forEach(u => (u.ids || []).forEach(id => { byId[id] = u.name; }));
  let prev = cfg[0].name;
  return lessons.map(l => (prev = byId[l.id] || prev));
}
/* open=false: 완료한 차시만 접기 / open=true: 전부 펼치기 */
function setDoneLessonsOpen_(open){
  if(open) document.querySelectorAll('#timeline .unit-group').forEach(el => setUnitOpen_(el, true));
  document.querySelectorAll('#timeline .lesson').forEach(el => {
    if(open) setLessonOpen_(el, true);
    else if(el.classList.contains('done')) setLessonOpen_(el, false);
  });
}

/* v27 — 활동 하나의 블록(제목·달성도·AI코멘트·버튼)을 렌더링.
 * multi가 false면 기존과 완전히 동일한 모양(활동 소제목·wrapper 없이 바로 내용). */
function renderActivityBlock(l, act, idx, opts){
  const { multi, locked, doneIds, achieveMap, latestMap, classFeedbackMap } = opts;
  const done = doneIds.has(act.id);
  const url = lessonActivityUrl(act);
  const building = !url;
  const rec = achieveMap[act.id];
  const latest = latestMap[act.id];

  const recAnalyzed = !!(rec && rec.achievement && String(rec.achievement).trim());
  const latestAnalyzed = !!(latest && latest.achievement && String(latest.achievement).trim());
  const isModule = act.type === 'module';
  const pendingNew = isModule && done && recAnalyzed && latest && !latestAnalyzed
    && String(latest.timestamp) !== String(rec.timestamp);
  const pendingFirst = isModule && done && !recAnalyzed;

  let achieveHtml = '';
  if(done && recAnalyzed){
    achieveHtml = `
      <div class="achieve">
        <span>달성도</span>
        <span class="dots">${achieveDots(rec.achievement)}</span>
        <span>${escapeHtml(String(rec.achievement))}${pendingNew ? ' <small>(이전 도전 기준)</small>' : ''}</span>
      </div>
      ${rec.summary ? `<div class="achieve-summary">💬 ${escapeHtml(String(rec.summary))}</div>` : ''}`;
  }

  let pendingHtml = '';
  if(pendingNew){
    pendingHtml = `<div class="pending-note">🕐 ${formatDate(latest.timestamp)} 새 도전 기록이 저장됐어요. AI 분석이 끝나면 달성도와 코멘트가 새로 표시돼요.</div>`;
  } else if(pendingFirst){
    pendingHtml = `<div class="pending-note">🕐 기록이 저장됐어요! AI 분석이 끝나면 달성도와 코멘트가 표시돼요.</div>`;
  }

  let aiHtml = '';
  if(done && rec && rec.aiComment && String(rec.aiComment).trim()){
    aiHtml = `
      <div class="note note-ai">
        <div class="note-label">🤖 AI 분석 코멘트
          <span class="note-date">${formatDate(rec.timestamp)}</span>
        </div>
        <div class="note-text">${escapeHtml(String(rec.aiComment))}</div>
      </div>`;
  }

  // v35 — 학급 공통 피드백(학생용 문구). 개인 AI 코멘트·개인 피드백과 별도로,
  // "이 반 전체"에 대한 문구가 있을 때만 뜬다 — 교사가 대시보드에서 생성한 게 있을
  // 때만(선택), 이 활동을 완료한 학생에게만(done) 보여준다.
  let classFbHtml = '';
  const cf = classFeedbackMap && classFeedbackMap[act.id];
  if(done && cf && cf.studentText){
    classFbHtml = `
      <div class="note note-class">
        <div class="note-label">🏫 학급 공통 피드백
          <span class="note-date">${formatDate(cf.timestamp)}</span>
        </div>
        <div class="note-text">${escapeHtml(String(cf.studentText))}</div>
      </div>`;
  }

  const retryHtml = (done && recAnalyzed && !building && !pendingNew
    && ['중','하'].includes(String(rec.achievement).trim()))
    ? `<div class="retry-hint">🔄 다시 도전하면 달성도가 새로 기록돼요</div>` : '';

  let actions = '';
  if(locked){
    actions = `<span class="badge-wait">🔒 ${idx}활동을 먼저 끝내면 열려요</span>`;
  } else if(building){
    actions = `<span class="badge-wait">🔨 준비 중이에요</span>`;
  } else if(act.type === 'module'){
    actions = `<a class="btn-go" href="${withStudentParams(url)}" target="_blank" rel="noopener">
      ${done ? "다시 하러 가기" : "하러 가기"} →</a>`;
  } else {
    actions = `<a class="btn-go" href="${url}" target="_blank" rel="noopener">활동 열기 →</a>`
      + (done
        // v69 — 자가체크로만 완료된 활동(최신 기록이 selfCheck)은 되돌릴 수 있다.
        ? (latest && latest.selfCheck ? `<button class="btn-uncheck" data-activity="${escapeHtml(act.id)}">완료 취소</button>` : '')
        : `<button class="btn-check" data-activity="${escapeHtml(act.id)}">활동을 끝냈어요 ✓</button>`);
  }

  const label = multi ? (act.title && act.title.trim() ? act.title.trim() : `${idx+1}활동`) : '';

  return `
    <div class="activity-block${multi ? ' activity-block-multi' : ''}${locked ? ' activity-locked' : ''}">
      ${multi ? `<p class="activity-label">${escapeHtml(label)}${act.desc ? ' — ' + escapeHtml(act.desc) : ''}</p>` : ''}
      ${achieveHtml}
      ${pendingHtml}
      ${aiHtml}
      ${classFbHtml}
      ${retryHtml}
      <div class="lesson-actions">${actions}</div>
    </div>`;
}

/* ── 자가체크 (패들렛·외부 활동) ──
 * v27: 차시가 아니라 "활동"(activityId) 단위로 기록됨 — data-activity 사용. */
async function selfCheck(btn){
  if(PREVIEW_MODE){
    showToast('미리보기 모드예요 — 실제로 기록되지 않아요.');
    return;
  }
  const activityId = btn.dataset.activity;
  btn.disabled = true; btn.textContent = "기록하는 중…";
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({
        studentId: SESSION.studentId,
        studentName: SESSION.name,
        gameName: activityId,
        choiceSummary: '자가체크'
      })
    });
    // v21-1: 응답을 확인 안 하고 무조건 "완료"로 처리하던 버그 수정 — 백엔드가
    // 순차진행 위반 등으로 result:'error'를 돌려줘도(예: 화면이 최신 상태가 아닌
    // 채로 잠긴 활동을 기록하려 한 경우) 지금까지는 그걸 무시하고 학생 화면엔
    // 그냥 "완료" 도장이 찍혀서, 실제로는 기록되지 않았는데 완료로 보이는
    // 상태 불일치가 생겼음. 이제 결과를 확인해서 실패면 완료 처리하지 않는다.
    const body = await res.json().catch(() => null);
    if(!body || body.result === 'error'){
      btn.disabled = false; btn.textContent = "활동을 끝냈어요 ✓";
      showToast((body && body.message) || "기록하지 못했어요. 다시 시도해 주세요.");
      if(body && body.locked) renderPortal(); // 화면이 최신 상태가 아니었을 수 있으니 다시 그림
      return;
    }
    STUDENT_DATA.activities.push({ activityId: activityId, achievement:'', summary:'', aiComment:'', reflection:'', selfCheck:true, timestamp:new Date().toISOString() });
    showToast("완료로 기록했어요! 도장이 찍혔어요 🎉");
    // v69 — 완료 차시는 기본 접힘이라 방금 누른 카드가 접히면 "완료 취소"가 안 보인다. 이 카드는 펼친 채로 둔다.
    const lessonEl = btn.closest('.lesson');
    if(lessonEl) LESSON_OPEN[lessonEl.dataset.lid] = true;
    renderPortal();
  }catch(e){
    btn.disabled = false; btn.textContent = "활동을 끝냈어요 ✓";
    showToast("기록하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
  }
}

/* ── v69: 자가체크 취소 — "끝냈어요"를 잘못 눌렀을 때 되돌린다.
 * 서버는 선택 요약이 '자가체크'인 행만 지우므로 실제 제출 기록은 못 지운다. */
async function cancelSelfCheck(btn){
  if(PREVIEW_MODE){
    showToast('미리보기 모드예요 — 실제로 기록되지 않아요.');
    return;
  }
  if(!confirm('이 활동의 "끝냈어요" 기록을 취소할까요?\n활동을 아직 안 끝냈다면 다시 하고 눌러 주세요.')) return;
  const activityId = btn.dataset.activity;
  btn.disabled = true; btn.textContent = "취소하는 중…";
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'cancelSelfCheck',
        studentId: SESSION.studentId,
        studentName: SESSION.name,
        activityId: activityId
      })
    });
    const body = await res.json().catch(() => null);
    if(!body || body.result !== 'success'){
      btn.disabled = false; btn.textContent = "완료 취소";
      showToast((body && body.message) || "취소하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    // 자가체크 기록만 로컬에서 제거(가장 최근 1건) — 서버와 같은 기준
    const acts = STUDENT_DATA.activities;
    for(let i = acts.length - 1; i >= 0; i--){
      if(acts[i].activityId === activityId && acts[i].selfCheck){ acts.splice(i, 1); break; }
    }
    showToast("완료를 취소했어요. 활동을 마친 뒤 다시 눌러 주세요.");
    renderPortal();
  }catch(e){
    btn.disabled = false; btn.textContent = "완료 취소";
    showToast("취소하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
  }
}

/* ── 공지사항: 목록 렌더 (서버가 이미 학년+반으로 필터링해 내려줌) ── */
function renderAnnouncements(){
  const card = $('announceCard');
  const list = $('announceList');
  const items = (STUDENT_DATA && STUDENT_DATA.announcements) || [];
  if(!items.length){
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  const sorted = [...items].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  list.innerHTML = sorted.slice(0, 3).map(a => `
    <div class="announce-item">
      <div class="an-meta">${formatDate(a.timestamp)}</div>
      <div>${escapeHtml(a.content)}</div>
    </div>`).join('');
}

/* ── 피드백 모아보기: 차시 인라인·학기 총평 카드에 흩어진 피드백을 전부 모아
 * 최신순으로 한 곳에서 볼 수 있게 하는 카드(v36). 기존 두 노출 방식을 대체하지
 * 않고 병행 — 핸드오프 문서 "피드백 알림/모아보기/읽음 상태" 3-2 참고.
 * v38(Phase 3) — 항목마다 "이 피드백에 대해 질문하기" 버튼을 붙여 질문함으로
 * 느슨하게 연결한다(완전 스레드 통합은 아님 — askAboutFeedback_ 참고). 버튼이
 * data-idx로 렌더링 시점의 항목을 다시 찾아야 해서, 매 렌더마다의 정렬 결과를
 * FEEDBACK_INBOX_ITEMS에 함께 보관해둔다. */
let FEEDBACK_INBOX_ITEMS = [];
const FEEDBACK_INBOX_SHOW = 3;   // v64 — 처음엔 최근 3건만, 나머지는 "더 보기"로 펼침
let FEEDBACK_INBOX_OPEN = false;
function renderFeedbackInbox(fbAll){
  const card = $('feedbackInboxCard');
  if(!fbAll.length){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  const sorted = [...fbAll].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  FEEDBACK_INBOX_ITEMS = sorted;
  $('feedbackInboxSub').textContent = `총 ${sorted.length}개 · 최신순`;
  $('feedbackInboxList').innerHTML = sorted.map((f, i) => `
    <article class="fbi-item${i >= FEEDBACK_INBOX_SHOW ? ' fbi-extra' : ''}" ${i >= FEEDBACK_INBOX_SHOW && !FEEDBACK_INBOX_OPEN ? 'hidden' : ''}>
      <div class="fbi-head">
        <span class="fbi-tag">${escapeHtml(feedbackLabel_(f))}</span>
        <time class="fbi-date">${formatDate(f.timestamp)}</time>
      </div>
      <p class="fbi-text">${escapeHtml(String(f.feedback))}</p>
      <button type="button" class="btn-tiny fb-ask-btn" data-idx="${i}">❓ 이 피드백에 대해 질문하기</button>
    </article>`).join('');
  $('feedbackInboxList').querySelectorAll('.fb-ask-btn').forEach(btn => {
    btn.addEventListener('click', () => askAboutFeedback_(Number(btn.dataset.idx)));
  });
  const more = $('feedbackInboxMoreBtn');
  const extra = sorted.length - FEEDBACK_INBOX_SHOW;
  more.style.display = extra > 0 ? 'block' : 'none';
  more.textContent = FEEDBACK_INBOX_OPEN ? '이전 피드백 접기 ▲' : `이전 피드백 ${extra}개 더 보기 ▼`;
}
function toggleFeedbackInboxMore_(){
  FEEDBACK_INBOX_OPEN = !FEEDBACK_INBOX_OPEN;
  renderFeedbackInbox(FEEDBACK_INBOX_ITEMS);
}

/* v38(핸드오프 Phase 3) — "이 피드백에 대해 질문하기". 피드백과 질문함을 서버
 * 참조 필드로 진짜 연결(완전 스레드화)하는 대신, 질문함 입력창에 그 피드백을
 * 인용구로 미리 채워주기만 하는 순수 프론트 UX 연결 — 백엔드 변경이 전혀
 * 필요 없다. "학생이 실제로 얼마나 되묻는지" 데이터가 쌓이면 완전 통합 여부를
 * 다시 논의하기로 함(핸드오프 5번 참고). 피드백 원문이 아주 길면 인용구가
 * 질문 입력을 압도하지 않게 200자에서 자른다. */
function askAboutFeedback_(idx){
  const f = FEEDBACK_INBOX_ITEMS[idx];
  if(!f) return;
  switchQuickTab('question'); // v57 — 질문함이 탭 뒤에 숨어 있을 수 있어 먼저 열어야 스크롤·포커스가 보임
  const text = String(f.feedback || '');
  const quoted = text.length > 200 ? text.slice(0, 200) + '…' : text;
  const input = $('questionInput');
  input.value = `[${feedbackLabel_(f)} 피드백에 대해 질문해요]\n"${quoted}"\n\n`;
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  showToast('질문함으로 이동했어요 — 이어서 궁금한 점을 적어주세요.');
}

/* ── v57: 상단 탭 카드(질문함·달성도·보관함 / 패들렛·클래스카드) 전환 ── */
function switchQuickTab(tab){
  ['question','overview','archive','message'].forEach(t => {
    $('qp' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = (t === tab) ? 'block' : 'none';
  });
  document.querySelectorAll('#quickTabsCard .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.qtab === tab);
    if(btn.dataset.qtab === tab && btn.scrollIntoView) btn.scrollIntoView({ inline:'center', block:'nearest' }); // v63
  });
  if(tab === 'message'){
    const box = $('msgThread');
    box.scrollTop = box.scrollHeight;
    ackMessages_(); // v62 — 탭을 연 순간 읽은 것으로 처리
  }
}

function switchRefTab(tab){
  ['portfolio','classcard','textbook'].forEach(t => {
    $('refPanel' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = (t === tab) ? 'flex' : 'none';
  });
  document.querySelectorAll('#refTabsCard .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.rtab === tab);
  });
}

/* 달성도 "더 보기" — 렌더마다 접힌 상태로 초기화되고(renderPortal), 누르면 펼쳐진다. */
function toggleOverviewMore(){
  const list = $('overviewMoreList');
  const btn = $('overviewMoreBtn');
  const open = btn.dataset.open === 'true';
  const next = !open;
  list.style.display = next ? 'block' : 'none';
  btn.dataset.open = String(next);
  btn.textContent = next ? '접기 ▲' : `더 보기 (${btn.dataset.count})`;
}

/* ── 질문함: 목록 렌더 ── */
function renderQuestions(){
  const list = $('questionList');
  if(!list) return;
  const qs = (STUDENT_DATA && STUDENT_DATA.questions) || [];
  if(!qs.length){
    list.innerHTML = '<p class="q-hint" style="margin:0;">아직 남긴 질문이 없어요.</p>';
    return;
  }
  const sorted = [...qs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  list.innerHTML = sorted.map(q => {
    const done = q.status === '답변완료';
    return `
      <div class="q-item">
        <div class="q-meta">
          ${formatDate(q.timestamp)}
          <span class="q-status ${done ? 'done' : 'wait'}">${done ? '답변완료' : '대기중'}</span>
        </div>
        <div class="q-text">${escapeHtml(q.question)}</div>
        ${done ? `<div class="q-answer"><b>선생님 답변</b><br>${escapeHtml(q.answer)}</div>` : ''}
      </div>`;
  }).join('');
}

/* ── 선생님 개인 메시지 (v62) ──
 * 교사가 먼저 보낸 1:1 스레드. 질문함(학생이 먼저 물음)과 별개 시트(백엔드 '개인메시지')이고,
 * 학생은 교사가 먼저 보낸 스레드에만 답장할 수 있다(서버가 강제). 스레드가 비어 있으면 탭 버튼
 * 자체를 숨긴다. 읽음 처리는 팝업을 닫을 때가 아니라 탭을 열 때(switchQuickTab → ackMessages_)라서,
 * 팝업만 넘기고 안 본 메시지는 탭의 빨간 숫자로 계속 남는다. 미리보기 모드엔 messages 필드가
 * 없어 탭이 숨은 채로 유지된다. */
let MSG_POPUP_SEEN_TS = '';
function messagesSorted_(){
  return [...((STUDENT_DATA && STUDENT_DATA.messages) || [])]
    .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
}
function unreadTeacherMessages_(){
  return messagesSorted_().filter(m => m.from === '교사' && !m.read);
}
function renderMessages(keepOrder){
  const btn = $('qtabMessage'), box = $('msgThread');
  if(!btn || !box) return;
  const ms = messagesSorted_();
  btn.style.display = ms.length ? '' : 'none';
  const unread = unreadTeacherMessages_().length;
  // 안 읽은 게 있을 땐 탭을 맨 앞으로(폰에선 탭 줄이 가로 스크롤이라 뒤에 두면 안 보임).
  // 읽음 처리 직후 재렌더(keepOrder)에서는 순서를 유지해, 방금 누른 탭이 끝으로 튀지 않게 한다.
  if(!keepOrder) btn.classList.toggle('unread', unread > 0);
  const badge = $('msgBadge');
  badge.textContent = unread || '';
  badge.style.display = unread ? 'inline-block' : 'none';
  box.innerHTML = ms.map(m => `
    <div class="msg-bubble ${m.from === '교사' ? 'from-teacher' : 'from-me'}">
      <div class="msg-meta">${m.from === '교사' ? '선생님' : '나'} · ${formatDate(m.timestamp)}</div>
      <div class="msg-text">${escapeHtml(m.content)}</div>
    </div>`).join('');
}
function ackMessages_(){
  if(!SESSION || PREVIEW_MODE) return;
  const un = unreadTeacherMessages_();
  if(!un.length) return;
  un.forEach(m => { m.read = true; });
  renderMessages(true);
  fetch(CONFIG.WEBAPP_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'ackMessages', studentId: SESSION.studentId, studentName: SESSION.name })
  }).catch(() => {}); // 실패하면 서버엔 안 읽음으로 남아 다음 로그인 때 다시 알림 — 놓쳐도 안전
}
function checkNewMessages_(){
  if(!SESSION || PREVIEW_MODE) return;
  const un = unreadTeacherMessages_();
  if(!un.length) return;
  const key = String(un[un.length - 1].timestamp);
  if(key === MSG_POPUP_SEEN_TS) return; // 같은 세션에서 재렌더될 때 반복 팝업 방지
  MSG_POPUP_SEEN_TS = key;
  document.querySelectorAll('.msg-popup-overlay').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'msg-popup-overlay';
  overlay.innerHTML = `
    <div class="fb-popup-card" role="dialog" aria-modal="true" aria-label="선생님 메시지 도착">
      <p class="fb-popup-emoji">💌</p>
      <p class="fb-popup-title">${un.length === 1 ? '선생님이 메시지를 보냈어요' : `선생님 메시지가 ${un.length}개 도착했어요`}</p>
      <button type="button" class="btn btn-sm fb-popup-ok">메시지 보러 가기</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = go => {
    overlay.remove();
    if(go){
      switchQuickTab('message');
      $('quickTabsCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  overlay.querySelector('.fb-popup-ok').addEventListener('click', () => close(true));
  overlay.addEventListener('click', ev => { if(ev.target === overlay) close(false); });
}
async function sendMessageReply(){
  if(PREVIEW_MODE){ showToast('미리보기 모드예요 — 실제로 기록되지 않아요.'); return; }
  const input = $('msgInput');
  const text = input.value.trim();
  if(!text){ showToast('답장 내용을 입력해 주세요.'); return; }
  const btn = $('btnSendMsg');
  btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'replyMessage', studentId: SESSION.studentId, studentName: SESSION.name, content: text })
    });
    const data = await res.json();
    if(data.result !== 'success') throw new Error(data.message || '실패');
    STUDENT_DATA.messages = STUDENT_DATA.messages || [];
    STUDENT_DATA.messages.push({ timestamp: new Date().toISOString(), from: '학생', content: text, read: false });
    input.value = '';
    renderMessages();
    const box = $('msgThread'); box.scrollTop = box.scrollHeight;
    showToast('답장을 보냈어요.');
  }catch(e){
    showToast('보내지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '답장 보내기';
  }
}

/* ── 질문함: 보내기 ── */
async function askQuestion(){
  if(PREVIEW_MODE){
    showToast('미리보기 모드예요 — 실제로 기록되지 않아요.');
    return;
  }
  const input = $('questionInput');
  const text = input.value.trim();
  if(!text){ showToast('질문 내용을 입력해 주세요.'); return; }
  const btn = $('btnAskQuestion');
  btn.disabled = true; btn.textContent = '보내는 중…';
  try{
    await fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'askQuestion',
        studentId: SESSION.studentId,
        studentName: SESSION.name,
        grade: SESSION.grade,
        ban: SESSION.ban,
        question: text
      })
    });
    STUDENT_DATA.questions = STUDENT_DATA.questions || [];
    STUDENT_DATA.questions.push({
      timestamp: new Date().toISOString(), question: text, answer: '', status: '대기'
    });
    input.value = '';
    showToast('질문을 보냈어요. 답이 오면 여기서 확인할 수 있어요.');
    renderQuestions();
  }catch(e){
    showToast('보내지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }finally{
    btn.disabled = false; btn.textContent = '질문 보내기';
  }
}

/* v77 — 웹앱 글쓰기 뒤 "패들렛 열기" 버튼용. 이 학생 반의 패들렛(포트폴리오) 주소를 ?padlet=로 함께 넘긴다.
 * 웹앱 쪽도 padlet.com https만 받지만, 여기서도 걸러서 엉뚱한 주소가 웹앱으로 가지 않게 한다. 읽기 전용이라 PREVIEW_MODE 영향 없음. */
function padletParam_(){
  try{
    const pf = (CONFIG.CURRICULUM[SESSION.grade] || {}).portfolio;
    const raw = pf ? (pf.urlByBan ? (pf.urlByBan[SESSION.ban] || '') : (pf.url || '')) : '';
    if(!raw) return '';
    const u = new URL(ensureUrlScheme_(raw));
    if(u.protocol !== 'https:' || !/(^|\.)padlet\.com$/.test(u.hostname)) return '';
    return '&padlet=' + encodeURIComponent(u.href);
  }catch(e){ return ''; }
}
function withStudentParams(url){
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'sid=' + encodeURIComponent(SESSION.studentId)
             + '&name=' + encodeURIComponent(SESSION.name)
             + padletParam_()
             + (PREVIEW_MODE ? '&preview=1' : ''); // v64 — 교사 미리보기에서 연 활동이 그 학생 이름으로 제출되지 않게(웹앱 공통 ?preview=1 규약)
}

/* v48(2026-09-09, 효니 리포트 "클래스카드 링크가 www.classcard.net/www.classcard.net으로
 * 들어가짐"): 교사가 학년정보 입력칸에 "www.classcard.net"처럼 스킴(https://) 없이 URL을
 * 적으면, <a href>에 그대로 넣었을 때 브라우저가 이걸 절대 URL이 아니라 "현재 페이지 기준
 * 상대경로"로 해석해버려서 실제로는 `https://hyonnie-t.github.io/history26/www.classcard.net`
 * 같은 엉뚱한 주소로 열린다. 포트폴리오·클래스카드 링크 둘 다 같은 방식으로 href에 그대로
 * 꽂아 넣던 코드라 같은 위험이 있었음 — 스킴이 없으면 https://를 붙여준다. */
function ensureUrlScheme_(url){
  const s = String(url || '').trim();
  if (!s) return s;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) ? s : 'https://' + s;
}
/* 반마다 링크가 다른 활동(urlByBan) 지원 —
 * urlByBan이 있으면 로그인한 학생의 반(SESSION.ban) 링크를 골라 쓰고,
 * 없으면 기존처럼 공통 url을 그대로 씁니다. 해당 반 링크가 없으면 '준비 중'으로 처리됩니다.
 * v27: 차시(l)가 아니라 활동(act) 하나를 받음 — url/urlByBan이 이제 활동 레벨에 있음. */
function lessonActivityUrl(act){
  if (act.urlByBan) return act.urlByBan[SESSION.ban] || '';
  return act.url || '';
}

/* ── 유틸 ── */
function achieveDots(level){
  const l = String(level).trim();
  if(l === '상') return '●●●';
  if(l === '중') return '●●○';
  if(l === '하') return '●○○';
  return '○○○';
}
function formatDate(ts){
  const d = new Date(ts);
  if(isNaN(d)) return '';
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}
/* v27 — id가 차시id와 같으면(단일활동 차시) 차시 제목, 활동id로 매칭되면
 * "차시제목 · 활동제목" 형태로. 어느 쪽도 안 걸리면 id 그대로 돌려줌(안전망). */
function lessonTitle(id){
  for(const g of Object.keys(CONFIG.CURRICULUM)){
    for(const l of CONFIG.CURRICULUM[g].lessons){
      if(l.id === id) return l.title;
      const idx = l.activities.findIndex(a => a.id === id);
      if(idx !== -1) return activityDisplayTitle(l, l.activities[idx], idx);
    }
  }
  return id;
}
/* v36 — activityId가 "전체"(또는 빈 값)면 학기 총평, 그 외엔 lessonTitle()로 차시·
 * 활동 이름을 붙인다. 피드백 모아보기 카드·도착 팝업이 공용으로 쓰는 라벨. */
function feedbackLabel_(f){
  const aid = String(f.activityId || '').trim();
  if (!aid || aid === '전체') return '학기 총평';
  return lessonTitle(aid);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function showToast(msg){
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

