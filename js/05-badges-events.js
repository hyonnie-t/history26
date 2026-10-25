/* ════════════════════════════════════════════════════════
 * 칭호첩(특별 칭호) — v23 연동, v24에서 렌더링 방식 변경
 * backend_v24.gs studentGet_이 이미 계산해서 내려주는 badges 배열을 그대로
 * 그리기만 한다(계산은 백엔드 computeBadges_ 담당, 프론트는 렌더링 전담).
 * badges[i] = { id, name, emoji, category('learning'|'behavior'|'strength'),
 *               type('once'|'repeat'), earned, count }
 * 교사 미리보기 모드는 STUDENT_DATA에 badges 필드 자체가 안 실리므로
 * (startPreview 참고) badges가 undefined/빈 배열인 경우를 항상 방어적으로 처리.
 * [v24] 학습 칭호가 사고유형 4종 고정이 아니라 활동(activityId) 단위로 늘어나는
 * 구조로 바뀌면서, 이전처럼 미획득 배지까지 흐리게(bc-locked) 다 그리면 활동이
 * 늘어날수록 칭호첩 목록이 한없이 길어짐 — "획득한 것만" 그리는 방식으로 변경.
 * ════════════════════════════════════════════════════════ */
const BADGE_CATEGORY_ORDER = ['learning', 'behavior', 'strength'];
const BADGE_CATEGORY_LABEL = { learning: '학습 칭호', behavior: '행동 칭호', strength: '강점 칭호' };
const BADGE_CATEGORY_CLASS = { learning: 'bc-blue', behavior: 'bc-orange', strength: 'bc-purple' };

function renderBadgeChip(b){
  // 1회성(once) = 골드 테두리 / 반복(repeat) = 실버 테두리 + ×N. 여기 들어오는 건
  // 전부 획득한 배지뿐이라(renderBadges에서 미리 걸러냄) 미획득(bc-locked) 케이스는 없음.
  const stateClass = b.type === 'once' ? 'bc-once' : 'bc-repeat';
  const colorClass = BADGE_CATEGORY_CLASS[b.category] || '';
  const countHtml = (b.type === 'repeat' && b.count > 1) ? `<span class="bc-count">×${b.count}</span>` : '';
  return `
    <div class="badge-chip ${stateClass} ${colorClass}" title="${escapeHtml(b.name)}">
      <span class="bc-emoji">${b.emoji}</span>
      <span class="bc-name">${escapeHtml(b.name)}</span>
      ${countHtml}
    </div>`;
}

function renderBadges(badges){
  const wrap = $('badgeGroups');
  if(!wrap) return;
  // v24: 획득한 것만 그린다 — 활동 수만큼 배지가 늘어날 수 있어서 미획득까지
  // 다 나열하면 목록이 무한정 길어짐(고정 4개일 땐 안 보이던 문제).
  const list = (badges || []).filter(b => b.earned);
  if(!list.length){
    wrap.innerHTML = '<p class="bc-empty">아직 획득한 칭호가 없어요.</p>';
    return;
  }
  const byCategory = {};
  list.forEach(b => { (byCategory[b.category] = byCategory[b.category] || []).push(b); });
  wrap.innerHTML = BADGE_CATEGORY_ORDER
    .filter(cat => (byCategory[cat] || []).length)
    .map(cat => `
      <div class="bc-group">
        <p class="bc-group-label ${BADGE_CATEGORY_CLASS[cat]}">${escapeHtml(BADGE_CATEGORY_LABEL[cat])}</p>
        <div class="bc-row">${byCategory[cat].map(renderBadgeChip).join('')}</div>
      </div>`).join('');
  // v44 — 넘침 판정(updateBadgeScrollHint_)은 여기서 바로 하지 않는다. 이 시점엔
  // .side-combined의 max-height가 아직 이전 렌더 값(또는 없음)이라 clientHeight가
  // 부정확함 — renderPortal()이 뒤이어 부르는 layoutSideCard_()가 높이를 다시
  // 잰 "다음"에 정확하게 판정한다(그 함수 끝에서 호출).
}

