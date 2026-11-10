# 진행 기억(학번별 저장) — `progress-memory`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 학번별 localStorage 키에 고른 값만 저장한다. 글 칸은 DraftGuard 몫. 미리보기·제출 뒤에는 저장하지 않는다.

**언제 쓰나**: 여러 화면에 걸친 활동(새로고침해도 이어 하기)

**나오는 앱**: empire-rebut, modern_slavery, vienna_diary, IR-simulator, survive-eras, nation-building

## 기준 구현

`empire-rebut/app.js`의 `storeKey`·`save`·`load`(7일 만료, 옛 판 기록 버림)·`clearSave`.

## 꼭 지킬 것

- 제출 성공 뒤 `clearSave()` — 공용 태블릿에서 다음 학생에게 남지 않게.
- 데이터 id 체계를 바꾸면 옛 기록 버리는 코드를 넣는다.

## 흔한 실수

- DraftGuard가 이미 글을 저장하는데 글까지 또 저장하면 둘이 엇갈린다.
