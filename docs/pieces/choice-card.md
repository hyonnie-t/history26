# 고르기 카드 — `choice-card`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 라디오/체크박스 역할의 큰 카드. `aria-checked`로 상태를 보이고 Enter/Space도 받는다.

**언제 쓰나**: 둘 이상 중에서 고르는 판단·선택 화면

**나오는 앱**: empire-rebut(`.claim`), modern_slavery·suffrage_age·nation-building(`.opt`), two_unifications·suneung-dungeon·survive-eras(`.choice`)

## 기준 구현

`empire-rebut/app.js`의 `pickable(node, role, checked, onPick)` — 카드 안 낱말(`.term`)을 누르면 고르지 않고 풀이만 연다. 모양은 `modern_slavery/style.css`의 `.opt`(원형 ✓)와 `suffrage_age`의 `optEl`.

## 꼭 지킬 것

- 라디오면 부모에 `role="radiogroup"` + `aria-labelledby`.
- 제출 뒤에는 고르기를 잠근다(`if (S.submitted) return`).
- 카드 안 낱말 밑줄은 skip하고 풀이는 카드 밖 줄에(→ `glossary-words.md`).

## 흔한 실수

- `modern_slavery`의 `radioGroup`은 `.term` 클릭 가드가 없어 skip으로 밑줄을 아예 껐다. 새 앱은 `pickable`을 쓴다.
- `div role` 방식과 `<button>` 방식(survive-eras)이 섞여 있다 — 한 앱 안에서는 하나로.
