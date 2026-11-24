# 독서기록장 + 교사 대시보드 «독서» 탭 (2027 1학기 교과 독서용)

- 브랜치: 프론트 `feat/reading-log`(worktree `웹앱\wt-h26-reading`), 백엔드 `feat/reading-log`(worktree `웹앱\wt-be-reading`)
- 시작: 2026-11-24, 출처: 효니 말 «역사 포털에 학생 독서기록장과 교사 대시보드 독서 칸을 만들어 줘 … 배포는 나한테 묻기», 프롬프트 `클로드작업\산출물\수업평가\2026-11-24_교과독서_다음세션_프롬프트.md` «프롬프트 2»
- 항목 하나 끝낼 때마다 그 레포에 커밋. 이 파일 체크도 같이 커밋.

## 막힌 곳
- (없음) — 독서로 교사 메뉴 실제 화면은 로그인 전이라 못 봄(아래 «독서로 확인» 참고). 막는 일은 아님.

## 효니에게 물을 것 (답이 없으면 ○○로)
- [ ] 독서로 교사 화면 «독서활동» 메뉴를 직접 보려면 내장 브라우저에서 독서로 로그인 필요 → 답 없으면 **보지 않고 B안(복사·CSV)으로 진행**(공개 FAQ로 일괄 등록 없음 확인)
- [ ] 선생님 도서 목록(신청서 도서) → 답 없으면 **교사 «독서» 탭에서 효니가 직접 입력·붙여넣기**(제목·저자·ISBN 한 줄씩)
- [ ] 독서 기록용 패들렛을 따로 쓸지 → 답 없으면 **기존 반별 포트폴리오 패들렛(`portfolio.urlByBan`) 재사용**
- [ ] 엑셀은 CSV(BOM, 엑셀로 바로 열림)로 충분한지 → 답 없으면 **CSV**(SheetJS 새로 넣지 않음, 학교망 외부 로드 미확인)
- [ ] 채점: «인정»은 효니가 기록마다 누르는지, 조건(밑줄+질문+150자)을 채우면 자동 인정인지 → 답 없으면 **자동 «인정 후보» + 효니가 한꺼번에 확정**
- [ ] 배포(PR 병합·gas_sync push·deploy) — **반드시 효니 답을 기다림**(효니 지시)

## 독서로 확인 (2026-11-24, 내장 브라우저, 로그인 없이)
- 공개 FAQ «선생님» 분류 7개: 학생 계정 발급, 독후활동 «조회»·«승인/반려», 공개범위 수정 불가, 포트폴리오 «조회», 그룹 독서이음활동, 독후감 대회(센터만 생성). **교사 일괄 등록·엑셀 올리기·나이스 연동 항목 없음.**
- FAQ 제목 검색 «엑셀·일괄·나이스·생활기록부·학생부·연동·독서활동상황·다운로드» 0건, «업로드»는 학교관리자 도서관 소식뿐, «등록»은 관리자 인증서뿐.
- 공개 API 없음(11-24 앞 조사). → **B안**: 학생 «독서로에 옮겨 적기» 복사 + 교사 «반별 독서 목록 CSV(도서명(저자))».
- 못 본 것: 로그인 뒤 교사 «독서활동» 메뉴 실제 단추, 2026 사용자 매뉴얼 첨부파일(공지 2026-02-27).

