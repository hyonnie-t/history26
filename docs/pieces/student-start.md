# 학번·이름 시작 화면 — `student-start`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 학번 5자리(학년1+반2+번호2)와 이름을 받아 검증하고, 시작할 때 FocusGuard·DraftGuard를 켜고, 패들렛 주소를 미리 가져오고, 진행 기억을 되살린다. `?sid=&name=`이 오면 자동으로 채운다.

**언제 쓰나**: 모든 수업 앱의 첫 화면

**나오는 앱**: IR-simulator, culture-dig, empire-rebut, modern_slavery, nation-building, suffrage_age, suneung-dungeon, survive-eras, two_unifications, vienna_diary

## 기준 구현

`empire-rebut/index.html`의 `#s0`, `app.js`의 `parseSid`·`startApp`·`init`(자동 채움). 포털에서 이름·학번이 오면 입력칸을 숨기고 «이름 (학번)»만 보이는 판은 `survive-eras`의 `.known-who`, `suneung-dungeon`의 `whoLine`/`whoEdit`.

## 꼭 지킬 것

- 순서: 검증 → `FocusGuard.start({ key: CONFIG.GAME_NAME + ":" + sid })` → `DraftGuard.start` → 패들렛 주소 선로딩 → 진행 기억 `load()` → 화면 이동.
- 학번·이름 칸에 `data-draft`를 붙이지 않는다. DraftGuard는 `textarea`와 `[data-draft]`만 저장하므로 보통 `<input>`인 학번 칸은 저장되지 않는다. `data-no-draft`는 붙여도 해롭지 않다(empire-rebut·nation-building·two_unifications).
- `<head>`의 `<meta charset>` 바로 뒤에 `portal_auth.js` 한 줄(복사하지 말고 주소 그대로).

## 흔한 실수

- 학번 칸을 `textarea`로 만들면 DraftGuard가 저장해 공용 태블릿 다음 학생에게 앞 학생 학번이 채워진다 — 학번은 `<input>`으로.
- 클립보드 복사용 임시 `textarea`에는 `data-no-draft`를 붙인다(vienna_diary·culture-dig의 `copyText`).
- 학번 예시(20512/30512)는 대상 학년에 맞춘다.
