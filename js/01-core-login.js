/* 설정은 config.js에서 불러옵니다 (같은 폴더에 있어야 함) */
const CONFIG = window.PORTAL_CONFIG;
if (!CONFIG) {
  document.body.innerHTML = '<div style="max-width:420px;margin:80px auto;padding:24px;font-family:sans-serif;line-height:1.6">'
    + '<h2>config.js를 찾을 수 없어요</h2>'
    + '<p>config.js 파일이 이 HTML과 같은 폴더에 있는지 확인해 주세요.</p></div>';
  throw new Error('config.js 없음');
}

/* ════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
// v44 — resize 리스너용 아주 단순한 디바운스(연속 호출 중 마지막 것만 delay 뒤 실행).
const debounce_ = (fn, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };
let SESSION = null;      // { studentId, name, grade, ban, num }
let STUDENT_DATA = null; // 서버 응답 { activities, feedback }
let PREVIEW_MODE = false; // 교사용 "학생 화면 미리보기"에서 true — 실제 기록/조회 없이 화면만 확인
/* v64 — 미리보기 두 종류: ① 샘플(로그인 화면의 학년·반 선택, 가짜 학번) ② 실제 학생(대시보드의 "학생 화면 보기",
 * 그 학생의 실제 mode=student 응답을 읽기 전용으로 그림). PREVIEW_REAL은 ②일 때만 true. PREVIEW_FROM_DASH는
 * 대시보드에서 들어왔음(종료 시 대시보드로 복귀, 이전/다음 학생 버튼 노출). */
let PREVIEW_REAL = false, PREVIEW_FROM_DASH = false, PREVIEW_DASH_SCROLL = 0;
/* v70 — 교사 "기록 테스트 모드": PREVIEW_MODE(읽기 전용)와 달리 99번 테스트 계정으로 진짜 로그인해 쓰기가 실제로 저장된다.
 * 학생 화면 코드는 PREVIEW_MODE만 보고 쓰기를 막으므로, 이 모드에선 PREVIEW_MODE를 켜지 않고 배너만 따로 띄운다. */
let TEST_WRITE_MODE = false;
const TEST_STUDENT_NAME = '미리보기 학생';
let DASH_STUDENT_ORDER = []; // renderDash가 매번 갱신 — 미리보기 "이전/다음 학생" 이동 순서
let CHECKIN_PLAN = null; // v17: 이제 checkin_data.js 정적 값이 아니라 mode=checkinPlan API로 채움 (loadCheckinPlan)

const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
store.del('dash_token'); // v67 — 옛 버전이 무조건 저장해둔 토큰 일괄 삭제(교실 PC 등에 남은 것 포함)

function parseStudentId(sid){
  if(!/^\d{5}$/.test(sid)) return null;
  return { grade: Number(sid[0]), ban: Number(sid.slice(1,3)), num: Number(sid.slice(3,5)) };
}

/* v22: 공용 재시도 fetch 헬퍼 — Apps Script 재배포 직후 script.googleusercontent.com
 * 리다이렉트가 순간적으로 404를 뱉거나(엣지 캐시 전파 지연), 네트워크가 잠깐
 * 끊기는 경우를 흡수. HTTP status 비정상이거나 JSON 파싱 실패 시 재시도.
 * maxAttempts회, 시도 사이 delayMs*attempt 만큼 대기(기본 3회, 700ms 간격). */
