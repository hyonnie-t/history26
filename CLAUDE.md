@AGENTS.md

<!-- 규칙 본체는 AGENTS.md. 이 파일엔 import 한 줄과 아래 «연결 점검표»만 둔다(머지 전 훅 connect-check.js가 이 파일의 그 절을 본다, 2026-11-23). 세부 문서(docs/*, .claude/rules/*)는 @로 가져오지 않는다 — 가져오면 매 세션 전부 로드된다. -->

## 연결 점검표
새 칸·단추·창을 더하거나 공용 계산·저장 칸을 고치면 아래에 줄을 더하고 빈칸을 채운 뒤 PR한다(출처: 효니 말 2026-11-14 «새로운 기능을 넣으면 기존의 기능과 모두 연결성과 호환성이 이어지도록 해야해»). 트리거 = diff에서 알아볼 이름. 다음 PR은 트리거가 맞는 줄만 다시 본다.

| 무엇 | 트리거 | 이어지는 흐름 → 어떻게 되나 |
|---|---|---|
| 성적관리 학년 고르기 `GRADES_YEAR`(v188) | `gradesYearRows_`·`gradesPickYear_`·`dash_grades_year` | 탭 열기·↻·팝업 ↻(`dashLoadPerfStatus_().then`) → 고른 학년 유지 ✓ / 로그아웃(`dashClearSession_`) → 데이터 비움, 학년만 기억 ✓ / 학기말 합계·모둠 탭(`grLoadScoreCounts_`) → 전 학년 데이터 그대로 ✓ / «전체» 팝업(안 누름·한눈에 보기)·미응시 복사 → 고른 학년만 ✓ |
| «지금 할 일» 한 줄(v188) | `gradesRenderTodo_`·`perfStatusOf_` | 현황 표와 같은 판정(`perfStatusOf_`) ✓ / 점수 조정(`adjustPerfScore`·`adjustPerfPostScore`)·확인 완료(`perfRefreshAdminLists_`)·공개 토글 → `gradesSyncAfterEdit_`/다시 그림 ✓ / 현황 표·묶음 요약은 조정 뒤 ↻까지 옛 숫자(고른 반 유지 때문, v101부터 같음) △ |
| 미응시자 카드(v188, v175 팝업 대체) | `perfMissingRender_`·`perfMissingLoad_`·`mode=perfMissing` | 현황과 같이 읽고 따로 실패(오류 + 다시 시도) ✓ / 0명이면 카드 숨김, 할 일 줄에 «미응시 없음» ✓ / 학생 화면엔 안 내려감(교사 token) ✓ |
| 접힌 묶음 `#semFold`·`#perfFold`(v188) | `data-fold="gtSem"`·`gtPerf`·`SEM_TABLE_OPEN`·`PERF_STU_OPEN` | 접힘 기억(`dashFoldInit_`) ✓ / 다시 그려도 학생 표·조정 묶음 펼침 유지 ✓ / 불러오기 실패면 `#perfFold`를 펼쳐 오류를 보임 ✓ / 2학년(지필 없음)은 `#semFold` 숨김 ✓ |

