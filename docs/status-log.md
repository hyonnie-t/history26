# 점검 기록 (과거 확인 결과 — 지금 규칙이 아니라 이력)

<!-- 출처: 옛 hyonnie.md §4. 줄번호는 2026-08-29 기준이라 지금은 틀리다 — 함수 이름으로 grep할 것. -->

> 2026-08-29 클로드 코드로 정합성 확인.

- 활동목록JSON·순차진행: **구현돼 있음** — `renderLessonCard`/`renderActivityBlock`, `l.sequential`→`locked`, 완료 AND 조건
  `lessonDone()`/`lessonAllActivityIds_()`.
- 칭호첩 판정(`computeBadges_`) 소재: 이 레포엔 없음 → `hyonnie-t/history26_backend`의 `code.gs`(2026-09-03 정정: 주석의
  `backend_v23.gs`는 옛 파일명. 클로드 코드가 "어디에도 없는 외부 파일"이라고 잘못 말한 적 있음).
- `ai_module_*.gs`/`backend_*.gs` 최신 버전: 이 레포로는 확인 불가. 지금은 `history26_backend` 레포(`code.gs`, `ai_module_v9.3.gs`)가 사본.
- **사고(2026-08-29)**: `backend_v24.gs`가 이 레포 main에 커밋됐다 삭제됨. 이후 `.gs`는 이 레포에 올리지 않는다(AGENTS.md 절대 규칙 5).
- `BAN_SIZE`: 2학년 1~4반(27/26/27/27)·5~8반 0(미담당) / 3학년 5~8반(26/27/26/26)·1~4반 항목 없음 — 효니.local.md 담당 반과 일치.
- 3차시 "역사법정: 권문세족의 성장"(`hyonnie-t/his_judge_goryeo`, 2026-09-03): 검사팀/변호인팀/배심원 역할극. 판사·전자투표·내장 타이머는
  설계 중 제외. 기본 gameName 제출 경로만 사용. 백엔드에 `courtCase` 조회 action(re_judge 사건 접수 형식 취합, 반자동 — 교사가 복사해
  넣음; 완전 자동 연동은 토큰 공유가 필요해 보류)과 역할극 칭호(논고왕⚖️/변론왕🛡️, `choicesJson.role`로 판정 — 다른 역할극 웹앱도 role만
  같은 값이면 자동 적용)를 추가. 당시 "배포 대기"였으나 백엔드 v50 통째 반영에 포함된 것으로 추정(백엔드 `docs/deploy-status.md`).
- 세부 수업 설계 진행상황(주제·단원별)은 `효니.local.md`.