## 설계 (Claude 판단 — 효니 답이 오면 고침)
### 데이터 (백엔드 새 파일 `99_reading.gs`, CRLF)
- 시트 `독서기록` [기록ID, 학번, 이름, 도서명, 저자, ISBN, 읽은 날짜, 시작쪽, 끝쪽, 밑줄, 내 질문, 한 줄 평, 글(150자), 작성시각, 수정시각, 상태(작성/삭제), 인정(빈칸/인정/보류), 교사메모]
- 시트 `독서도서목록` [학년, 도서명, 저자, ISBN, 출판사, 순서, 보이기]
- 학생 action: `readingSave`(새로·고치기, 기록ID로 upsert, 본인 것만), `readingDelete`(상태=삭제, 실제 행 안 지움) → `STUDENT_GATED_ACTIONS`·`ACTION_DEDUP_ACTIONS`(새로 쓰기만). 학생 GET `mode=readingMine`(STUDENT_GATED_MODES) — 내 기록 + 내 학년 도서 목록.
- 교사: GET `mode=readingAdmin`(token, `canSeeSid_`로 담당 반만), POST `readingJudge`(기록 여러 개 인정/보류 한 번에), `readingBooksSave`(도서 목록 통째 교체).
- 학생 자유 입력은 `=+-@` 시작 수식 주입 막기(`ftCell_`), 글자 수 상한(밑줄 300·질문 200·한 줄 평 100·글 150자 안팎 400 상한), 학번별 시간당 횟수 제한(97 틀).
- 잠금 `tryLockTimed_`, `appendRow` 한 번. 시트가 없으면 GET은 빈 값(만들지 않음).

### 학생 화면 (새 `js/13-reading.js`, quickTabs에 «📚 독서기록장» 탭 `data-qtab="reading"` + `#qpReading`)
- 책 고르기: 선생님 목록(먼저) + «목록에 없는 책» 직접 쓰기(제목·저자). ISBN 검색은 책장 중계(src=nl) — 중계 주소를 public 레포에 두는 문제 확인 뒤(이미 bookshelf 공개 레포에 있음), 하루 상한 3,000건 공유라 **검색 단추 눌렀을 때만** 부름.
- 칸: 읽은 날짜·쪽수, 밑줄(사료 문장), 내가 만든 질문, 한 줄 평, 150자 글(글자 수 표시).
- 내 기록 목록(최근 순) + 회차 표시(«3/5회»), 고치기·지우기(앱 안 확인 창, 네이티브 confirm 금지).
- «독서로에 옮겨 적기» 복사: `도서명(저자)` + 줄바꿈 + 한 줄 평/150자 글. 복사 뒤 «독서로 열기» 링크(read365.edunet.net).
- «우리 반 패들렛 열기» 단추(기존 `portfolio.urlByBan`).
- PREVIEW_MODE 가드(쓰기·지우기), 학생 화면에 «인정/보류»·교사메모 안 보임(«선생님 확인 완료» 정도만 — 효니 확인 전엔 아예 안 보임).
- 폰 세로 360 → 태블릿 768·1180 → PC 순서로 확인.

### 교사 대시보드 (새 탭 «독서» `data-tab="reading"`, `#panelReading`, 코드는 `js/13-reading.js` 아래쪽 또는 `js/14-dash-reading.js`)
- 학년·반 고르기(기존 `dashMyBans_`·`banMatches_`), 반별 표: 학생 수·기록한 학생·평균 횟수·5회 채운 학생·0회 학생 — **숫자 누르면 명단 팝업**(`perfModalOpen_`) + 명단 복사.
- 학생별 표: 횟수·권수·인정 수·점수(인정 회당 2점, 최대 5회=10점), 펼치면 기록 내용.
- 채점 보조: «인정 후보 한꺼번에 보기 → 효니가 고르기 → 한 번에 저장»(`readingJudge`).
- 내보내기(CSV, BOM): ① 반별 독서 목록 `학번,이름,도서명(저자) 목록` (독서활동상황 근거) ② 기록 전체 ③ 점수 — `uploadPerfScores` 와 같은 열 순서(학번,이름,평가명,점수,만점,…)라 성적관리 탭 올리기에 그대로.
- 새로고침 «↻» 단추, 불러오기 실패 땐 `dashRetryBtn_`.
- 도서 목록 관리 칸(접힌 묶음): 여러 줄 붙여넣기 → 미리보기 → 저장.

