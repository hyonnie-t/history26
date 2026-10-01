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
  - `<script>` 블록(469번째 줄부터, `initPortal()` IIFE로 부팅)이 전체 로직을 담고 있으며 파일 내 주석
    구분선(`/* ══...`, `/* ──...`)이 섹션 경계 역할을 한다. 새 기능을 찾을 땐 이 구분선 주석을 먼저 훑을 것.
- **차시-활동 구조**: 커리큘럼 시트의 한 차시(행)에는 활동을 2개까지 담을 수 있다. 학생용
  `mode=curriculum` 응답은 배열로 파싱된 `l.activities`를 내려주고, 교사 대시보드용
  `mode=curriculumAdmin` 응답은 원본 JSON 문자열 `activitiesRaw`와 `activitiesCount`, `sequential`을
  같이 내려준다 — `dashEditLesson()`(`index.html:2416` 부근)이 `activitiesRaw`를 파싱해 폼을 채우고,
  `clLessonItemHtml()`(`index.html:2199`)이 목록 배지("활동 2개 · 🔒 순차")를 그린다. 학생 화면에서는
  `renderLessonCard()`/`renderActivityBlock()`(`index.html:1113`, `1161`)이 활동별 블록을 나열하고,
  `l.sequential`이 켜져 있으면 앞 활동을 `doneIds`에 넣기 전까지 다음 활동을 잠근다(`locked` 계산,
  `index.html:1125`). **⚠️ 차시 "완료" 판정은 항상 그 차시의 모든 activities id가 `doneIds`에 들어있어야
  성립하는 AND 조건**이며, 학생 쪽 `lessonDone()`(`index.html:955`)과 교사 대시보드 쪽
  `lessonAllActivityIds_()`(`index.html:2740`)가 각자 같은 기준을 별도 구현한다 — 진행률·완료 뱃지·포인트
  로직을 고칠 땐 이 AND 조건이 두 곳 모두에서 깨지지 않는지 확인할 것.
- **발표 탐구포인트**: 발표처럼 웹앱 밖에서 일어나는 활동에 포인트를 즉시 지급하는 통로. 교사가 학생 상세
  카드(`.pp-box`) 또는 "탐구포인트" 탭(`dashPointBoxHtml_()`, `index.html:3455` 부근)에서 사고유형
  (판단/비교/해석/관점, 또는 "유형 없이")과 수준(하/중/상 — `PP_LEVELS`, +4/+6/+9점)을 골라 지급하면
  `grantPresentationPoint` action이 `level`과 함께 호출된다. 학생 화면은 `STUDENT_DATA.presentationGrants`를
  커리큘럼 순회와 별도로 합산한다(`index.html:1113` 부근, `Number(g.points) || 6` 폴백). **서버가 `level`을
  실제로 반영해 배포됐는지는 `history26_backend`의 CLAUDE.md 배포 상태를 확인할 것** — 배포 전이면 항상
  +6점·achievement='상'으로 고정 동작한다. ⚠️ '하'/'중'으로 지급한 발표는 학습 칭호(결정왕 등) 집계 대상에서
  빠진다(백엔드가 achievement==='상'인 것만 집계) — 포인트는 그대로 들어간다.
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
- **학급 공통 피드백 & 피드백 알림**: 교사 대시보드 "학생 기록" 탭에서 학년+반+활동(하나)을 모두 골랐을
  때만 `#classFbBox`가 나타나(`dashRenderClassFeedback()`, `index.html:3467` 부근) 그 범위 학생 글을
  모아 AI로 "교사용 리포트"·"학생 공지용 문구"·"대표적인 오개념"을 생성한다(`generateClassFeedback` action,
  조회는 `mode=classFeedback`). 학생 공지용 문구는 자동으로 학생 포털 활동 완료 카드에도 표시되고,
  **오개념은 교사 전용**이라 학생 화면엔 절대 안 내려간다. 반은 숫자 하나 또는 **"내 담당 반"**
  (`selBan==='mine'`) — `dashClassFeedbackBanParam_()`이 `dashMyBans_()` 결과를 콤마 문자열("5,6,7,8")로
  풀어서 서버에 보낸다. **'전체 반' 옵션은 지원하지 않는다** — 효니가 "학급 단위" 밖의 범위를 원하지 않음.
  학생 쪽은 개인 AI 코멘트·학급 공통 피드백을 합쳐 최신순으로 보여주는 "피드백 모아보기" 카드와 도착 1회
  알림 팝업이 있고, 확인 여부는 `ackFeedback` action으로 서버에 남긴다. 모아보기 각 항목의 "이 피드백에
  대해 질문하기" 버튼(`askAboutFeedback_()`)은 질문함 입력창에 피드백을 인용구로 채워주는 **순수 프론트
  UX 연결**일 뿐 — 백엔드에 피드백과 질문을 실제로 연결하는 참조 필드는 없다.
