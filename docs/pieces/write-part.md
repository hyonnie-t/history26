# 서술형 쓰기 칸 묶음 — `write-part`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: `PARTS` 데이터로 «라벨 · 안내 · 힌트 · textarea · 글자 수»를 한 묶음씩 만든다.

**언제 쓰나**: 서술형이 있는 앱

**나오는 앱**: vienna_diary, suffrage_age, two_unifications(`buildWrites`), empire-rebut·IR-simulator(고정 칸), modern_slavery(`bindCount`)

## 기준 구현

`vienna_diary/app.js`의 `buildParts`·`renderWriteHead`·`clearBoilerplate`/`isBoilerplate`/`checkParts`, `style.css`의 `.hint`·`.count`.

## 꼭 지킬 것

- textarea에 고정 `data-draft="<id>"`(DraftGuard가 되살린다).
- placeholder·«예:»에 정답을 떠올리게 하는 말 금지 — 형식만 안내.
- 임시저장에서 되살아난 안내 문구는 지우고, 교과서 문장을 그대로 낸 글은 막는다(vienna_diary의 방어).

## 흔한 실수

- `suffrage_age`의 `buildParts`는 같은 코드지만 방어 로직이 없다 — vienna_diary 판을 쓴다.
