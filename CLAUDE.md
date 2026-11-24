@AGENTS.md

<!-- 규칙 본체는 AGENTS.md. 이 파일엔 import 한 줄과 아래 «연결 점검표»만 둔다(머지 전 훅 connect-check.js가 이 파일의 그 절을 본다, 2026-11-23). 세부 문서(docs/*, .claude/rules/*)는 @로 가져오지 않는다 — 가져오면 매 세션 전부 로드된다. -->

## 연결 점검표
새 칸·단추·창을 더하거나 공용 계산·저장 칸을 고치면 아래에 줄을 더하고 빈칸을 채운 뒤 PR한다(출처: 효니 말 2026-11-14 «새로운 기능을 넣으면 기존의 기능과 모두 연결성과 호환성이 이어지도록 해야해»). 트리거 = diff에서 알아볼 이름. 다음 PR은 트리거가 맞는 줄만 다시 본다.

| 무엇 | 트리거 | 이어지는 흐름 → 어떻게 되나 |
|---|---|---|
| 성적관리 학년 고르기 `GRADES_YEAR`(v188) | `gradesYearRows_`·`gradesPickYear_`·`dash_grades_year` | 탭 열기·↻·팝업 ↻(`dashLoadPerfStatus_().then`) → 고른 학년 유지 ✓ / 로그아웃(`dashClearSession_`) → 데이터 비움, 학년만 기억 ✓ / 학기말 합계·모둠 탭(`grLoadScoreCounts_`) → 전 학년 데이터 그대로 ✓ / «전체» 팝업(안 누름·한눈에 보기)·미응시 복사 → 고른 학년만 ✓ |
| «지금 할 일» 한 줄(v188) | `gradesRenderTodo_`·`perfStatusOf_` | 현황 표와 같은 판정(`perfStatusOf_`) ✓ / 점수 조정(`adjustPerfScore`·`adjustPerfPostScore`)·확인 완료(`perfRefreshAdminLists_`)·공개 토글 → `gradesSyncAfterEdit_`/다시 그림 ✓ / 현황 표·묶음 요약은 조정 뒤 ↻까지 옛 숫자(고른 반 유지 때문, v101부터 같음) △ |
| 미응시자 카드(v188, v175 팝업 대체) | `perfMissingRender_`·`perfMissingLoad_`·`mode=perfMissing` | 현황과 같이 읽고 따로 실패(오류 + 다시 시도) ✓ / 0명이면 카드 숨김, 할 일 줄에 «미응시 없음» ✓ / 학생 화면엔 안 내려감(교사 token) ✓ |
| 독서기록장 학생 탭(v189) | `qtabReading`·`qpReading`·`readingPortalInit_`·`readingTabOpen_`·`READING_FROM` | 로그인 묶음(`loginPrefetch_`·studentBoot) → 안 넣음, 탭 열 때만 `readingMine` ✓ / 다른 학생 로그인·«책 덮기»(`resetPortalState_`·`exitToLogin`) → 비움·다시 읽음, 쓰던 글은 로그아웃 때 지움 ✓ / PREVIEW_MODE → 읽기·쓰기 없음, 안내만 ✓ / 학생 화면 테스트(99번) → 보이고 저장됨 ✓ / 날짜 전 → 탭 숨김 ✓ / 학생 화면 판정 0건(백엔드가 안 내려보냄 + 화면도 안 읽음) ✓ / 탐구 나무·포인트·칭호 → 연결 안 함(효니 원하면 다음) △ |
| 독서 저장·지우기(v189) | `readingSave_`·`readingDelete_`·`PORTAL_POST_RETRY_ACTIONS` | 재시도(`portalPost_`) → 같은 기록ID upsert라 한 행 ✓ / 로그인 세션(portal_auth, 절대 규칙 11) → JSON 문자열 POST·studentId GET ✓ / 지우기 확인은 앱 안 `<dialog>` ✓ / 다음 학년도 같은 학번 → 백엔드가 이번 학년도만 ✓ |
| 교사 «📚 독서» 탭(v189) | `dashReadingOpen_`·`rdaRender_`·`RDA`·`switchDashTab('reading')`·`dash_reading_grade` | `?dash=reading` 딥링크(`tdAfterEnter_`가 DOM 탭 목록) ✓ / «나가기» → `dashReadingClear_` 비움 ✓ / 담당 반 `banMatches_`·`dashMyBans_`, 미현쌤 반은 백엔드 `canSeeSid_` ✓ / 숫자 → 명단 팝업·복사·새로고침(`perfModalOpen_`) ✓ / 판정은 모아 한 번에(`readingJudge`), 저장 안 한 판정은 CSV에 안 들어감(안내 문구) ✓ / 성적관리 탭 «점수» 올리기는 화면에 없음 — 점수 CSV를 Claude·효니가 `uploadPerfScores`로 △ |
| 접힌 묶음 `#semFold`·`#perfFold`(v188) | `data-fold="gtSem"`·`gtPerf`·`SEM_TABLE_OPEN`·`PERF_STU_OPEN` | 접힘 기억(`dashFoldInit_`) ✓ / 다시 그려도 학생 표·조정 묶음 펼침 유지 ✓ / 불러오기 실패면 `#perfFold`를 펼쳐 오류를 보임 ✓ / 2학년(지필 없음)은 `#semFold` 숨김 ✓ |