/* v44 — .side-combined(나무·칭호첩 sticky 카드) 높이를 실제 위치에 맞춰 재계산.
 * CSS만으로 max-height:calc(100vh - 32px)를 쓰면 sticky가 아직 "고정"되기 전
 * (페이지 스크롤이 0이라 카드가 헤더·미리보기 배너 아래 원래 자리에 있을 때)엔
 * 카드 top이 16px보다 훨씬 아래인데도 그 공식은 top이 16px라고 가정해버려서,
 * 카드가 뷰포트 아래로 넘치고 칭호첩이 화면 밑에서 잘려 보이는 버그가 있었다
 * (효니 리포트, 2026-09-08 — v43에서 이 sticky+높이제한 구간을 태블릿 가로모드까지
 * 넓히면서 뷰포트가 더 짧아져 눈에 띄게 됨. 데스크톱에서도 이론상 같은 버그였지만
 * 화면이 넉넉히 길어 안 드러났을 뿐). getBoundingClientRect().top으로 지금 실제
 * 위치를 재서 "뷰포트 높이 - 지금 top - 여백16px"만큼만 max-height로 준다.
 *
 * ⚠️ maxHeight는 반드시 이 available 안에서만 정해야 한다 — 처음엔 칭호첩이 너무
 * 작아 보이는 걸 막으려고 부족하면 available보다 카드를 더 길게 잡는 시도를
 * 했었는데, sticky는 "고정"되면 카드 전체가 뷰포트에 대해 움직이지 않으므로
 * 카드가 뷰포트보다 크면 그 아래로 삐져나온 부분은 페이지를 아무리 스크롤해도
 * 절대 화면에 들어오지 않는다(내부 스크롤 대상이 아니라 아예 도달 불가능한
 * 영역이 됨) — "작게 보이는" 것보다 훨씬 나쁘다. 짧은 화면에서 칭호첩이 작게
 * 보이는 문제는 대신 .side-fixed 쪽 공간을 실제로 줄여서(짧은 가로모드에서
 * .tree-note 안내문구 숨김, style.css) 해결한다.
 *
 * top이 이미 16px에 고정된 뒤(스크롤해서 sticky가 실제로 걸린 상태)에도 같은
 * 공식이 그대로 통한다. sticky가 아예 안 걸리는 구간(세로모드 등)에서는
 * .side-card가 static이라 이 계산 자체가 무의미 — 인라인 max-height를 지워
 * CSS 기본값(제한 없음)으로 되돌린다. */
function layoutSideCard_(){
  const card = document.querySelector('.side-combined');
  if(!card) return;
  if(getComputedStyle(card).position !== 'sticky'){
    card.style.maxHeight = '';
    updateBadgeScrollHint_();
    return;
  }
  const top = card.getBoundingClientRect().top;
  const maxH = Math.max(220, Math.floor(window.innerHeight - top - 16));
  card.style.maxHeight = maxH + 'px';
  updateBadgeScrollHint_();
}
window.addEventListener('resize', debounce_(layoutSideCard_, 150));
window.addEventListener('orientationchange', () => setTimeout(layoutSideCard_, 300));

/* v44 — 칭호첩 내부 스크롤 영역이 실제로 넘칠 때만 아래쪽에 옅은 페이드를 줘서
 * "더 있어요, 스크롤하세요"를 알려준다(.has-more, style.css). 안 넘칠 땐 평범하게
 * 끝까지 보여야 하므로 매번 다시 판정. */
function updateBadgeScrollHint_(){
  const el = document.getElementById('badgeGroups');
  if(!el) return;
  el.classList.toggle('has-more', el.scrollHeight - el.clientHeight > 4);
}

