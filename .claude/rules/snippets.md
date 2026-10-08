---
paths:
  - "snippets/**"
---

# snippets/ — 개별 웹앱에 복사해 쓰는 원본

- `focus_guard.js`(작성 과정 신호)·`draft_guard.js`(글쓰기 임시저장)·`glossary.js`+`hard_words.json`+`vocab_check.mjs`(어휘 풀이)는
  각 웹앱 레포에 **복사본**으로 들어간다. 여기서 고쳐도 기존 웹앱엔 자동 반영되지 않는다 — 기존 레포 소급은 효니가 시킬 때만,
  인라인으로 붙인 앱은 복사본을 직접 다시 붙여야 한다.
- 동작·옵션·함정(5초 미만 이탈 무시, `allowHosts`, `clear()` 호출 시점, `data-draft`/`data-no-draft`, 풀이 규칙 등)은
  `docs/features.md`의 "작성 과정 신호"/"글쓰기 임시저장"/"어휘 풀이". 웹앱에 넣는 규칙은 `docs/webapp-rules.md`.
- `hard_words.json`은 앱을 만들 때마다 늘린다(목록이 아는 낱말만 잡으므로 새 앱은 사람이 먼저 읽고 추가).