## 연결 점검표 (스킬 webapp-connect-check — 구현 전 다시 채우고 빈 줄은 범위에 넣기)
| 새 것 | 기존 흐름 | 어떻게 되나 |
|---|---|---|
| readingSave/Delete | 학생 로그인 세션(`portal_auth.js`, 절대규칙 11) | JSON 문자열 POST + studentId GET만 |
| 〃 | 교사 미리보기(PREVIEW_MODE·미리보기 학생 99번) | 쓰기 막고 토스트, 99번은 메모리 규칙대로 저장 허용 여부 확인 |
| 〃 | 재시도(`PORTAL_POST_RETRY_ACTIONS`)·중복 방지(`ACTION_DEDUP_ACTIONS`) | 새로 쓰기는 clientId로 중복 방지, 고치기는 기록ID upsert라 재시도 안전 |
| 〃 | 로그인 부하(`studentBootGet_`) | 탭 열 때만 readingMine 조회 — boot에 안 넣음 |
| 독서 탭 | 학생 화면 내부 정보 0건(절대규칙 2) | 인정/보류·교사메모·자동 판정 표시 안 함 |
| 독서 탭 | 탐구 나무·포인트·칭호 | 이번엔 연결 안 함(효니 원하면 다음) — 점검표에 «안 함» 명시 |
| readingAdmin | 담당 반 거르기(`canSeeSid_`)·미현쌤 반 | 담당 반만 |
| 점수 CSV | 성적관리 탭 `uploadPerfScores`·미응시(`96`)·모둠 탭 점수 수 | 평가명 «독서 활동»으로 올리면 기존 현황·미응시에 그대로 잡힘 — 시트 직접 쓰기 안 함 |
| 도서 목록 | 커리큘럼 관리 탭 | 따로(독서 탭 안), 학년별 |
| 새 시트 2개 | 백업·학년 넘김(새 학년도 초기화) | 기존 학년 넘김 절차 문서에 한 줄 추가 |
| 새 action | `docs/deploy-status.md`·`tools/gas_sync.py SPLIT_FILES`·`code-gs.md` 표·AGENTS 목록·50/40 머리 주석 | 같은 PR에 |
| 새 js | `index.html` script 순서·`?v=`·`.claude/rules/index-html.md` 표 | 같은 PR에 |
| 용어 | `docs/glossary.md`(두 레포) | «독서기록장»·«인정» 추가 |

## 코드 자리 메모 (2026-11-24 조사, 함수 이름은 구현 전 grep으로 다시 확인)
- 본보기 = «선생님 도와주세요»(v177): 프론트 `js/03-help.js`(`helpPortalInit_`·`helpSend_`·`helpPost_`→`portalPost_`·`helpCheckMine_`), 백엔드 `97_help_request.gs`(`getOrCreateHelpSheet_`·`helpAskPost_`·`helpMineGet_`·`helpAdminGet_`·`helpResolvePost_`). 시험 본보기 `tests/webapp-testing/help_check.js`, 백엔드 `tools/mock_test.js` 도움요청 케이스.
- 학생 탭: `#quickTabsCard` `data-qtab` + `#qp…` 패널, `switchQuickTab`(js/02) 배열에 추가. `renderPortal` 끝에서 `typeof …Init_==='function'` 가드로 부름.
- 교사 탭: `.dash-tabs` `data-tab` + `#panel…`, `switchDashTab`(js/06) 배열, `DASH_LOAD`·`dashRetryBtn_`, 주소 동기화 `tdSyncUrl_`(js/08) 허용 탭 목록 확인 필요.
- 명단 팝업·복사: `perfModalOpen_`·`perfNoneOpen_`·`perfNoneCopy_`(js/07), `ckLowOpen_`·`ckLowCopy_`(js/06). CSV: `dashDownloadCsv`(js/07, BOM). SheetJS 없음.
- 반: `CONFIG.BAN_SIZE`·`BAN_NUMS`, `dashMyBans_`·`banMatches_`. 패들렛: `portfolio.urlByBan`, `padletParam_`(js/02).
- 백엔드 게이트: `STUDENT_GATED_ACTIONS`·`STUDENT_GATED_MODES`·`studentGate_`·`saNormSid_`(90), `ACTION_DEDUP_ACTIONS`(50), `teacherNameForToken_`·`canSeeSid_`·`tryLockTimed_`·`ensureHeaderRow_`·`jsonText_`(00), `getOrCreatePerfSheet_`(95), 수식 주입 `ftCell_`. 프론트 재시도 `PORTAL_POST_RETRY_ACTIONS`(js/01).
- 점수 시트 `수행평가점수` [학번,이름,평가명,점수,만점,반영 글 수,3점 글,2점 글,1점 글,0점 글,작성 글 수,비고] ← 교사 `uploadPerfScores`(평가명 단위 통째 교체).
- 책 검색 중계: bookshelf `js/app.js` `BOOK_RELAY`, `?src=nl&q=` → `{ok, books:[{title,authors,publisher,year,isbn,kdc}]}`. 국립중앙도서관 표지는 안 뜸(쓰지 않음).
- 캐시 키: 새 js면 `index.html`에 새 `<script src="js/13-reading.js?v=NN">` 줄.