/* 새로 획득한 칭호만 토스트로 알림(상시 노출 안 함). 학번별로 "이전에 이미
 * 획득 확인한 칭호 id" 목록을 localStorage에 저장해두고, studentGet_ 응답이
 * 올 때마다(로그인 시 + refreshStudentData 재조회 시 — 둘 다 renderPortal을
 * 거치므로 여기 한 곳에서 처리하면 충분) 그 기준선에 없던 새 획득만 골라낸다.
 * - 첫 조회(기준선이 아예 없음, store.get이 null)에는 토스트 없이 기준선만 저장 —
 *   안 그러면 이미 칭호를 여러 개 가진 학생이 처음 로그인할 때 전부 "신규"로 뜬다.
 * - 여러 개가 동시에 새로 잡히면(예: 재도전 배지 + 강점 배지 동시 충족) showToast()가
 *   단일 슬롯이라 하나만 남고 덮어써지므로, 개별 토스트를 띄우는 대신 문구 하나로
 *   합쳐서 전부 언급되게 한다.
 * - 미리보기 모드는 실제 기록이 아니므로 토스트도, 기준선 갱신도 하지 않는다. */
function checkNewBadges(badges){
  if(!SESSION || PREVIEW_MODE) return;
  if(!badges || !badges.length) return; // 구버전 응답 등으로 필드 자체가 없으면 조용히 건너뜀
  const key = 'badges_seen_' + SESSION.studentId;
  const earnedIds = badges.filter(b => b.earned).map(b => b.id);
  const raw = store.get(key);
  if(raw === null){
    store.set(key, JSON.stringify(earnedIds));
    return;
  }
  let prevIds = [];
  try{ prevIds = JSON.parse(raw) || []; }catch(e){ prevIds = []; }
  const prevSet = new Set(prevIds);
  const newlyEarned = badges.filter(b => b.earned && !prevSet.has(b.id));
  store.set(key, JSON.stringify(earnedIds));
  if(!newlyEarned.length) return;
  const msg = newlyEarned.length === 1
    ? `🎉 ${newlyEarned[0].name} 획득!`
    : `🎉 ${newlyEarned[0].name} 외 ${newlyEarned.length - 1}개 칭호 획득!`;
  showToast(msg);
}

/* v103 — 새 공지 알림. 공지엔 id가 없고 올린 시각(timestamp)뿐이라 시각 문자열을 키로 쓴다.
 * checkNewBadges와 같은 패턴: 학번별로 "이미 본 공지 키" 목록을 localStorage에 두고, 기준선에 없던
 * 공지가 있을 때만 토스트 한 번. 첫 조회(기준선 없음)에는 알리지 않고 기준선만 저장 — 안 그러면
 * 처음 쓰는 기기에서 기존 공지가 전부 "새 공지"로 뜬다. 토스트는 단일 슬롯이라 칭호 토스트가 떠 있으면
 * 끝난 뒤에 띄운다. 미리보기(교사가 학생 화면 보기)는 읽음 기준선도 건드리지 않는다. */
function checkNewAnnouncements_(items){
  if(!SESSION || PREVIEW_MODE) return;
  if(!Array.isArray(items)) return; // 조회 실패(빈 배열과 구분 안 됨)로 기준선이 지워지는 걸 막기 위해 배열일 때만
  if(!items.length) return;
  const key = 'ann_seen_' + SESSION.studentId;
  const keys = items.map(a => String(a.timestamp));
  const raw = store.get(key);
  if(raw === null){
    store.set(key, JSON.stringify(keys));
    return;
  }
  let prev = [];
  try{ prev = JSON.parse(raw) || []; }catch(e){ prev = []; }
  const prevSet = new Set(prev);
  const fresh = keys.filter(k => !prevSet.has(k));
  if(!fresh.length) return;
  store.set(key, JSON.stringify(Array.from(new Set(prev.concat(keys)))));
  const msg = fresh.length === 1 ? '📢 새 공지가 1건 있어요' : `📢 새 공지가 ${fresh.length}건 있어요`;
  const busy = $('toast') && $('toast').classList.contains('show');
  // 항상 한 틱 뒤로 미룬다: 수동 새로고침(refreshStudentData(true))은 renderPortal 직후 "최신 기록으로 갱신했어요"를
  // 띄워 이 토스트를 덮어쓰는데, 기준선은 이미 저장돼 알림이 영영 사라지기 때문.
  setTimeout(() => showToast(msg), busy ? 2800 : 0);
}