async function fetchJsonRetry_(url, maxAttempts, delayMs){
  maxAttempts = maxAttempts || 3;
  delayMs = delayMs || 700;
  let lastErr;
  for(let attempt = 1; attempt <= maxAttempts; attempt++){
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    }catch(e){
      lastErr = e;
      if(attempt < maxAttempts) await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

/* ── 로그인 ──
 * v83: 비밀번호 단계 추가. silent(자동 입장)는 이 기기에 같은 학번의 유효한 세션(H26Auth)이 있을 때만 들어가고,
 * 없으면 학번·이름만 채워 둔 채 비밀번호를 기다린다. preAuthed는 세션을 방금 받은 경우(첫 비번 변경 직후·교사 테스트 모드). */
let PW_CHANGE_CTX = null; // v83 — { sid, name, oldPw }: 초기 비밀번호로 맞게 들어와 새 비밀번호를 받는 중
async function login(sid, name, silent, preAuthed){
  const parsed = parseStudentId(sid);
  if(!parsed){ showLoginError("학번은 숫자 5자리예요. 예: 30512"); return; }
  if(!name){ showLoginError("이름을 입력해 주세요."); return; }

  /* v22: 커리큘럼이 아예 안 불러와진 상태(로딩 실패)와, 학번은 맞는데 해당
   * 학년 자체가 없는 경우(진짜 오타)를 구분. 전자를 "학번을 다시 확인해 주세요"로
   * 보여주면 학생이 자기 학번이 잘못된 줄 알고 헤맴 — 실제로는 서버 통신 문제. */
  if(Object.keys(CONFIG.CURRICULUM).length === 0){
    showLoginError("커리큘럼 정보를 불러오는 중이에요. 잠시만 기다려 주세요…");
    const reloaded = await loadCurriculum();
    if(!reloaded){
      showLoginError("커리큘럼 정보를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.");
      return;
    }
    $('loginError').style.display = 'none';
  }

  if(!CONFIG.CURRICULUM[parsed.grade]){
    showLoginError("이 학번의 학년 정보를 찾을 수 없어요. 학번을 다시 확인해 주세요."); return;
  }

  const btn = $('btnLogin');

  /* v83 — 세션 확보 */
  const held = window.H26Auth && H26Auth.get();
  if(silent && !(held && held.sid === sid)) return; // 자동 입장할 세션이 없음 — 입력칸만 채워진 채로 비밀번호를 기다린다
  if(!silent && !preAuthed){
    const pw = $('inputPw').value.trim();
    if(!pw){ showLoginError("비밀번호를 입력해 주세요."); return; }
    btn.disabled = true; btn.textContent = "확인하는 중…";
    $('loginError').style.display = 'none';
    try{
      const res = await fetch(CONFIG.WEBAPP_URL, { method: 'POST',
        body: JSON.stringify({ action: 'login', studentId: sid, name, password: pw }) });
      const r = await res.json();
      if(r.result !== 'success'){ showLoginError(r.message || "로그인하지 못했어요."); return; }
      if(r.mustChange){ startFirstPwChange_(sid, name, pw); return; }
      H26Auth.set(r.session);
    }catch(e){
      showLoginError("로그인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."); return;
    }finally{
      btn.disabled = false; btn.textContent = PW_CHANGE_CTX ? "새 비밀번호로 시작하기" : "책 펼치기";
    }
  }

  btn.disabled = true; btn.textContent = "책을 펼치는 중…";
  $('loginError').style.display = 'none';

  try{
    const url = CONFIG.WEBAPP_URL
      + "?mode=student&studentId=" + encodeURIComponent(sid)
      + "&name=" + encodeURIComponent(name);
    const res = await fetch(url);
    const data = await res.json();
    if(data.needLogin){ // v83 — 세션 만료·다른 기기에서 비번 변경·교사 초기화
      H26Auth.clear(); store.del('portal_session');
      showLoginError(data.message || "다시 로그인해 주세요.");
      return;
    }
    if(data.result !== 'success') throw new Error(data.message || '조회 실패');
    $('inputPw').value = '';

    SESSION = { studentId: sid, name, ...parsed };
    STUDENT_DATA = data;
    store.set('portal_session', JSON.stringify({ sid, name }));

    /* v23: 공지사항 조회와 체크인 확인은 서로 독립적인 요청이라(둘 다
     * SESSION만 있으면 됨, STUDENT_DATA와 무관) 순차로 기다리지 않고
     * 병렬로 쏨. Apps Script 호출 하나당 콜드스타트·동시접속 지연이
     * 붙는 구조라, 순차 2번을 병렬 1번 분량으로 줄여서 로그인 체감
     * 속도를 개선 — 특히 반 전체가 한꺼번에 로그인하는 순간에 효과가 큼. */
    const [announcements, needsCheckin] = await Promise.all([
      fetchAnnouncements(parsed.grade, parsed.ban),
      maybeStartCheckin()
    ]);
    STUDENT_DATA.announcements = announcements;

    if(needsCheckin){
      enterCheckinFlow();
    } else {
      openBook(silent);
    }
  }catch(e){
    if(!silent) showLoginError("기록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  }finally{
    btn.disabled = false; btn.textContent = "책 펼치기";
  }
}

/* 공지사항 조회 — 실패해도 로그인 자체는 막지 않도록 별도 try/catch */
async function fetchAnnouncements(grade, ban){
  try{
    const url = CONFIG.WEBAPP_URL
      + "?mode=announcements&grade=" + encodeURIComponent(grade)
      + "&ban=" + encodeURIComponent(ban);
    const res = await fetch(url);
    const data = await res.json();
    return (data.result === 'success') ? (data.rows || []) : [];
  }catch(e){
    return [];
  }
}

/* 커리큘럼 로딩 (시트 기반) — CONFIG.CURRICULUM을 API 응답으로 채움.
 * v21: 재시도 추가(fetchJsonRetry_ 공용화, v22). 재시도 없이 CONFIG.CURRICULUM이
 * 빈 채로 남으면 login()에서 학번 자체가 잘못된 것처럼("학년 정보를 찾을 수 없어요")
 * 오해를 주는 메시지가 떴음. */
async function loadCurriculum(){
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL + "?mode=curriculum");
    if(data.result === 'success' && data.grades){
      CONFIG.CURRICULUM = data.grades;
      return true;
    }
  }catch(e){}
  return false;
}

/* v17: CHECKIN_PLAN(체크인 문항)을 "체크인문항" 시트에서 불러옴. 실패해도 체크인 기능만
 * 조용히 꺼질 뿐 로그인 자체는 막지 않음(loadCurriculum과 달리 필수 아님).
 * v22: fetchJsonRetry_로 공용화. */
async function loadCheckinPlan(){
  try{
    const data = await fetchJsonRetry_(CONFIG.WEBAPP_URL + "?mode=checkinPlan");
    if(data.result === 'success' && data.plan){
      CHECKIN_PLAN = data.plan;
      return true;
    }
  }catch(e){}
  return false;
}

/* 책 펼침 연출 → 포털 진입 */
function openBook(instant){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(instant || reduce){ renderPortal(); return; }
  $('bookCover').classList.add('opening');
  setTimeout(renderPortal, 650);
}

function showLoginError(msg){
  const err = $('loginError');
  err.textContent = msg; err.style.display = 'block';
}

