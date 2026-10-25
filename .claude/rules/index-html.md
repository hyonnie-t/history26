---
paths:
  - "index.html"
  - "js/*.js"
---

# index.html · js/ 구조와 함정

## 구조
- 뷰 4개(`<div id="...View">`)를 JS로 표시/숨김: `#loginView`(학생 로그인 책 표지 + 교사 토큰 게이트 + 학생 화면 테스트 진입) /
  `#checkinView`(웰컴 체크인: 감정 온도·단어칩·문항) / `#portalView`("나의 역사책": 탐구 나무·타임라인·자가체크·공지·질문함) /
  `#dashView`(교사 대시보드 탭: 학생 기록·질문함·공지 관리·커리큘럼 관리·체크인·탐구포인트).
- JS는 v104(2026-10-25)부터 `index.html` 인라인이 아니라 `js/` 7개 파일이다. `index.html` 맨 아래 `<script src="js/...?v=NN">` 순서가 실행 순서이고, 전부 classic script라
  최상위 `const`/`let`·함수는 파일 사이에 공유된다(`type="module"`로 바꾸지 않는다 — 전역 스코프 공유가 깨진다). 옛 `/* ══` 구분선이 그대로 파일 경계이고,
  파일 안에서는 `/* ──` 구분선으로 찾는다. 마지막 파일 끝의 `initPortal()` IIFE로 부팅.
  | 파일 | 내용 |
  |---|---|
  | `js/01-core-login.js` | config 가드, `$`·`store`·`fetchJsonRetry_`, 세션 상태 변수, 학생 로그인(`login`·`parseStudentId`), 커리큘럼·체크인 계획 로드 |
  | `js/02-checkin-portal.js` | 웰컴 체크인, 탐구 나무 SVG, 포털 렌더, 자가체크, 공지, 피드백 모아보기, 상단 탭, 질문함, 개인 메시지, 유틸 |
  | `js/03-grade-lookup.js` | 성적조회 |
  | `js/04-perf-score.js` | 수행평가 점수 확인 |
  | `js/05-badges-events.js` | 칭호첩, 로그인 화면 이벤트 바인딩, 비밀번호 변경·초기화 요청, 자동 재조회, 대시보드→실제 학생 화면 보기 |
  | `js/06-dashboard.js` | 교사 대시보드(탭·공지·커리큘럼·웰컴 체크인·문항·이미지 업로드·질문함·메시지·AI 의심·학급 피드백·발표 포인트·re_judge·성적 업로드) |
  | `js/07-dash-admin-boot.js` | 학생 계정(v83), 성적 열람 상태, 수행평가 현황, 고민리스트 보너스, AI 검토·중복 삭제·AI 코멘트 관리, 학생 화면 미리보기, 초기 부팅 |
- **파일 경계 규칙**: 함수 선언 호이스팅은 파일을 넘지 않는다. 앞 파일의 로드 시점 코드(최상위 문·IIFE·`forEach` 같은 동기 콜백, 그때 불리는 함수 본문까지)가 뒤 파일 선언을
  부르면 ReferenceError. 코드를 다른 파일로 옮기거나 새 파일을 끼울 땐 이 조건을 다시 확인한다(v104 분리 때 AST로 0건 확인).
- `js/*.js`를 고치면 `index.html`의 해당 `<script src="...?v=NN">` 번호를 올린다(GitHub Pages 캐시, `style.css?v=`와 같은 방식).
- **TDZ 함정**: 즉시 실행(IIFE) 코드에서 파일 아래쪽에 선언된 `const`(DOM 참조 등)를 참조하면 스크립트 전체가 멈춰 모든 버튼이 죽는다.
  init은 함수로 선언하고 모든 const·이벤트 바인딩 뒤 맨 아래에서 호출.

## 차시-활동
- 커리큘럼 시트 한 행(차시)에 활동 최대 2개. 학생용 `mode=curriculum`은 파싱된 `l.activities` 배열, 교사용 `mode=curriculumAdmin`은
  원본 JSON 문자열 `activitiesRaw` + `activitiesCount` + `sequential`. `dashEditLesson()`이 `activitiesRaw`를 파싱해 폼을 채우고
  `clLessonItemHtml()`이 목록 배지("활동 2개 · 🔒 순차")를 그린다.
- 학생 화면: `renderLessonCard()`/`renderActivityBlock()`. `l.sequential`이면 앞 활동이 `doneIds`에 들기 전까지 다음 활동 잠금(`locked`).
- 완료 판정 AND 조건(`lessonDone()` ↔ `lessonAllActivityIds_()`)은 AGENTS.md 절대 규칙 10.

