# 순서 정렬(▲▼ + 드래그) — `reorder-list`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 카드를 위/아래로 옮겨 순서를 정한다. 태블릿에서 정확하도록 ▲▼ 버튼이 기본, 드래그는 덤.

**언제 쓰나**: 사건·카드를 순서대로 놓는 활동

**나오는 앱**: IR-simulator(`renderOrder`), nation-building(`renderRank`), two_unifications(`buildCard`+Sortable), culture-dig

## 기준 구현

버튼만: `nation-building/app.js`의 `renderRank` + `logic.js`의 `moveRank`(순수 함수, 테스트 있음), 44px 버튼·`aria-label`. 드래그 같이: `two_unifications/app.js`의 `buildCard`·`moveCard`(이동 뒤 포커스 유지)와 Sortable 연결(없으면 버튼만).

## 꼭 지킬 것

- 순서 계산은 `logic.js` 순수 함수 + 단위 테스트.
- 제출 뒤 버튼 disabled.
- ☰ 손잡이를 보였으면 드래그가 실제로 돼야 한다(`window.Sortable` 확인).

## 흔한 실수

- 외부 CDN(Sortable)은 학교망 차단 여부 미확인 — 레포에 복사해 쓰는 쪽이 안전.
- 손가락 드래그는 스크롤과 부딪힌다(nation-building은 판 위 카드를 눌러서 옮김).
