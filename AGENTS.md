# history26 — 2학기 역사 탐구 기록 (프론트엔드)

중학교 역사 수업용 학생 포털(교사 "효니": 2학년 세계사·3학년 한국사). 학생은 5자리 학번(학년1+반2+번호2)+이름으로
로그인해 차시 활동·체크인·질문함을 쓰고, 교사는 대시보드에서 기록·AI 코멘트·공지·커리큘럼·체크인 문항을 관리한다.
**빌드·패키지 매니저·린터·테스트 러너 없는 정적 파일**(`index.html` 단일 SPA + `config.js`/`checkin_data.js`/`style.css`/`tree.js`).
**백엔드는 이 레포에 없다** — `config.js`의 `WEBAPP_URL`(Apps Script, 데이터는 Google Sheets)이며 소스는
`hyonnie-t/history26_backend`(`?mode=` GET 조회 / `{action}` POST 변경, 교사 쓰기는 `token`). 배지 판정·AI 코멘트 생성도 거기다.
개별 수업 웹앱(`crusades` 등)·SEL 팝업(`SEL_APP_URL`)·`re_judge`도 각자 다른 레포/프로젝트다.

## 대화 (효니)
<!-- claude.ai 사용자 설정과 겹치지만, 그 설정이 안 들어오는 실행 환경도 있어 레포에도 둔다. -->
반말, 호칭 "효니". 업무는 결론 먼저·이유 뒤(감정 얘기는 수용 먼저). 틀린 건 "틀렸어, 이유는 이거야"로 분명히.
모르면 모른다, 확실한 것만 단언·논쟁적이면 "논쟁 있어". 긴 코드는 채팅 말고 파일로. 전면 재작성보다 타겟 수정 + 수정 후 검증.
UI 텍스트·주석·커밋 메시지는 한국어.

## 절대 규칙 — 어기면 학생 데이터·배포·보안이 깨진다
1. **`PREVIEW_MODE` 가드**: 새 쓰기·읽음 처리(ack) 코드엔 반드시 넣는다. 없으면 교사가 미리보기만 해도 학생 데이터가 바뀐다.
2. **학생 화면에 내부 정보 0건**: (a) 검증 메타(`sourceId`/`verified`/"검수"/"대조"/"미확인"/"2차"/"확인 전" 라벨, 미검증 고지 문장)
   — 화면 코드가 검증 플래그를 아예 참조하지 않는다. (b) AI 작성 의심도·평소 대비·교차 확인·이탈/붙여넣기 신호.
   (c) 학급 공통 피드백의 "오개념". 상세 `.claude/rules/student-screen.md`.
3. 이탈/붙여넣기 신호·평소 대비·교차 확인은 의심도 등급·🔍 반복 횟수·Gemini 프롬프트에 서로 섞지 않는다(표시만 나란히).
4. **Apps Script 재배포는 "배포 관리 > 수정 > 새 버전"만.** "새 배포"는 URL이 바뀌어 포털·웹앱 연결이 전부 깨진다(백엔드·개별 웹앱 공통).
5. **`.gs` 파일은 이 레포에 절대 커밋하지 않는다**(`.gitignore`가 `*.gs`를 막지만 `-f`로 뚫린다). 실수로 올렸으면 삭제 커밋으로
   끝내지 말고 그 파일의 토큰/키를 노출된 것으로 보고 교체한다(히스토리에 남음). 백엔드 코드는 `history26_backend` 레포에서 고친다.
