# 글자 수 표시 — `char-count`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 칸마다 «N자», 마무리 화면에 «내가 쓴 글 N자 (양식 줄 제외) — 60자 이상 써 보자». 모자라면 `.warn`과 제출 전 `confirm`(막지는 않음).

**언제 쓰나**: 서술형이 있는 앱(칸별 + 마무리 합계)

**나오는 앱**: 서술형 앱 10개

## 기준 구현

`empire-rebut/app.js`의 `renderSummary`(`bodyCount`+warn)와 `submitAll`의 confirm, `style.css`의 `.count.warn`. 칸별은 `modern_slavery`의 `bindCount`.

## 꼭 지킬 것

- «양식 줄 제외»의 괄호 문구와 실제 계산 함수(뺄 것: 첫 줄·[꼬리표] 등)를 같이 바꾼다.
- 미리보기에서는 confirm 건너뜀(`skip()`).

## 흔한 실수

- `trim().length` 기준이라 줄바꿈이 많으면 어긋난다. 판정 로직이 있는 앱은 `logic.js`에(culture-dig `Logic.countChars`).
