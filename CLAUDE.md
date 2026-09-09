# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**2학기 역사 탐구 기록** — 중고등학교 역사 수업용 학생 학습 포털. 학생이 학번(5자리: 학년·반·번호)과 이름으로
로그인해 차시별 활동을 수행·기록하고, 웰컴 체크인(감정 온도 체크)을 하고, 질문함으로 교사에게 질문을 보낸다.
교사는 별도 대시보드에서 학생 기록·AI 코멘트·공지·커리큘럼·체크인 문항을 관리한다.

## 아키텍처

**순수 정적 프론트엔드 + Google Apps Script 백엔드** 구조로, 별도 빌드 과정이나 패키지 매니저가 없다.

- `index.html` — 전체 애플리케이션. 4개의 뷰(`<div id="...View">`)를 하나의 HTML 안에 두고 JS로 표시/숨김
  전환하는 단일 페이지 앱이다. 뷰가 곧 화면 단위이며, 각 뷰 안에서 다시 상태에 따라 내부 DOM을 다시 그린다.
  - `#loginView` — 학생 로그인(책 표지 컨셉) + 교사 토큰 게이트 + 학생 화면 미리보기 진입점
  - `#checkinView` — 웰컴 체크인(감정 온도·단어칩·문항 응답)
  - `#portalView` — 학생용 메인 포털("나의 역사책": 탐구 나무, 타임라인, 자가체크, 공지사항, 질문함)
  - `#dashView` — 교사 대시보드(탭: 학생 기록 / 질문함 / 공지 관리 / 커리큘럼 관리 / 체크인 / 탐구포인트)
  - `<script>` 블록(469번째 줄부터, `initPortal()` IIFE로 부팅)이 전체 로직을 담고 있으며 파일 내 주석
    구분선(`/* ══...`, `/* ──...`)이 섹션 경계 역할을 한다. 새 기능을 찾을 때는 이 구분선 주석을 먼저 훑는 것이
    빠르다.
- **차시-활동 구조 (활동목록JSON·순차진행, v27~)**: 커리큘럼 시트의 한 차시(행)에는 활동을 2개까지 담을 수
  있다. 학생용 `mode=curriculum` 응답은 이미 배열로 파싱된 `l.activities`를 내려주는 반면, 교사 대시보드용
  `mode=curriculumAdmin` 응답(`LESSONS_ADMIN`)은 원본 JSON 문자열 `activitiesRaw`와 활동 개수
  `activitiesCount`, 순차 진행 여부 `sequential`을 함께 내려준다 — `dashEditLesson()`(`index.html:2416`
  부근)이 `activitiesRaw`를 파싱해 "활동 2개" 입력 폼을 채우고, `clLessonItemHtml()`(`index.html:2199`)이
  `activitiesCount`/`sequential`로 목록 배지("활동 2개 · 🔒 순차")를 그린다. 학생 화면에서는
  `renderLessonCard()`/`renderActivityBlock()`(`index.html:1113`, `1161`)이 활동별 블록을 나열하고,
  `l.sequential`이 켜져 있으면 앞 활동을 `doneIds`에 넣기 전까지 다음 활동을 잠근다(`locked` 계산,
  `index.html:1125`). **차시 "완료" 판정은 항상 그 차시의 모든 activities id가 `doneIds`에 들어있어야
  성립하는 AND 조건**이며, 학생 쪽 `lessonDone()`(`index.html:955`)과 교사 대시보드 쪽
  `lessonAllActivityIds_()`(`index.html:2740`, `renderDash()`의 학생별 진행률 계산에서 재사용)가 각자
  같은 기준을 구현한다 — 진행률·완료 뱃지·포인트 관련 로직을 고칠 땐 이 AND 조건이 두 곳 모두에서 깨지지
  않는지 확인할 것.