/* v31(핸드오프 "발표 탐구포인트 학생 화면 반영") — checkNewBadges와 같은 패턴:
 * 학번별로 "이미 확인한 발표 지급 id" 목록을 localStorage에 저장해두고, 새로
 * studentGet_ 응답이 올 때마다 기준선에 없던 지급만 골라 팝업으로 1회 보여준다.
 * 토스트(showToast)는 2.6초면 사라지는 배경 알림이라 "선생님이 방금 인정해준
 * 포인트"라는 무게에 안 맞아서, 확인 버튼을 눌러야 닫히는 별도 팝업(showPresentationPopup)을
 * 씀. 배지와 동일하게 첫 조회(기준선 없음)엔 팝업 없이 기준선만 저장 — 안 그러면
 * 이미 여러 번 지급받은 학생이 처음 로그인할 때 전부 "신규"로 뜬다.
 * grants[i].id가 없는 응답(백엔드 구버전 등)을 대비해 timestamp를 폴백 키로 씀. */
function ppGrantKey_(g){ return String(g.id != null ? g.id : g.timestamp); }
function checkNewPresentationGrants(grants){
  if(!SESSION || PREVIEW_MODE) return;
  if(!grants || !grants.length) return;
  const key = 'pp_seen_' + SESSION.studentId;
  const ids = grants.map(ppGrantKey_);
  const raw = store.get(key);
  if(raw === null){
    store.set(key, JSON.stringify(ids));
    return;
  }
  let prevIds = [];
  try{ prevIds = JSON.parse(raw) || []; }catch(e){ prevIds = []; }
  const prevSet = new Set(prevIds);
  const newlyGranted = grants.filter(g => !prevSet.has(ppGrantKey_(g)));
  store.set(key, JSON.stringify(ids));
  if(!newlyGranted.length) return;
  showPresentationPopup(newlyGranted);
}
function showPresentationPopup(grants){
  document.querySelectorAll('.pp-popup-overlay').forEach(el => el.remove()); // 중복 방지
  const totalPts = grants.reduce((sum, g) => sum + (Number(g.points) || 6), 0);
  const descLine = grants.length === 1
    ? (grants[0].thinkingType ? `‘${escapeHtml(grants[0].thinkingType)}’ 유형으로 선생님이 인정해 주셨어요.` : '선생님이 발표를 인정해 주셨어요.')
    : `발표 ${grants.length}건을 선생님이 인정해 주셨어요.`;
  const reasonHtml = (grants.length === 1 && grants[0].reason)
    ? `<p class="pp-popup-reason">“${escapeHtml(String(grants[0].reason))}”</p>` : '';
  const overlay = document.createElement('div');
  overlay.className = 'pp-popup-overlay';
  overlay.innerHTML = `
    <div class="pp-popup-card" role="dialog" aria-modal="true" aria-label="발표 탐구포인트 획득">
      <p class="pp-popup-emoji">🎤</p>
      <p class="pp-popup-title">발표 탐구포인트 +${totalPts}점</p>
      <p class="pp-popup-desc">${descLine}</p>
      ${reasonHtml}
      <button type="button" class="btn btn-sm pp-popup-ok">확인</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.pp-popup-ok').addEventListener('click', close);
  overlay.addEventListener('click', ev => { if(ev.target === overlay) close(); });
}

/* v37(핸드오프 "피드백 알림/모아보기/읽음 상태" Phase 2) — Phase 1의 localStorage
 * 기준선 방식(fbKey_)을 폐기하고 서버가 studentGet_ 응답에 내려주는 ack 필드
 * (FEEDBACKS 시트 '확인여부')를 그대로 신뢰한다. "ack가 false인 것 = 아직 안
 * 읽음"이라 기기를 바꿔 로그인해도 정확하고, 팝업을 확인하면 ackFeedbackItems_가
 * 그 항목들만 서버에 확인 표시를 남긴다 — 교사 대시보드의 fb-dot도 이제 같은
 * ack 값을 봐서 두 화면이 서로 어긋나지 않는다. 배포 직후 기존 피드백은 백엔드
 * backfillFeedbackAck_ 마이그레이션으로 전부 ack=true 처리해뒀으므로, Phase 1
 * 때 막아뒀던 "첫 로그인 플러드" 문제는 서버 쪽에서 이미 해결된 상태다. */
function checkNewFeedback(fbAll){
  if(!SESSION || PREVIEW_MODE) return;
  if(!fbAll || !fbAll.length) return;
  const unread = fbAll.filter(f => !f.ack);
  if(!unread.length) return;
  showFeedbackPopup(unread);
}
/* 토스트 대신 확인 버튼을 눌러야 닫히는 모달(showPresentationPopup과 같은 이유) —
 * "선생님이 남긴 피드백"이라는 무게에 2.6초짜리 토스트는 안 맞음. 여러 건이 한
 * 번에 도착하면(교사가 몰아서 채점) 항목별로 리스트를 스크롤해서 볼 수 있게 함. */
function showFeedbackPopup(items){
  document.querySelectorAll('.fb-popup-overlay').forEach(el => el.remove()); // 중복 방지
  const title = items.length === 1
    ? '선생님 피드백이 도착했어요!'
    : `선생님 피드백이 ${items.length}개 도착했어요!`;
  const listHtml = items.map(f => `
    <div class="fb-popup-item">
      <div class="fb-popup-item-meta">${escapeHtml(feedbackLabel_(f))}</div>
      <div>${escapeHtml(String(f.feedback))}</div>
    </div>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'fb-popup-overlay';
  overlay.innerHTML = `
    <div class="fb-popup-card" role="dialog" aria-modal="true" aria-label="선생님 피드백 도착">
      <p class="fb-popup-emoji">📮</p>
      <p class="fb-popup-title">${title}</p>
      <div class="fb-popup-list">${listHtml}</div>
      <button type="button" class="btn btn-sm fb-popup-ok">확인</button>
    </div>`;
  document.body.appendChild(overlay);
  // v37 — 확인 버튼이든 배경 클릭이든 "닫음 = 확인함"으로 취급해 서버에 ack를 남김.
  const close = () => { overlay.remove(); ackFeedbackItems_(items); };
  overlay.querySelector('.fb-popup-ok').addEventListener('click', close);
  overlay.addEventListener('click', ev => { if(ev.target === overlay) close(); });
}

