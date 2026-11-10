# 화면 조각 설명서

<!-- 2026-11-10 시작. 메타 Astryx의 «부품마다 설명서 한 장, AI가 찾아 쓰기»를 효니 수업 웹앱에 맞게 빌렸다. 규칙은 docs/webapp-rules.md «새 앱은 틀에서 시작한다». -->

새 수업 앱을 만들 때 **① 아래 «앱 틀»에서 가장 가까운 앱을 고르고 ② 쓰는 조각마다 설명서를 읽는다.**
찾을 때: `grep -ril "<낱말>" docs/pieces` (예: `순서`, `패들렛`, `가로`).

## 앱 틀 — 활동 유형별로 가장 가까운 앱

| 활동 유형 | 틀 | 화면 흐름 | 주의 |
|---|---|---|---|
| 근거 고르고 글쓰기(짧게) | `vienna_diary` | 시작 → 뽑기 → 사실 고르기 → 쓰기 ①②③ → 마무리 | 마무리는 옛 2버튼 → `wrap-submit-padlet`로 바꿔 넣기, `skip()` 없음 |
| 지난 글 불러와 의견글 | `suffrage_age` | 시작 → 내 지난 글 → 입장 → 교과서 사실 → 쓰기 → 마무리 | 마무리 옛 방식 |
| 판단형(기준 정하고 고르고 이유) | `modern_slavery` | 시작 → 기준 정하기 → 자료 읽고 판단 → 마무리(예시 글) | 마무리 옛 방식, 가로 2단 없음 |
| 지문 읽고 반박·형광펜 | `empire-rebut` | 시작 → 고르기 → 뜯어보기(형광펜) → 근거 → 쓰기 → 마무리 | 가장 최신·풍부. 기본 틀로 가장 안전 |
| 두 사건 비교 | `two_unifications` | 시작 → 찾기(순서 맞추기) ×2 → 같은 점·다른 점 → 쓰기 → 마무리 | 마무리 옛 방식, Sortable CDN |
| 끌어 맞추기·시뮬레이션 | `IR-simulator` | 도입 → 단계별 조작(끌기·탭) → 마무리(고르기+글) | 마무리 옛 방식 |
| 분류 게임 / 카드 글쓰기 / 모둠 카드 게임(부 나눔) | `nation-building` | `?part=1` 분류판 → `?part=2` 카드 쓰기 → `?part=3` 모둠 레이드 | `GAME_NAMES`로 부마다 이름 |
| 발굴·방탈출 게임 + 한 줄 쓰기(모둠) | `culture-dig` | 입력 → 팀·활동 → 퀴즈 → 발굴/방탈출 → 수첩 쓰기·제출 | 활동마다 `GAME_*` 이름 |
| 스토리 선택 게임(총복습) + 서술형 | `survive-eras` | 누구니? → 시대 → 갈림길 → 실제 역사 → 엔딩 서술·제출 | DraftGuard 안 씀 |
| 퀴즈·기출(교사 진행) | `suneung-dungeon` | 입구 → 성향 → 시범 문제 → 보스 → 모의고사 → 결과 | 비공개 앱 |
| 기출 풀이·오답노트 | `final-practice` | 홈 → 주제 → 퀴즈 → 결과 → 오답노트 | Tailwind, 다른 체계 — 조각 설명서와 안 맞음 |
| 체크리스트·자기채점 | `final-test` | 탭 → 주제 칩 → 질문 카드(안다/모른다·힌트·정답) | 별도 변수 체계·다크 모드 |

맞는 틀이 없으면 `empire-rebut`의 뼈대(시작·미리보기·단계·마무리)만 쓰고 가운데 활동을 새로 만든다.

## 조각 목록

| 조각 | 설명서 | 나오는 앱 수 |
|---|---|---|
| 마무리: 제출하고 복사하기 + 패들렛 버튼 | [`wrap-submit-padlet.md`](wrap-submit-padlet.md) | 9+ |
| 학번·이름 시작 화면 | [`student-start.md`](student-start.md) | 10+ |
| 미리보기 띠 | [`preview-bar.md`](preview-bar.md) | 1+ |
| 단계 진행 막대 | [`step-bar.md`](step-bar.md) | 6+ |
| 다음 버튼 잠금·이유 한 줄 | [`step-gate.md`](step-gate.md) | 9+ |
| 고르기 카드 | [`choice-card.md`](choice-card.md) | 3+ |
| 형광펜·문장 고르기 | [`highlight-pick.md`](highlight-pick.md) | 3+ |
| 서술형 쓰기 칸 묶음 | [`write-part.md`](write-part.md) | 5+ |
| 힌트 토글 | [`hint-toggle.md`](hint-toggle.md) | 9+ |
| 글자 수 표시 | [`char-count.md`](char-count.md) | 1+ |
| 태블릿 가로 2단 | [`landscape-split.md`](landscape-split.md) | 4+ |
| 낱말 풀이 줄 | [`glossary-words.md`](glossary-words.md) | 1+ |
| 순서 정렬(▲▼ + 드래그) | [`reorder-list.md`](reorder-list.md) | 4+ |
| 앞 선택 다시 보여 주는 고정 띠 | [`pin-recap.md`](pin-recap.md) | 3+ |
| 토스트 알림 | [`toast.md`](toast.md) | 5+ |
| 진행 기억(학번별 저장) | [`progress-memory.md`](progress-memory.md) | 6+ |
| 예시 글 잠금 해제 | [`example-unlock.md`](example-unlock.md) | 2+ |
| 표지 그림 띠 | [`cover-banner.md`](cover-banner.md) | 1+ |
| 공용 도우미 함수 | [`common-helpers.md`](common-helpers.md) | 거의 전부 |

## 색 변수 (공통인 것만)

- 같은 뜻으로 쓰는 다섯 개: `--paper`(페이지 바탕) `--page`(카드 바탕) `--ink` `--muted` `--line`. 밝게·진하게는 `-wash`/`-deep` 접미사.
- 강조색 이름은 주제를 따라 자유롭게(`--plum`, `--brass` …). 오류색은 새 앱부터 `--alert`로 맞춘다.
- 함정: `suneung-dungeon`은 `--paper`가 카드 바탕(뜻이 반대), `culture-dig`는 바탕이 `--floor`.
- 배색 자체는 틀을 따르지 않는다(최근 3~4개 앱과 둘 이상 다르게, 스킬 섹션 2).

## 아직 설명서가 없는 것(한 앱에만 있음)

연표(survive-eras 엔딩 지도), 말풍선 대화(survive-eras·nation-building 각자 구현), 낱말 찾기 시트(empire-rebut `word_lookup.js`), 자료 탭. 두 번째 앱에 나오면 그때 설명서를 만든다.

## 조사하며 본 옛 앱의 빈 곳 (고치지 않음, 참고)

- «제출하고 복사하기» 한 버튼이 아닌 옛 2버튼: vienna_diary, suffrage_age, two_unifications, modern_slavery, IR-simulator.
