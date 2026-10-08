---
paths:
  - "config.js"
  - "checkin_data.js"
---

# config.js / checkin_data.js

- `config.js` = `window.PORTAL_CONFIG`.
  - `RANKS`는 `{ 2: [...], 3: [...] }` **학년별 8단계**(2학년 30차시·3학년 15차시라 문턱 분리). `renderPortal()`이 `CONFIG.RANKS[SESSION.grade]`로
    고르고 없으면 2학년 배열로 폴백. 탐구 나무 8단계와 1:1.
  - **`CURRICULUM`은 비워 둔다** — 실제 소스는 Google Sheets, 로딩 시 `mode=curriculum`으로 채워지고 교사 대시보드 "커리큘럼 관리" 탭에서 편집한다.
  - `BAN_SIZE`: 숫자가 채워진 반 = 실제 담당 반(현재 2학년 1~4반, 3학년 5~8반). 담당 반이 바뀌면 같이 갱신해야 체크인 탭
    "OO명 중 XX명 완료" 분모가 맞는다.
  - `POINTS_PER_LESSON`은 **안 쓰이는 죽은 값**. 실제 배점은 `.claude/rules/index-html.md` "포인트·칭호".
- `checkin_data.js` = `CHECKIN_CONFIG`(감정 온도 척도·기본 단어칩 등 정적 UI만). 문항(`CHECKIN_PLAN`)은 시트 "체크인문항" 탭 → `mode=checkinPlan`.
  체크인 문항 폼 함정은 `docs/features.md` "체크인 문항 관리 폼".
