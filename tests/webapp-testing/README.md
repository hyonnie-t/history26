# webapp-testing 도입 — 1차 결과 (2026-09-15)

핸드오프 "history26 포털 webapp-testing 스킬 도입 (v1)" 대응. 아래는 전부
실제로 레포를 클론해 index.html을 로컬 서버로 띄우고 Playwright로 실행해
확인한 결과다 — "확인했다"가 아니라 실행 로그로 남긴다.

## 1. `webapp-testing` 스킬의 실제 구성 (열린 질문 #1 답)

anthropics/skills 레포(`skills/webapp-testing/`)를 직접 열어 확인:

- **테스트 러너 없음.** Jest/pytest류가 아니라 "Python + Playwright(sync API)로
  직접 스크립트를 짜서 실행"하는 방식이다. assertion 프레임워크도 없어서
  성공/실패 판정은 스크립트가 직접 print하고 exit code로 알린다(이 폴더의
  스크립트들도 같은 관례를 따름 — `[PASS]`/`[FAIL]` 출력 + `sys.exit(1)`).
- 번들 스크립트는 `scripts/with_server.py` 하나뿐 — 정적 서버든 dev 서버든
  포트가 뜰 때까지 기다렸다가 명령을 실행하고 끝나면 정리해주는 헬퍼.
- 정적 HTML이면 서버 없이 `file://`로 열어보라고 권하지만, 이 저장소는
  `config.js`/`checkin_data.js`를 `<script src>`로 불러오는 구조라 CLAUDE.md가
  이미 경고한 대로 `file://`에서 fetch/스크립트 로드가 브라우저 정책에 막힐 수
  있다 — 그래서 항상 `python3 -m http.server`로 띄우고 접근했다.

**마켓플레이스 버그 원인도 코드로 확인됨**(GitHub Issue #1087, #189 이 말하는
문제 그대로): `anthropics/skills`의 `.claude-plugin/marketplace.json`은
`webapp-testing`을 `example-skills`라는 플러그인 하나에 다른 11개 스킬과 묶어
등록해뒀다(`algorithmic-art`, `canvas-design`, `mcp-builder`, `skill-creator`,
`theme-factory` 등). 마켓플레이스 경유로 설치하면 이 묶음 전체가 따라온다 —
그래서 핸드오프가 지시한 대로 **레포를 클론해서 `skills/webapp-testing` 폴더
하나만 로컬 스킬로 등록**해야 한다.

### 설치 방법 (효니가 직접 할 일 — 이 세션의 원격 컨테이너가 아니라 효니의
로컬 Claude Code 환경에서)

이 세션은 클라우드 컨테이너라 효니의 로컬 `~/.claude` 설정에 아무것도 쓸 수
없다 — 그래서 이 스텝은 "완료"로 보고할 수 없고, 효니가 직접 실행해야 한다.

```bash
git clone https://github.com/anthropics/skills.git /tmp/anthropic-skills
mkdir -p ~/.claude/skills
cp -r /tmp/anthropic-skills/skills/webapp-testing ~/.claude/skills/webapp-testing
```

이렇게 두면 다음 세션부터 `~/.claude/skills/webapp-testing/SKILL.md`가 개인
스킬로 잡혀 다른 게임 레포에서도 그대로 재사용된다(레포마다 따로 안 넣어도 됨).
`/plugin add` 경로를 쓰고 싶으면 클론한 `skills/webapp-testing` 디렉터리
자체를 대상으로 지정하면 되는데, 위 방식(개인 스킬 디렉터리에 직접 복사)이
더 단순하고 마켓플레이스 묶음 문제를 원천적으로 피한다.

## 2. Mock vs 실제 백엔드 호출 (열린 질문 #3 답)

**결론: 쓰기(`action=...`) 경로는 항상 mock, 읽기(`mode=...`)는 테스트 목적에
따라 다르게.** 근거는 코드로 확인했다 — `history26_backend/code.gs`의
`SHEET_NAME = '게임활동_로그'`(247행) 하나를 포털과 crusades·his_judge_goryeo·
gongmin 등 여러 개별 웹앱이 `gameName`으로만 구분해 같이 쓴다. 쓰기 action을
실제로 호출하면 테스트 데이터가 실제 교사 대시보드·성적 계산에 섞여 들어간다.