/* v37 — 팝업에 떴던 항목들만 서버에 확인 표시(ackFeedback)를 남긴다. 실패해도
 * 조용히 넘어감(사용자에게 에러 노출 안 함) — ack가 그대로 false로 남으면
 * 다음 방문 때 팝업이 다시 뜰 뿐이라 놓쳐도 안전하게 재시도되는 구조.
 * f.ack를 낙관적으로 먼저 true로 바꿔두는데, items는 fbAll(=STUDENT_DATA.feedback)
 * 안의 객체를 그대로 참조하므로 이 한 번의 변경이 fbGeneral·fbByLesson·모아보기
 * 카드가 쓰는 값에도 전부 반영된다(같은 세션 안 재렌더링 시 중복 확인 방지). */
function ackFeedbackItems_(items){
  if(!SESSION || PREVIEW_MODE) return;
  items.forEach(f => {
    if(f.ack) return;
    f.ack = true;
    fetch(CONFIG.WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'ackFeedback', studentId: SESSION.studentId, row: f._row })
    }).catch(() => {});
  });
}

/* ── 이벤트 바인딩 ── */
$('btnLogin').addEventListener('click', () => {
  if(PW_CHANGE_CTX){ submitFirstPwChange_(); return; } // v83
  login($('inputId').value.trim(), $('inputName').value.trim(), false);
});
/* ── v83 로그인 비밀번호: 첫 로그인 변경·초기화 요청·포털 안 변경 ── */
const PW_RE_ = /^\d{4,12}$/;
function setPwChangeMode_(on){
  $('pwField').style.display = on ? 'none' : '';
  $('pwChangeBox').style.display = on ? 'block' : 'none';
  $('inputId').disabled = on; $('inputName').disabled = on;
  $('btnLogin').textContent = on ? "새 비밀번호로 시작하기" : "책 펼치기";
  $('btnPwReset').textContent = on ? "← 처음으로 돌아가기" : "비밀번호를 잊었어요 · 초기화 요청하기";
  $('inputNewPw').value = ''; $('inputNewPw2').value = '';
}
function startFirstPwChange_(sid, name, oldPw){
  PW_CHANGE_CTX = { sid, name, oldPw };
  setPwChangeMode_(true);
  $('loginError').style.display = 'none';
  $('inputNewPw').focus();
}
function cancelFirstPwChange_(){
  PW_CHANGE_CTX = null;
  setPwChangeMode_(false);
  $('inputPw').value = '';
}
async function submitFirstPwChange_(){
  const ctx = PW_CHANGE_CTX;
  const pw = $('inputNewPw').value.trim(), pw2 = $('inputNewPw2').value.trim();
  if(!PW_RE_.test(pw)){ showLoginError("새 비밀번호는 숫자 4~12자리로 정해 주세요."); return; }
  if(pw !== pw2){ showLoginError("두 번 적은 새 비밀번호가 서로 달라요."); return; }
  const btn = $('btnLogin');
  btn.disabled = true; btn.textContent = "저장하는 중…";
  $('loginError').style.display = 'none';
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({
      action: 'changePassword', studentId: ctx.sid, name: ctx.name, oldPassword: ctx.oldPw, newPassword: pw }) });
    const r = await res.json();
    if(r.result !== 'success'){ showLoginError(r.message || "비밀번호를 바꾸지 못했어요."); btn.disabled = false; btn.textContent = "새 비밀번호로 시작하기"; return; }
    H26Auth.set(r.session);
    cancelFirstPwChange_();
    showToast("새 비밀번호를 저장했어요. 다음부터는 이 비밀번호로 로그인해요.");
    btn.disabled = false;
    await login(ctx.sid, ctx.name, false, true);
  }catch(e){
    showLoginError("비밀번호를 바꾸지 못했어요. 인터넷 연결을 확인해 주세요.");
    btn.disabled = false; btn.textContent = "새 비밀번호로 시작하기";
  }
}
$('inputPw').addEventListener('keydown', e => { if(e.key === 'Enter') $('btnLogin').click(); });
$('inputNewPw2').addEventListener('keydown', e => { if(e.key === 'Enter') $('btnLogin').click(); });
$('btnPwReset').addEventListener('click', async () => {
  if(PW_CHANGE_CTX){ cancelFirstPwChange_(); return; } // 변경 단계에선 "처음으로 돌아가기"로 쓴다
  const sid = $('inputId').value.trim(), name = $('inputName').value.trim();
  if(!parseStudentId(sid) || !name){ showLoginError("학번(5자리)과 이름을 먼저 적은 뒤 눌러 주세요."); return; }
  if(!confirm(sid + " " + name + " 학생의 비밀번호 초기화를 선생님께 요청할까요?")) return;
  const btn = $('btnPwReset'); btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST',
      body: JSON.stringify({ action: 'requestPasswordReset', studentId: sid, name }) });
    const r = await res.json();
    showLoginError(r.message || (r.result === 'success' ? "초기화 요청을 보냈어요." : "요청하지 못했어요."));
  }catch(e){
    showLoginError("요청하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }finally{ btn.disabled = false; }
});
function openPwDialog_(){
  if(PREVIEW_MODE || TEST_WRITE_MODE){ showToast("미리보기·테스트 계정에서는 비밀번호를 바꿀 수 없어요."); return; }
  ['pwCur','pwNew','pwNew2'].forEach(id => { $(id).value = ''; });
  $('pwDialogError').style.display = 'none';
  $('pwDialog').style.display = 'flex';
  $('pwCur').focus();
}
function closePwDialog_(){ $('pwDialog').style.display = 'none'; }
async function savePwDialog_(){
  const cur = $('pwCur').value.trim(), pw = $('pwNew').value.trim(), pw2 = $('pwNew2').value.trim();
  const err = msg => { $('pwDialogError').textContent = msg; $('pwDialogError').style.display = 'block'; };
  if(!cur){ err("지금 비밀번호를 입력해 주세요."); return; }
  if(!PW_RE_.test(pw)){ err("새 비밀번호는 숫자 4~12자리로 정해 주세요."); return; }
  if(pw !== pw2){ err("두 번 적은 새 비밀번호가 서로 달라요."); return; }
  const btn = $('pwDialogSave'); btn.disabled = true;
  try{
    const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST', body: JSON.stringify({
      action: 'changePassword', studentId: SESSION.studentId, name: SESSION.name, oldPassword: cur, newPassword: pw }) });
    const r = await res.json();
    if(r.result !== 'success'){ err(r.message === "학번·이름·비밀번호가 맞지 않아요." ? "지금 비밀번호가 맞지 않아요." : (r.message || "비밀번호를 바꾸지 못했어요.")); return; }
    H26Auth.set(r.session);
    closePwDialog_();
    showToast("비밀번호를 바꿨어요. 다른 기기에서는 로그아웃됐어요.");
  }catch(e){
    err("비밀번호를 바꾸지 못했어요. 인터넷 연결을 확인해 주세요.");
  }finally{ btn.disabled = false; }
}
$('btnPwSettings').addEventListener('click', openPwDialog_);
$('pwDialogCancel').addEventListener('click', closePwDialog_);
$('pwDialogSave').addEventListener('click', savePwDialog_);
$('pwNew2').addEventListener('keydown', e => { if(e.key === 'Enter') savePwDialog_(); });
$('inputName').addEventListener('keydown', e => {
  if(e.key === 'Enter') $('btnLogin').click();
});
/* ── 자동 재조회 ──
 * 포털은 로그인 때 한 번만 데이터를 불러오므로, 학생이 다른 탭에서
 * 활동을 끝내고 돌아왔을 때를 위해 탭 복귀 시 자동으로 다시 조회한다. */