- **학생 포털 레이아웃**: `#portalView`는 사이드카드(나무·칭호첩) → 공지 → KPI → 단원질문 →
  **`#quickTabsCard`(질문하기·나의 달성도·기록 보관함 탭)** → **학습 연표(실제 차시 목록)** 순으로 오고,
  `.section-divider`("📎 그 밖의 기록") 아래에는 **`#refTabsCard`(패들렛·클래스카드 탭)** · 성적조회 ·
  피드백 모아보기만 참고용으로 몰려 있다. v42는 질문함·달성도·보관함까지 전부 "그 밖의 기록" 아래로
  보냈었는데, v57에서 자주 쓰는 기능이라는 효니 피드백으로 그 셋만 다시 상단으로 옮기되 세 카드를
  그대로 쌓지 않고 `.tab-card`(`switchQuickTab()`)로 묶어 카드 하나 높이만 차지하게 압축했다 — 학습
  연표는 v42 취지(실제로 매번 할 일) 그대로 탭 밖에 남아 있다. `.tab-card`/`.tab-nav`/`.tab-btn`/
  `.tab-panel`은 카드 하나를 탭 여러 개로 나눌 때 쓰는 공용 컴포넌트로, `#refTabsCard`(`switchRefTab()`)도
  같은 컴포넌트를 재사용한다 — 패들렛·클래스카드 둘 다 데이터가 없으면 카드째 숨고, 하나만 있으면 탭
  내비게이션 자체를 숨긴 채 그 패널만 보여준다(`renderPortal()`의 `pfHas`/`ccHas` 분기). "나의 달성도"
  탭은 `achieveMap`의 `rec.timestamp` 기준 최근순 3개만 기본 노출하고 나머지는 `#overviewMoreBtn`
  (`toggleOverviewMore()`)으로 펼친다 — 렌더마다 접힌 상태로 초기화된다. `renderPortal()`은 `$('id')`
  참조라 마크업 순서와 무관하게 동작한다. 세로모드에서 `.layout`이 2단→1단으로 붕괴하는 기준은
  **폭이 아니라 orientation**
  (`@media (max-width:1024px) and (orientation:portrait), (max-width:640px) and (orientation:landscape)`,
  `style.css:304` 부근)이다 — 그 외 가로모드는 폭이 좁아도 좌(서재)/우(본문) 2단을 유지한다. **⚠️ `.side-card`의
  sticky↔static 전환 조건(`style.css:326` 부근)과 `.side-combined` 내부 스크롤 높이 제한 조건
  (`style.css:344` 부근)은 정확히 같은 조건으로 맞춰야 한다** — 하나만 바꾸면 sticky는 걸리는데 높이
  제한이 안 걸려 카드가 뷰포트를 넘어가는 등 어긋난다. 사이드카드(나무·칭호첩) 높이는
  `layoutSideCard_()`(`renderBadges()` 뒤에 정의)가 `renderPortal()` 끝·`resize`/`orientationchange`
  시점에 `.side-combined`의 실제 `getBoundingClientRect().top`을 재서 `window.innerHeight - top - 16`을
  인라인 `style.maxHeight`로 넣는 방식이다(CSS의 vh 고정값이 아님). **⚠️ 이 값은 절대 뷰포트 여유보다 크게
  잡으면 안 된다** — sticky는 "고정"되면 카드 전체가 뷰포트 기준으로 안 움직여서, 뷰포트보다 큰 부분은
  페이지를 아무리 스크롤해도 화면에 안 들어온다. 칭호첩 스크롤 영역이 실제로 넘칠 때만
  (`scrollHeight - clientHeight > 4`) `#badgeGroups`에 `.has-more` 클래스가 붙어 아래쪽에 페이드가 뜬다.
- **복습용 클래스카드**: `#portfolioCard`(패들렛 포트폴리오)와 같은 구조로 `#classcardCard`가 있다.
  `cur.classcard`(`{title, desc, url}` 또는 반별로 다르면 `urlByBan`)가 있고 그 반의 URL이 비어있지
  않을 때만 렌더링되며(`renderPortal()`, `index.html:1219` 부근), 없으면 조용히 숨는다. 값(제목·설명·
  초대코드 안내 문구·링크)은 교사 대시보드 "커리큘럼 관리 > 학년정보" 탭(`gi-cc-title`/`gi-cc-desc`/
  `gi-cc-url`, `dashSaveGradeInfo()`)에서 학년별로 저장하며, 포트폴리오와 같은 `action=updateGradeInfo`
  하나로 같이 저장된다. 서버 쪽 필드 배포 상태는 `history26_backend` CLAUDE.md 참고.
