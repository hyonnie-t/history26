# 낱말 풀이 줄 — `glossary-words`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: `GLOSSARY`의 낱말에 `Glossary.start`가 밑줄을 긋고 누르면 풀이를 연다. 누르는 칸 안에서는 밑줄을 못 쓰니 칸 밖 «모르는 낱말:» 줄에 모은다.

**언제 쓰나**: 모든 수업 앱(어휘 점검)

**나오는 앱**: 수업 앱 10개

## 기준 구현

`empire-rebut/app.js`의 `renderWords(box, all, label)`(긴 낱말 안의 짧은 낱말은 빼되 따로 나오면 남김)와 `Glossary.start`의 skip 목록, `style.css`의 `.words`·`.words-label`.

## 꼭 지킬 것

- skip에 `#steps`와 누르는 칸(카드·형광펜 조각·근거 문장)을 넣는다.
- 풀이는 그 낱말이 처음 보이는 화면부터(고르기 화면 포함).
- `hard_words.json`에 더하고 `node snippets/vocab_check.mjs <앱>` 누락 0건.
- `glossary.js`는 이 레포 `snippets/` 최신 파일을 복사(앱 사본 복사 금지).

## 흔한 실수

- 한 문단에서 첫 번째만 밑줄이 그어진다. `unique: true` 여부가 앱마다 다르다.
