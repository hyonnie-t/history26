# 공용 도우미 함수

<!-- 화면 조각이 아니라 거의 모든 앱에 복붙된 함수들. 새 앱은 empire-rebut/app.js에서 가져온다. 줄 번호는 바뀌니 함수 이름으로 찾는다. -->

| 함수 | 하는 일 | 기준 |
|---|---|---|
| `el(tag, attrs, ...children)` | 요소 만들기 | `empire-rebut/app.js` |
| `parseSid(v)` | 학번 5자리 검증·분해(학년1+반2+번호2) | 같음 |
| `postToSheet(body)` | 백엔드 POST(미리보기면 바로 return). 보내기는 `postWithRetry`(v183) | 같음 |
| `postWithRetry(url, body)` / `newClientId` / `submitRand` | 기본 제출 재시도: 오류 화면·HTTP 오류·네트워크 끊김·30초 초과면 1~3초 뒤 최대 2번 더, 제출마다 `clientId`(백엔드 v183이 10분 안 중복 행을 막음). 정상 JSON 오류·`action` 있는 요청은 안 다시 보냄 | `snippets/submit_retry.js`(복사 원본, 시험 `node snippets/submit_retry.test.mjs [앱 app.js]`) |
| `loadPadletUrl()` / `ensureUrlScheme` | `?mode=curriculum`에서 반 패들렛 주소 | 같음 |
| `copyText(text)` | 클립보드 복사 + `execCommand` 대체 경로 | 같음 |

- 백엔드 호출은 `fetch` + GET `studentId=` / POST JSON 본문이어야 로그인 세션이 붙는다(`portal_auth.js`).
- `focus_guard.js`·`draft_guard.js`·`glossary.js`는 앱 사본이 아니라 이 레포 `snippets/` 최신 파일을 복사한다(2026-11-10 기준 앱 사본과 같은 판).
