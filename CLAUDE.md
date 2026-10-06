# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

과거 버전(v12~v55)에서 왜 그렇게 바꿨는지, 무엇을 시도했다 되돌렸는지 같은 이력은
[`CHANGELOG.md`](./CHANGELOG.md)에 있다. 여기는 **지금 코드가 실제로 어떻게 동작하는지**와
**고칠 때 반드시 알아야 할 함정**만 남긴다.

## 프로젝트 개요

**2학기 역사 탐구 기록** — 중고등학교 역사 수업용 학생 학습 포털. 학생이 학번(5자리: 학년·반·번호)과 이름으로
로그인해 차시별 활동을 수행·기록하고, 웰컴 체크인(감정 온도 체크)을 하고, 질문함으로 교사에게 질문을 보낸다.
교사는 별도 대시보드에서 학생 기록·AI 코멘트·공지·커리큘럼·체크인 문항을 관리한다.

## 아키텍처

**순수 정적 프론트엔드 + Google Apps Script 백엔드** 구조로, 별도 빌드 과정이나 패키지 매니저가 없다.

- `index.html` — 전체 애플리케이션. 4개의 뷰(`<div id="...View">`)를 하나의 HTML 안에 두고 JS로 표시/숨김
  전환하는 단일 페이지 앱이다.
  - `#loginView` — 학생 로그인(책 표지 컨셉) + 교사 토큰 게이트 + 학생 화면 미리보기 진입점
  - `#checkinView` — 웰컴 체크인(감정 온도·단어칩·문항 응답)
  - `#portalView` — 학생용 메인 포털("나의 역사책": 탐구 나무, 타임라인, 자가체크, 공지사항, 질문함)
  - `#dashView` — 교사 대시보드(탭: 학생 기록 / 질문함 / 공지 관리 / 커리큘럼 관리 / 체크인 / 탐구포인트)
  - `<script>` 블록(`initPortal()` IIFE로 부팅)이 전체 로직을 담고 있으며 파일 내 주석
    구분선(`/* ══...`, `/* ──...`)이 섹션 경계 역할을 한다. 새 기능을 찾을 땐 이 구분선 주석을 먼저 훑을 것.
- **차시-활동 구조**: 커리큘럼 시트의 한 차시(행)에는 활동을 2개까지 담을 수 있다. 학생용
  `mode=curriculum` 응답은 배열로 파싱된 `l.activities`를 내려주고, 교사 대시보드용
  `mode=curriculumAdmin` 응답은 원본 JSON 문자열 `activitiesRaw`와 `activitiesCount`, `sequential`을
  같이 내려준다 — `dashEditLesson()`이 `activitiesRaw`를 파싱해 폼을 채우고,
  `clLessonItemHtml()`이 목록 배지("활동 2개 · 🔒 순차")를 그린다. 학생 화면에서는
  `renderLessonCard()`/`renderActivityBlock()`이 활동별 블록을 나열하고,
  `l.sequential`이 켜져 있으면 앞 활동을 `doneIds`에 넣기 전까지 다음 활동을 잠근다(`locked` 계산).
  **⚠️ 차시 "완료" 판정은 항상 그 차시의 모든 activities id가 `doneIds`에 들어있어야
  성립하는 AND 조건**이며, 학생 쪽 `lessonDone()`과 교사 대시보드 쪽
  `lessonAllActivityIds_()`가 각자 같은 기준을 별도 구현한다 — 진행률·완료 뱃지·포인트
  로직을 고칠 땐 이 AND 조건이 두 곳 모두에서 깨지지 않는지 확인할 것.
- `config.js` — `window.PORTAL_CONFIG`. `RANKS`는 `{ 2: [...], 3: [...] }` 형태의 **학년별 8단계** 배열
  (2학년 30차시·3학년 15차시로 진도량이 달라 문턱을 분리) — `renderPortal()`이
  `CONFIG.RANKS[SESSION.grade]`로 골라 쓰고, 없으면 2학년 배열로 폴백한다. 탐구 나무도 8단계로 RANK와
  1:1 매칭된다. **`CURRICULUM`은 여기서 비워둔 채로 두고 페이지 로딩 시 `mode=curriculum` API 응답으로
  채워진다** — 커리큘럼의 실제 소스는 이 파일이 아니라 Google Sheets이며, 교사 대시보드 "커리큘럼 관리"
  탭에서 편집한다. `BAN_SIZE`는 현재 2학년 1~4반과 3학년 5~8반에만 실제 인원수가 채워져 있다(숫자가 채워진
  반이 실제 수업을 맡은 반) — 담당 반이 바뀌면 이 표도 함께 갱신해야 체크인 탭의 "OO명 중 XX명 완료" 분모가
  정확해진다.