- **발표 탐구포인트 (v31~, 2026-09-04에 수준별 차등 지급 추가)**: 발표처럼 웹앱 밖에서 일어나는 즉흥
  활동에 포인트를 즉시 지급하는 별도 통로. 교사가 학생 상세 카드(접힌 `.pp-box`) 또는 전용 "탐구포인트"
  탭(`dashPointBoxHtml_()`, `index.html:3455` 부근 — 학생 검색 후 펼쳐진 채로 뜸, v33 신규)에서
  사고유형(판단/비교/해석/관점) 또는 "유형 없이"를 고르고, **수준(하/중/상 — `PP_LEVELS`, 각각
  +4/+6/+9점)도 같이 골라** 지급하면 `grantPresentationPoint` action이 `level` 파라미터와 함께
  호출된다(기본 선택은 중=+6, 예전 flat 6점과 동일). 학생 화면에서는 `STUDENT_DATA.presentationGrants`를
  커리큘럼 순회와 별도로 합산해 포인트에 얹는다(`index.html:1113` 부근) — 각 grant의 `points` 필드를
  그대로 읽으므로(`Number(g.points) || 6` 폴백) 차등 점수가 자동으로 반영된다. **이 action의 서버 구현
  (achievement 컬럼/로그 기록 방식, `PRESENTATION_POINTS_BY_LEVEL`)은 이 저장소에 없다** —
  `history26_backend`. ⚠️ '하'/'중'으로 지급한 발표는 학습 칭호(결정왕 등) 집계 대상에서 빠진다(백엔드가
  achievement==='상'인 것만 집계) — 포인트는 그대로 들어간다.
- `config.js` — `window.PORTAL_CONFIG`. Apps Script 웹앱 URL(`WEBAPP_URL`), 누적 포인트 기반 칭호 체계
  (`RANKS`), 반별 총원(`BAN_SIZE`) 등 정적 설정. `RANKS`는 v31부터 학년 공통 단일 배열이 아니라
  `{ 2: [...], 3: [...] }` 형태의 **학년별 8단계** 배열이다(2학년 30차시·3학년 15차시로 진도량이 달라
  문턱을 분리) — `renderPortal()`이 `CONFIG.RANKS[SESSION.grade]`로 골라 쓰고, 없으면 2학년 배열로
  폴백한다. 탐구 나무도 4단계에서 8단계로 늘어(v32) RANK 8단계와 1:1로 매칭된다.
  **`CURRICULUM`은 여기서 비워둔 채로 두고 페이지 로딩 시 `mode=curriculum` API 응답으로 채워진다** —
  커리큘럼(차시 목록·단원 질문·포트폴리오)의 실제 소스는 이 파일이
  아니라 Google Sheets이며, 교사 대시보드 "커리큘럼 관리" 탭에서 편집한다. `BAN_SIZE`는 현재 2학년 1~4반과
  3학년 5~8반에만 실제 인원수가 채워져 있고(2학년 5~8반은 0, 3학년 1~4반은 항목 자체가 없음) — 숫자가 채워진
  반이 실제 수업을 맡은 반이다. 담당 반이 바뀌면 이 표도 함께 갱신해야 체크인 탭의 "OO명 중 XX명 완료" 분모가
  정확해진다.
- `checkin_data.js` — `CHECKIN_CONFIG`. 감정 온도 척도, 기본 단어칩, 기타입력 설정 등 체크인의 정적 UI 설정만
  담는다. 문항 자체(`CHECKIN_PLAN`)는 마찬가지로 Google Sheets("체크인문항" 탭)에서 관리되며
  `mode=checkinPlan` API로 채워진다.
- `style.css` — 전체 스타일. 상단 `:root`에 디자인 토큰(색상 `--paper`/`--ink`/`--indigo`/`--seal` 등,
  spacing/font-size 스케일, `--tap-min: 44px` 터치 타겟 최소값)을 정의하고 이후 섹션별로 이어진다. v39에서
  시맨틱 색상 토큰(amber/jade/indigo-bg 등)과 border-radius 4단계 스케일(`--radius-xs/sm/lg` 등)을
  추가해 기능별로 조금씩 다르던 하드코딩 hex/반경 리터럴을 통일했고, 흰 배경+옅은 테두리+카드 반경+옅은
  그림자를 반복 선언하던 카드 성격 선택자 13곳(`.side-card`/`.kpi`/`.question-card` 등)을 공통 베이스
  규칙 하나로 모았다(베이스가 소스상 개별 규칙보다 앞에 있어야 `border-left` 같은 override가 정상 동작).
  새 카드류 UI를 추가할 때는 이 공통 베이스를 재사용하는 게 먼저다.
