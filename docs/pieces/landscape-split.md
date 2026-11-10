# 태블릿 가로 2단 — `landscape-split`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 가로 900px 이상에서 왼쪽 자료·오른쪽 쓰기. 오른쪽 열은 머리 띠 아래 sticky, «다음» 버튼은 늘 보인다. 세로·폰은 1단.

**언제 쓰나**: 자료를 보며 쓰거나 고르는 화면

**나오는 앱**: empire-rebut, survive-eras, nation-building(2부 `.p2-grid`), culture-dig(`.write-split`)

## 기준 구현

`empire-rebut/style.css`의 `@media (min-width:900px) and (orientation:landscape)` 블록(`.split`, `.col-src`, `.col-write` sticky, `.col-write .nav` sticky bottom, `--head-h`) + `app.js`의 `syncHead`.

## 꼭 지킬 것

- 머리 띠 높이는 JS가 `--head-h`로 CSS에 알려 sticky 위치를 맞춘다.
- 1180×820, 1024×768에서 확인.
- 컨테이너 폭은 3단계(28 → 48 → 64rem, empire-rebut `.page`).

## 흔한 실수

- 가로 2단이 없는 옛 앱(IR, modern_slavery, suffrage, two_unifications, vienna)은 `max-width:720~820px` 고정 폭이다 — 틀로 써도 폭은 3단계로 바꾼다.
- sticky를 두 곳(머리 띠 + 고정 띠)에 두면 겹친다.