- `checkin_data.js` — `CHECKIN_CONFIG`. 감정 온도 척도·기본 단어칩 등 정적 UI 설정만 담는다. 문항 자체
  (`CHECKIN_PLAN`)는 Google Sheets("체크인문항" 탭)에서 관리되며 `mode=checkinPlan` API로 채워진다.
- `style.css` — 상단 `:root`에 디자인 토큰(색상 `--paper`/`--ink`/`--indigo`/`--seal`, spacing/font-size
  스케일, `--tap-min: 44px`)을 정의한다. 시맨틱 색상 토큰(amber/jade/indigo-bg 등)과 border-radius 4단계
  스케일이 있고, 카드 성격 선택자(`.side-card`/`.kpi`/`.question-card` 등)는 공통 베이스 규칙 하나를
  공유한다. **⚠️ 이 베이스가 소스상 개별 규칙보다 앞에 있어야 `border-left` 같은 override가 정상 동작한다**
  — 새 카드류 UI를 추가할 땐 이 공통 베이스를 재사용할 것.
- **백엔드는 이 저장소에 없다.** `config.js`의 `WEBAPP_URL`이 가리키는 Google Apps Script 웹앱이 API 역할을
  하며, 데이터 저장소는 Google Sheets다. 프론트엔드는 `?mode=...` 쿼리 파라미터(GET, 조회용)와
  `{ action: '...' }` JSON body(POST, 변경용) 두 가지 방식으로 통신한다. 교사 쓰기 작업은 대부분
  `token: TOKEN`을 함께 보내 인증한다. 백엔드 소스는 `hyonnie-t/history26_backend` 레포(`code.gs` +
  `ai_module_v9.3.gs`)에 있다 — 이 저장소만 봐서는 `?mode=`/`action=`이 실제로 뭘 하는지 알 수 없고,
  백엔드 로직을 고치거나 새 action을 추가하는 작업은 그 레포에서 해야 한다.
- **검증 메타데이터와 학생 화면 분리 원칙**: `sourceId`, `verified`, "원문 대조 전", "교사 검수 전",
  "미확인", "[2차]" 같은 라벨은 작업 중 사실 확인 여부를 추적하는 내부 장치일 뿐이다. 학생이 보는 화면
  렌더링 코드(HTML/JS 문자열)에는 배지든 토글 라벨이든 괄호 메모든 어떤 형태로도 넣지 않는다 — 검증
  상태를 보여줄 곳은 핸드오프 문서·README·커밋 메시지뿐이며, 화면 코드 안에 이 상태를 조건문으로
  노출하는 구조 자체를 만들지 않는다. `verified:false`인 내용은 (a) 검증 후 반영 (b) 검증 전까지 교과서
  수준 대체 서술로 대체 (c) 아예 뺀다 — 셋 중 하나로만 처리하고, "이 내용은 아직 확인 못 했어" 같은
  미검증 고지 문장을 학생에게 노출하지 않는다. "사료와 해석을 분리해서 제공한다"는 원칙은 라벨을
  붙이라는 뜻이 아니라 화면 구성(카드 순서·카드 분리)으로 분리하라는 뜻이다 — "이건 해석이야, 사실과
  구분해서 읽자" 식으로 학생에게 직접 설명하는 문장은 역할극 프레임을 깨므로 넣지 않는다. 작업 순서는
  (1) 콘텐츠·검증 확정 → (2) 검증 상태 정리는 핸드오프 문서 안에서 완료 → (3) 화면 코드는 검증 플래그를
  아예 참조하지 않는다 — 화면 코드에서 검증 플래그를 읽어와 조건부로 뭔가 보여주는 함수를 만드는 순간이
  이 원칙 위반 신호다. **완료 기준**: 학생 화면에 렌더링되는 모든 문자열을 대상으로 "검수", "대조",
  "미확인", "2차", "확인 전" 문자열이 0건이어야 한다(grep으로 확인).