## 할 일 (순서대로, 항목마다 커밋)
- [x] 0. 계획·TODO.md·연결 점검표(이 파일), 독서로 공개 화면 확인
- [x] 1. 새 vNN 번호 잡기(두 레포 `git fetch` + `git grep -n "v번호" origin/main`, 프론트 v188·백엔드 v191 다음) → 프론트 v189·백엔드 v192(2026-11-24 원격 브랜치·열린 PR까지 grep, 안 쓰임)
- [x] 2. 백엔드 `99_reading.gs`: 시트 헬퍼·readingMine·readingSave·readingDelete + 라우팅(40·50·90) + mock_test 케이스(세션 없음/시트 없음/남의 기록 고치기 거절/수식 주입/횟수 제한)
- [x] 3. 백엔드 교사: readingAdmin·readingJudge·readingBooksSave + mock_test(토큰 없음/담당 아닌 반)
- [x] 4. 백엔드 문서: deploy-status·SPLIT_FILES·code-gs.md·AGENTS·CHANGELOG·glossary, `node --check` + `node tools/mock_test.js`
- [x] 5. 프론트 학생 독서기록장 탭(`js/13-reading.js`, index.html, style.css 8pt 토큰) + 독서로 복사·패들렛 단추 — ISBN 검색(책장 중계)은 이번엔 뺌(하루 상한 공유·학교망 미확인), 목록 고르기+직접 쓰기만
- [x] 6. 프론트 교사 «독서» 탭: 반별 표·명단 팝업·복사·새로고침·채점 보조·CSV 3종·도서 목록 관리
- [x] 7. `tests/webapp-testing/reading_check.js`(help_check.js 본뜸) — 학생·교사 화면 가짜 응답, 폰360·태블릿768/1180·PC 캡처
- [x] 8. webapp-connect-check 스킬로 점검표 다시 + 빈 줄 고침 — 찾아 고친 것 3: 탭 연 채 다른 학생 로그인 시 앞 학생 목록 남음·«책 덮기» 때 쓰던 글 남음(공용 태블릿)·학번 재사용(백엔드 이번 학년도만)
- [x] 9. 검토자 1회(`클로드작업\도구\검토자-지시문.md` 틀, «새 기능 × 기존 기능» 조합 시험), 제미나이 의견(학생 정보 빼고), 엑사원 학생풀이 — 검토자: 막을 결함 없음, 낮음·중간 4건 고침(99번 테스트 계정 빼기·복사 대체 글·학생 ↻·낡은 초안), 1학년 탭은 기각(담당 2·3학년). 제미나이: 점수 칸 «저장 전» 표시 받음, 나머지 기각. 엑사원: 이 PC에 열쇠 없어 못 받음
- [x] 10. 내장 브라우저로 직접 확인(로컬 preview `history26`) → 결과 보고 페이지 — 내장 브라우저(가짜 응답)로 교사 탭·학생 쓰기 폼 확인
- [ ] 11. **효니에게 배포 묻기** (PR 2개 병합·gas_sync push·deploy·deploy-status 갱신) — 답 전엔 안 함
