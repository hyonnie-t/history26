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
- **발표 탐구포인트 (v31~)**: 발표처럼 웹앱 밖에서 일어나는 즉흥 활동에 포인트를 즉시 지급하는 별도 통로.
  교사가 학생 상세 카드(접힌 `.pp-box`) 또는 전용 "탐구포인트" 탭(`dashPointBoxHtml_()`,
  `index.html:3455` 부근 — 학생 검색 후 펼쳐진 채로 뜸, v33 신규)에서 사고유형(판단/비교/해석/관점) 또는
  "유형 없이"를 골라 지급하면 `grantPresentationPoint` action이 호출된다. 학생 화면에서는
  `STUDENT_DATA.presentationGrants`를 커리큘럼 순회와 별도로 합산해 포인트에 얹는다(`index.html:1113`
  부근). **이 action의 서버 구현(achievement 컬럼/로그 기록 방식)은 이 저장소에 없다** — Apps Script 쪽
  확인·구현이 필요하다.
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
- **공지 대상 3분류 / 질문함 담당 반 필터링 (v30)**: 공지 작성 시 대상을 "담당 학급반"(로그인한 교사가 맡은
  반들, `dashMyBans_()`가 콤마 리스트로 반환)/"전체"/"개별 반" 3분류 라디오로 고르며, "담당 학급반"으로
  게시하면 `ban` 필드에 `"5,6,7,8"`처럼 콤마 리스트가 저장된다(서버 `parseBanListField_()`가 풀어서 매칭
  — 콤마 없는 기존 단일 반/전체 공지와 하위 호환). 질문함 목록도 로그인한 교사가 담당하지 않는 반의 질문은
  아예 제외하고 보여준다.
- **백엔드는 이 저장소에 없다.** `config.js`의 `WEBAPP_URL`이 가리키는 Google Apps Script 웹앱이 API 역할을
  하며, 데이터 저장소는 Google Sheets다. 프론트엔드는 `?mode=...` 쿼리 파라미터(GET, 조회용)와
  `{ action: '...' }` JSON body(POST, 변경용) 두 가지 방식으로 통신한다. 교사 쓰기 작업은 대부분
  `token: TOKEN`을 함께 보내 인증한다.

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
  v34~v38 = 학급 공통 피드백·알림·모아보기·질문함 연결, v39 = 디자인 토큰 정리·카드형 컴포넌트 공통 베이스
  — 확인 시점 기준 `index.html`/`style.css`에서 가장 높은 버전 표기는 v39). 여러 기능이 같은 버전
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
  있다.** 다만 실제 배지 획득 판정 계산(`computeBadges_`)은 이 저장소가 아니라 `backend_v23.gs`(Apps
  Script)가 `mode=student` 응답의 `STUDENT_DATA.badges` 필드로 이미 계산해서 내려주는 값이며, 교사 미리보기
  모드(`PREVIEW_MODE`)에서는 이 필드 자체가 없으므로 두 함수 모두 빈 값을 방어적으로 처리한다.
- AI 코멘트 기능(`aiReview`/`aiEdit` action)은 교사 대시보드에서 학생 기록에 대한 AI 생성 코멘트를
  검토/수정/숨김 처리하는 기능이며, 이 저장소는 그 코멘트 생성 로직이 아니라 검토 UI만 갖고 있다(생성은
  Apps Script 백엔드 쪽 책임). 이 저장소 코드 전체를 검색해도 손글씨 사진 → 키워드 제안 같은 이미지/
  Vision 기반 워크플로우는 없다 — 현재 프론트에 존재하는 건 텍스트 코멘트를 검토(`aiReview`)/수정
  (`aiEdit`)하는 두 action뿐이며, 이미지 업로드나 Gemini Vision 호출 관련 코드는 이 저장소에 전혀 없다
  (있다면 전적으로 외부 Apps Script 백엔드 쪽 책임).