- **학급 공통 피드백 & 피드백 알림 (v34~v38)**: 교사 대시보드 "학생 기록" 탭에서 학년+반(숫자 하나, "전체"나
  "담당 학급반mine" 묶음 아님)+활동(하나)을 모두 골랐을 때만 `#classFbBox`가 나타나(`dashRenderClassFeedback()`,
  `index.html:3165` 부근) 그 조합에 해당하는 학생 글을 모아 AI로 "교사용 리포트"와 "학생 공지용 문구"를
  생성한다(`generateClassFeedback` action, 조회는 `mode=classFeedback`). 학생 공지용 문구는 자동으로
  학생 포털 활동 완료 카드에도 표시된다. **`generateClassFeedback`/`mode=classFeedback` 모두 이 저장소에
  없는 백엔드**이며, 배포 전까지 이 박스는 "아직 없음" 상태로만 보이거나 생성 버튼이 실패 토스트를 낸다.
  학생 쪽은 개인 AI 코멘트·학급 공통 피드백을 합쳐 최신순으로 보여주는 "피드백 모아보기" 카드(v36)와 도착
  1회 알림 팝업(v34)이 있고, 확인 여부는 v35부터 로컬스토리지가 아니라 `ackFeedback` action으로 서버에
  남긴다. v38(Phase 3)에서 모아보기 각 항목에 "이 피드백에 대해 질문하기" 버튼(`askAboutFeedback_()`)이
  붙었는데, 이는 질문함 입력창에 피드백을 인용구로 미리 채워주는 **순수 프론트 UX 연결**일 뿐 — 백엔드에
  피드백과 질문을 실제로 연결하는 참조 필드는 없다.