- **포트폴리오·클래스카드 링크의 스킴 보정**: `renderPortal()`이 href를 세팅할 때 `ensureUrlScheme_()`
  (`lessonActivityUrl()` 바로 앞)를 거쳐 스킴이 없으면 `https://`를 붙인다 — 스킴 없이(`www.example.com`)
  저장된 값이 `<a href>`에 그대로 들어가면 브라우저가 상대경로로 오해석하는 문제를 막기 위함.
- **공지 대상 3분류 / 질문함 담당 반 필터링**: 공지 작성 시 대상을 "담당 학급반"(`dashMyBans_()`가 콤마
  리스트로 반환)/"전체"/"개별 반" 3분류 라디오로 고르며, "담당 학급반"으로 게시하면 `ban` 필드에
  `"5,6,7,8"`처럼 콤마 리스트가 저장된다(서버 `parseBanListField_()`가 풀어서 매칭 — 콤마 없는 기존
  단일 반/전체 공지와 하위 호환). 질문함 목록도 로그인한 교사가 담당하지 않는 반의 질문은 아예 제외한다.
- **역사법정 → re_judge 자동 등록**: 교사 대시보드 "탐구포인트" 탭 하단 `courtCasePush` 카드에서 3학년
  반을 고르고 버튼을 누르면, `his_judge_goryeo`(`CONFIG.GAME_NAME = "3차시_권문세족_역사법정"`,
  `COURT_CASE_GAME_NAME` 상수로 이 저장소에도 하드코딩돼 있음. 다른 역할극 웹앱이 생기면 같이 늘릴 것)의
  검사/변호인 발언문+배심원 판결을 모아 백엔드가 re_judge(`hyonnie-t/re_judge`, 완전 별도 시스템)에 새
  사건으로 자동 등록해준다(`dashCourtCasePush()`). 실제 취합·호출 로직은 `history26_backend`의
  `courtCasePushPost_` 책임 — 이 저장소는 버튼과 결과 메시지 표시만 담당한다. 서버가 `result:'partial'`을
  돌려주면 사건은 만들어졌지만 진술은 자동으로 안 채워진 상태라는 뜻 — 안내 메시지를 그대로 보여준다.
- **고민리스트 자원 카드 보너스**: 교사 대시보드 "탐구포인트" 탭 맨 아래 `#gmBonusBox` 카드
  (`dashRenderGongminBonus_()`, `index.html:3804` 부근)가 개별 웹앱 `gongmin`
  (`GONGMIN_GAME_NAME = "4차시_공민왕개혁_고민리스트"`)의 2단계 자원 여부를 모아 보여주고 일괄 지급한다.
  `gongmin`은 학생용 웹앱이라 교사 토큰을 심을 수 없어 `choicesJson.volunteer` 플래그만 기록해서 보내고,
  여기서 교사가 확인한 뒤 자원자에게만 지급한다. 이미 로드된 `ROWS`를 gameName으로 걸러 쓰므로 별도 네트워크
  요청은 없다. **새 action은 없다** — 기존 `grantPresentationPoint`를
  `reason: GONGMIN_BONUS_REASON`("고민리스트 2단계 자원 카드 보너스") 고정 문자열로 호출할 뿐이다.
  중복 지급 방지도 `choiceSummary === GONGMIN_BONUS_REASON`인 기존 행 유무로 프론트가 자체 판별한다 —
  **⚠️ 같은 이유 문자열을 다른 용도로 재사용하면 이 dedupe가 오작동한다.**
- **체크인 문항 자료(텍스트/이미지/없음)**: 관리자 폼의 "자료 형식"이 judgment/source_emotion 두 타입
  공통 필드다. judgment는 자료가 선택(비워두면 발문만), source_emotion은 필수. 이미지 선택 시
  `ckqHandleImageFileChange()`가 base64로 읽어 `uploadCheckinImage` action으로 Drive에 저장하고 반환된
  URL을 자동으로 채운다. 학생 화면은 `renderCheckinSourceBoxHtml_()`(`index.html:898` 부근) 하나로
  텍스트/이미지 자료를 공통 렌더링한다. "자료 형식"에 "없음"을 고르면 텍스트/이미지 입력 UI가 (사료 출처
  필드까지) 통째로 숨는다 — `ckqDefaultSourceFormatForType_()`가 유형별 기본값(judgment=없음,
  source_emotion=텍스트)을 정한다.