- **PREVIEW_MODE**(교사용 "학생 화면 미리보기")가 이미 이 문제를 풀어둔 기존
  기능이다 — `submitCheckin()`이 `PREVIEW_MODE`일 때 실제 fetch를 건너뛰는 등,
  학생 포털 쪽 쓰기 경로는 이미 자체적으로 막혀 있다. 그래서 학생 포털 렌더
  테스트는 PREVIEW_MODE를 그대로 활용했다.
- 교사 대시보드는 이런 안전장치가 없다(토큰만 있으면 `reorderLessons` 등이
  바로 실제 시트에 쓴다) — 그래서 대시보드 관련 테스트는 `page.route()`로
  `WEBAPP_URL` 전체를 가로채 GET은 고정 픽스처, POST는 전부 성공 스텁으로
  응답하게 만들었다(`fixtures.py`, `test_curriculum_reorder_mock.py`).
- 읽기 전용 GET도 실제 호출을 그대로 두면 "그날 시트에 실제로 뭐가 있는지"에
  결과가 좌우돼(예: 특정 학년에 등록된 차시가 하나도 없으면 결과가 달라짐)
  deterministic하지 않다 — 그래서 우선순위 높은 스모크 테스트는 읽기 GET까지
  같이 mock해서 실행 환경(이 샌드박스든, 효니 로컬 PC든, 나중에 CI든)과
  무관하게 같은 결과가 나오게 했다.

### 이 과정에서 실제로 발견한 것 (mock을 만들다가 걸린 버그성 동작)

1. `loadCurriculum()`은 `mode=curriculum` 응답의 `data.grades`를
   `CONFIG.CURRICULUM`에 그대로 대입한다(`CONFIG.CURRICULUM = data.grades`).
   응답에 `grades` 필드가 없으면 `CONFIG.CURRICULUM`이 통째로 `undefined`가
   되고, 그 이후 커리큘럼을 참조하는 아무 코드나 죽는다 — mock 응답을 대충
   `{result:'success'}`로만 줬다가 실제로 이 에러를 재현했다
   (`Cannot read properties of undefined (reading 'lessons')`).
2. **교사 대시보드는 `CONFIG.CURRICULUM`이 완전히 빈 객체(`{}`)인 상태를
   방어하지 않는다.** `dashRefreshActivityOptions()`(index.html:3631~)가
   `CONFIG.CURRICULUM[Number($('selGrade').value)]`를 조회하는데, 커리큘럼에
   학년이 하나도 없으면 `#selGrade`에 옵션이 안 생겨서 `.value`가 빈 문자열
   → `Number('')` = `0` → `CONFIG.CURRICULUM[0]`은 `undefined` → `.lessons`
   참조에서 예외가 나며 대시보드 진입 자체가 "들어가지 못했어요" 에러로
   실패한다. 실제 운영에서는 커리큘럼 시트가 완전히 빌 일이 거의 없어 지금까지
   안 드러났을 뿐, 학기 초 시트를 새로 만드는 시점처럼 진짜로 비어있는 상태를
   만나면 재현될 수 있는 취약점이다. **이번 작업 범위(테스트 인프라 도입)
   밖이라 고치지 않고 관찰만 남긴다** — 고치려면 index.html을 수정해야 하니
   별도 승인 필요.

## 3. 체크리스트 3개 → 테스트 조건 변환