- **학생 포털 구조 재배치 (v42, 2026-09-08 — 효니 진단 요청에 따른 리디자인)**: `#portalView`가
  사이드카드(나무·칭호첩) → 공지 → KPI → 단원질문 → 포트폴리오 → 학기 총평 → 피드백 모아보기 → 질문함 →
  달성도 → 보관함 → **그제서야 학습 연표(실제 차시 목록)** 순으로 쌓여 있어, 학생이 매번 하는 일(차시
  활동 열기)이 페이지 맨 끝에 있던 문제를 구조적으로 고쳤다. 두 가지를 바꿈:
  1. `<main>` 안에서 학습 연표(`.timeline`)를 공지·KPI·단원질문 바로 다음으로 끌어올리고, 포트폴리오·
     피드백·질문함·달성도·보관함은 `.section-divider`("📎 그 밖의 기록") 아래로 몰아 참고용임을 시각적으로
     구분했다(`index.html:147` 부근, `style.css`의 `.section-divider`). 마크업 순서만 바꾼 것이라
     `renderPortal()`은 `$('id')` 참조라 순서 무관하게 그대로 동작한다.
  2. **"선생님이 남긴 총평" 카드(구 `#feedbackCard`)를 완전히 제거**했다 — 거기 뜨던 `fbGeneral`(차시에
     안 속한 피드백)이 이미 v36 "피드백 모아보기"(`#feedbackInboxCard`, `fbAll` = `fbGeneral` +
     `fbByLesson`)에 "학기 총평" 라벨로 그대로 포함돼 있어서(`feedbackLabel_()`), 같은 내용이 amber
     카드 두 개에 중복 노출되고 있었다(v36 커밋 당시 "기존 두 노출 방식을 대체하지 않고 병행"이라고
     의도적으로 남겨뒀던 것 — 이번에 정리). 정보 손실 없이 중복만 제거한 것.
  3. `.layout`이 세로모드에서 2단→1단으로 붕괴할 때 소스 순서상 먼저 오는 사이드카드가 화면 맨 위를
     차지하던 것을, `.side-col{order:2}`/`main{order:1}`로 화면 노출 순서만 뒤집어 해결했다
     (`style.css:298` 부근) — 마크업은 그대로다.
  헤드리스 브라우저로 태블릿 세로(820×1180)·가로(1180×820) 두 뷰포트 모두 목업 데이터로 렌더 확인함
  (실제 로그인은 이 저장소만으로 재현 불가 — `PREVIEW_MODE` 경로로 확인).
  **v43 정정(2026-09-08, 효니 피드백)**: 위 3번을 처음엔 `max-width:1024px`(폭 기준)로만 걸어서
  구형 아이패드 **가로모드**(1024px)까지 1단으로 접혀버렸는데, 나무·칭호첩을 왼쪽/위에 두는 배치는
  "책을 펼친 모양"에서 왼쪽 페이지(서재)로 삼은 의도된 디자인이었다(효니: "이건 동기부여 목적으로
  의도한 부분"). 그래서 기준을 폭 대신 **orientation**으로 바꿨다 — `@media (max-width:1024px) and
  (orientation:portrait), (max-width:640px) and (orientation:landscape)`(`style.css:304` 부근)일
  때만 1단으로 접고, 그 외 가로모드(태블릿 가로모드 대부분 포함)는 폭이 좁아도 좌(서재)/우(본문)
  2단 그대로 유지한다. `.side-card`의 sticky↔static 전환 조건(`style.css:326` 부근)과 `.side-combined`
  내부 스크롤 높이 제한 조건(`style.css:344` 부근, 구 `min-width:1025px`)도 정확히 같은/반대 조건으로
  맞춰야 한다 — 셋 중 하나만 바꾸면 sticky는 걸리는데 높이 제한이 안 걸려 카드가 뷰포트를 넘어가는 등
  어긋난다. 헤드리스 브라우저로 1024×768(구형 아이패드 가로)·900×700(좁은 가로)·820×1180(세로) 세
  뷰포트 재확인함.
  **v44 정정(2026-09-08, 효니 리포트 "칭호첩이 짤리는 거 같은데")**: v43으로 태블릿 가로모드에
  sticky+높이제한 구간을 넓힌 게 새 버그를 하나 더 냈다. `.side-combined{max-height:calc(100vh - 32px)}`
  라는 CSS 공식은 sticky가 실제로 "고정"되기 전(페이지 스크롤이 0이라 카드가 헤더·미리보기 배너
  아래 원래 자리에 있을 때) top이 16px가 아니라 훨씬 아래(실측 ~170px)인데도 top=16px를 가정해서,
  카드가 그만큼 뷰포트 아래로 넘쳐 칭호첩이 화면 밑에서 잘려 보였다 — 태블릿처럼 짧은 뷰포트라 v43
  전엔 이 구간 자체가 안 걸려서 안 드러났을 뿐, 데스크톱에서도 이론상 같은 버그. 고친 방법:
  1. `layoutSideCard_()`(`index.html`, `renderBadges()` 뒤에 정의)가 `renderPortal()` 끝에서
     `requestAnimationFrame`으로 한 번, 그리고 `resize`/`orientationchange`(디바운스 150ms)에서
     `.side-combined`의 실제 `getBoundingClientRect().top`을 재서 `window.innerHeight - top - 16`을
     인라인 `style.maxHeight`로 넣는다 — CSS의 vh 고정값 제거. **이 값은 절대 뷰포트 여유보다 크게
     잡으면 안 된다**(처음엔 칭호첩 최소 확보 높이를 위해 넘치는 걸 허용하려 했었는데, sticky는
     "고정"되면 카드 전체가 뷰포트 기준으로 안 움직이므로 뷰포트보다 큰 부분은 페이지를 아무리
     스크롤해도 절대 화면에 안 들어옴 — 내부 스크롤 대상이 아니라 도달 자체가 불가능해짐. "작게
     보인다"보다 훨씬 나쁜 상태라 이 시도는 되돌림).
  2. 대신 칭호첩이 너무 작아 보이는 문제는 `.side-fixed`(나무·이름·칭호뱃지·포인트·다음 칭호까지
     거리 등)가 차지하는 공간 자체를 줄여서 해결 — `.tree-note`(안내 문구 3줄)를
     `@media (orientation:landscape) and (max-height:900px)`(`style.css`, 데스크톱은 보통 세로가
     이보다 넉넉해서 안 걸림)에서 숨겨 그만큼을 칭호첩 쪽으로 돌려준다.
  3. 칭호첩 스크롤 영역이 실제로 넘칠 때만(`scrollHeight - clientHeight > 4`) `#badgeGroups`에
     `.has-more` 클래스를 붙여(`updateBadgeScrollHint_()`) 아래쪽에 옅은 `mask-image` 페이드를 줘서
     "더 있어요, 스크롤하세요"를 알려준다 — 이전엔 스크롤 가능한 걸 알리는 신호가 전혀 없어서
     기술적으론 스크롤되는데도 "그냥 잘려서 안 보이는 것"처럼 보였다.
  헤드리스 브라우저로 실제 배지 10개(카테고리 3개 모두)를 채운 상태로 1024×768·1180×820·
  900×700(가로)·1400×1000(데스크톱) 재확인 — 모두 카드가 뷰포트를 안 넘고(음수 여유), 짧은
  가로모드에서도 칭호첩이 최소 1줄 이상 보이며 필요할 때만 `.has-more` 페이드가 뜸.
- **공지 대상 3분류 / 질문함 담당 반 필터링 (v30)**: 공지 작성 시 대상을 "담당 학급반"(로그인한 교사가 맡은
  반들, `dashMyBans_()`가 콤마 리스트로 반환)/"전체"/"개별 반" 3분류 라디오로 고르며, "담당 학급반"으로
  게시하면 `ban` 필드에 `"5,6,7,8"`처럼 콤마 리스트가 저장된다(서버 `parseBanListField_()`가 풀어서 매칭
  — 콤마 없는 기존 단일 반/전체 공지와 하위 호환). 질문함 목록도 로그인한 교사가 담당하지 않는 반의 질문은
  아예 제외하고 보여준다.
- **역사법정 → re_judge 자동 등록 (2026-09-04 신규)**: 교사 대시보드 "탐구포인트" 탭 하단에
  `courtCasePush` 카드가 있다 — 3학년 반을 고르고 버튼을 누르면, `his_judge_goryeo`
  (`CONFIG.GAME_NAME = "3차시_권문세족_역사법정"`, `COURT_CASE_GAME_NAME` 상수로 이 저장소에도
  하드코딩돼 있음. 다른 역할극 웹앱이 생기면 같이 늘릴 것)의 검사/변호인 발언문+배심원 판결을
  모아 백엔드가 re_judge(완전 별도 시스템, `hyonnie-t/re_judge`)에 새 사건으로 자동 등록해준다
  (`dashCourtCasePush()`). 실제 취합·re_judge 호출 로직은 `history26_backend`의
  `courtCasePushPost_` 책임 — 이 저장소는 버튼과 결과 메시지 표시만 담당한다. 서버가
  `result:'partial'`을 돌려주면(re_judge 응답에서 caseId를 못 찾은 경우) 사건은 만들어졌지만
  진술은 자동으로 안 채워진 상태라는 뜻 — 안내 메시지를 그대로 보여준다.
- **고민리스트 자원 카드 보너스 (2026-09-07 신규)**: 교사 대시보드 "탐구포인트" 탭 맨 아래
  `#gmBonusBox` 카드(`dashRenderGongminBonus_()`, `index.html:3804` 부근)가 개별 웹앱 `gongmin`
  (공민왕의 개혁 "고민리스트", `GONGMIN_GAME_NAME = "4차시_공민왕개혁_고민리스트"`)의 2단계 자원
  여부를 모아 보여주고 일괄 지급한다. **`gongmin`은 학생용 웹앱이라 교사 토큰을 심을 수 없어
  `grantPresentationPoint`를 직접 호출하지 못한다** — 그래서 `choicesJson.volunteer` 플래그만
  기록해서 보내고, 여기서 교사가 확인한 뒤 자원자에게만 몰아서 지급한다(1장만 쓴 학생은 대상 제외,
  이게 곧 1장 vs 2장 학생 간 탐구포인트 차등). 이미 로드된 `ROWS`를 gameName으로 걸러 쓰므로 별도
  네트워크 요청은 없다. **새 action은 없다** — 기존 `grantPresentationPoint`를
  `reason: GONGMIN_BONUS_REASON`("고민리스트 2단계 자원 카드 보너스") 고정 문자열로 호출할 뿐이라
  백엔드는 이 기능을 몰라도 동작한다. 중복 지급 방지도 서버 dedupe가 아니라
  `choiceSummary === GONGMIN_BONUS_REASON`인 기존 행 유무로 프론트가 자체 판별한다
  (`grantPresentationPointPost_`가 reason을 choiceSummary 컬럼에 그대로 저장하는 걸 이용) —
  같은 이유 문자열을 다른 용도로 재사용하면 이 dedupe가 오작동한다.
- **백엔드는 이 저장소에 없다.** `config.js`의 `WEBAPP_URL`이 가리키는 Google Apps Script 웹앱이 API 역할을
  하며, 데이터 저장소는 Google Sheets다. 프론트엔드는 `?mode=...` 쿼리 파라미터(GET, 조회용)와
  `{ action: '...' }` JSON body(POST, 변경용) 두 가지 방식으로 통신한다. 교사 쓰기 작업은 대부분
  `token: TOKEN`을 함께 보내 인증한다. 그 백엔드 소스 자체는 `hyonnie-t/history26_backend` 레포
  (`code.gs` + `ai_module_v9.3.gs`)에 있다 — 이 저장소만 봐서는 `?mode=`/`action=`이 실제로 뭘 하는지
  알 수 없고, 백엔드 로직을 고치거나 새 action을 추가하는 작업은 그 레포에서 해야 한다.
- **개별 수업 웹앱은 이 저장소 밖에서 각자 따로 만들어진다.** `crusades`(십자군, 화면 하나짜리
  판단형 서술), `his_judge_goryeo`(3차시 역사법정, 검사/변호인/배심원 역할극) 등 — 전부 자기 레포에
  단일 `index.html`로 존재하고, `CONFIG.SHEET_WEBAPP_URL`로 위와 같은 `history26_backend`를 직접
  호출한다(대부분 새 action 없이 기존 gameName 제출 경로만 씀). 이 저장소의 커리큘럼 관리 탭에서
  activity id로 등록해야 포털 진행률·포인트 계산에 잡힌다. 디자인 기준선("역사책 페이지" 컨셉)은
  hyonnie.md 참고. **새로 만들거나 수정할 땐 `webapp-builder` 스킬을 반드시 따른다** — 특히
  ① 로그인 확인 화면(포털에서 넘어온 학번/이름은 자동 채우되 화면 자체를 건너뛰면 안 됨),
  ② 마무리 글쓰기 후 패들렛 복사 기능, ③ 제출(fetch)에 재시도 포함(백엔드 기록 보장) 이 세
  가지는 매번 빠뜨리기 쉬워서 실제로 반복 누락됐던 항목이다(2026-09-09, `gongmin` 사례 — 재시도
  없이 fetch 한 번 실패로 끝나 활동 중 시트 기록이 안 남을 뻔함). 자세한 내용은 스킬 파일 참고.

## 외부 연동 — SEL(사회정서역량) 특성 보기

교사 대시보드의 학생 상세 카드에 있는 "🧭 SEL 특성 보기" 버튼은 이 저장소의 `WEBAPP_URL`과 무관한
**완전히 별도의 Apps Script 웹앱**을 새 팝업 창으로 여는 딥링크일 뿐이다. `SEL_APP_URL`
(`index.html:1605`) 상수에 그 웹앱 주소가 하드코딩돼 있고, `openSelPopup(sid)`(`index.html:1607`)가
학번(`sid`) 하나만 쿼리 파라미터로 실어 팝업을 띄운다. 그 팝업 안의 화면·데이터·계산 로직은 전부 그
외부 프로젝트(사용자 확인: `sel_backend_v1.gs`) 책임이며, 이 저장소 코드에는 포함돼 있지 않다. SEL
기능을 수정해야 한다면 이 저장소가 아니라 해당 외부 Apps Script 프로젝트를 봐야 한다.

## 개발 워크플로우

- 빌드 도구, 패키지 매니저, 린터, 테스트 러너가 없다. `npm install`/`build`/`test` 같은 커맨드는 존재하지
  않는다.
- 로컬 확인은 `index.html`을 정적 파일 서버로 열면 된다 (예: `python3 -m http.server`). `file://`로 직접
  열면 `config.js`/`checkin_data.js` 로드나 `fetch` 동작이 브라우저 정책상 막힐 수 있으니 반드시 로컬 서버를
  거친다.
- 실제 데이터 흐름(로그인, 체크인, 대시보드 조회/수정)을 확인하려면 `config.js`의 `WEBAPP_URL`이 가리키는
  실제 Apps Script 웹앱에 네트워크로 접근 가능해야 한다. 이 저장소만으로는 백엔드 로직을 재현/수정할 수
  없다 — Apps Script 프로젝트와 Google Sheets는 별도로 관리된다.
- 배포는 이 정적 파일들을 그대로 호스팅(GitHub Pages 등)하는 방식으로 보인다. 별도의 CI 워크플로우
  (`.github/workflows`)는 없다.

## 코드 컨벤션 / 알아둘 점

- 모든 UI 텍스트와 주석은 한국어. 커밋 메시지도 한국어가 관례다 (`git log` 참고: "selfCheck: 서버 응답
  확인 안 하던 버그 수정" 등).
- 코드 곳곳의 주석에 `v12`, `v17`, `v22`, `v27`, `v29`처럼 버전 표기가 붙어 있고, 그 버전에서 왜 그렇게
  바꿨는지(버그, 성능, UX 이유)를 짧게 설명하는 스타일이다(예: v27 = 차시당 활동 2개·순차진행 도입, v28 =
  담당 교사별 트랙 필터링, v29 = 대시보드 반 선택 UI 개편, v30 = 공지 대상 3분류·질문함 반 필터링, v31 =
  발표 탐구포인트 도입·RANK 학년별 재설계, v32 = 탐구 나무 8단계 확장, v33 = 탐구포인트 빠른 지급 탭,
  v34~v38 = 학급 공통 피드백·알림·모아보기·질문함 연결, v39 = 디자인 토큰 정리·카드형 컴포넌트 공통 베이스,
  v40~v41 = 체크인 대시보드 반별 요약·학년별 2단 배치·적용 대상 3분류 개편, v42 = 학생 포털 구조 재배치,
  v43 = 사이드카드 2단 유지 기준을 폭에서 orientation으로 정정, v44 = 사이드카드(나무·칭호첩)
  높이 계산을 CSS의 vh 고정값에서 JS 실측 기반으로 교체(아래 참고) — 확인 시점 기준
  `index.html`/`style.css`에서 가장 높은 버전 표기는 v44). 여러 기능이 같은 버전
  번호를 먼저 붙였다가 나중에 충돌을 발견해 재번호한 이력도 있으므로(`git log` "버전표기 충돌 정리" 커밋
  참고), 새 버전 번호를 붙이기 전에 이미 쓰인 번호인지 먼저 확인할 것. 관련 로직을 고칠 때는 기존 버전
  주석을 참고해 과거에 이미 겪은 문제를 되풀이하지 않도록 하고, 의미 있는 변경이면 같은 스타일로 이유를
  남긴다.
- 네트워크 호출은 `fetch`를 직접 쓰는 곳과 `fetchJsonRetry_()`(재시도 헬퍼, 기본 3회·700ms 간격)를 쓰는
  곳이 섞여 있다. Apps Script 재배포 직후 일시적 404/JSON 파싱 실패를 흡수하기 위한 것이므로, 대시보드처럼
  `Promise.all`로 여러 요청을 한 번에 묶는 곳은 특히 `fetchJsonRetry_`를 쓰는 편이 안전하다(하나만 실패해도
  전체가 reject되는 문제를 피함).
- 학생 로그인 세션은 `localStorage`(`store.get/set/del`, 키 `portal_session`)에 `{ sid, name }`만 저장해
  자동 로그인에 쓴다. 교사 토큰(`TOKEN`)은 저장하지 않고 세션 중 메모리 변수로만 유지된다(`PREVIEW_MODE`도
  동일하게 메모리 상태).
- 학번은 `학년(1자리) + 반(2자리) + 번호(2자리)` 5자리 문자열로, `parseStudentId()`가 파싱 규칙의
  단일 소스다. 학번 관련 로직을 추가할 때 이 함수를 재사용할 것.
- 교사용 "학생 화면 미리보기"(`PREVIEW_MODE`)는 실제 서버 기록을 만들지 않고 화면만 보여주는 모드이므로,
  포털 관련 함수를 수정할 때 이 플래그로 실제 API 호출/기록 여부가 분기되는 지점이 있는지 확인해야 한다.
- `config.js`의 `POINTS_PER_LESSON`은 **현재 사용되지 않는 죽은 값**이다. 실제 포인트 지급은
  `renderPortal()` 안의 `const P = CONFIG.POINTS || { FIRST: 10, RETRY: 5, RETRY_MAX: 2 }`
  (`index.html:969`)에서 활동 단위로 계산한다 — 첫 완료 시 `FIRST`점, 이후 재도전마다 활동당
  `RETRY_MAX`회까지 `RETRY`점씩 추가. `CONFIG.POINTS`는 `config.js`에도, `loadCurriculum()`이 채우는
  `mode=curriculum` 응답에도 없으므로(`index.html:617` 부근, `CONFIG.CURRICULUM`만 덮어씀) 항상 이
  기본값(10/5/2)이 쓰인다. 포인트 배점을 바꾸려면 `config.js`에 `POINTS_PER_LESSON` 대신
  `POINTS: { FIRST, RETRY, RETRY_MAX }` 객체를 추가하거나 이 기본값 리터럴을 직접 고쳐야 한다.
- "칭호"라는 말은 서로 다른 두 시스템을 가리킨다. (1) `config.js`의 `RANKS`(포인트 누적 → 권지 사관/가주서/
  주서/사관/겸춘추/편수관/직제학/대제학 8단계, 학년별 문턱 분리, v31~) — 순수 프론트 로직으로,
  `renderPortal()`이 `CONFIG.RANKS[SESSION.grade]`와 점수를 비교해서 계산한다.
  (2) "칭호첩" 배지 시스템(`.badge-card`, `index.html:95` 부근) — `learning`/`behavior`/`strength` 3개
  카테고리, `once`/`repeat` 2가지 획득 타입의 배지를 `renderBadges()`/`renderBadgeChip()`
  (`index.html:1430`대)이 그리고, `checkNewBadges()`(`index.html:1459`)가 로컬스토리지 기준선과 비교해
  신규 획득만 토스트로 알린다. **이 저장소 기준으로는 프론트엔드 렌더링·신규 획득 알림까지 구현이 끝나
  있다.** 다만 실제 배지 획득 판정 계산(`computeBadges_`)은 이 저장소가 아니라 **`hyonnie-t/history26_backend`
  레포의 `code.gs`**(2026-09-03 확인 — 문서에 옛날부터 남아있던 "`backend_v23.gs`"라는 파일명은 착오,
  실제로 지금 쓰이는 파일은 `code.gs`다)가 `mode=student` 응답의 `STUDENT_DATA.badges` 필드로 이미
  계산해서 내려주는 값이며, 교사 미리보기 모드(`PREVIEW_MODE`)에서는 이 필드 자체가 없으므로 두 함수
  모두 빈 값을 방어적으로 처리한다. `BADGE_DEFS`/`computeBadges_`가 이 카테고리·타입 체계를 그대로 따라
  정의돼 있으므로, 배지 관련 작업은 프론트(이 저장소)만 봐서는 절반만 보인다 — `history26_backend`도
  같이 열어야 함. (예: 2026-09-03에 역할극 웹앱용 "논고왕"⚖️/"변론왕"🛡️ 배지가 `history26_backend`
  쪽에 추가됨 — `choicesJson.role`이 `prosecution`/`defense`인 활동 제출이 있으면 획득. 배포는
  아직 안 됨.)
- AI 코멘트 기능(`aiReview`/`aiEdit` action)은 교사 대시보드에서 학생 기록에 대한 AI 생성 코멘트를
  검토/수정/숨김 처리하는 기능이며, 이 저장소는 그 코멘트 생성 로직이 아니라 검토 UI만 갖고 있다(생성은
  Apps Script 백엔드 쪽 책임). 이 저장소 코드 전체를 검색해도 손글씨 사진 → 키워드 제안 같은 이미지/
  Vision 기반 워크플로우는 없다 — 현재 프론트에 존재하는 건 텍스트 코멘트를 검토(`aiReview`)/수정
  (`aiEdit`)하는 두 action뿐이며, 이미지 업로드나 Gemini Vision 호출 관련 코드는 이 저장소에 전혀 없다
  (있다면 전적으로 외부 Apps Script 백엔드 쪽 책임).