let lastRefresh = Date.now();
async function refreshStudentData(force){
  if(!SESSION) return;
  if(PREVIEW_MODE && !PREVIEW_REAL) return; // v64 — 샘플 미리보기는 가짜 학번이라 재조회하면 예시 데이터가 사라짐
  if($('portalView').style.display !== 'block') return;
  if(!force && Date.now() - lastRefresh < 15000) return; // 15초 쿨다운
  lastRefresh = Date.now();
  try{
    const url = CONFIG.WEBAPP_URL
      + "?mode=student&studentId=" + encodeURIComponent(SESSION.studentId)
      + "&name=" + encodeURIComponent(SESSION.name)
      + (PREVIEW_MODE ? "&token=" + encodeURIComponent(TOKEN) : ""); // v83 — 실제 학생 미리보기는 교사 토큰으로
    const res = await fetch(url);
    const data = await res.json();
    if(data.needLogin && !PREVIEW_MODE){ // v83 — 다른 기기에서 비번을 바꿨거나 교사가 초기화했다
      exitToLogin();
      showLoginError(data.message || "다시 로그인해 주세요.");
      return;
    }
    if(data.result === 'success'){
      STUDENT_DATA = data;
      STUDENT_DATA.announcements = await fetchAnnouncements(SESSION.grade, SESSION.ban);
      renderPortal();
      if(force) showToast('최신 기록으로 갱신했어요.');
    }
  }catch(e){
    if(force) showToast('갱신하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible') refreshStudentData(false);
});
window.addEventListener('focus', () => refreshStudentData(false));
$('btnPortalRefresh').addEventListener('click', () => refreshStudentData(true));

