# 다음 버튼 잠금·이유 한 줄 — `step-gate`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 조건을 채우기 전에는 «다음»을 비활성으로 두고, 눌렀을 때는 `.err`에 이유 한 줄을 보인다.

**언제 쓰나**: 고르기·빈칸·최소 글자를 채워야 넘어가는 단계

**나오는 앱**: IR-simulator, empire-rebut, modern_slavery, nation-building, suffrage_age, suneung-dungeon, survive-eras, two_unifications, vienna_diary

## 기준 구현

`empire-rebut/app.js`의 `refreshOpen`·`refreshEvidenceNext`·`refreshWrite`(disabled 갱신)와 `init`의 `s*Next` 핸들러(`.err`에 이유), `style.css`의 `.btn:disabled`.

## 꼭 지킬 것

- «비활성 + 이유 한 줄» 두 겹. 조건 계산에 `skip()`을 한 곳에서 붙인다.
- `.err`에 `role="alert"`.

## 흔한 실수

- `vienna_diary`·`modern_slavery`는 비활성 없이 클릭 뒤 오류만 보인다 — 태블릿에서 학생이 왜 안 넘어가는지 모른다.
