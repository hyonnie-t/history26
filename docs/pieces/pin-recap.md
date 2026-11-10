# 앞 선택 다시 보여 주는 고정 띠 — `pin-recap`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 앞에서 고른 역할·사실·형광펜·기준을 다음 화면 위에 요약으로 계속 보인다.

**언제 쓰나**: 앞 화면에서 고른 것·쓴 것을 보며 다음 활동을 하는 흐름

**나오는 앱**: empire-rebut(`.pin`), suffrage_age·vienna_diary·two_unifications(`.frame-note`), modern_slavery(`.recap-row`)

## 기준 구현

`empire-rebut/app.js`의 `renderPin`(화면마다 보여 줄 줄을 바꿈), `style.css`의 `.pin`. 단순판은 `modern_slavery`의 `renderRecap`.

## 꼭 지킬 것

- sticky는 한 곳에만(머리 띠가 sticky면 고정 띠는 일반 흐름).

## 흔한 실수

- `.frame-note`(sticky top:0)를 empire-rebut식 sticky 머리 띠와 같이 쓰면 겹친다.
