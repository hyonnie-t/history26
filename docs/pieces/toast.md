# 토스트 알림 — `toast`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 하단 중앙에 2.2초 뜨는 `role="status"` 알림.

**언제 쓰나**: «2곳까지만 칠할 수 있어»처럼 짧게 알릴 때

**나오는 앱**: IR-simulator, empire-rebut, nation-building, suneung-dungeon, final-practice

## 기준 구현

`empire-rebut/app.js`의 `toast`(clearTimeout 후 2200ms), `index.html`의 토스트 요소, `style.css`.

## 꼭 지킬 것

- `hidden` 토글이므로 CSS가 `display`를 덮어쓰지 않게(`[hidden]` 규칙).

## 흔한 실수

- 오류(제출 실패)는 토스트가 아니라 `.err`에 남겨 둔다 — 2초 뒤 사라지면 학생이 못 본다.