- **기능 노트 색인 — 상세는 `docs/features.md`(해당 기능을 고칠 때만 읽는다)**. 기능마다 `## 제목`이 있고
  `grep -n "^## " docs/features.md`로 목록을 본다. 제목: 발표 탐구포인트 / 학급 공통 피드백 & 피드백 알림 /
  학생 포털 레이아웃 / 복습용 클래스카드 / 포트폴리오·클래스카드 링크의 스킴 보정 / 공지 대상 3분류 ·
  질문함 담당 반 필터링 / 역사법정 → re_judge 자동 등록 / 고민리스트 자원 카드 보너스 / 체크인 문항 자료 /
  체크인 문항 관리 폼 / 성적조회 / 개별 수업 웹앱 / AI 작성 의심 경고 / 평소 대비 / 교차 확인 / 작성 과정 신호 /
  어휘 풀이 / 교사↔학생 개인 메시지 / UI 통일 레이어 / 연표 접기 · 그 밖의 기록 카드 / 학생 화면 미리보기 /
  나무 일러스트 / 커리큘럼 관리 폼 / 출석 도장 + 오늘의 기분.
- **기능과 상관없이 늘 지킬 함정 (상세는 위 문서)**:
  - 새 쓰기·읽음 처리 코드엔 반드시 `PREVIEW_MODE` 가드를 넣는다(안 그러면 교사 미리보기만 해도 학생 데이터가 바뀐다).
  - 새 버튼은 `.btn`/`.btn-sm`/`.btn-ghost`, 새 카드는 공통 베이스를 쓴다. `style.css` 맨 끝 "v63 UI 통일 레이어"를 파일 중간으로 옮기지 않는다.
  - `.side-card`의 sticky↔static 전환 조건과 `.side-combined` 높이 제한 조건은 정확히 같은 조건으로 맞춘다.
  - AI 작성 의심·평소 대비·교차 확인·이탈/붙여넣기 신호는 학생 화면에 절대 노출하지 않고, 의심도 등급·🔍 반복 횟수·Gemini 프롬프트에 서로 섞지 않는다.
  - 학급 공통 피드백의 "오개념"은 교사 전용이다(학생 화면으로 내려가면 안 됨).
  - `grantPresentationPoint`의 `reason` 문자열(`GONGMIN_BONUS_REASON` 등)을 다른 용도로 재사용하지 않는다(중복 지급 판별이 오작동).
  - 성적조회는 `login()`을 건드리지 않고, 매칭 실패 사유(학번/이름/비밀번호 중 무엇이 틀렸는지)를 구분해 보여주지 않는다.
  - 체크인 문항 폼은 선택된 학년 탭(`CKQ_GRADE`)으로 저장된다. 옛 문항의 회수질문·재확인 값은 저장하면 교사 메모로 합쳐져 되돌릴 수 없다.
- **개별 수업 웹앱**(`crusades`, `his_judge_goryeo` 등)은 이 저장소 밖 각자의 레포에 있고 `webapp-builder` 스킬을 반드시 따른다. 핵심: ①`CONFIG.SHEET_WEBAPP_URL` 하드코딩(옮겨 적은 URL은 grep/diff로 원본과 대조) ②`?sid=&name=`·`?preview=1` 지원 ③빌드 단계(번들러·프레임워크·TypeScript) 금지, plain HTML/CSS/JS ④배포는 "새 배포"가 아니라 "배포 관리 > 수정 > 새 버전"만(새 배포는 URL이 바뀌어 연결이 깨진다) ⑤서술형엔 `snippets/focus_guard.js`, 학생 화면 낱말엔 `snippets/glossary.js`·`vocab_check.mjs`. 전체 규칙은 `docs/features.md`의 "개별 수업 웹앱".

## 외부 연동 — SEL(사회정서역량) 특성 보기

교사 대시보드의 학생 상세 카드에 있는 "🧭 SEL 특성 보기" 버튼은 이 저장소의 `WEBAPP_URL`과 무관한
**완전히 별도의 Apps Script 웹앱**을 새 팝업 창으로 여는 딥링크일 뿐이다. `SEL_APP_URL`
상수에 그 웹앱 주소가 하드코딩돼 있고, `openSelPopup(sid)`가
학번(`sid`) 하나만 쿼리 파라미터로 실어 팝업을 띄운다. 그 팝업 안의 화면·데이터·계산 로직은 전부 그
외부 프로젝트(`sel_backend_v1.gs`) 책임이며, 이 저장소 코드에는 포함돼 있지 않다.

