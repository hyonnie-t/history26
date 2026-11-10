# 힌트 토글 — `hint-toggle`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: «💡 막막하면 힌트 보기» 접이식. 맥락 단서·질문만 담고 답은 넣지 않는다.

**언제 쓰나**: 서술형 칸마다

**나오는 앱**: IR-simulator, modern_slavery, nation-building, vienna_diary, two_unifications, suffrage_age, empire-rebut, culture-dig, final-test

## 기준 구현

기본은 `<details class="hint"><summary>`. 함수 하나로 넣으려면 `two_unifications/app.js`의 `hintEl(text)`. 버튼+`aria-expanded`판은 `empire-rebut`. 단계식(힌트1→2)은 `final-test`, 힌트 횟수를 점수에 넣는 판은 `culture-dig`.

## 꼭 지킬 것

- 힌트는 «비교 대상 제시, 관점 바꾸는 질문». 정답 낱말 금지.

## 흔한 실수

- `<details>`면 summary에는 낱말 밑줄이 안 그어지고 본문에는 그어진다 — 풀이가 필요하면 본문에 둔다.