## 포인트·칭호
- 실제 포인트: `renderPortal()` 안 `const P = CONFIG.POINTS || { FIRST: 10, RETRY: 5, RETRY_MAX: 2 }` — 활동 단위, 첫 완료 `FIRST`점,
  재도전마다 활동당 `RETRY_MAX`회까지 `RETRY`점. `CONFIG.POINTS`는 config.js에도 API 응답에도 없어 항상 10/5/2.
  배점 변경은 config.js에 `POINTS: { FIRST, RETRY, RETRY_MAX }` 추가 또는 이 리터럴 수정. (`POINTS_PER_LESSON`은 죽은 값)
- "칭호"는 두 시스템: (1) `RANKS` 8단계 계급(권지 사관→…→대제학) — 순수 프론트, `renderPortal()`이 `CONFIG.RANKS[SESSION.grade]`와
  점수 비교. 탐구 나무 8단계와 1:1. (2) "칭호첩" 배지(`.badge-card`; `learning`/`behavior`/`strength` × `once`/`repeat`) —
  `renderBadges()`/`renderBadgeChip()`이 그리고 `checkNewBadges()`가 localStorage 기준선과 비교해 신규만 토스트.
  **판정(`computeBadges_`)은 `history26_backend`의 `code.gs`** → `mode=student`의 `STUDENT_DATA.badges`. 배지 작업은 백엔드 레포도 같이 연다.
  코드 주석의 `backend_v23.gs`·`backend_v24.gs`·`ai_module_v9.gs`(옛 이름, 현재는 `ai_module.gs`)는 옛 파일명일 뿐 실제 파일이 아니다(지금은 `code.gs`·`ai_module.gs`) — "레포에 없는 외부 파일"로 착각 금지.
  `PREVIEW_MODE`에선 `badges` 필드가 없으므로 두 함수 모두 빈 값을 방어한다.

## 네트워크·세션·학번
- `fetch` 직접 호출과 `fetchJsonRetry_()`(기본 3회·700ms, Apps Script 재배포 직후 일시적 404/JSON 실패 흡수)가 섞여 있다.
  `Promise.all`로 묶는 곳(대시보드)은 `fetchJsonRetry_`를 쓴다(하나만 실패해도 전체 reject).
- 학생 세션: `localStorage` `portal_session`(`store.get/set/del`)에 `{ sid, name }`(자동 입장할 학번 기억용)과, v83부터 로그인 세션 `h26_auth`
  (`{token, exp, sid, name}`, `H26Auth.get/set/clear` — `snippets/portal_auth.js`, 웹앱과 공유). 자동 입장은 `h26_auth`의 학번이 같을 때만.
  `portal_auth.js`가 `window.fetch`를 감싸 Apps Script 호출에 `session`을 붙이므로 각 호출부는 세션을 직접 다루지 않는다. 교사 `TOKEN`·`PREVIEW_MODE`는 메모리 변수.
  "이 기기에서 로그인 유지"(`#tokenRemember`)를 켤 때만 `dash_token_saved`에 저장(v67, 옛 키 `dash_token`은 부팅 때 삭제).
- 학번 파싱은 `parseStudentId()`가 단일 소스 — 학번 로직은 이것을 재사용.
- `PREVIEW_MODE`: 포털 함수를 고칠 때 이 플래그로 API 호출/기록이 분기되는 지점이 있는지 확인(미리보기 종류는 features.md "학생 화면 미리보기").
  주의: 로그인 화면 "🧪 학생 화면 테스트"는 v70부터 99번 `미리보기 학생`으로 진짜 로그인하는 `TEST_WRITE_MODE`(시트에 실제 저장, `PREVIEW_MODE` 아님)다.
  읽기 전용 미리보기는 대시보드의 `previewAsStudent()`(`PREVIEW_REAL=true`)뿐.

## AI 코멘트·외부 연동
- `aiReview`/`aiEdit` action은 AI 코멘트 **검토/수정/숨김 UI**일 뿐, 생성은 백엔드. 손글씨 사진·Vision 같은 이미지 워크플로우는 이 레포에 없다.
- "🧭 SEL 특성 보기"는 `SEL_APP_URL`(별도 Apps Script, `sel_backend_v1.gs`)을 `openSelPopup(sid)`로 학번만 실어 여는 딥링크.
  팝업 안 화면·데이터·계산은 이 레포 책임이 아니다.

## 기능별 함정 한 줄 (상세는 `docs/features.md` 해당 섹션)
- 체크인 문항 폼은 선택된 학년 탭(`CKQ_GRADE`)으로 저장된다. 옛 문항의 회수질문·재확인 값은 저장하면 교사 메모로 합쳐져 되돌릴 수 없다.
- 학급 공통 피드백·발표 탐구포인트·성적조회·개인 메시지 등 백엔드 의존 기능은 "백엔드 재배포 전 동작"이 섹션마다 적혀 있다 — 고치기 전 그 섹션부터.