| # | 기존 체크리스트 (손으로 확인) | 테스트 파일 | 판정 방식 | 실행 결과 |
|---|---|---|---|---|
| 1 | URL/ID 오탈자 | `test_url_helpers.py` | `ensureUrlScheme_()`(v48 스킴 보정)·`parseStudentId()`를 브라우저 콘솔에서 직접 호출해 입출력 대조 | 10/10 PASS |
| 2 | IIFE + 파일 하단 const 참조로 인한 TDZ 에러 | `test_console_error_smoke.py` | 페이지 로드+첫 상호작용 동안 `pageerror`/`console(error)`를 수집해 "before initialization"/ReferenceError 여부 판정 | PASS (TDZ 의심 0건) |
| 3 | 카드 나열형 인터랙션 드래그+▲▼ 이중 지원 | `test_curriculum_reorder_mock.py` | 버튼 클릭과 네이티브 dragstart/dragover/dragend 디스패치 양쪽 다 DOM 순서 변경 + `reorderLessons` POST 발생을 확인 | 5/5 PASS |

**#1의 미완성 부분(그대로 열어둠):** 커리큘럼 시트의 활동id가 각 개별
웹앱의 `CONFIG.GAME_NAME`과 실제로 일치하는지 대조하는 건 (a) 커리큘럼 값이
이 레포 밖(Google Sheets)에 있고 (b) crusades·his_judge_goryeo 등 개별 웹앱
레포가 이번 세션의 GitHub 접근 범위 밖이라 여기서 자동화하지 못했다. 아래
"다른 레포로 확장" 절에 재사용 패턴만 제안해둔다.

**#3에서 핸드오프 문서를 정정함:** 원문은 "SortableJS 드래그"라고 적었지만,
실제 구현은 외부 라이브러리 없는 네이티브 HTML5 Drag and Drop API다 —
`index.html` 전체에서 `<script src>`는 `config.js`/`checkin_data.js` 둘뿐이고
(11번째 줄 `<link>`로 불러오는 Pretendard 폰트 CSS 제외), SortableJS는 어디에도
없다. 드래그 로직은 `clDragAfterElement()`/`bindClListEvents()`
(index.html:3172~3226)가 `dragstart`/`dragover`/`dragend`만으로 직접 구현했다.
테스트도 그에 맞춰 SortableJS API가 아니라 네이티브 DragEvent를 직접
디스패치하는 방식으로 짰다.

## 4. 우선순위 플로우 (열린 질문 #2 답 — 제안)

전부 테스트하지 않고 아래 순서로 먼저 커버했다/커버를 제안한다:

1. **로그인 형식 검증** (`test_login_validation.py`) — 백엔드 의존 0, 실행
   빠름, 회귀가 제일 조용히 일어나는 지점(입력 검증 로직은 리팩터링 때 실수로
   깨지기 쉬움). ✅ 작성·검증 완료.
2. **학생 포털 렌더(미리보기 모드, 2/3학년 × 샘플 유무)**
   (`test_preview_mode_render.py`) — 학생이 매일 보는 화면 전체를 안전하게
   태우는 가장 넓은 스모크 테스트. ✅ 작성·검증 완료.
3. **커리큘럼 관리 탭 순서 변경(드래그+버튼)** (`test_curriculum_reorder_mock.py`)
   — 체크리스트 3번 대응, 교사 대시보드 중 유일한 "카드 나열형" 인터랙션.
   ✅ 작성·검증 완료.
4. **TDZ 콘솔 에러 스모크** (`test_console_error_smoke.py`) — history26
   자체보다는 앞으로 webapp-builder 스킬로 만들 개별 웹앱들에 그대로 재사용할
   범용 회귀 테스트로 의미가 크다. ✅ 작성·검증 완료.
5. *(다음 후보, 이번엔 안 만듦)* 웰컴 체크인 문항 렌더+제출(PREVIEW_MODE
   경로) — "오늘 지정된 체크인"이 있어야 트리거되는 조건부 플로우라 우선순위
   4개보다 준비 비용이 더 든다(체크인 지정 상태까지 mock해야 함).
6. *(다음 후보)* 교사 대시보드 "학생 기록" 탭 필터(학년/반/활동 select 연동)
   — 위에서 발견한 "커리큘럼 빈 값" 취약점과 맞닿아 있어서, 그 관찰을 실제
   버그 수정으로 승격할 때 같이 만드는 게 효율적.