- **체크인 문항 관리 폼**: 각 필드에 `<label>` + 빨간 `*필수`(`.cl-req`)/회색 `선택`(`.cl-opt`) 태그가
  있다. 기준은 `dashSubmitCheckinLessonForm()`의 검증 로직과 동일 — 학년·차시id·제목·발문은 항상 필수,
  옵션A/B는 judgment일 때만, 사료(텍스트 또는 이미지)는 source_emotion일 때만 필수. 학년 선택은
  `#ckqGradeTabs`(`switchCkqGradeTab_()`, 상태는 모듈 변수 `CKQ_GRADE`) 탭 하나뿐이다 — **v58부터 "새 문항
  추가" 폼 안에 따로 있던 학년 select(`ckqFormGrade`)를 없앴다.** 폼은 항상 지금 선택된 `CKQ_GRADE`로
  저장되며(`ckqCollectFormData()`), 편집 중 탭을 바꾸면 그 학년으로 저장된다는 뜻이라 편집은 항상 그
  탭이 그리고 있는 목록에서 시작하는 게 전제다.
  **v58 — 회수 질문(`recall`)/재확인 체크박스(`verify`)/검증 메모(`verifyNote`) 세 필드를 없애고
  교사 메모(`note`) 하나로 합쳤다.** 셋 다 거의 안 쓰였다는 효니 피드백으로 폼에서 뺐다. 시트 컬럼
  (`CHECKIN_LESSON_HEADERS`의 회수질문/사실검증/검증메모)은 `history26_backend`에 그대로 남아 있고,
  프론트가 그냥 그 필드들을 안 보내면 서버가 빈 값으로 저장할 뿐이라 **백엔드 변경은 필요 없다.**
  기존 문항에 이 값들이 남아있으면 `dashEditCheckinLesson()`이 편집 폼을 열 때 `[재확인 필요]`/
  `[예전 회수 질문]` 접두어를 붙여 교사 메모 앞에 합쳐서 보여준다 — 그대로 두고 저장하면 note 컬럼으로
  옮겨 담기고, 그 뒤로 recall/verify/verifyNote 컬럼은 빈 채로 남는다(한 번 저장하면 되돌릴 수 없음,
  값이 필요하면 저장 전에 확인할 것). 등록된 문항 목록은 진행중(`#ckqActiveList`, 기본 펼침)과 지난
  (`#ckqPastList`, `<details class="cl-past-collapse">`, 기본 접힘) 두 그룹으로 나뉘며, 개별 문항 항목의
  "지난 체크인으로 표시" 버튼(`dashToggleCheckinLessonPast()`)이 `toggleCheckinLessonPast` action을
  호출한다. 서버 배포 상태는 `history26_backend` CLAUDE.md 참고 — 배포 전엔 모든 문항이 항상 진행중
  그룹에만 보이고 토글도 반영되지 않는다.
- **성적조회**: 별도 GAS 스크립트로 있던 "엑셀 성적표 → 학생 개인 조회"를 포털에 통합했다. **포털
  로그인(`login()`)은 무변경** — 학생 포털 "그 밖의 기록" 영역의 `#gradeCard`(포트폴리오와 같은
  `.portfolio-card` 구조, `index.html:189` 부근)에서만 학번+이름(`SESSION`)에 비밀번호까지 3중 매칭을
  추가로 요구한다(`mode=grade`, `openGradeGate()`/`submitGradeLookup()`). 매칭 실패 사유(학번/이름/
  비밀번호 중 뭐가 틀렸는지)는 서버가 이미 통일된 메시지로만 반환하므로 프론트도 그대로 보여줄 뿐 원인을
  구분하지 않는다(무차별 대입 단서 차단). 교사 대시보드 "🧮 성적관리" 탭(`panelGrades`)이 성적 엑셀 업로드
  (`dashUploadGradeExcel()`)와 열람 상태 ON/OFF 토글(`dashSetGradeDisplayStatus()`)을 제공한다.
  **학생별 비밀번호 관리 UI는 없음** — 효니가 "계정" 시트를 구글시트에서 직접 편집한다(핸드오프 확정
  사항). ⚠️ 매칭키가 원본의 "반+번호"가 아니라 history26 5자리 학번이라, 업로드하는 성적 엑셀의 학번
  열도 5자리 형식이어야 조회된다. 서버 쪽(`계정` 시트, `mode=grade`/`gradeStatus`,
  `action=uploadGradeExcel`/`setGradeDisplayStatus`) 배포 상태는 `history26_backend` CLAUDE.md 참고.