6. **이 레포는 public**: URL/ID/토큰·반 정보 등 민감정보는 `효니.local.md`(gitignore됨)에만. 커밋 전 diff에 민감정보 없는지 확인.
7. 긴 URL/ID(`WEBAPP_URL`, `SHEET_WEBAPP_URL`, 시트 ID)를 옮겨 적을 땐 육안 말고 grep/diff로 원본과 대조(조용한 전송 실패의 주원인).
8. `grantPresentationPoint`의 `reason` 문자열(`GONGMIN_BONUS_REASON` 등)을 다른 용도로 재사용하지 않는다(중복 지급 판별 오작동).
9. 성적조회는 `login()`을 건드리지 않고, 매칭 실패 사유(학번/이름/비밀번호 중 무엇)를 구분해 보여주지 않는다.
10. 차시 "완료"는 그 차시 **모든** activity id가 `doneIds`에 있어야 하는 AND 조건 — 학생 `lessonDone()`과 대시보드
    `lessonAllActivityIds_()` 두 곳이 따로 구현한다. 진행률·완료 뱃지·포인트를 고치면 둘 다 확인.

## 작업 습관
- **`index.html`(5천 줄+, 300KB)은 통째로 Read 금지** — `grep -n "^function 이름\|/\* ══" index.html`로 위치를 찾고 범위만 Read.
  문서에 줄번호를 적지 말고 함수·id 이름만 쓴다(편집마다 밀림).
- 코드 주석 관례: 바꾼 곳에 `vNN` + 왜 바꿨는지 짧게. 새 번호는 `CHANGELOG.md`에서 안 쓰인 번호인지 먼저 확인(재번호 사고 이력, Stop 훅도 경고).
  과거 경위는 `CHANGELOG.md`.
- 샌드박스에서 `script.google.com`·`*.github.io`·`cdn.jsdelivr.net`은 막혀 있다. 실제 응답·배포 확인은 curl 말고
  효니에게 URL을 열어 결과를 붙여 달라고 하고, 백엔드 응답은 `tests/webapp-testing/fixtures.py`처럼 가짜로 시험한다.
- 로컬 확인은 반드시 `python3 -m http.server 8765 &`(`file://`는 스크립트 로드·fetch가 막힌다). 새 화면은
  `node tests/webapp-testing/shot.js http://localhost:8765/index.html <출력폴더> <접두어>`로 폰360·태블릿820·PC1280 세 폭 확인
  (playwright 경로는 스크립트가 찾는다 — 세션마다 새로 찾지 말 것).
- Stop 훅(`.claude/hooks/`)이 턴 끝에 Playwright 스모크·버전 재사용·`.side-card` 브레이크포인트·검증 메타 유출을 **경고만** 한다(차단 아님). 경고가 뜨면 고친다.

## 작업 전 읽을 것 (라우팅)
`.claude/rules/*`는 해당 파일을 Read/Edit하면 자동 로드되지만 **grep·sed로만 볼 땐 안 뜬다** — 그 파일을 고칠 거면 먼저 Read할 것.

| 작업 | 먼저 읽기 |
|---|---|
| `index.html` 수정(포털·대시보드·차시/활동·포인트·칭호·세션) | `.claude/rules/index-html.md` |
| `style.css` 수정, 새 버튼·카드 | `.claude/rules/style-css.md` |
| `config.js`/`checkin_data.js`(RANKS·BAN_SIZE·포인트·체크인) | `.claude/rules/config-data.md` |
| 학생 화면 문구·사료·해석 콘텐츠 | `.claude/rules/student-screen.md` |
| 특정 기능 고치기 | `docs/features.md` — `grep -n "^## " docs/features.md`로 제목 보고 그 섹션만 |
| 개별 수업 웹앱 제작·수정, `snippets/` | `webapp-builder` 스킬 + `docs/webapp-rules.md` |
| 활동지·수업설계·루브릭·세특 등 콘텐츠 | `docs/lesson-design.md` |
| 패들렛·Gemini 키·외부 에듀테크 도구 | `docs/tools.md` |
| 배지(칭호첩)·`?mode=`/`action=` 동작·배포 여부 | `history26_backend` 레포(AGENTS.md·`docs/deploy-status.md`) |
| 테스트 스크립트 추가·수정 | `tests/webapp-testing/README.md` |
| 과거 점검 기록·사고 이력 | `docs/status-log.md`, `CHANGELOG.md` |
