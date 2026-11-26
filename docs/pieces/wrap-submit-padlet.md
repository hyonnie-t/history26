# 마무리: 제출하고 복사하기 + 패들렛 버튼 — `wrap-submit-padlet`

<!-- 2026-11-10 웹앱 12개 조사로 만듦. 기준 구현은 함수·클래스 이름으로 찾는다(줄 번호는 바뀜). 바꿀 일이 생기면 이 장을 고친다. -->

**무엇**: 글 요약과 실제 글자 수를 보여 주고, 버튼 하나로 제출과 클립보드 복사를 함께 한다. 제출이 성공한 뒤에만 «우리 반 패들렛 열기»가 열린다.

**언제 쓰나**: 학생 글을 제출하고 반 패들렛에 올리게 하는 모든 앱

**나오는 앱**: empire-rebut, survive-eras, culture-dig, suneung-dungeon, nation-building(최신 방식) / vienna_diary, suffrage_age, two_unifications, modern_slavery, IR-simulator(옛 2버튼 방식)

## 기준 구현

`empire-rebut/app.js`의 `renderSummary`·`renderPadlet`·`submitAll`·`copyText`, `index.html`의 `.padlet-box`·`#padletBtn`. 여러 부가 있는 앱은 `nation-building/app.js`의 `submitPart2`.

## 꼭 지킬 것

- 큰 버튼은 «제출하고 복사하기» 하나(`submitBtn`). 핸들러 첫머리(검증 `confirm` 뒤, 첫 `await` 앞)에서 `const copyP = copyText(...)`로 복사를 먼저 시작한다(클릭 직후여야 브라우저가 허용).
- `padletBtn`은 제출 성공 전 `hidden`, 실패하면 계속 숨기고 «저장이 안 됐어…» 안내. `copyBtn`은 «다시 복사»로 제출 뒤에만.
- CSS에 `[hidden]{display:none!important}`. 확인은 `getComputedStyle(btn).display`로.
- 패들렛 주소는 레포에 적지 않는다. `?mode=curriculum`의 `portfolio.urlByBan`에서 학번의 반으로 가져오고, 없으면 버튼을 숨기고 «선생님이 알려 준 곳» 안내.
- 제출 body 최상위 `reflection`(학생 글), `choiceSummary`, `Object.assign(body, FocusGuard.payload())`. 성공 직후 `DraftGuard.clear()`.
- 복사 글은 본문 중심, 양식 문구 최소(→ `char-count.md`).
- **«✏️ 고쳐서 다시 내기» 단추를 기본으로 넣는다**(출처: 효니 말 2026-11-26 쪽지 imwvosbizm6w7 «앞으로는 고쳐서 다시 내기 버튼을 기본값으로 넣어줘»). 제출하면 잠겨서, 막 찍고 낸 학생이 다시 낼 길이 없는 줄 알았던 일 때문이다.
  - 자리: 제출 단추 줄 바로 아래 `<button id="fixBtn" class="<보조 단추> wide" type="button" hidden>✏️ 고쳐서 다시 내기</button>`. 제출 성공 처리 끝에서 `fixBtn.hidden = false`.
  - `unlockForFix()`: 보내는 중이거나 제출 안 했으면 끝 → `S.submitted = false` → 제출 때 잠근 것(readOnly·disabled·`data-no-draft`·고르기 막음·기기에 남긴 «제출함» 표시)을 모두 되돌림 → 제출 때 지운 고른 값이 있으면 다시 저장 → `fixBtn` 숨김 → 제출 단추를 켜고 «다시 제출» → 안내 «고친 뒤 «다시 제출»을 눌러 줘. 새로 낸 글이 앞의 것을 대신해.» 쓴 글·고른 것은 화면에 그대로 둔다(지우는 게 없으니 확인 창 없음).
  - 백엔드는 고치지 않는다: 제출마다 새 행을 쓰고 최신 행을 기록으로 본다(대시보드엔 다시 «미확인»).
  - 진행이 기기에 남아 다음 차시에 이어 하는 게임형 앱(`survive-eras`)은 고칠 글이 없으니 엔딩에 «🔄 처음부터 다시 하기»(앱 안 확인 창 → 학번별 저장 지우고 처음부터)를 둔다.
  - 기준 구현: `trench_letters`·`culture-dig`의 `unlockForFix`, `survive-eras`의 `askRedo`·`doRedo`(2026-11-26 커밋). «이미 제출했어. 선생님께 물어봐»처럼 다시 내기를 막는 문구는 쓰지 않는다.

## 흔한 실수

- 옛 2버튼 앱(`vienna_diary` 등)을 틀로 고르면 제출 안 하고 패들렛으로 가는 사고가 다시 난다. 마무리 화면만은 empire-rebut 방식으로 바꿔 넣는다.
- `IR-simulator`는 주소만 있으면 제출 전에도 패들렛 버튼을 켠다(옛 방식) — 따라 하지 않는다.
- `.btn{display:inline-block}`이 `hidden`을 이겨 버튼이 보이는 함정(culture-dig 2026-11-10).