function exitToLogin(){
  store.del('portal_session');
  store.del('portal_handoff'); // v81
  if(window.H26Auth) H26Auth.clear(); // v83 — 이 기기의 로그인 세션(웹앱 공용)도 지운다
  if(PW_CHANGE_CTX) cancelFirstPwChange_();
  $('inputPw').value = '';
  SESSION = null; STUDENT_DATA = null; PREVIEW_MODE = false; CHECKIN_CTX = null;
  PREVIEW_REAL = false; PREVIEW_FROM_DASH = false; TEST_WRITE_MODE = false;
  $('portalView').style.display = 'none';
  $('portalView').classList.remove('shown');
  $('checkinView').style.display = 'none';
  $('bookCover').classList.remove('opening');
  $('loginView').style.display = 'flex';
  $('inputId').value = ''; $('inputName').value = '';
}
$('btnLogout').addEventListener('click', exitToLogin);
$('btnExitPreview').addEventListener('click', () => PREVIEW_FROM_DASH ? exitPreviewToDash_() : exitToLogin());

/* ── 대시보드에서 "이 학생의 실제 학생 화면" 보기 (v64) ──
 * 교사가 학생 계정으로 매번 로그인하지 않고 그 학생이 보는 화면을 그대로 확인하는 용도. 학번+이름만으로
 * 조회되는 기존 mode=student를 그대로 쓰고(새 API 없음), PREVIEW_MODE를 켜서 모든 쓰기를 막는다 —
 * 질문·답장·자가체크·읽음 처리(ackMessages_/ackFeedbackItems_)·배지 기준선(localStorage)·체크인이 전부
 * PREVIEW_MODE 가드에 걸려 실제 기록이 남지 않는다. 자동로그인 세션(portal_session)도 안 건드린다. */