- **백엔드는 이 저장소에 없다.** `config.js`의 `WEBAPP_URL`이 가리키는 Google Apps Script 웹앱이 API 역할을
  하며, 데이터 저장소는 Google Sheets다. 프론트엔드는 `?mode=...` 쿼리 파라미터(GET, 조회용)와
  `{ action: '...' }` JSON body(POST, 변경용) 두 가지 방식으로 통신한다. 교사 쓰기 작업은 대부분
  `token: TOKEN`을 함께 보내 인증한다. 백엔드 소스는 `hyonnie-t/history26_backend` 레포(`code.gs` +
  `ai_module_v9.3.gs`)에 있다 — 이 저장소만 봐서는 `?mode=`/`action=`이 실제로 뭘 하는지 알 수 없고,
  백엔드 로직을 고치거나 새 action을 추가하는 작업은 그 레포에서 해야 한다.
- **개별 수업 웹앱은 이 저장소 밖에서 각자 따로 만들어진다.** `crusades`(십자군, 화면 하나짜리 판단형
  서술), `his_judge_goryeo`(3차시 역사법정, 검사/변호인/배심원 역할극) 등 — 전부 자기 레포에 단일
  `index.html`로 존재하고, `CONFIG.SHEET_WEBAPP_URL`로 같은 `history26_backend`를 직접 호출한다(대부분
  새 action 없이 기존 gameName 제출 경로만 씀). 이 저장소의 커리큘럼 관리 탭에서 activity id로 등록해야
  포털 진행률·포인트 계산에 잡힌다. 디자인 기준선("역사책 페이지" 컨셉)은 hyonnie.md 참고. **새로 만들거나
  수정할 땐 `webapp-builder` 스킬을 반드시 따른다.** 모든 웹앱에 기본으로 들어가야 하는 필수 요소는
  ① `CONFIG.SHEET_WEBAPP_URL` 하드코딩, ② `?sid=&name=` URL 파라미터 자동채움(5자리 학번), ③ `?preview=1`
  미리보기 모드(자동채움 + 시트 저장 없이 동작), ④ 서술형 입력엔 정답 아닌 맥락 단서만 주는 힌트 토글, ⑥ **작성 과정 신호** — `snippets/focus_guard.js`를 넣고 최종 제출 body에 `Object.assign(body, FocusGuard.payload())`로 이탈·붙여넣기 값을 같이 보낸다(서술형 활동에 한함, 상세는 아래 "작성 과정 신호" 항목)이다.
  코드 작성·수정 뒤엔 반복 실수 체크리스트 세 가지를 반드시 재확인한다 — (a) URL/스프레드시트 ID 등을
  옮겨 적을 때 육안 확인 말고 grep/diff로 원본과 대조(조용한 전송 실패의 주 원인이었음), (b) IIFE로
  즉시 실행하는 코드는 TDZ 에러가 안 나게 함수 선언을 먼저 끝내고 `init()` 같은 실행 호출은 파일 맨
  마지막에 두기, (c) 드래그 기반 인터랙션(카드 나열·순서 재배열)엔 항상 화살표 버튼(▲▼) 같은 태블릿
  대체 수단을 같이 넣기. **⑤ 빌드 단계가 필요한 구조로 만들지 않는다** — webpack/vite 같은 번들러,
  React 같은 프레임워크, TypeScript 컴파일 단계를 쓰지 않고 `<script>` 태그로 직접 불러오는 plain
  HTML/CSS/JS만 쓴다. `index.html`(뼈대) + `config.js`(설정) + `data.js`(콘텐츠) + `app.js`(렌더링) +
  `style.css`(스타일)처럼 관심사별로 파일을 나누는 건 괜찮다 — **파일을 여러 개로 나누는 것과 빌드
  단계를 도입하는 건 다른 문제**, 금지 대상은 후자다(이 포털 자체도 `index.html`+`config.js`+
  `checkin_data.js`+`style.css`로 나눠져 있음). **기본 구성은 `index.html`+`style.css`+`data.js`(콘텐츠)+
  `app.js`(로직) 4파일이다** — 나누면 수정할 때 필요한 파일만 읽으면 돼서 유지보수 토큰이 줄지만
  (단일 `index.html`은 어떤 수정이든 통째로 읽어야 함), 파일마다 연결·헤더 주석 같은 이음새 비용이
  들어서 그 이상은 필요할 때만 늘린다. `config.js`는 URL·상수 몇 줄뿐이면 `app.js` 상단 `CONFIG`로
  합쳐도 된다. 순수 로직 분리(`logic.js`)와 단위 테스트는 판정·계산 로직이 있는 앱(예: 점수·유형 판정)
  에만 넣고 단순 서술형 앱엔 넣지 않는다. 배포 전 점검 스크립트(`verify.mjs`)와 긴 README도 필요할
  때만 만든다(붕당 분화 앱 `Joseon-Bungdang`이 이 부가 파일들을 전부 넣은 사례). 버전이 올라가면서 기존 웹앱들이 써온 plain
  HTML/CSS/JS 구조가 임의로 틀어지는 게 반복적으로 문제가 됐다 — 기존 웹앱(`crusades`,
  `his_judge_goryeo` 등)도 같은 구조인지는 미확인이니, 수정할 땐 그 레포의 기존 파일 구성을 먼저
  확인하고 거기 맞출 것. 배포는 절대 "새 배포"가
  아니라 "배포 관리 > 수정 > 새 버전"으로만 한다(새 배포는 URL이 바뀌어 포털 연결이 깨짐). 자세한 내용은
  스킬 파일 참고.
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

