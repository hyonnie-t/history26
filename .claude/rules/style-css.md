---
paths:
  - "style.css"
---

# style.css 규칙

- 상단 `:root`에 디자인 토큰: 색 `--paper`/`--ink`/`--indigo`/`--seal`, 시맨틱 색(amber/jade/indigo-bg 등), spacing/font-size 스케일,
  border-radius 4단계, `--tap-min: 44px`. 새 색·크기는 토큰을 쓴다.
- 카드류(`.side-card`/`.kpi`/`.question-card` 등)는 **공통 베이스 규칙 하나**를 공유한다. 새 카드 UI는 이 베이스를 재사용.
  **⚠️ 베이스가 소스상 개별 규칙보다 앞에 있어야** `border-left` 같은 override가 먹는다.
- 새 버튼은 `.btn`/`.btn-sm`/`.btn-ghost`만 쓴다(id·컨테이너로 따로 스타일하지 말 것 — 통일이 깨진 원인).
- **맨 끝 "v63 UI 통일 레이어"를 파일 중간으로 옮기지 않는다**(특이도가 같으면 나중 규칙이 이기는 구조). 상세는 `docs/features.md` "UI 통일 레이어".
- `.side-card`의 sticky↔static 전환 조건과 `.side-combined` 높이 제한 조건은 **정확히 서로 반대(min = max+1)** 로 맞춘다 —
  하나만 바꾸면 어긋난다(Stop 훅 `check_layout_breakpoint_sync.sh`가 경고). 레이아웃 상세는 features.md "학생 포털 레이아웃".