async function previewAsStudent(sid, name, fromNav){
  const parsed = parseStudentId(sid);
  if(!parsed || !CONFIG.CURRICULUM[parsed.grade]){ showToast('이 학생의 학년 정보를 찾지 못했어요.'); return; }
  showToast(`${name} 학생 화면을 불러오는 중이에요…`);
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL
      + '?mode=student&studentId=' + encodeURIComponent(sid) + '&name=' + encodeURIComponent(name)
      + '&token=' + encodeURIComponent(TOKEN)); // v83 — 로그인 필수가 켜져도 교사 토큰으로 통과
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    data.announcements = await fetchAnnouncements(parsed.grade, parsed.ban);
    if(!fromNav) PREVIEW_DASH_SCROLL = window.scrollY;
    PREVIEW_MODE = true; PREVIEW_REAL = true; PREVIEW_FROM_DASH = true;
    SESSION = { studentId: sid, name, ...parsed };
    STUDENT_DATA = data;
    CHECKIN_CTX = null;
    $('portalView').classList.remove('shown');
    renderPortal();
    window.scrollTo(0, 0);
  }catch(e){
    showToast('학생 화면을 불러오지 못했어요. 다시 시도해 주세요.');
  }
}
function previewStepStudent_(delta){
  const i = DASH_STUDENT_ORDER.findIndex(x => x.sid === SESSION.studentId);
  const next = DASH_STUDENT_ORDER[i + delta];
  if(!next){ showToast(delta < 0 ? '이 목록의 첫 번째 학생이에요.' : '이 목록의 마지막 학생이에요.'); return; }
  previewAsStudent(next.sid, next.name, true);
}
function exitPreviewToDash_(){
  SESSION = null; STUDENT_DATA = null; PREVIEW_MODE = false; PREVIEW_REAL = false; PREVIEW_FROM_DASH = false;
  CHECKIN_CTX = null;
  $('portalView').style.display = 'none';
  $('portalView').classList.remove('shown');
  $('dashView').style.display = 'block';
  window.scrollTo(0, PREVIEW_DASH_SCROLL);
}
function dashPreviewStudent(btn){ previewAsStudent(btn.dataset.sid, btn.dataset.name); }
$('btnPrevStudent').addEventListener('click', () => previewStepStudent_(-1));
$('btnNextStudent').addEventListener('click', () => previewStepStudent_(1));

