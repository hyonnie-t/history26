# 외부 도구 메모

<!-- 출처: 옛 hyonnie.md §2 "Gemini API"·"패들렛" + §5 도구 목록. -->

## 쓰는 도구
- Gemini API(AI Studio, 무료 티어) — 학생 서술 분석(AI 코멘트·의심도, 백엔드 `ai_module`).
- 클리포(Clipo) — 루브릭 기반 AI 채점(`clipo-rubric` 스킬, `docs/lesson-design.md`).
- sengpt — 세특 작성 에이전트.

## Gemini API
- 키 형식: 구형 `AIza`(35~45자) → 신형 `AQ.`(~53자, 2026.06~). 키 유효성 검사 로직이 신형을 인식하는지 확인(현재 `ai_module`은 둘 다 인식).
- 배치: 8개씩 + 15초 간격(RPM 5 제한). 오류 시 폴백 모델로 한 번 더 — 폴백 조건(429·503·404·미지원 모델)과 모델 설정은
  `history26_backend`의 `.claude/rules/ai-module.md`·`docs/deploy-status.md`가 최신.

## 패들렛
- 데이터 추출은 **Excel 내보내기(CSV 아님)** — 본문 텍스트가 포함되는 유일한 방법.
- API 접근: `wall_hashid` 추출 후 `/api/10/wishes` 직접 호출.
- 반별 패들렛 URL은 `효니.local.md`.