- **AI 작성 의심 경고**: 교사 대시보드 "학생 기록" 탭 상단 `#suspectBox`(`dashRenderSuspectBox_()`)가
  백엔드가 행마다 채우는 `AI작성의심도`(중간/높음)를 학생별·활동별(최신 등급 행 기준)로 누적해
  `SUSPECT_REPEAT_MIN`(2)회 이상 걸린 학생을 강조하고 1회는 접어 보여준다. 학생 표 `🔍×N` 칩과 행 단위
  "🔍 확인 요청" 배지(상세 카드)는 같은 필드를 쓴다. 참고용 판정이며 학생 화면엔 절대 노출 금지. **v65 — 검토 표시**: 상세 카드의
  "확인함(문제없음)/상담함" 버튼(`dashReviewSuspect()`)이 `action=reviewSuspect`로 게임활동_로그 23열 `의심검토`에 저장하고
  `dashSuspectReview_(r)`가 읽는다(서버 성공 응답이 있어야만 화면 상태 변경 — 백엔드 v35 재배포 전엔 저장 실패 토스트). **⚠️ 검토
  표시는 반복 횟수(`items.length`)에 영향을 주면 안 된다** — 효니 확정: 오탐도 횟수에 남겨 반복을 놓치지 않게 한다. 검토는 박스에서 "확인
  필요"와 "확인 완료"를 나누고 칩에 ✓를 붙일 뿐이다.

- **작성 과정 신호 (v68)**: AI 의심도(글 판정)와 별개로, 수업 웹앱이 최종 제출 때 `focusLeaveCount`(웹앱 안에서 화면을 벗어난
  횟수)/`focusLeaveSec`/`pasteChars`를 보내면 백엔드가 게임활동_로그 24~26열에 쌓고 `teacherGet_`이 그대로 내려준다. 대시보드는
  `dashFocusSignal_()`로 상세 카드에 집계만 표시한다(`FOCUS_LEAVE_WARN`/`FOCUS_PASTE_WARN` 넘을 때만 배지, 알림 없음). 학생에겐
  돌아왔을 때 "이탈 기록은 선생님이 볼 수 있어요" 배너로 **숨기지 않고** 알린다. **⚠️ 이 값을 Gemini 프롬프트(의심도)에 섞지 않는다** —
  두 신호를 따로 둬야 근거가 흐려지지 않는다. 참고 구현은 `snippets/focus_guard.js`(헤드리스 Chromium으로 이탈 카운트·1초 미만
  무시·`exempt()`·새로고침 유지·붙여넣기 합산 확인함). 폰·다른 기기·분할 화면은 못 잡으므로 단독 증거로 쓰지 말 것. 백엔드 v37
  배포 전엔 24~26열이 안 생겨 대시보드에 표시가 안 나온다(오류는 없음). 기존 웹앱엔 소급 적용 안 함.