## 5. 실행 방법

```bash
cd history26
python3 -m pip install playwright   # 최초 1회. 브라우저 바이너리는 환경에 이미 있으면 재사용
# 이 컨테이너처럼 playwright 패키지 버전과 사전 설치된 크로미움 버전이
# 어긋나는 환경이면 PWTEST_CHROMIUM_PATH로 실제 바이너리를 지정해준다.
export PWTEST_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome  # 필요할 때만

python3 -m http.server 8791 &
python3 tests/webapp-testing/test_login_validation.py
python3 tests/webapp-testing/test_url_helpers.py
python3 tests/webapp-testing/test_console_error_smoke.py
python3 tests/webapp-testing/test_preview_mode_render.py
python3 tests/webapp-testing/test_curriculum_reorder_mock.py
kill %1
```

(webapp-testing 스킬을 설치한 뒤에는 서버 기동을 `scripts/with_server.py`로
대신해도 된다 — 위 수동 방식과 결과는 동일함.)

## 6. 다른 게임 레포로 확장할 때 재사용할 패턴

1. **`_pw_helpers.py`/`fixtures.py`를 그대로 복사해서 시작.** 브라우저 실행
   경로 override, `route_history26_backend`류 GET/POST 스텁 패턴은 같은
   백엔드(`WEBAPP_URL`)를 쓰는 모든 개별 웹앱에 그대로 적용된다 — 특히
   "쓰기는 항상 mock" 원칙과 "GET을 mock할 땐 프론트가 기대하는 필드를
   빠짐없이 채워야 한다"(위 발견 #1 참고)는 교훈은 게임 레포마다 반복될
   것이다.
2. **TDZ 콘솔 에러 스모크(`test_console_error_smoke.py`)는 수정 없이 거의
   그대로 재사용 가능** — CLAUDE.md가 명시한 webapp-builder 스킬의 반복
   실수(IIFE를 파일 중간에서 실행)를 정확히 겨냥한 범용 테스트라, 새 웹앱마다
   진입점 URL과 "첫 상호작용" 셀렉터만 바꿔 끼우면 된다.
3. **URL/ID 대조 자동화는 다음 세션 후보.** crusades·his_judge_goryeo 등
   개별 웹앱 레포가 이번 세션 GitHub 접근 범위에 없어 여기선 못 했지만,
   패턴은 정해둘 수 있다: 그 레포의 `config.js`(또는 동급 파일)에서
   `CONFIG.GAME_NAME`/`CONFIG.SHEET_WEBAPP_URL`을 grep으로 뽑고,
   `history26`의 커리큘럼 관리 탭에 등록된 활동id·WEBAPP_URL과 diff하는
   작은 스크립트 하나면 된다(브라우저 불필요, 순수 텍스트 대조).
4. **각 레포에 테스트를 심을 때도 이번처럼 "먼저 만들고, 실제로 실행해서
   증거를 남기고 나서 완료로 보고"하는 순서를 지킬 것** — 이번 세션에서
   실제로 두 번(빈 커리큘럼 값, 서브탭 미클릭) 예상과 다른 실패를 겪었고,
   전부 실행 로그 덕분에 원인을 바로 찾았다. "짜놓고 안 돌려본 테스트"는
   테스트가 아니라 그냥 코드다.

## 7. 이번 세션이 못 한 것 (다음 세션 열린 질문)

- 웰컴 체크인 제출 플로우, 교사 대시보드 학생 기록 필터 등 우선순위 5~6번.
- 다른 게임 레포(crusades 등)로의 실제 확장 — 그 레포들이 이번 세션 GitHub
  접근 범위 밖이라 코드 대조를 못 했다. 접근 범위에 추가되면 위 패턴 #3부터
  시작하면 된다.
- 스킬 자체의 로컬 설치(위 1절) — 이 세션(클라우드 컨테이너)이 아니라 효니의
  로컬 Claude Code 환경에서 해야 하는 일이라 미완료로 남겨둔다.
