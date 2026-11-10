# 단계 진행 막대 — `step-bar`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 위쪽에 «준비/…/마무리» 단계를 보이고 지금·끝난 단계를 표시한다.

**언제 쓰나**: 화면이 3단계 이상 이어지는 앱

**나오는 앱**: IR-simulator, empire-rebut, modern_slavery, suffrage_age, two_unifications, vienna_diary

## 기준 구현

`modern_slavery/app.js`의 `SCREENS`(화면→단계 표)와 `show()`의 `aria-current="step"`, `style.css`의 `.steps li.on`·`.done::before{content:"✓ "}`. 머리 띠와 함께 위에 고정하려면 `empire-rebut`의 `.book-head`(sticky)와 `show`.

## 꼭 지킬 것

- 단계 글자 16px 이상. 화면→단계 매핑은 표 하나로.
- `Glossary.start`의 skip에 `#steps`를 넣는다.

## 흔한 실수

- 상태 클래스가 앱마다 `.on`/`.now`로 다르다 — CSS와 JS 이름을 같이 맞춘다.
- `empire-rebut`의 `.steps li`는 약 15px로 16px 규칙보다 작다. 따라 하지 않는다.