- **교사↔학생 개인 메시지 (v62)**: 교사가 먼저 시작하는 1:1 스레드. 질문함(학생이 먼저 물음, 질문 1+답변
  1 구조)과 **별개 시트**(백엔드 `개인메시지`)라 질문함·질문왕 배지 집계엔 영향이 없다. 학생 포털은
  `STUDENT_DATA.messages`(`mode=student` 응답)로 `#qtabMessage` 탭·`renderMessages()`·도착 팝업
  (`checkNewMessages_()`)을 그리고, 스레드가 비어 있으면 탭 버튼 자체가 숨는다(미리보기 모드도 같음).
  **읽음 처리는 팝업이 아니라 탭을 여는 순간**(`switchQuickTab('message')` → `ackMessages_()`)이다.
  교사 쪽은 `MESSAGES`(`mode=messagesAdmin`)를 `dashRenderMessages_()`(질문함 탭 위 목록)과
  `dashMsgThreadHtml_()`(학생 상세 카드 안 위젯, 새 스레드는 여기서만 시작)가 그린다. "답장 대기"는 스레드의
  마지막 메시지가 학생 것인지로 판정하고 질문함 탭 배지에 합산한다. 학생 답장은 교사가 먼저 보낸 스레드에만
  서버가 허용한다. **⚠️ 백엔드 재배포 전엔 `messagesAdmin` 실패를 빈 목록으로 흡수하므로 대시보드는 정상이고
  메시지 보내기만 실패한다** — 배포 상태는 `history26_backend` CLAUDE.md 참고. AI 작성 의심 경고(v61)와는
  연결하지 않았다(경고는 표시만, 대화는 교사가 확인 뒤 이 스레드로).

- **UI 통일 레이어 (v63)**: `style.css` **맨 끝**의 "v63 UI 통일 레이어"가 버튼·탭·요약카드·필터·폼·표의 반응형을
  한곳에서 덮어쓴다. 특이도가 같으면 나중 규칙이 이기는 구조라 **이 섹션을 파일 중간으로 옮기지 말 것.** 원칙:
  버튼은 사각(`--radius-sm`)이고 알약(999px)은 배지·칩 전용, 주 버튼은 인디고(오커는 "달성" 강조에만), 입력창은
  1.5px·`--input-bg`. 새 버튼을 만들 땐 `.btn`/`.btn-sm`/`.btn-ghost`를 쓰고, id·컨테이너로 따로 스타일하지 말 것
  (그게 통일이 깨진 원인이었다). 탭 줄(`.tab-nav`/`.dash-tabs`)은 ≤1024px에서 가로 스크롤이며 `switchDashTab`/
  `switchQuickTab`이 활성 탭을 스크롤 안으로 끌어온다 — **그리드 자식 안에 스크롤 컨테이너를 넣으면 `1fr` 열이 내용
  폭만큼 늘어난다**(`.layout`을 `minmax(0,1fr)`로 고친 이유). 폰(≤640px)에서 학생 표는 "최근 활동" 열을 숨긴다.
  새 화면을 추가한 뒤엔 PC·태블릿 세로/가로·폰 4개 뷰포트로 찍어 확인할 것.

- **연표 접기 / 그 밖의 기록 카드 (v64)**: `renderLessonCard()`가 `.lesson-toggle` 헤더 + `.lesson-body`로 나뉘고 접힘 상태는
  `LESSON_OPEN[lessonId]`(없으면 완료=접힘·미완료=펼침)에 있다. 토글은 `#timeline`의 이벤트 위임 하나이므로 카드 마크업을 바꿀 땐
  `.lesson-toggle`/`data-lid`를 지킬 것. "그 밖의 기록"은 `.ref-card`+`.ref-ico` 공통 카드다 — 성적조회 카드(`#gradeCard`)의
  `gradeIntro`/`gradeForm`/`gradeResultWrap` id와 피드백 카드의 `#feedbackInboxList`/`fb-ask-btn`은 JS가 직접 참조한다.
- **학생 화면 미리보기 (v64)**: 두 종류다. ① 샘플(로그인 화면, 가짜 학번, `PREVIEW_REAL=false`) ② 실제 학생(`previewAsStudent()` —
  대시보드 학생 카드의 "학생 화면 보기", 그 학생의 진짜 `mode=student` 응답을 읽기 전용 렌더링, `PREVIEW_REAL=true`). 쓰기는 전부 기존
  `PREVIEW_MODE` 가드로 막힌다 — **새 쓰기/읽음 처리 코드를 추가할 땐 반드시 이 가드를 넣을 것**(안 그러면 교사가 미리보기만 해도 학생
  데이터가 바뀐다). 활동 링크는 `withStudentParams()`가 `&preview=1`을 붙인다. `refreshStudentData()`는 샘플에서만 재조회를 건너뛴다.
- **나무 일러스트 (v64)**: `tree.js`의 `treeSvg(stage, leaves, totalLessons)`(index.html에서 분리). 8단계 로직(진행률 새잎·개화·열매)은 유지,
  10월엔 단풍 팔레트+낙엽(`treeSeason_()`, `?season=autumn|default`로 강제). 색은 `TREE_PALETTE`, 단계별 모양은 `TREE_STAGES`, 단계별
  잘라낸 `viewBox`는 `TREE_TOP`. 무작위는 시드 고정이라 화면마다 안 바뀐다.