## 개발 워크플로우

- 빌드 도구, 패키지 매니저, 린터, 테스트 러너가 없다. `npm install`/`build`/`test` 같은 커맨드는 존재하지
  않는다.
- **브라우저 확인은 `tests/webapp-testing/`에 있다.** 러너는 아니고 Playwright 스크립트 모음이다
  (`fixtures.py`=가짜 서버 응답, `_pw_helpers.py`=브라우저 실행, `test_*.py`=`[PASS]`/`[FAIL]` 출력 스모크,
  사용법은 같은 폴더 `README.md`). 화면만 보고 싶으면 `python3 -m http.server 8765 &` 뒤
  `node tests/webapp-testing/shot.js http://localhost:8765/index.html <출력폴더> <접두어>`가 폰 360·태블릿
  820·PC 1280 세 폭으로 찍고 콘솔 오류를 알려준다(playwright 모듈 경로는 스크립트가 알아서 찾는다 —
  세션마다 경로를 새로 찾지 말 것). 새 화면은 이 세 폭으로 확인하는 게 v63 이후 기준이다.
- **샌드박스에서 `script.google.com`(Apps Script)·`*.github.io`·`cdn.jsdelivr.net`은 접속이 막혀 있다**
  (프록시가 CONNECT를 거부). 배포 확인·실제 응답 확인은 `curl`로 시도하지 말고 효니에게 URL을 열어 결과를
  붙여 달라고 요청할 것. 백엔드 응답은 `fixtures.py`처럼 가짜 응답으로 시험한다.
- 로컬 확인은 `index.html`을 정적 파일 서버로 열면 된다 (예: `python3 -m http.server`). `file://`로 직접
  열면 `config.js`/`checkin_data.js` 로드나 `fetch` 동작이 브라우저 정책상 막힐 수 있으니 반드시 로컬 서버를
  거친다.
- 실제 데이터 흐름(로그인, 체크인, 대시보드 조회/수정)을 확인하려면 `config.js`의 `WEBAPP_URL`이 가리키는
  실제 Apps Script 웹앱에 네트워크로 접근 가능해야 한다. 이 저장소만으로는 백엔드 로직을 재현/수정할 수
  없다.
- 배포는 이 정적 파일들을 그대로 호스팅(GitHub Pages 등)하는 방식으로 보인다. 별도의 CI 워크플로우
  (`.github/workflows`)는 없다.
- **`index.html`은 5천 줄이 넘는 단일 파일이다.** 통째로 Read하면 그 내용이 대화에 계속 남아 이후 모든
  턴에서 다시 처리된다 — 먼저 Grep으로 관련 함수/구분선 주석 위치를 찾고, 필요한 라인 범위만 Read할 것.
  이 CLAUDE.md는 줄번호 대신 함수·id 이름만 적는다(줄번호는 편집마다 밀려서 틀려진다) —
  `grep -n "^function 이름" index.html`로 찾고 새로 쓸 때도 줄번호를 적지 말 것.

## 코드 컨벤션 / 알아둘 점

- 모든 UI 텍스트와 주석은 한국어. 커밋 메시지도 한국어가 관례다.
- 코드 곳곳의 주석에 `v12`, `v17`, `v22`... 처럼 버전 표기가 붙어 있고, 그 버전에서 왜 그렇게 바꿨는지를
  짧게 설명하는 스타일이다. 전체 버전 목록과 각 버전의 배경은 [`CHANGELOG.md`](./CHANGELOG.md) 참고 —
  새 버전 번호를 붙이기 전에 이미 쓰인 번호인지 먼저 거기서 확인할 것(여러 기능이 같은 번호를 먼저
  붙였다가 충돌을 발견해 재번호한 이력이 있음).
- 네트워크 호출은 `fetch`를 직접 쓰는 곳과 `fetchJsonRetry_()`(재시도 헬퍼, 기본 3회·700ms 간격)를 쓰는
  곳이 섞여 있다. Apps Script 재배포 직후 일시적 404/JSON 파싱 실패를 흡수하기 위한 것이므로, 대시보드처럼
  `Promise.all`로 여러 요청을 한 번에 묶는 곳은 특히 `fetchJsonRetry_`를 쓰는 편이 안전하다(하나만 실패해도
  전체가 reject되는 문제를 피함).
- 학생 로그인 세션은 `localStorage`(`store.get/set/del`, 키 `portal_session`)에 `{ sid, name }`만 저장해
  자동 로그인에 쓴다. 교사 토큰(`TOKEN`)은 기본적으로 저장하지 않고 메모리 변수로만 유지된다. 로그인 폼의 "이 기기에서 로그인 유지"(`#tokenRemember`)를 켠 경우에만 `localStorage` 키 `dash_token_saved`에 저장한다(v67, 옛 키 `dash_token`은 부팅 때 삭제)(`PREVIEW_MODE`도
  동일하게 메모리 상태).
- 학번은 `학년(1자리) + 반(2자리) + 번호(2자리)` 5자리 문자열로, `parseStudentId()`가 파싱 규칙의
  단일 소스다. 학번 관련 로직을 추가할 때 이 함수를 재사용할 것.
- 교사용 "학생 화면 미리보기"(`PREVIEW_MODE`)는 실제 서버 기록을 만들지 않고 화면만 보여주는 모드이므로,
  포털 관련 함수를 수정할 때 이 플래그로 실제 API 호출/기록 여부가 분기되는 지점이 있는지 확인해야 한다.
- `config.js`의 `POINTS_PER_LESSON`은 **현재 사용되지 않는 죽은 값**이다. 실제 포인트 지급은
  `renderPortal()` 안의 `const P = CONFIG.POINTS || { FIRST: 10, RETRY: 5, RETRY_MAX: 2 }`에서
  활동 단위로 계산한다 — 첫 완료 시 `FIRST`점, 이후 재도전마다 활동당
  `RETRY_MAX`회까지 `RETRY`점씩 추가. `CONFIG.POINTS`는 `config.js`에도 `mode=curriculum` 응답에도
  없으므로 항상 이 기본값(10/5/2)이 쓰인다. 포인트 배점을 바꾸려면 `config.js`에
  `POINTS: { FIRST, RETRY, RETRY_MAX }` 객체를 추가하거나 이 기본값 리터럴을 직접 고쳐야 한다.
- "칭호"라는 말은 서로 다른 두 시스템을 가리킨다. (1) `config.js`의 `RANKS`(포인트 누적 → 권지 사관/가주서/
  주서/사관/겸춘추/편수관/직제학/대제학 8단계, 학년별 문턱 분리) — 순수 프론트 로직으로, `renderPortal()`이
  `CONFIG.RANKS[SESSION.grade]`와 점수를 비교해서 계산한다. (2) "칭호첩" 배지 시스템(`.badge-card`)
  — `learning`/`behavior`/`strength` 3개 카테고리, `once`/`repeat` 2가지 획득
  타입의 배지를 `renderBadges()`/`renderBadgeChip()`이 그리고, `checkNewBadges()`가
  로컬스토리지 기준선과 비교해 신규 획득만 토스트로 알린다. **이 저장소는
  프론트엔드 렌더링·신규 획득 알림까지만 구현돼 있다.** 실제 배지 획득 판정(`computeBadges_`)은
  `hyonnie-t/history26_backend`의 `code.gs`가 `mode=student` 응답의 `STUDENT_DATA.badges` 필드로
  계산해서 내려주는 값이며, 교사 미리보기 모드(`PREVIEW_MODE`)에서는 이 필드 자체가 없으므로 두 함수
  모두 빈 값을 방어적으로 처리한다. 배지 관련 작업은 프론트(이 저장소)만 봐서는 절반만 보인다 —
  `history26_backend`도 같이 열어야 함.
- AI 코멘트 기능(`aiReview`/`aiEdit` action)은 교사 대시보드에서 학생 기록에 대한 AI 생성 코멘트를
  검토/수정/숨김 처리하는 기능이며, 이 저장소는 그 코멘트 생성 로직이 아니라 검토 UI만 갖고 있다(생성은
  Apps Script 백엔드 쪽 책임). 이 저장소 코드 전체를 검색해도 손글씨 사진 → 키워드 제안 같은 이미지/
  Vision 기반 워크플로우는 없다 — 현재 프론트에 존재하는 건 텍스트 코멘트를 검토(`aiReview`)/수정
  (`aiEdit`)하는 두 action뿐이다.