- **커리큘럼 관리 폼 (v64)**: 3구역 카드(`.cl-section`) + `.cl-field` 라벨·필수/선택 태그. 입력창 id는 그대로이고 `clToggleMulti()`만
  래퍼(`#clTypeField`/`#clUrlField`)를 토글한다.

## 외부 연동 — SEL(사회정서역량) 특성 보기

교사 대시보드의 학생 상세 카드에 있는 "🧭 SEL 특성 보기" 버튼은 이 저장소의 `WEBAPP_URL`과 무관한
**완전히 별도의 Apps Script 웹앱**을 새 팝업 창으로 여는 딥링크일 뿐이다. `SEL_APP_URL`
(`index.html:1605`) 상수에 그 웹앱 주소가 하드코딩돼 있고, `openSelPopup(sid)`(`index.html:1607`)가
학번(`sid`) 하나만 쿼리 파라미터로 실어 팝업을 띄운다. 그 팝업 안의 화면·데이터·계산 로직은 전부 그
외부 프로젝트(`sel_backend_v1.gs`) 책임이며, 이 저장소 코드에는 포함돼 있지 않다.

## 개발 워크플로우

- 빌드 도구, 패키지 매니저, 린터, 테스트 러너가 없다. `npm install`/`build`/`test` 같은 커맨드는 존재하지
  않는다.
- 로컬 확인은 `index.html`을 정적 파일 서버로 열면 된다 (예: `python3 -m http.server`). `file://`로 직접
  열면 `config.js`/`checkin_data.js` 로드나 `fetch` 동작이 브라우저 정책상 막힐 수 있으니 반드시 로컬 서버를
  거친다.
- 실제 데이터 흐름(로그인, 체크인, 대시보드 조회/수정)을 확인하려면 `config.js`의 `WEBAPP_URL`이 가리키는
  실제 Apps Script 웹앱에 네트워크로 접근 가능해야 한다. 이 저장소만으로는 백엔드 로직을 재현/수정할 수
  없다.
- 배포는 이 정적 파일들을 그대로 호스팅(GitHub Pages 등)하는 방식으로 보인다. 별도의 CI 워크플로우
  (`.github/workflows`)는 없다.
- **`index.html`은 4793줄짜리 단일 파일이다.** 통째로 Read하면 그 내용이 대화에 계속 남아 이후 모든
  턴에서 다시 처리된다 — 먼저 Grep으로 관련 함수/구분선 주석 위치를 찾고, 필요한 라인 범위만 Read할 것.
  이 CLAUDE.md의 함수 참조가 대부분 `index.html:줄번호` 형식인 것도 그래서다.

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
  `renderPortal()` 안의 `const P = CONFIG.POINTS || { FIRST: 10, RETRY: 5, RETRY_MAX: 2 }`
  (`index.html:969`)에서 활동 단위로 계산한다 — 첫 완료 시 `FIRST`점, 이후 재도전마다 활동당
  `RETRY_MAX`회까지 `RETRY`점씩 추가. `CONFIG.POINTS`는 `config.js`에도 `mode=curriculum` 응답에도
  없으므로 항상 이 기본값(10/5/2)이 쓰인다. 포인트 배점을 바꾸려면 `config.js`에
  `POINTS: { FIRST, RETRY, RETRY_MAX }` 객체를 추가하거나 이 기본값 리터럴을 직접 고쳐야 한다.
- "칭호"라는 말은 서로 다른 두 시스템을 가리킨다. (1) `config.js`의 `RANKS`(포인트 누적 → 권지 사관/가주서/
  주서/사관/겸춘추/편수관/직제학/대제학 8단계, 학년별 문턱 분리) — 순수 프론트 로직으로, `renderPortal()`이
  `CONFIG.RANKS[SESSION.grade]`와 점수를 비교해서 계산한다. (2) "칭호첩" 배지 시스템(`.badge-card`,
  `index.html:95` 부근) — `learning`/`behavior`/`strength` 3개 카테고리, `once`/`repeat` 2가지 획득
  타입의 배지를 `renderBadges()`/`renderBadgeChip()`(`index.html:1430`대)이 그리고, `checkNewBadges()`
  (`index.html:1459`)가 로컬스토리지 기준선과 비교해 신규 획득만 토스트로 알린다. **이 저장소는
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
