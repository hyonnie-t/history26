/**
 * ============================================================
 * 2학기 통합 학습 포털 — 백엔드 v24
 * ============================================================
 * [v24] 학습 칭호(A) — 카테고리 고정 4개 → 활동 단위 동적 배지로 전환.
 *   문제: THINKING_TYPE_BADGE가 사고유형 카테고리(판단/비교/해석/관점) 1개당
 *   배지 1개(결정왕/비교왕/해석왕/다른 눈으로 본 사람)로 고정돼 있어서, 사고유형이
 *   붙은 활동이 몇 개든 학습 칭호는 항상 4개를 못 넘었음. 이제 "활동(activityId)
 *   단위"로 칭호를 내려서, 활동이 늘어나면 칭호도 그만큼 늘어나게 바꿈.
 *   사고유형(CLCOL_THINKING_TYPE, '판단'/'비교'/'해석'/'관점') 자체는 그대로 유지
 *   — 세특 매핑용 다른 체계와 별개라 이번 작업에서 안 건드렸고, 앞으로는
 *   "칭호명이 속할 그룹 + 이모지 결정" 용도로만 쓰인다.
 *   - 커리큘럼 시트에 '칭호명' 컬럼 신규(CLCOL_BADGE_NAME = 15). 사고유형이
 *     빈칸(자유서술형 차시)이면 칭호명도 빈칸 — 배지 없음.
 *   - BADGE_NAME_POOL 신규(참고용 상수) — 판단/비교/해석/관점 그룹별 이름 후보
 *     8개씩. 교사가 대시보드에서 칭호명을 입력할 때 참고하도록 대시보드 폼에도
 *     자동완성(datalist)으로 노출. 이모지는 THINKING_TYPE_EMOJI로 그룹 단위 고정
 *     유지(판단⚖️/비교🔀/해석🔍/관점👁️) — 활동마다 새 이모지를 만들지 않음.
 *   - addLessonPost_/updateLessonPost_: data.badgeName 파싱 추가(thinkingType과
 *     같은 패턴). 검증 규칙: 사고유형이 채워졌는데 칭호명이 비어있으면 그 그룹의
 *     첫 번째 이름(결정왕/비교왕/해석왕/다른 눈으로 본 사람)을 기본값으로 채워서
 *     하위호환 유지(v22/v23 때 이미 사고유형만 채워둔 기존 행이 배지를 계속
 *     받을 수 있게).
 *   - curriculumAdminGet_: 각 lesson에 badgeName 필드 추가(thinkingType과 동일한
 *     용도 — 대시보드 수정 폼 프리필).
 *   - buildActivityBadgeMap_() 신규 — buildActivityThinkingTypeMap_과 같은 방식
 *     (parseLessonActivities_ 재사용)으로 activityId → { badgeName, thinkingType }
 *     맵을 만든다. 순차형 차시(활동목록JSON)는 사고유형과 동일한 정책으로 모든
 *     하위 활동이 칭호명 하나를 공유.
 *   - THINKING_TYPE_BADGE 상수 제거. BADGE_DEFS에서 A(학습 칭호) 고정 4개
 *     (decisionKing/compareKing/interpretKing/diffEyeSeer) 제거 — B(행동 칭호)·
 *     C(강점 칭호) 항목은 그대로 둠.
 *   - computeBadges_(activities, questionsCount) 리팩토링: A 부분을
 *     "achievement='상'인 활동마다 buildActivityBadgeMap_()로 칭호명·사고유형을
 *     찾아 'act_'+activityId를 id로 하는 배지를 그 자리에서 만든다" 방식으로 교체.
 *     기존 고정 id(decisionKing 등)는 BADGE_DEFS에서 이미 빠졌고 새 id는 'act_'
 *     접두사를 쓰므로 서로 충돌하지 않는다. 반환 형태(id·name·emoji·category·
 *     type·earned·count)는 그대로 유지 — B/C 계산 로직은 손대지 않음.
 *     studentGet_은 이미 매 호출마다 computeBadges_를 실시간 계산하므로 별도
 *     마이그레이션 불필요.
 * ── 이전 버전 히스토리(v23) ──
 * [v23] 사고유형 UI 추가 — v22에서 컬럼(CLCOL_THINKING_TYPE)만 만들어두고
 *   입력 경로가 없어서(대시보드 폼에 필드 없음, addLessonPost_/updateLessonPost_가
 *   data.thinkingType을 안 받음) A(학습 칭호) 4개가 계속 미충족 상태로 남던 문제.
 *   교사가 시트를 직접 열어 입력하는 대신 대시보드 폼으로 입력하게 함.
 *   - addLessonPost_/updateLessonPost_: data.thinkingType 파싱 추가.
 *     '판단'·'비교'·'해석'·'관점' 4개 값 외(빈 문자열 포함)가 오면 owner 필드
 *     검증 패턴과 동일하게 안전히 빈칸으로 처리 — 자유서술형 차시는 빈칸이 정상.
 *   - curriculumAdminGet_: 각 lesson에 thinkingType 필드 추가 — 대시보드
 *     "등록된 활동 수정" 폼이 기존 값을 프리필하는 데 씀.
 *   - buildActivityThinkingTypeMap_ 등 배지 계산 쪽 로직은 그대로(안 바뀜) —
 *     이제 그 맵이 참조하는 값이 시트 직접 입력이 아니라 이 UI로 들어올 뿐.
 *
 * ── 이전 버전 히스토리(v22) ──
 * [v22] 특별 칭호("칭호첩") 기능 — A(학습 칭호)·C(강점 칭호) 구현.
 *   B(행동 칭호) 중 개인 배지 2개(포기하지 않는 사람·질문왕)도 함께 포함.
 *   반 공통 배지 2개(생각이 다양한 반·함께 해낸 반)는 반 전체 조회 API가
 *   필요해서 이번 스코프에서 제외 — 나중에 별도 진행.
 *   - 커리큘럼 시트에 '사고유형' 컬럼 신규(CLCOL_THINKING_TYPE) — 판단·비교·
 *     해석·관점 중 하나, 자유서술형 차시는 빈칸. 태그값 자체는 교사가
 *     시트에 직접 채워 넣을 예정이라 여기서는 컬럼과 판정 로직만 준비.
 *   - buildActivityThinkingTypeMap_() 신규: 커리큘럼을 훑어서
 *     activityId → 사고유형 맵을 만든다(parseLessonActivities_ 재사용).
 *   - 게임활동_로그에 ai_module이 채우는 새 컬럼 3개(요인연결·반론관점·
 *     현재연결, COL_AP_FACTOR/COUNTERVIEW/PRESENT = 16~18)를 추가로 읽음 —
 *     ai_module_v8.gs의 STEP 1-B(표면조건) 판정 결과를 그대로 매핑만 함
 *     (여기서 AI가 새로 판단하지 않음). '반론논파'(COL_AP_REBUTTAL = 19)는
 *     자리만 마련해둔 상태 — ai_module이 아직 이 값을 채우지 않으므로
 *     해당 배지(반박왕)는 지금은 실제로 뜨지 않는다.
 *   - computeBadges_(activities, questionsCount) 신규: 학생의 활동 기록+
 *     질문함 개수로 칭호 목록(획득 여부·반복 카운트)을 계산.
 *   - studentGet_ 응답에 badges 필드 추가 — 프론트(index.html)가 사이드카드
 *     "칭호첩"을 그릴 때 그대로 사용.
 *
 * ── 이전 버전 히스토리(v21) ──
 * [v21-1] 순차진행(sequential) 서버측 검증 추가 — 지금까지는 앞 활동을 안 끝내면
 *   버튼을 잠그고 "🔒 n활동을 먼저 끝내면 열려요" 문구를 보여주는 게 프론트
 *   (index.html renderActivityBlock)에만 있었고, doPost 기본 경로(활동 최종 제출)는
 *   순차진행 여부를 전혀 확인하지 않았음 — 즉 프론트 버튼을 거치지 않고 API를
 *   직접 호출하면(예: fetch로 gameName만 뒤 활동id로 바꿔서 호출) 순차 위반 제출이
 *   그대로 기록됐음.
 *   - findLessonForActivity_(activityId) 신규: 커리큘럼 시트를 훑어서 이 활동이
 *     속한 차시의 activities 배열과 이 활동의 인덱스·순차진행 여부를 찾아줌.
 *   - checkSequentialGate_(studentId, activityId) 신규: 순차 차시의 2번째 이후
 *     활동이면, 게임활동_로그에서 이 학생이 바로 앞 활동을 이미 제출했는지 확인.
 *     안 끝냈으면 { ok:false, message } 반환.
 *   - doPost 기본 경로(활동 기록, judgment 아닌 경우)에서 시트에 appendRow하기
 *     직전에 이 게이트를 통과시킴 — 막히면 result:'error', locked:true로 응답하고
 *     시트에는 아무것도 기록하지 않음. studentId나 gameName이 없는 호출(기존처럼
 *     비정상 요청)은 기존 동작 그대로 두고 이 검증을 건너뜀.
 *
 * [v21] 교사 토큰을 1개(공용)에서 2개(교사별)로 분리 — "완전 분리"는 아니고
 *   "기본값만 내 반으로" 용도. 서버 쪽 권한 자체는 안 바꿈(어느 토큰이든
 *   여전히 전체 데이터 접근 가능) — 대신 로그인 응답에 어느 교사인지
 *   실어 보내서, 프론트가 그 값으로 기본 필터·커리큘럼 "담당" 기본값을
 *   자동으로 맞춰줌.
 *   - TEACHER_TOKEN(단일 상수) → TEACHER_TOKENS(토큰→교사이름 맵) +
 *     teacherNameForToken_(token) 헬퍼로 교체. 토큰 검사하던 25곳 전부
 *     이 헬퍼를 쓰도록 일괄 교체.
 *   - teacherGet_(대시보드 진입 시 가장 먼저 호출되는 엔드포인트)이
 *     rows와 함께 teacher(교사 이름)를 같이 반환.
 *   - 미현쌤 전용 토큰은 아직 임시값('mh26') — 실제 배포 전에 원하는
 *     값으로 바꿔서 써야 함.
 *
 * ── 이전 버전 히스토리(v20) ──
 * [v20] 미현쌤 담당 반에 대해 커리큘럼을 따로 구성할 수 있게 확장.
 *   - 학년정보 시트에 '효니담당반'·'미현쌤담당반' 컬럼 추가(반 번호를
 *     쉼표로 나열, 예: "1,2,3,4"). 둘 다 비어있으면 그 학년은 담당
 *     구분이 아예 없는 상태로 취급됨 — 기존 학년(3학년 등)은 이 두 칸을
 *     채우기 전까진 지금처럼 전부 공통으로 동작.
 *   - 커리큘럼 시트에 '담당' 컬럼 추가('공통'(기본)·'효니'·'미현쌤').
 *     '공통'이 아닌 차시는 학년정보의 반 매핑에 해당하는 반의 학생에게만
 *     보임 — 프론트(index.html)가 로그인한 학생의 반으로 판단.
 *   - curriculumGet_이 학년마다 hyoBans·mihyunBans(숫자 배열)를 같이
 *     내려주고, 각 차시엔 owner가 '공통'이 아닐 때만 값을 실어 보냄.
 *   - addLessonPost_/updateLessonPost_/updateGradeInfoPost_ 확장.
 *
 * ── 이전 버전 히스토리(v19) ──
 * [v19] 한 차시에 활동을 2개(이상) 넣을 수 있게 확장 + 순차 진행 on/off.
 *   - 커리큘럼 시트에 '활동목록JSON'·'순차진행' 컬럼 추가(CLCOL_ACTIVITIES,
 *     CLCOL_SEQUENTIAL). 비어있으면 기존처럼 활동id·타입·URL 3개 컬럼으로
 *     활동 1개짜리 차시로 동작 — 기존 데이터는 전혀 안 건드려도 됨.
 *   - parseLessonActivities_(row) 신규: 이 컬럼을 파싱해서 항상
 *     activities 배열을 돌려주는 공용 헬퍼. curriculumGet_(학생용)이
 *     이제 lesson.type/lesson.url 대신 lesson.activities[]를 내려줌.
 *   - curriculumAdminGet_(교사용)은 기존 필드(type/urlText 등, 대표값)에
 *     activitiesRaw·activitiesCount·sequential을 추가로 얹어서 내려줌 —
 *     대시보드 "등록된 활동" 목록·수정 폼이 이 값으로 활동 2개 모드를 판단.
 *   - addLessonPost_/updateLessonPost_: data.activities(배열)가 오면
 *     활동목록JSON으로 저장(기존 타입·URL 컬럼은 비움), 안 오면 기존과 동일.
 *
 * ── 이전 버전 히스토리(v18) ──
 * v17(체크인문항 시트화) 기준, "제출/로그인이 느리다"는 신고를 진단해서
 * 나온 백엔드 원인 2가지를 고친 버전.
 *
 * [v18-1] 체크인 시트 서식 지정이 매 로그인마다 반복 실행되던 버그 수정.
 *   - getOrCreateCheckinSheet_() 안의 setNumberFormat('@') 호출이 if문
 *     밖에 있어서, 시트가 이미 있어도 학생 로그인·체크인 조회할 때마다
 *     매번 시트 전체 행에 서식을 다시 씀. 시트를 "처음 만들 때"만
 *     하면 되는 작업이므로 if(getLastRow()===0) 블록 안으로 이동.
 *
 * [v18-2] doPost 기본 경로(활동 최종 제출)에서 Gemini를 동기 호출하던
 *   구조 제거 — 전면적으로 ai_module_v6.gs의 배치 분석(트리거)에 위임.
 *   - 문제: choicesJson이 {choice, reason} 구조(예: 여진_이자겸판단
 *     게임)인 제출 건은 buildFeedbackPrompt_가 프롬프트를 만들어서
 *     callGeminiFeedback_를 즉시 호출했음. 즉 학생이 제출 버튼을 누르면
 *     "시트 기록 → Gemini 응답 대기(수 초, 429면 그냥 실패) → 응답 반환"
 *     순서로 처리돼서, 그 대기 시간만큼 학생 화면이 그대로 멈춰 있었음.
 *   - ai_module_v6.gs가 이미 같은 시트를 트리거로 주기적으로 훑으면서
 *     분류태그·1줄요약·성취수준·판단근거·AI코멘트를 전부 채워주고 있으므로
 *     doPost 쪽 실시간 경로는 불필요한 중복이자 지연 원인.
 *   - buildFeedbackPrompt_ / callGeminiFeedback_ 함수 자체는 삭제하지
 *     않고 남겨둠(나중에 다른 용도로 쓸 수도 있어서) — 다만 doPost
 *     기본 경로에서는 더 이상 호출하지 않음. 이제 제출은 시트 기록만
 *     하고 즉시 success를 반환하며, aiComment는 항상 빈 문자열로 내려감
 *     (프론트가 그 값을 화면에 즉시 쓰던 곳이 있다면 확인 필요 — 이제는
 *     AI 코멘트가 배치 실행 후에 채워지고, 학생은 다음 방문 때 보게 됨).
 *
 * [v18-3] 교사 대시보드 학생 상세에서 중복 제출을 정리할 수 있도록
 *   action=deleteActivityRow 신규 추가. 게임활동_로그의 특정 행(_row)을
 *   완전히 삭제한다. 프론트(index.html)의 학생 상세 카드마다 삭제 버튼이
 *   붙고, 같은 활동에 제출이 2건 이상이면 "중복 N건" 배지로 표시해서
 *   지울 대상을 찾기 쉽게 함.
 *
 * ── 이전 버전 히스토리(v15) ──
 * [v15] 웰컴 체크인 — 신규 기능.
 *   - "감정체크인" 시트 신설(게임활동_로그와 완전 분리 — 포털 완료 판정·
 *     세특 도구가 오염되지 않도록). 헤더: 핸드오프 문서(웰컴 체크인 v1) 5번 그대로.
 *   - "체크인설정" 시트 신설(학년당 1행) — 오늘 학생 화면에 띄울 차시id를
 *     교사가 대시보드에서 고르면 여기 저장됨. checkin_data.js(CHECKIN_PLAN)의
 *     배열 순서/개수를 건드리지 않고도 "오늘 뭘 쓸지"를 바꿀 수 있게 하기 위함
 *     — 진도가 밀리거나 순서가 바뀌어도 코드를 건드릴 필요 없음.
 *   - [v16] 체크인설정 시트 구조 변경: 학년당 1행 → (학년,반)당 1행.
 *     반="전체"로 저장하면 그 학년 전체 반에 적용, 특정 반 행이 따로 있으면 그게 우선.
 *   - action=checkin           → 체크인 기록 (토큰 불필요). 학번+날짜 중복이면
 *     새로 쌓지 않고 result:'success', duplicate:true 만 반환(재제출 없음 확정).
 *   - action=setTodayCheckin   → 학년+반별 오늘 차시id 저장 (교사, 토큰 필수, v16: ban 파라미터 추가).
 *   - mode=checkinToday        → 학생용. 학년+반의 오늘 차시id + (studentId·name
 *     같이 보내면) 본인 오늘 체크인 완료 여부까지 함께 반환.
 *   - mode=checkinAdmin        → 교사용. 지정 날짜(기본 오늘)의 응답 목록을
 *     온도 낮은 순으로 정렬해서 반환. 각 응답에 lowStreakAlert(연속 저온도 3회)
 *     플래그를 붙임 — 학생 화면엔 절대 노출 안 되고 이 응답에만 존재.
 *   - 장난 입력 대응은 기술로 안 막음. customInput.notice 문구(checkin_data.js)로
 *     "선생님만 볼 수 있어" 사전 고지하는 걸로 충분하다고 판단(핸드오프 참고).
 *
 * [v14] 실시간 피드백 프롬프트(buildFeedbackPrompt_) 정답 판정 오류 수정.
 *   (v18에서 doPost 호출 자체는 제거됐지만 함수는 남겨둠 — 위 v18-2 참고)
 *
 * [v13] 커리큘럼 관리 UI 개선 지원 — 순서 조정 + 지난 활동 구분.
 * [v12] 커리큘럼(차시)·학년정보(단원 관통 질문·포트폴리오)를
 *   config.js 하드코딩에서 시트 기반으로 이관.
 *
 * [배포]
 *  기존 Apps Script 프로젝트의 본체 파일 내용을 이 파일 전체로 교체.
 *  ⚠️ 재배포는 반드시 "배포 > 배포 관리 > 수정(연필) > 새 버전" — 새 배포 금지(URL 바뀜).
 *  ⚠️ "감정체크인"·"체크인설정" 시트는 doGet/doPost 첫 호출 때 자동 생성됨 —
 *     마이그레이션처럼 별도 함수를 수동 실행할 필요 없음.
 * ============================================================
 */

const SHEET_NAME = '게임활동_로그';
const FEEDBACK_SHEET_NAME = '피드백';
const GROUP_TEMP_SHEET_NAME = '조별_임시공유';
const QUESTION_SHEET_NAME = '질문함'; // v10 신규
const ANNOUNCEMENT_SHEET_NAME = '공지사항'; // v11 신규
const CURRICULUM_SHEET_NAME = '커리큘럼'; // v12 신규
const GRADE_INFO_SHEET_NAME = '학년정보'; // v12 신규
const CHECKIN_SHEET_NAME = '감정체크인'; // v15 신규
const CHECKIN_SETTING_SHEET_NAME = '체크인설정'; // v15 신규 — 학년당 1행, 오늘 차시id
const HEADERS = ['타임스탬프', '학번', '이름', '게임명', '선택 요약', '실제 역사와의 차이', '학생 서술', '선택 상세(JSON)'];
const FEEDBACK_HEADERS = ['타임스탬프', '학번', '이름', '활동id', '피드백'];
const GROUP_TEMP_HEADERS = ['타임스탬프', '학번', '이름', '게임명', '조번호', '역할', 'give', 'want', 'why'];
// v10 신규 — 질문함 시트 헤더
const QUESTION_HEADERS = ['타임스탬프', '학번', '이름', '학년', '반', '질문', '답변', '답변시각', '상태'];
// v11 신규 — 공지사항 시트 헤더 (학년/반은 "전체" 또는 구체값 문자열로 저장)
const ANNOUNCEMENT_HEADERS = ['타임스탬프', '학년', '반', '내용', '게시여부'];
// v12 신규 — 커리큘럼 시트 헤더. URL은 단일 URL 또는 "반:URL" 줄바꿈 텍스트.
// v19: 활동목록JSON·순차진행 추가 — 한 차시(행)에 활동을 2개 이상 담고 싶을 때만 씀.
// 비어있으면 기존처럼 활동id/타입/URL 3개 컬럼으로 활동 1개짜리 차시로 동작
// (기존 데이터는 손 안 대도 그대로 작동 — parseLessonActivities_ 참고).
// v20: 담당 추가 — '공통'(기본값)·'효니'·'미현쌤' 중 하나. 공통이면 그 학년 모든 반에
// 노출, 특정 교사면 학년정보의 반 매핑에 해당하는 반에게만 노출(curriculumGet_ 참고).
// v22: 사고유형 추가 — '판단'·'비교'·'해석'·'관점' 중 하나, 자유서술형 차시는 빈칸.
// 값은 교사가 시트에 직접 채워 넣음(별도 대시보드 입력 UI는 이번 스코프 밖) —
// buildActivityThinkingTypeMap_/computeBadges_가 "학습 칭호"(A) 판정에 사용.
// v24: 칭호명 추가 — 이 활동이 부여할 학습 칭호의 실제 이름(예: '저울질의 고수').
// 사고유형이 채워진 차시에만 의미가 있고, 빈칸이면 배지가 없다는 뜻(자유서술형 차시).
// buildActivityBadgeMap_이 활동id 단위로 이 값을 읽어 computeBadges_에 넘긴다.
const CURRICULUM_HEADERS = ['타임스탬프', '학년', '활동id', '제목', '설명', '타입', 'URL', '공개여부', '순서', '지난활동', '활동목록JSON', '순차진행', '담당', '사고유형', '칭호명']; // v13: 순서·지난활동 / v19: 활동목록JSON·순차진행 / v20: 담당 / v22: 사고유형 / v24: 칭호명
// 커리큘럼 시트 컬럼 위치 (1-based, CURRICULUM_HEADERS와 동일한 순서)
const CLCOL_PUBLIC = 8;
const CLCOL_ORDER = 9;
const CLCOL_PAST = 10;
const CLCOL_ACTIVITIES = 11;  // v19 신규 — 활동 2개 이상일 때 JSON 배열 텍스트
const CLCOL_SEQUENTIAL = 12;  // v19 신규 — "순차" 문자열이면 활동을 순서대로만 열 수 있음
const CLCOL_OWNER = 13;       // v20 신규 — '공통'(기본)·'효니'·'미현쌤'
const CLCOL_THINKING_TYPE = 14; // v22 신규 — '판단'·'비교'·'해석'·'관점'(빈칸 가능)
const CLCOL_BADGE_NAME = 15;    // v24 신규 — 이 활동이 부여할 칭호명(빈칸이면 배지 없음)
// v12 신규 — 학년정보 시트 헤더 (학년당 1행). 포트폴리오URL도 단일/반별(줄바꿈) 텍스트.
// v20: 효니담당반·미현쌤담당반 추가 — 반 번호를 쉼표로 나열(예: "1,2,3,4"). 둘 다 비어있으면
// 이 학년은 "담당 구분 없음"으로 취급 — 어떤 차시에 담당을 지정해도(공통이 아닌) 아무도 못 보게
// 막힐 수 있으니, 담당 구분을 쓰려면 이 두 칸부터 채워야 한다(대시보드 "학년 정보"에서 편집).
const GRADE_INFO_HEADERS = ['학년', '과목', '단원관통질문', '포트폴리오제목', '포트폴리오설명', '포트폴리오URL', '효니담당반', '미현쌤담당반'];
// v15 신규 — 감정체크인 시트 헤더. 웰컴 체크인 v1 핸드오프 문서 5번 그대로.
const CHECKIN_HEADERS = ['타임스탬프', '학번', '이름', '날짜', '차시id', '온도', '체크인타입', '판단선택', '단어', '기타입력'];
// v16 변경 — 체크인설정 시트 헤더. (학년,반)당 1행. 반="전체"면 그 학년 전체에 적용,
// 특정 반 행이 따로 있으면 그 반에서는 특정 행이 우선(checkinTodayGet_ 참고).
const CHECKIN_SETTING_HEADERS = ['학년', '반', '오늘차시id', '수정시각'];
// v17 신규 — 체크인문항 시트 헤더. checkin_data.js에 하드코딩돼 있던 CHECKIN_PLAN을
// 시트로 옮겨서 교사가 대시보드에서 직접 문항을 수정할 수 있게 함(커리큘럼과 동일한 방식).
// 옵션A/B는 judgment 타입에서만, 사료텍스트/사료출처/단어칩은 source_emotion 타입에서만 사용.
const CHECKIN_LESSON_SHEET_NAME = '체크인문항';
const CHECKIN_LESSON_HEADERS = [
  '타임스탬프', '학년', '차시id', '제목', '교과서', '타입', '발문',
  '옵션A', '옵션B', '사료텍스트', '사료출처', '단어칩', '회수질문',
  '사실검증', '검증메모', '교사메모'
];
// v21: 교사 토큰을 1개(공용)에서 교사별 2개로 분리. 각 토큰이 어느 교사 것인지만
// 구분하고, 권한 자체는 여전히 동일(둘 다 전체 데이터에 접근 가능) — "완전 분리"가
// 아니라 "기본값만 내 반으로 열리게" 하는 용도라, 서버 쪽 접근 제어는 안 바꿈.
// 프론트가 로그인 시 받은 teacher 값으로 기본 필터(내 담당 반)만 정해서 보여줌.
const TEACHER_TOKENS = {
  'his26': '효니',
  'mh26': '미현쌤'   // TODO: 미현쌤 전용 토큰으로 교체해서 쓸 것 — 임시값
};
function teacherNameForToken_(token) {
  return TEACHER_TOKENS[String(token || '').trim()] || null;
}

// 감정체크인 시트 컬럼 위치 (1-based, CHECKIN_HEADERS와 동일한 순서)
const CKCOL_TIMESTAMP = 1;
const CKCOL_HAKBUN = 2;
const CKCOL_NAME = 3;
const CKCOL_DATE = 4;
const CKCOL_LESSON = 5;
const CKCOL_TEMP = 6;
const CKCOL_TYPE = 7;
const CKCOL_JUDGMENT = 8;
const CKCOL_WORD = 9;
const CKCOL_CUSTOM = 10;

// 연속 저온도 판정 기준 (교사 대시보드 전용 표시, 학생 화면엔 절대 안 씀)
const CHECKIN_LOW_TEMP = 2;        // 이 값 이하를 "저온도"로 간주
const CHECKIN_LOW_STREAK_N = 3;    // 이 횟수 연속이면 lowStreakAlert = true

// AI 관련 컬럼 위치 (1-based) — 기존 v5·v6과 동일하게 유지
const COL_AI_COMMENT = 13;  // AI코멘트
const COL_AI_CHECK   = 14;  // AI코멘트확인
const COL_GROUP_ID   = 15;  // 조번호 (v7 신규)
// v22 신규 — ai_module_v8.gs가 채우는 STEP 1-B(표면조건) 판정 컬럼.
// "상" 등급 답안에서만 값이 채워짐("예" 또는 빈칸). 여기서는 그 값을 그대로 읽어
// "강점 칭호"(C)를 계산하는 데만 쓴다 — AI 판단 로직 자체는 ai_module 쪽 소관.
const COL_AP_FACTOR      = 16; // 요인연결 — 역사적 요인 2개 이상 연결 → 연결왕🧵
const COL_AP_COUNTERVIEW = 17; // 반론관점 — 반론·다른 관점 고려 → 다른 생각도 살펴본 사람⚔️
const COL_AP_PRESENT     = 18; // 현재연결 — 현재와의 연결 → 오늘과 연결한 사람🌉
const COL_AP_REBUTTAL    = 19; // 반론논파(신규 항목) → 반박왕🗡️ — 자리만 예약, ai_module 미반영이라 항상 빈칸

// 질문함 시트 컬럼 위치 (1-based, QUESTION_HEADERS와 동일한 순서)
const QCOL_TIMESTAMP = 1;
const QCOL_STUDENT_ID = 2;
const QCOL_STUDENT_NAME = 3;
const QCOL_GRADE = 4;
const QCOL_BAN = 5;
const QCOL_QUESTION = 6;
const QCOL_ANSWER = 7;
const QCOL_ANSWER_TIME = 8;
const QCOL_STATUS = 9;

// 공지사항 시트 컬럼 위치 (1-based, ANNOUNCEMENT_HEADERS와 동일한 순서)
const ACOL_TIMESTAMP = 1;
const ACOL_GRADE = 2;
const ACOL_BAN = 3;
const ACOL_CONTENT = 4;
const ACOL_STATUS = 5;
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function getOrCreateFeedbackSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(FEEDBACK_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(FEEDBACK_HEADERS);
  return sheet;
}

/* ── 짝 활동 1차 판단 전용 임시 시트 (v9) ──
 * 포털의 완료 판정·세특 도구는 이 시트를 보지 않는다.
 * 오직 "같은 조끼리 서로 답 조회"용 스크래치 공간. */
function getOrCreateGroupTempSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(GROUP_TEMP_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(GROUP_TEMP_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(GROUP_TEMP_HEADERS);
  return sheet;
}

/* ── 질문함 시트 (v10 신규) ── */
function getOrCreateQuestionSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(QUESTION_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(QUESTION_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(QUESTION_HEADERS);
  return sheet;
}

/* ── 공지사항 시트 (v11 신규) ── */
function getOrCreateAnnouncementSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ANNOUNCEMENT_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(ANNOUNCEMENT_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(ANNOUNCEMENT_HEADERS);
  return sheet;
}

/* ── 커리큘럼 시트 (v12 신규, v13에서 순서·지난활동 컬럼 추가) ──
 * v12 때 이미 만들어둔 기존 시트(8열)에도 새 헤더가 없으면 자동으로 채워 넣음
 * (기존 행들의 순서·지난활동 값은 빈 칸으로 남는데, curriculumGet_/Admin에서
 * 빈 값은 시트 행 순서를 fallback 순서로 취급하므로 동작엔 문제 없음). */
function getOrCreateCurriculumSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CURRICULUM_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CURRICULUM_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CURRICULUM_HEADERS);
  } else {
    ensureColumns_(sheet, CURRICULUM_HEADERS.length);
    for (let c = 1; c <= CURRICULUM_HEADERS.length; c++) {
      if (!sheet.getRange(1, c).getValue()) sheet.getRange(1, c).setValue(CURRICULUM_HEADERS[c - 1]);
    }
  }
  return sheet;
}

/* ── 학년정보 시트 (v12 신규, v20: 반 트랙 컬럼 2개 추가) ──
 * 기존 6열 시트에도 새 헤더가 없으면 자동으로 채워 넣음(커리큘럼 시트와 동일한 패턴) —
 * 기존 행의 두 새 컬럼은 빈 칸으로 남는데, 빈 칸이면 "담당 구분 없음"으로 취급되므로
 * 안전하게 기존 동작을 유지한다. */
function getOrCreateGradeInfoSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(GRADE_INFO_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(GRADE_INFO_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(GRADE_INFO_HEADERS);
  } else {
    ensureColumns_(sheet, GRADE_INFO_HEADERS.length);
    for (let c = 1; c <= GRADE_INFO_HEADERS.length; c++) {
      if (!sheet.getRange(1, c).getValue()) sheet.getRange(1, c).setValue(GRADE_INFO_HEADERS[c - 1]);
    }
  }
  return sheet;
}

/* ── 반 트랙: "1,2,3,4" 같은 텍스트를 숫자 배열로 (v20 신규) ── */
function parseBanListField_(raw) {
  return String(raw || '').split(',')
    .map(function (s) { return Number(s.trim()); })
    .filter(function (n) { return !!n; });
}

/* ── 감정체크인 시트 (v15 신규) ──
 * 게임활동_로그와 완전히 분리된 독립 시트. 포털 완료 판정·세특 도구는 이 시트를 보지 않음.
 * [v18-1 수정] 날짜 컬럼 서식 지정을 "시트를 처음 만들 때"만 실행하도록 이동.
 * 예전엔 이 setNumberFormat 호출이 if문 밖에 있어서, 이미 만들어진 시트에도
 * 학생이 로그인·체크인 조회할 때마다 매번 시트 전체 행에 서식을 다시 썼음
 * (데이터는 안 바뀌어도 불필요한 시트 조작이 매 요청에 끼어들어 지연 요인이 됨). */
function getOrCreateCheckinSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CHECKIN_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CHECKIN_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CHECKIN_HEADERS);
    // v16 버그 수정: 날짜 컬럼(D)을 텍스트 서식으로 고정 — 안 하면 "2026-08-25" 같은
    // 문자열을 쓸 때 시트가 진짜 Date로 자동 변환해버려서 이후 문자열 비교가 다 깨짐.
    // [v18-1] 시트를 새로 만드는 이 순간에만 한 번 실행하면 충분함.
    sheet.getRange(2, CKCOL_DATE, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  }
  return sheet;
}

/* ── 체크인설정 시트 (v15 신규, v16에서 반 단위로 확장) ──
 * (학년,반)당 1행. "오늘 어느 차시를 학생 화면에 띄울지"만 저장하는 작은 설정 시트.
 * 반 진도가 갈리는 경우를 위해 반="전체"(그 학년 공통) 행과 반="5" 같은 특정 반 행이
 * 공존 가능 — 특정 반 행이 있으면 그게 우선, 없으면 "전체" 행으로 폴백.
 * checkin_data.js(CHECKIN_PLAN)의 배열 순서·개수는 절대 안 건드리고, 여기 값만
 * 바뀌면 학생 화면에 뜨는 차시가 바뀜 — 진도 변경 시 코드 수정 불필요. */
function getOrCreateCheckinSettingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CHECKIN_SETTING_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CHECKIN_SETTING_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(CHECKIN_SETTING_HEADERS);
  return sheet;
}

/* ── 체크인문항 시트 (v17 신규) ──
 * 체크인 발문·선택지·사료 데이터를 시트로 관리 — 교사 대시보드에서 직접 추가/수정/삭제 가능.
 * checkin_data.js는 이제 CHECKIN_CONFIG(온도 설정 등)만 담당하고, 문항 자체는 이 시트가 원본. */
function getOrCreateCheckinLessonSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CHECKIN_LESSON_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CHECKIN_LESSON_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(CHECKIN_LESSON_HEADERS);
  return sheet;
}

/* ── 오늘 날짜 문자열 (yyyy-MM-dd, 학교 타임존 기준) ──
 * 학번+날짜 중복 판정과 mode=checkinAdmin의 기본 date 값에 공용으로 씀. */
function todayString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/* ── 날짜 셀 정규화 (v16 버그 수정) ──
 * "2026-08-25" 같은 문자열을 appendRow로 쓰면 시트가 자동으로 진짜 Date 값으로
 * 바꿔버릴 수 있음 — 그 상태로 getValues()를 읽으면 문자열이 아니라 Date 객체가
 * 나와서 String(dateObj) !== "2026-08-25" 가 되어 날짜 비교가 전부 실패함.
 * (감정체크인 기록 중복판정·오늘자 필터가 안 먹던 원인이 이거였음 — v16에서 수정)
 * Date 객체든 문자열이든 항상 'yyyy-MM-dd' 문자열로 통일해서 반환. */
function ckDateStr_(val) {
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(val || '').trim();
}

/* ── URL 필드 파서 (v12 신규) ──
 * "https://..." 단일 줄이면 { url, urlByBan: null }.
 * 모든 줄이 "숫자:내용" 형태면(반별 링크) { url: null, urlByBan: {반:URL, ...} }.
 * 섞여 있거나 애매하면 첫 줄을 단일 url로 취급(안전한 기본값). */
function parseUrlField_(raw) {
  const text = String(raw || '').trim();
  if (!text) return { url: '', urlByBan: null };
  const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const banPattern = /^([0-9]+)\s*:\s*(.+)$/;
  const allBanLines = lines.length > 0 && lines.every(function (l) { return banPattern.test(l); });
  if (allBanLines) {
    const map = {};
    lines.forEach(function (l) {
      const m = l.match(banPattern);
      map[m[1]] = m[2].trim();
    });
    return { url: null, urlByBan: map };
  }
  return { url: lines[0], urlByBan: null };
}

/* ── 커리큘럼: 차시 한 행의 활동 목록을 정규화 (v19 신규) ──
 * '활동목록JSON' 컬럼(row[CLCOL_ACTIVITIES-1])이 있으면 그 배열을 파싱해서 쓰고,
 * 없으면 기존 단일활동 방식(활동id·타입·URL 3개 컬럼)을 활동 1개짜리 배열로
 * 감싸서 돌려준다. 이렇게 하면 이 함수를 부르는 쪽(학생 조회·교사 조회)은
 * "차시엔 항상 activities 배열이 있다"고 가정하고 그대로 쓰면 되고,
 * 활동목록JSON 없이 예전 방식으로 등록된 기존 데이터는 전혀 안 건드려도 계속 작동한다.
 * (단일활동 폴백에서 활동 id를 차시id(row[2])와 똑같이 맞춰두므로, 기존에 쌓인
 * 게임활동_로그의 activityId·doneIds 매칭도 그대로 유지된다.) */
function parseLessonActivities_(row) {
  const rawJson = String(row[CLCOL_ACTIVITIES - 1] || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length) {
        const acts = parsed.map(function (a) {
          const out = {
            id: String(a.id || '').trim(),
            title: String(a.title || ''),
            desc: String(a.desc || ''),
            type: String(a.type || 'module')
          };
          const u = parseUrlField_(a.url || '');
          if (u.urlByBan) out.urlByBan = u.urlByBan; else out.url = u.url;
          return out;
        }).filter(function (a) { return a.id; });
        if (acts.length) return acts;
      }
    } catch (e) {
      // JSON이 깨져 있으면 조용히 폴백 — 아래 단일활동 방식으로 내려감
    }
  }
  const u = parseUrlField_(row[6]);
  const single = { id: String(row[2] || ''), title: '', desc: '', type: String(row[5] || '') };
  if (u.urlByBan) single.urlByBan = u.urlByBan; else single.url = u.url;
  return [single];
}

/* ── 순차진행: 활동id로 그 활동이 속한 차시를 찾기 (v21-1 신규) ──
 * 커리큘럼 시트를 훑어서 parseLessonActivities_로 얻은 activities 배열 안에
 * activityId가 있는 행을 찾아, 그 배열·인덱스·순차진행 여부를 돌려준다.
 * 어느 차시에도 속하지 않는 activityId(예: 커리큘럼과 무관한 다른 활동)면 null. */
function findLessonForActivity_(activityId) {
  const clSheet = getOrCreateCurriculumSheet_();
  if (clSheet.getLastRow() < 2) return null;
  const rows = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const activities = parseLessonActivities_(rows[i]);
    const idx = activities.findIndex(function (a) { return a.id === activityId; });
    if (idx !== -1) {
      return {
        activities: activities,
        idx: idx,
        sequential: String(rows[i][CLCOL_SEQUENTIAL - 1] || '') === '순차'
      };
    }
  }
  return null;
}

/* ── 순차진행: 서버측 제출 게이트 (v21-1 신규) ──
 * 프론트(renderActivityBlock)는 앞 활동이 안 끝났으면 버튼 자체를 안 보여주는
 * 방식으로만 순차진행을 막고 있었음 — doPost 기본 경로는 이 값을 전혀 몰랐기
 * 때문에 API를 직접 호출하면 순차 위반 제출이 그대로 기록될 수 있었다.
 * activityId가 순차 차시의 2번째 이후 활동이면, 이 학생이 게임활동_로그에
 * 바로 앞 활동을 이미 제출한 기록이 있는지 확인해서 없으면 막는다. */
function checkSequentialGate_(studentId, activityId) {
  const info = findLessonForActivity_(activityId);
  if (!info || !info.sequential || info.idx <= 0) return { ok: true };

  const prevId = info.activities[info.idx - 1].id;
  const sheet = getOrCreateSheet_();
  let done = false;
  if (sheet.getLastRow() >= 2) {
    // 학번(B열)·게임명(D열)만 필요 — 각각 컬럼 2, 4
    const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 3).getValues();
    done = values.some(function (row) {
      return String(row[0] || '').trim() === studentId && String(row[2] || '').trim() === prevId;
    });
  }
  if (!done) {
    return { ok: false, message: '이전 활동(' + prevId + ')을 먼저 끝내야 제출할 수 있어요.' };
  }
  return { ok: true };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ════════════════════════════════════════════════════════
 * 시트 열 자동 확장 헬퍼
 * ════════════════════════════════════════════════════════ */
function ensureColumns_(sheet, col) {
  const max = sheet.getMaxColumns();
  if (max < col) sheet.insertColumnsAfter(max, col - max);
}

function ensureAiCommentHeader_(sheet) {
  ensureColumns_(sheet, COL_AI_COMMENT);
  const header = sheet.getRange(1, COL_AI_COMMENT).getValue();
  if (!header) sheet.getRange(1, COL_AI_COMMENT).setValue('AI코멘트');
}

function ensureGroupIdHeader_(sheet) {
  ensureColumns_(sheet, COL_GROUP_ID);
  const header = sheet.getRange(1, COL_GROUP_ID).getValue();
  if (!header) sheet.getRange(1, COL_GROUP_ID).setValue('조번호');
}

/* ════════════════════════════════════════════════════════
 * 특별 칭호("칭호첩") — v22 신규
 * A(학습 칭호)·C(강점 칭호) + B(행동 칭호) 중 개인 배지 2개.
 * B의 반 공통 배지 2개(생각이 다양한 반·함께 해낸 반)는 반 전체 조회 API가
 * 필요해서 이번 스코프에서 제외 — computeBadges_는 그 둘을 아예 다루지 않는다.
 * ════════════════════════════════════════════════════════ */

// 칭호 정의 — id는 studentGet_ 응답과 프론트가 공유하는 고정 키.
// type: 'once'(1회성 — 골드 테두리, 획득 즉시 고정) / 'repeat'(반복 — 실버 테두리 + ×N)
// category: 'learning'(파랑) / 'behavior'(주황) / 'strength'(보라)
// v24: A(학습 칭호) 고정 4개(decisionKing/compareKing/interpretKing/diffEyeSeer)는
// 여기서 제거 — 이제 활동(activityId) 단위로 computeBadges_가 'act_'+activityId
// id를 동적으로 만든다(아래 buildActivityBadgeMap_·computeBadges_ 참고). B(행동 칭호)·
// C(강점 칭호)는 그대로 고정 정의를 씀.
const BADGE_DEFS = {
  neverGiveUp:   { name: '포기하지 않는 사람',      emoji: '🔥', category: 'behavior', type: 'once' },
  questionKing:  { name: '질문왕',                 emoji: '💡', category: 'behavior', type: 'once' },
  linkKing:      { name: '연결왕',                 emoji: '🧵', category: 'strength', type: 'repeat' },
  counterviewer: { name: '다른 생각도 살펴본 사람', emoji: '⚔️', category: 'strength', type: 'repeat' },
  presentLinker: { name: '오늘과 연결한 사람',      emoji: '🌉', category: 'strength', type: 'repeat' },
  rebuttalKing:  { name: '반박왕',                 emoji: '🗡️', category: 'strength', type: 'repeat' }
};

// 사고유형(커리큘럼 시트 '사고유형' 컬럼값) → 이모지 매핑 (v24, 그룹 단위로 고정 —
// 활동마다 새 이모지를 만들지 않고 이 4개를 계속 재사용한다)
const THINKING_TYPE_EMOJI = {
  '판단': '⚖️',
  '비교': '🔀',
  '해석': '🔍',
  '관점': '👁️'
};

// v24 신규 — 칭호명 이름 풀(참고용). 교사가 대시보드에서 '칭호명'을 직접 입력할 때
// 참고하도록 그룹별 후보 8개씩 정리해둔 것 — 강제 목록은 아니고 이 중에서 골라도 되고
// 다른 이름을 자유롭게 써도 된다(대시보드 폼은 이 배열을 datalist 자동완성으로 노출).
// 각 그룹의 첫 번째 이름(결정왕/비교왕/해석왕/다른 눈으로 본 사람)은 v22/v23 시절
// 고정 배지의 이름과 동일 — addLessonPost_/updateLessonPost_의 하위호환 기본값으로도 쓰인다.
const BADGE_NAME_POOL = {
  '판단': ['결정왕', '저울질의 고수', '갈림길의 승부사', '근거로 밀어붙인 사람', '흔들리지 않은 판단자', '마지막까지 고민한 사람', '확신을 세운 사람', '선택의 이유를 아는 사람'],
  '비교': ['비교왕', '두 시대를 겹쳐본 사람', '닮은꼴을 찾아낸 사람', '차이를 짚어낸 사람', '패턴을 읽은 사람', '나란히 놓고 본 사람', '반복을 알아챈 사람', '다른 결을 짚은 사람'],
  '해석': ['해석왕', '행간을 읽은 사람', '자료 속을 파고든 사람', '숫자 뒤를 본 사람', '맥락을 짚어낸 사람', '사료를 뜯어본 사람', '숨은 뜻을 찾은 사람', '자료로 말한 사람'],
  '관점': ['다른 눈으로 본 사람', '그 입장이 되어본 사람', '반대편에서 생각한 사람', '역할 속으로 들어간 사람', '목소리를 대신한 사람', '처지를 바꿔본 사람', '다른 자리에서 본 사람', '시선을 옮긴 사람']
};

// 재도전 인정 기준(같은 활동 제출 횟수) / 질문왕 인정 기준(질문함 누적 개수)
const BADGE_RETRY_MIN = 3;
const BADGE_QUESTION_MIN = 3;

/* ── 칭호명 검증 + 하위호환 기본값 (v24 신규) ──
 * addLessonPost_/updateLessonPost_가 공용으로 쓴다. 사고유형 자체가 없으면
 * (자유서술형 차시) 칭호명도 항상 빈칸 — 배지 없음이 정상. 사고유형은 있는데
 * 칭호명이 비어 있으면(v22/v23 시절 사고유형만 채워두고 칭호명 입력 UI가 없던
 * 기존 행 포함) 그 그룹의 첫 번째 이름(결정왕/비교왕/해석왕/다른 눈으로 본 사람)을
 * 기본값으로 채워서 하위호환을 유지한다. */
function resolveBadgeName_(thinkingType, badgeNameIn) {
  if (!thinkingType) return '';
  const name = String(badgeNameIn || '').trim();
  if (name) return name;
  const pool = BADGE_NAME_POOL[thinkingType];
  return pool ? pool[0] : '';
}

/* ── 사고유형 매핑: activityId → 사고유형 (v22 신규) ──
 * 커리큘럼 시트를 훑어서 각 차시의 사고유형을, parseLessonActivities_로 얻은
 * 그 차시의 모든 activityId에 동일하게 부여한다(사고유형은 차시 단위 컬럼이라
 * 활동이 여러 개인 차시라도 컬럼은 하나뿐 — 그 값을 활동 전체가 공유).
 * v24 시점에도 그대로 유지 — buildActivityBadgeMap_이 참조하는 용도 외에,
 * 세특 매핑 등 다른 체계가 이 맵을 그대로 재사용할 수 있도록 남겨둔다. */
function buildActivityThinkingTypeMap_() {
  const map = {};
  const clSheet = getOrCreateCurriculumSheet_();
  if (clSheet.getLastRow() < 2) return map;
  const rows = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
  rows.forEach(function (row) {
    const thinkingType = String(row[CLCOL_THINKING_TYPE - 1] || '').trim();
    if (!thinkingType) return;
    parseLessonActivities_(row).forEach(function (a) {
      if (a.id) map[a.id] = thinkingType;
    });
  });
  return map;
}

/* ── 칭호명 매핑: activityId → { badgeName, thinkingType } (v24 신규) ──
 * buildActivityThinkingTypeMap_과 동일한 방식(parseLessonActivities_ 재사용)으로
 * 커리큘럼 시트를 훑는다. 사고유형·칭호명이 둘 다 채워진 차시만 맵에 들어가고,
 * 순차형 차시(활동목록JSON)는 사고유형과 동일한 정책으로 모든 하위 활동이
 * 칭호명 하나를 공유한다. computeBadges_가 이 맵으로 활동별 배지 이름·이모지를 찾는다. */
function buildActivityBadgeMap_() {
  const map = {};
  const clSheet = getOrCreateCurriculumSheet_();
  if (clSheet.getLastRow() < 2) return map;
  const rows = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
  rows.forEach(function (row) {
    const thinkingType = String(row[CLCOL_THINKING_TYPE - 1] || '').trim();
    if (!thinkingType) return;
    const badgeName = String(row[CLCOL_BADGE_NAME - 1] || '').trim();
    if (!badgeName) return;
    parseLessonActivities_(row).forEach(function (a) {
      if (a.id) map[a.id] = { badgeName: badgeName, thinkingType: thinkingType };
    });
  });
  return map;
}

/* ── 칭호첩 계산 (v22 신규, v24에서 A 부분 리팩토링) ──
 * activities: studentGet_이 이미 학번·이름으로 걸러낸 이 학생의 게임활동_로그 기록 배열
 * (achievement·activityId·ap* 플래그 포함). questionsCount: 이 학생의 질문함 누적 개수.
 * 반환: A(학습 칭호, 활동 단위 동적 배지) + BADGE_DEFS의 B/C 항목에 대해
 * { id, name, emoji, category, type, earned, count } — count는 'repeat' 타입에서만 의미 있음.
 * A는 achievement='상'을 받은 적 있는 활동에 대해서만 항목이 생기므로 항상 earned:true. */
function computeBadges_(activities, questionsCount) {
  const counts = {}; // badgeId -> 누적 카운트(반복형) 또는 1(1회성, 있으면 획득)
  function bump(id) { counts[id] = (counts[id] || 0) + 1; }

  // A. 학습 칭호 — 활동(activityId) 단위 동적 배지. buildActivityBadgeMap_()으로 이 활동이
  // 속한 차시의 칭호명·사고유형을 찾아, "상" 등급을 받은 적이 있으면 'act_'+activityId를
  // id로 하는 배지를 이 자리에서 만든다(고정 4종이 아니라 활동마다 하나씩 생긴다).
  // 'act_' 접두사라서 B/C의 고정 id(neverGiveUp 등)와 절대 충돌하지 않는다.
  const badgeMap = buildActivityBadgeMap_();
  const dynamicDefs = {}; // 'act_xxx' -> { name, emoji, category:'learning', type:'once' }
  activities.forEach(function (a) {
    if (String(a.achievement || '').trim() !== '상') return;
    const info = badgeMap[a.activityId];
    if (!info) return;
    const id = 'act_' + a.activityId;
    if (!dynamicDefs[id]) {
      dynamicDefs[id] = {
        name: info.badgeName,
        emoji: THINKING_TYPE_EMOJI[info.thinkingType] || '🏅',
        category: 'learning',
        type: 'once'
      };
    }
    bump(id);
  });

  // B-1. 포기하지 않는 사람 — 같은 활동을 BADGE_RETRY_MIN회 이상 제출
  const attemptsByActivity = {};
  activities.forEach(function (a) {
    const id = a.activityId;
    attemptsByActivity[id] = (attemptsByActivity[id] || 0) + 1;
  });
  const retried = Object.keys(attemptsByActivity).some(function (id) {
    return attemptsByActivity[id] >= BADGE_RETRY_MIN;
  });
  if (retried) bump('neverGiveUp');

  // B-2. 질문왕 — 질문함 누적 BADGE_QUESTION_MIN회 이상
  if ((questionsCount || 0) >= BADGE_QUESTION_MIN) bump('questionKing');

  // C. 강점 칭호 — ai_module_v8.gs가 STEP 1-B로 이미 판정해서 채워둔 값을 그대로 집계.
  // 반론논파(rebuttalKing)는 ai_module이 아직 값을 채우지 않아 현재는 항상 0.
  activities.forEach(function (a) {
    if (a.apFactor) bump('linkKing');
    if (a.apCounterview) bump('counterviewer');
    if (a.apPresent) bump('presentLinker');
    if (a.apRebuttal) bump('rebuttalKing');
  });

  const learningBadges = Object.keys(dynamicDefs).map(function (id) {
    const def = dynamicDefs[id];
    const count = counts[id] || 0;
    return { id: id, name: def.name, emoji: def.emoji, category: def.category, type: def.type, earned: count > 0, count: count };
  });

  const otherBadges = Object.keys(BADGE_DEFS).map(function (id) {
    const def = BADGE_DEFS[id];
    const count = counts[id] || 0;
    return { id: id, name: def.name, emoji: def.emoji, category: def.category, type: def.type, earned: count > 0, count: count };
  });

  return learningBadges.concat(otherBadges);
}

/* ════════════════════════════════════════════════════════
 * Gemini 연동 — 실시간 경로(doPost)에서는 더 이상 호출하지 않음 (v18-2 참고).
 * 함수 자체는 남겨둠: 나중에 필요하면 재사용 가능. 현재 AI 코멘트는
 * ai_module_v6.gs의 배치 트리거(aiScheduledRun)가 전담해서 채운다.
 * ════════════════════════════════════════════════════════ */
function getGeminiApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY가 스크립트 속성에 설정되지 않았습니다.');
  return key;
}

function getGeminiModel_() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
}

/**
 * choicesJson을 분석해서 프롬프트를 만든다.
 * "선택+이유" 구조(개인 진단)가 아니면 null을 반환해서 상위 로직이 건너뛰게 한다.
 * → 게임명을 하드코딩해서 분기하지 않고, 데이터 형태로 판단.
 * (v7의 짝 활동 choicesJson은 {stage, role, judgment, ...} 구조라 자동으로 건너뜀)
 *
 * [v14 수정] 같은 게임(1학기진단_개인) 안에서도 문항에 따라 정답 개념이 있는 것과
 * 없는 것(자유 서술형)이 섞여 있음이 실데이터에서 확인됨. 기존엔 isCorrect가 없는
 * 문항을 falsy로 취급해 전부 "오답"으로 Gemini에 전달하는 오류가 있었음.
 * → 문항 단위로 isCorrect 필드 존재 여부를 확인해서, 없는 문항은 정답/오답을
 *   아예 언급하지 않고 "정답이 정해지지 않은 자유 서술형"으로 표시함.
 *
 * [v18] 이 함수는 이제 doPost에서 호출되지 않음 — 남겨두기만 함.
 */
function buildFeedbackPrompt_(data) {
  let detail;
  try {
    detail = JSON.parse(data.choicesJson || '[]');
  } catch (e) {
    return null;
  }
  if (!Array.isArray(detail) || !detail.length) return null;
  if (typeof detail[0] !== 'object' || detail[0] === null) return null;
  if (detail[0].reason === undefined || detail[0].choice === undefined) return null;

  const lines = detail.map(function (d) {
    // v14: 문항 단위로 정답 개념이 있는지(isCorrect가 실제로 존재하는지) 먼저 확인
    const hasCorrectness = d.isCorrect !== undefined && d.isCorrect !== null;
    const correctnessPart = hasCorrectness
      ? ' / 정답 여부: ' + (d.isCorrect ? '정답' : '오답') +
        (d.isCorrect ? '' : ' (정답: "' + d.correct + '")')
      : ' / (이 문항은 정답이 정해진 문항이 아니라 자유 서술형)';
    return '- [' + d.q + '] 학생 선택: "' + d.choice + '"' + correctnessPart +
      ' / 학생이 쓴 이유: "' + (d.reason || '') + '"';
  }).join('\n');

  const anyGraded = detail.some(function (d) { return d.isCorrect !== undefined && d.isCorrect !== null; });

  return '너는 중학교 역사 교사를 돕는 보조 채점자야. 한 학생이 문항별로 고른 답과 그 이유를 아래에 줄게.\n' +
    '문항 중 일부는 정답이 정해져 있고(정답 여부가 표시됨), 일부는 자유 서술형이라 정답 개념이 없어.\n' +
    '자유 서술형 문항을 오답으로 취급하거나 정답/오답을 임의로 판단하지 마.\n\n' +
    lines + '\n\n' +
    '이 학생에게 줄 피드백을 한국어 2~3문장으로 작성해줘.\n' +
    '조건:\n' +
    '1. 과장된 칭찬 없이 담백하게 쓸 것.\n' +
    '2. 정답이 정해진 문항 중 오답이 있으면 어떤 개념을 다시 봐야 하는지는 짚어주되, 정답 자체를 그대로 알려주지는 말 것.\n' +
    '   자유 서술형 문항(정답 여부가 표시되지 않은 문항)은 정답/오답으로 언급하지 말고 서술 내용 자체에 대해서만 코멘트할 것.\n' +
    '3. 학생이 쓴 "이유"에 드러난 사고 과정에 대한 코멘트를 반드시 한 마디 포함할 것.\n' +
    (anyGraded
      ? '4. 정답이 정해진 문항 중 맞힌 문항이 하나라도 있으면 그중 하나를 구체적으로 짚어 잘한 점으로 언급할 것.\n' +
        '   정답이 정해진 문항을 전부 틀렸더라도 이유 서술 중 나름대로 논리적으로 접근한 부분이 있으면 그 점을 찾아 짚어줄 것.\n' +
        '   즉 오답 지적만 나열하지 말고, 잘한 점과 보완할 점이 균형 있게 드러나게 쓸 것.\n'
      : '4. 이 학생의 문항은 전부 자유 서술형이니 정답·오답 언급 없이, 서술에서 드러난 논리적 접근을 찾아 잘한 점으로 짚어줄 것.\n') +
    '5. 존댓말이 아니라 반말로, 다정하되 명확하게 쓸 것.\n' +
    '6. 다른 설명이나 따옴표 없이 피드백 본문만 출력할 것.';
}

function callGeminiFeedback_(promptText) {
  const apiKey = getGeminiApiKey_();
  const model = getGeminiModel_();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model +
    ':generateContent?key=' + apiKey;

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1500,
      thinkingConfig: { thinkingLevel: 'MINIMAL' }
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  let json;
  try {
    json = JSON.parse(res.getContentText());
  } catch (e) {
    throw new Error('Gemini 응답 파싱 실패: ' + res.getContentText().slice(0, 200));
  }

  if (code !== 200) {
    const msg = json.error && json.error.message ? json.error.message : res.getContentText();
    throw new Error('Gemini API 오류(' + code + '): ' + msg);
  }

  const text = json.candidates && json.candidates[0] &&
    json.candidates[0].content && json.candidates[0].content.parts &&
    json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;

  const finishReason = json.candidates && json.candidates[0] && json.candidates[0].finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('응답이 토큰 한도로 잘렸습니다(finishReason=MAX_TOKENS). maxOutputTokens를 더 늘려보세요.');
  }

  if (!text) throw new Error('Gemini 응답에서 텍스트를 찾지 못했습니다.');
  return text.trim();
}

/* ════════════════════════════════════════════════════════
 * doGet 라우팅
 *  - ?mode=student&studentId=&name=              → 학생 본인 기록 (+ 본인 질문함, v10)
 *  - ?mode=group&gameName=&groupId=&studentId=   → 짝(조)의 1차 판단 조회
 *  - ?mode=feedback&token=                       → 피드백 전체 (교사)
 *  - ?mode=questions&token=                      → 질문함 전체 (교사, v10 신규)
 *  - ?mode=announcements&grade=&ban=             → 공지사항, 학년+반 매칭분만 (학생, v11 신규)
 *  - ?mode=announcementsAdmin&token=             → 공지사항 전체(게시+보류) (교사, v11 신규)
 *  - ?mode=curriculum                            → 공개된 차시 + 학년정보 (학생, v12 신규)
 *  - ?mode=curriculumAdmin&token=                → 커리큘럼 전체(비공개 포함) + 학년정보 (교사, v12 신규)
 *  - ?mode=checkinToday&grade=&ban=&studentId=&name=  → 오늘 차시id + 본인 완료 여부 (학생, v15 신규, v16: ban 추가)
 *  - ?mode=checkinAdmin&token=&grade=&date=      → 지정 날짜 체크인 목록(온도 낮은 순) (교사, v15 신규)
 *  - ?mode=checkinPlan                           → 체크인 문항 전체(학년별 lessons 배열) (학생, v17 신규)
 *  - ?mode=checkinPlanAdmin&token=               → 체크인 문항 전체 + _row (교사, v17 신규)
 *  - ?token=                                     → 전체 기록 (교사)
 * ════════════════════════════════════════════════════════ */
function doGet(e) {
  const mode = (e.parameter.mode || '').trim();

  if (mode === 'student') return studentGet_(e);
  if (mode === 'group') return groupGet_(e);
  if (mode === 'feedback') return feedbackGet_(e);
  if (mode === 'questions') return questionsGet_(e); // v10 신규
  if (mode === 'announcements') return announcementsGet_(e); // v11 신규
  if (mode === 'announcementsAdmin') return announcementsAdminGet_(e); // v11 신규
  if (mode === 'curriculum') return curriculumGet_(e); // v12 신규
  if (mode === 'curriculumAdmin') return curriculumAdminGet_(e); // v12 신규
  if (mode === 'checkinToday') return checkinTodayGet_(e); // v15 신규
  if (mode === 'checkinAdmin') return checkinAdminGet_(e); // v15 신규
  if (mode === 'checkinPlan') return checkinPlanGet_(e); // v17 신규
  if (mode === 'checkinPlanAdmin') return checkinPlanAdminGet_(e); // v17 신규
  return teacherGet_(e);
}

/* ── 학생 본인 기록 조회 (v10: questions 필드 추가) ── */
function studentGet_(e) {
  try {
    const sid = String(e.parameter.studentId || '').trim();
    const name = String(e.parameter.name || '').trim();
    if (!sid || !name) throw new Error('학번과 이름이 필요합니다.');

    const sheet = getOrCreateSheet_();
    // v22: 표면조건 컬럼(16~19)까지 안전하게 읽기 위해 폭을 미리 확보 —
    // ai_module_v8.gs가 아직 한 번도 안 돌았으면 시트 실제 폭이 이보다 좁을 수 있음.
    ensureColumns_(sheet, COL_AP_REBUTTAL);
    const activities = [];
    if (sheet.getLastRow() >= 2) {
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), COL_AP_REBUTTAL)).getValues();
      values.forEach(row => {
        if (String(row[1]).trim() === sid && String(row[2]).trim() === name) {
          activities.push({
            activityId: String(row[3] || ''),
            achievement: String(row[10] || ''),
            summary: String(row[9] || ''),
            aiComment: String(row[COL_AI_COMMENT - 1] || ''),
            reflection: String(row[6] || ''),
            timestamp: row[0],
            // v22 — STEP 1-B 표면조건 판정값(ai_module_v8.gs가 채움). "예"일 때만 true.
            apFactor: String(row[COL_AP_FACTOR - 1] || '') === '예',
            apCounterview: String(row[COL_AP_COUNTERVIEW - 1] || '') === '예',
            apPresent: String(row[COL_AP_PRESENT - 1] || '') === '예',
            apRebuttal: String(row[COL_AP_REBUTTAL - 1] || '') === '예'
          });
        }
      });
    }

    const fbSheet = getOrCreateFeedbackSheet_();
    const feedback = [];
    if (fbSheet.getLastRow() >= 2) {
      const fv = fbSheet.getRange(2, 1, fbSheet.getLastRow() - 1, 5).getValues();
      fv.forEach(row => {
        if (String(row[1]).trim() === sid) {
          feedback.push({
            timestamp: row[0],
            activityId: String(row[3] || ''),
            feedback: String(row[4] || '')
          });
        }
      });
    }

    // v10 신규 — 본인이 남긴 질문 + 교사 답변
    const qSheet = getOrCreateQuestionSheet_();
    const questions = [];
    if (qSheet.getLastRow() >= 2) {
      const qv = qSheet.getRange(2, 1, qSheet.getLastRow() - 1, QUESTION_HEADERS.length).getValues();
      qv.forEach(row => {
        if (String(row[QCOL_STUDENT_ID - 1]).trim() === sid) {
          questions.push({
            timestamp: row[QCOL_TIMESTAMP - 1],
            question: String(row[QCOL_QUESTION - 1] || ''),
            answer: String(row[QCOL_ANSWER - 1] || ''),
            answerTime: row[QCOL_ANSWER_TIME - 1] || '',
            status: String(row[QCOL_STATUS - 1] || '대기')
          });
        }
      });
    }

    // v22 — 칭호첩. 사고유형 매핑·표면조건 플래그를 이미 activities에 담아뒀으니
    // 여기서는 집계만 한다(computeBadges_ 참고).
    const badges = computeBadges_(activities, questions.length);

    return json_({ result: 'success', activities: activities, feedback: feedback, questions: questions, badges: badges });
  } catch (err) {
    return json_({ result: 'error', message: err.message });
  }
}

/* ── 짝(조) 1차 판단 조회 (v9: 임시 시트에서 조회) ──
 * 조별_임시공유 시트에서 같은 gameName + 같은 groupId를 가진
 * "본인이 아닌" 다른 학생의 판단을 찾아 반환. */
function groupGet_(e) {
  try {
    const gameName = String(e.parameter.gameName || '').trim();
    const groupId = String(e.parameter.groupId || '').trim();
    const selfId = String(e.parameter.studentId || '').trim();
    if (!gameName || !groupId) throw new Error('gameName과 groupId가 필요합니다.');

    const sheet = getOrCreateGroupTempSheet_();
    const partners = [];
    if (sheet.getLastRow() >= 2) {
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, GROUP_TEMP_HEADERS.length).getValues();
      values.forEach(row => {
        const rowStudentId = String(row[1] || '').trim();
        const rowGame = String(row[3] || '').trim();
        const rowGroup = String(row[4] || '').trim();
        if (rowGame !== gameName || rowGroup !== groupId) return;
        if (selfId && rowStudentId === selfId) return; // 본인 제외

        partners.push({
          studentName: String(row[2] || ''),
          role: String(row[5] || ''),
          give: String(row[6] || ''),
          want: String(row[7] || ''),
          why: String(row[8] || '')
        });
      });
    }

    return json_({ result: 'success', partners: partners });
  } catch (err) {
    return json_({ result: 'error', message: err.message });
  }
}

/* ── 피드백 전체 조회 (교사) ── */
function feedbackGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const sheet = getOrCreateFeedbackSheet_();
  if (sheet.getLastRow() < 2) return json_({ result: 'success', rows: [] });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const rows = values.map(row => ({
    timestamp: row[0],
    studentId: String(row[1] || ''),
    studentName: String(row[2] || ''),
    activityId: String(row[3] || ''),
    feedback: String(row[4] || '')
  }));
  return json_({ result: 'success', rows: rows });
}

/* ── 질문함 전체 조회 (교사, v10 신규) ──
 * _row: 시트상 실제 행 번호. answerQuestion 액션에서 이 값으로 행을 특정함. */
function questionsGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const sheet = getOrCreateQuestionSheet_();
  if (sheet.getLastRow() < 2) return json_({ result: 'success', rows: [] });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, QUESTION_HEADERS.length).getValues();
  const rows = values.map((row, i) => ({
    _row: i + 2,
    timestamp: row[QCOL_TIMESTAMP - 1],
    studentId: String(row[QCOL_STUDENT_ID - 1] || ''),
    studentName: String(row[QCOL_STUDENT_NAME - 1] || ''),
    grade: row[QCOL_GRADE - 1],
    ban: row[QCOL_BAN - 1],
    question: String(row[QCOL_QUESTION - 1] || ''),
    answer: String(row[QCOL_ANSWER - 1] || ''),
    answerTime: row[QCOL_ANSWER_TIME - 1] || '',
    status: String(row[QCOL_STATUS - 1] || '대기')
  }));
  return json_({ result: 'success', rows: rows });
}

/* ── 공지사항 조회 — 학생용, 학년+반 매칭 + 게시중인 것만 (v11 신규) ──
 * 매칭 규칙: (학년="전체" or 학년==grade) AND (반="전체" or 반==ban) AND 게시여부="게시" */
function announcementsGet_(e) {
  const grade = String(e.parameter.grade || '').trim();
  const ban = String(e.parameter.ban || '').trim();

  const sheet = getOrCreateAnnouncementSheet_();
  if (sheet.getLastRow() < 2) return json_({ result: 'success', rows: [] });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ANNOUNCEMENT_HEADERS.length).getValues();
  const rows = values
    .map(row => ({
      timestamp: row[ACOL_TIMESTAMP - 1],
      grade: String(row[ACOL_GRADE - 1] || ''),
      ban: String(row[ACOL_BAN - 1] || ''),
      content: String(row[ACOL_CONTENT - 1] || ''),
      status: String(row[ACOL_STATUS - 1] || '')
    }))
    .filter(a => a.status === '게시')
    .filter(a => a.grade === '전체' || !grade || a.grade === grade)
    .filter(a => a.ban === '전체' || !ban || a.ban === ban);

  return json_({ result: 'success', rows: rows });
}

/* ── 공지사항 조회 — 교사용, 게시+보류 전체 (v11 신규) ── */
function announcementsAdminGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const sheet = getOrCreateAnnouncementSheet_();
  if (sheet.getLastRow() < 2) return json_({ result: 'success', rows: [] });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ANNOUNCEMENT_HEADERS.length).getValues();
  const rows = values.map((row, i) => ({
    _row: i + 2,
    timestamp: row[ACOL_TIMESTAMP - 1],
    grade: String(row[ACOL_GRADE - 1] || ''),
    ban: String(row[ACOL_BAN - 1] || ''),
    content: String(row[ACOL_CONTENT - 1] || ''),
    status: String(row[ACOL_STATUS - 1] || '')
  }));
  return json_({ result: 'success', rows: rows });
}

/* ── 커리큘럼 조회 — 학생용, 공개된 활동 + 학년정보만 (v12 신규) ──
 * 응답 모양을 config.js의 기존 CONFIG.CURRICULUM 구조와 동일하게 맞춰서
 * 프론트가 그대로 CONFIG.CURRICULUM = data.grades 로 덮어쓸 수 있게 함. */
function curriculumGet_(e) {
  const grades = {};

  const giSheet = getOrCreateGradeInfoSheet_();
  if (giSheet.getLastRow() >= 2) {
    const gv = giSheet.getRange(2, 1, giSheet.getLastRow() - 1, GRADE_INFO_HEADERS.length).getValues();
    gv.forEach(function (row) {
      const grade = String(row[0] || '').trim();
      if (!grade) return;
      const pf = parseUrlField_(row[5]);
      const hasPortfolio = !!(pf.url || pf.urlByBan);
      const portfolio = hasPortfolio ? {
        title: String(row[3] || ''),
        desc: String(row[4] || '')
      } : null;
      if (portfolio) {
        if (pf.urlByBan) portfolio.urlByBan = pf.urlByBan; else portfolio.url = pf.url;
      }
      grades[grade] = {
        subject: String(row[1] || ''),
        unitQuestion: String(row[2] || ''),
        portfolio: portfolio,
        // v20: 반 트랙 매핑 — 프론트가 로그인한 학생의 반으로 담당(효니/미현쌤) 차시를 가려낼 때 씀.
        hyoBans: parseBanListField_(row[6]),
        mihyunBans: parseBanListField_(row[7]),
        lessons: []
      };
    });
  }

  const clSheet = getOrCreateCurriculumSheet_();
  if (clSheet.getLastRow() >= 2) {
    const lv = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
    // v13: 학년 내 순서(CLCOL_ORDER) 기준 정렬 후 담기 — 시트 행 순서가 아니라 순서 컬럼이 노출 순서를 결정함
    const withOrder = lv.map(function (row, i) {
      return { row: row, order: Number(row[CLCOL_ORDER - 1]) || (i + 1) };
    });
    withOrder.sort(function (a, b) { return a.order - b.order; });
    withOrder.forEach(function (item) {
      const row = item.row;
      const isPublic = String(row[CLCOL_PUBLIC - 1] || '') === '공개';
      if (!isPublic) return;
      const grade = String(row[1] || '').trim();
      if (!grade) return;
      if (!grades[grade]) grades[grade] = { subject: '', unitQuestion: '', portfolio: null, hyoBans: [], mihyunBans: [], lessons: [] };

      const lesson = {
        id: String(row[2] || ''),
        title: String(row[3] || ''),
        desc: String(row[4] || ''),
        activities: parseLessonActivities_(row),
        sequential: String(row[CLCOL_SEQUENTIAL - 1] || '') === '순차',
        // v20: '공통'이 기본값 — 특정 교사 담당으로 지정된 차시만 별도로 표시.
        // 프론트 필터링을 가볍게 하려고 '공통'인 경우엔 필드 자체를 안 내려보냄.
        owner: (function () {
          const o = String(row[CLCOL_OWNER - 1] || '').trim();
          return (o === '효니' || o === '미현쌤') ? o : null;
        })()
      };
      grades[grade].lessons.push(lesson);
    });
  }

  return json_({ result: 'success', grades: grades });
}

/* ── 커리큘럼 조회 — 교사용, 비공개 포함 전체 + _row (v12 신규) ── */
function curriculumAdminGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const gradeInfo = {};
  const giSheet = getOrCreateGradeInfoSheet_();
  if (giSheet.getLastRow() >= 2) {
    const gv = giSheet.getRange(2, 1, giSheet.getLastRow() - 1, GRADE_INFO_HEADERS.length).getValues();
    gv.forEach(function (row, i) {
      const grade = String(row[0] || '').trim();
      if (!grade) return;
      gradeInfo[grade] = {
        _row: i + 2,
        subject: String(row[1] || ''),
        unitQuestion: String(row[2] || ''),
        portfolioTitle: String(row[3] || ''),
        portfolioDesc: String(row[4] || ''),
        portfolioUrlText: String(row[5] || ''),
        hyoBansText: String(row[6] || ''),     // v20
        mihyunBansText: String(row[7] || '')   // v20
      };
    });
  }

  const lessons = [];
  const clSheet = getOrCreateCurriculumSheet_();
  if (clSheet.getLastRow() >= 2) {
    const lv = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
    lv.forEach(function (row, i) {
      // v19: 활동목록JSON이 있으면 그 원문 그대로도 같이 내려줌 — 대시보드 수정 폼이
      // "활동 2개" 모드로 들어갈 때 기존 값을 채워 넣는 용도(원문 텍스트 그대로 재사용).
      const activitiesRaw = String(row[CLCOL_ACTIVITIES - 1] || '').trim();
      lessons.push({
        _row: i + 2,
        timestamp: row[0],
        grade: String(row[1] || ''),
        id: String(row[2] || ''),
        title: String(row[3] || ''),
        desc: String(row[4] || ''),
        type: String(row[5] || ''),
        urlText: String(row[6] || ''),
        public: String(row[CLCOL_PUBLIC - 1] || '') === '공개',
        order: Number(row[CLCOL_ORDER - 1]) || (i + 1),   // v13
        isPast: String(row[CLCOL_PAST - 1] || '') === '지난활동', // v13
        activitiesRaw: activitiesRaw,                                    // v19
        activitiesCount: parseLessonActivities_(row).length,             // v19
        sequential: String(row[CLCOL_SEQUENTIAL - 1] || '') === '순차',  // v19
        owner: String(row[CLCOL_OWNER - 1] || '').trim() || '공통',      // v20
        thinkingType: String(row[CLCOL_THINKING_TYPE - 1] || '').trim(), // v23 — 폼 프리필용
        badgeName: String(row[CLCOL_BADGE_NAME - 1] || '').trim()        // v24 — 폼 프리필용
      });
    });
    // v13: 학년별로 묶어서 보되, 학년 내에서는 순서 기준 정렬 — 대시보드가 이 순서 그대로 그리면 됨
    lessons.sort(function (a, b) { return a.grade.localeCompare(b.grade) || a.order - b.order; });
  }

  // v24: 칭호명 이름 풀도 같이 내려줌 — 대시보드 폼이 사고유형 그룹별 후보를
  // datalist 자동완성으로 보여줄 때 씀(BADGE_NAME_POOL 참고).
  return json_({ result: 'success', lessons: lessons, gradeInfo: gradeInfo, badgeNamePool: BADGE_NAME_POOL });
}

/* ── 웰컴 체크인: 오늘 차시 + 본인 완료 여부 조회 (학생, v15 신규) ──
 * grade만 보내면 오늘 차시id만 반환. studentId·name도 같이 보내면
 * "오늘 이미 체크인했나"(alreadyChecked)까지 함께 내려줌 — 프론트가
 * 이 값 하나로 화면 흐름(체크인 화면 vs 포털 메인 바로 진입)을 결정하면 됨. */
function checkinTodayGet_(e) {
  try {
    const grade = String(e.parameter.grade || '').trim();
    if (!grade) throw new Error('학년이 필요합니다.');
    // v16: ban 파라미터 추가. 안 넘어오면 "전체"로 취급(학년 공통 설정만 봄).
    const ban = String(e.parameter.ban || '전체').trim();

    const setSheet = getOrCreateCheckinSettingSheet_();
    let lessonId = '';
    if (setSheet.getLastRow() >= 2) {
      const values = setSheet.getRange(2, 1, setSheet.getLastRow() - 1, CHECKIN_SETTING_HEADERS.length).getValues();
      let banRowLessonId = null;   // (학년, 특정 반) 일치
      let allRowLessonId = null;   // (학년, "전체") 일치 — 폴백용
      for (let i = 0; i < values.length; i++) {
        const rowGrade = String(values[i][0] || '').trim();
        const rowBan = String(values[i][1] || '').trim();
        if (rowGrade !== grade) continue;
        if (ban !== '전체' && rowBan === ban) { banRowLessonId = String(values[i][2] || ''); }
        if (rowBan === '전체') { allRowLessonId = String(values[i][2] || ''); }
      }
      // 특정 반 설정이 있으면 그게 우선, 없으면 "전체" 설정으로 폴백.
      lessonId = (banRowLessonId !== null) ? banRowLessonId : (allRowLessonId !== null ? allRowLessonId : '');
    }

    const result = { result: 'success', lessonId: lessonId };

    const sid = String(e.parameter.studentId || '').trim();
    const name = String(e.parameter.name || '').trim();
    if (sid && name) {
      const today = todayString_();
      const ckSheet = getOrCreateCheckinSheet_();
      let already = false;
      if (ckSheet.getLastRow() >= 2) {
        const cv = ckSheet.getRange(2, 1, ckSheet.getLastRow() - 1, CHECKIN_HEADERS.length).getValues();
        already = cv.some(function (row) {
          return String(row[CKCOL_HAKBUN - 1] || '').trim() === sid &&
                 ckDateStr_(row[CKCOL_DATE - 1]) === today;
        });
      }
      result.alreadyChecked = already;
    }

    return json_(result);
  } catch (err) {
    return json_({ result: 'error', message: err.message });
  }
}

/* ── 웰컴 체크인: 교사용 응답 목록 조회 (v15 신규) ──
 * date 파라미터 없으면 오늘. 온도 낮은 순으로 정렬해서 반환.
 * lowStreakAlert: 해당 학생의 "가장 최근 기록부터 거슬러 올라간" 연속 저온도(<=CHECKIN_LOW_TEMP)
 * 횟수가 CHECKIN_LOW_STREAK_N 이상이면 true. 학생 화면엔 절대 노출되지 않고 이 응답에만 존재 —
 * 교사가 참고용으로만 보는 값(핸드오프: "나만 확인하고 교육용 자료로 활용"). */
function checkinAdminGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const grade = String(e.parameter.grade || '').trim();
  const date = String(e.parameter.date || '').trim() || todayString_();

  const sheet = getOrCreateCheckinSheet_();
  if (sheet.getLastRow() < 2) return json_({ result: 'success', rows: [] });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKIN_HEADERS.length).getValues();
  const all = values.map(function (row) {
    return {
      timestamp: row[CKCOL_TIMESTAMP - 1],
      studentId: String(row[CKCOL_HAKBUN - 1] || ''),
      studentName: String(row[CKCOL_NAME - 1] || ''),
      date: ckDateStr_(row[CKCOL_DATE - 1]),
      lessonId: String(row[CKCOL_LESSON - 1] || ''),
      temperature: Number(row[CKCOL_TEMP - 1]) || 0,
      checkinType: String(row[CKCOL_TYPE - 1] || ''),
      judgment: String(row[CKCOL_JUDGMENT - 1] || ''),
      word: String(row[CKCOL_WORD - 1] || ''),
      custom: String(row[CKCOL_CUSTOM - 1] || '')
    };
  });

  // 학번별로 날짜순 정렬해서 "가장 최근부터 연속 저온도" 스트릭 계산
  const byStudent = {};
  all.forEach(function (r) { (byStudent[r.studentId] = byStudent[r.studentId] || []).push(r); });
  const streakByStudent = {};
  Object.keys(byStudent).forEach(function (sid) {
    const list = byStudent[sid].slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    let streak = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].temperature > 0 && list[i].temperature <= CHECKIN_LOW_TEMP) streak++;
      else break;
    }
    streakByStudent[sid] = streak;
  });

  let rows = all.filter(function (r) { return r.date === date; });
  if (grade) {
    // 학번 앞자리(예: 30512 → 3학년)로 학년 필터링. 학번 체계: 학년1+반2+번호2.
    rows = rows.filter(function (r) { return String(r.studentId).charAt(0) === grade; });
  }
  rows = rows.map(function (r) {
    return Object.assign({}, r, {
      lowStreakAlert: streakByStudent[r.studentId] >= CHECKIN_LOW_STREAK_N
    });
  });
  rows.sort(function (a, b) { return a.temperature - b.temperature; });

  return json_({ result: 'success', rows: rows });
}

/* ── 체크인문항 조회 — 학생용, 학년별 lessons 배열로 재구성 (v17 신규) ──
 * 응답 모양을 기존 checkin_data.js의 CHECKIN_PLAN 구조와 동일하게 맞춰서
 * 프론트가 그대로 CHECKIN_PLAN = data.plan 으로 쓸 수 있게 함. */
function checkinPlanGet_(e) {
  const plan = {};
  const sheet = getOrCreateCheckinLessonSheet_();
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKIN_LESSON_HEADERS.length).getValues();
    values.forEach(function (row) {
      const grade = String(row[1] || '').trim();
      const id = String(row[2] || '').trim();
      if (!grade || !id) return; // 학년·차시id 없는 빈 행은 건너뜀
      if (!plan[grade]) plan[grade] = { lessons: [] };

      const type = String(row[5] || '').trim();
      const lesson = {
        id: id,
        topic: String(row[3] || ''),
        textbook: String(row[4] || ''),
        type: type,
        prompt: String(row[6] || ''),
        recall: String(row[12] || ''),
        verify: String(row[13] || '') === 'TRUE'
      };
      if (String(row[14] || '').trim()) lesson.verifyNote = String(row[14]);
      if (String(row[15] || '').trim()) lesson.note = String(row[15]);

      if (type === 'judgment') {
        lesson.options = [
          { id: 'a', label: String(row[7] || '') },
          { id: 'b', label: String(row[8] || '') }
        ];
      } else if (type === 'source_emotion') {
        lesson.source = { text: String(row[9] || ''), origin: String(row[10] || ''), caveat: null };
        const chipsRaw = String(row[11] || '').trim();
        if (chipsRaw) lesson.wordChips = chipsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      }
      plan[grade].lessons.push(lesson);
    });
  }
  return json_({ result: 'success', plan: plan });
}

/* ── 체크인문항 조회 — 교사용, _row 포함 전체 (v17 신규) ── */
function checkinPlanAdminGet_(e) {
  const token = e.parameter.token || '';
  if (!teacherNameForToken_(token)) return json_({ result: 'error', message: '인증 실패' });

  const rows = [];
  const sheet = getOrCreateCheckinLessonSheet_();
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKIN_LESSON_HEADERS.length).getValues();
    values.forEach(function (row, i) {
      rows.push({
        _row: i + 2,
        timestamp: row[0],
        grade: String(row[1] || ''),
        id: String(row[2] || ''),
        topic: String(row[3] || ''),
        textbook: String(row[4] || ''),
        type: String(row[5] || ''),
        prompt: String(row[6] || ''),
        optionA: String(row[7] || ''),
        optionB: String(row[8] || ''),
        sourceText: String(row[9] || ''),
        sourceOrigin: String(row[10] || ''),
        wordChips: String(row[11] || ''),
        recall: String(row[12] || ''),
        verify: String(row[13] || '') === 'TRUE',
        verifyNote: String(row[14] || ''),
        note: String(row[15] || '')
      });
    });
  }
  return json_({ result: 'success', rows: rows });
}

/* ── 전체 기록 조회 (교사) ── */
function teacherGet_(e) {
  const token = e.parameter.token || '';
  const teacherName = teacherNameForToken_(token);
  if (!teacherName) return json_({ result: 'error', message: '인증 실패' });

  const sheet = getOrCreateSheet_();
  if (sheet.getLastRow() < 2) return json_({ rows: [], teacher: teacherName });

  const lastCol = Math.max(sheet.getLastColumn(), COL_GROUP_ID);
  const values = sheet.getRange(1, 1, sheet.getLastRow(), lastCol).getValues();
  const headers = values[0];
  const keyMap = {
    '타임스탬프': 'timestamp', '학번': 'studentId', '이름': 'studentName',
    '게임명': 'gameName', '선택 요약': 'choiceSummary', '실제 역사와의 차이': 'diffSummary',
    '학생 서술': 'reflection', '선택 상세(JSON)': 'choicesJson', '조번호': 'groupId'
  };

  const gameFilter = e.parameter.game || '';

  let rows = values.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, c) => {
      const key = keyMap[h] || h;
      if (key) obj[key] = row[c];
    });
    return obj;
  });

  if (gameFilter) rows = rows.filter(r => r.gameName === gameFilter);

  return json_({ result: 'success', rows: rows, teacher: teacherName });
}

/* ════════════════════════════════════════════════════════
 * doPost 라우팅
 *  - stage="judgment"      → 조별_임시공유 시트에만 기록 (포털 완료 판정에 안 잡힘)
 *  - (기본, stage 없음/그 외) → 게임활동_로그에 활동 기록 + groupId 기록
 *    [v18-2] 여기서 하던 Gemini 실시간 호출을 제거함 — 이제 시트 기록만 하고
 *    즉시 success 반환. AI코멘트는 ai_module_v6.gs 배치 트리거가 채움.
 *  - action=feedback       → 피드백 기록 (토큰 필수)
 *  - action=aiReview       → AI 코멘트 검토 완료 표시 (토큰 필수)
 *  - action=aiEdit         → AI 코멘트 수정/숨김 (토큰 필수)
 *  - action=askQuestion        → 질문함에 질문 등록 (토큰 불필요, v10 신규)
 *  - action=answerQuestion     → 질문함에 답변 기록 (토큰 필수, v10 신규)
 *  - action=addAnnouncement    → 공지 새로 게시 (토큰 필수, v11 신규)
 *  - action=toggleAnnouncement → 공지 게시↔보류 전환 (토큰 필수, v11 신규)
 *  - action=addLesson          → 커리큘럼에 새 활동 추가 (토큰 필수, v12 신규, 기본 비공개)
 *  - action=toggleLessonPublic → 활동 공개↔비공개 전환 (토큰 필수, v12 신규)
 *  - action=updateGradeInfo    → 학년정보(단원질문·포트폴리오) 저장 (토큰 필수, v12 신규, upsert)
 *  - action=toggleLessonPast   → 지난활동 표시 on/off 전환 (토큰 필수, v13 신규)
 *  - action=reorderLessons     → 순서 일괄 재조정 [{row,order},...] (토큰 필수, v13 신규)
 *  - action=checkin            → 웰컴 체크인 기록 (토큰 불필요, v15 신규, v17: 하루 여러 번 가능하게 upsert로 변경)
 *  - action=setTodayCheckin    → 학년+반별 오늘 체크인 차시id 저장 (토큰 필수, v15 신규, v16: ban 추가)
 *  - action=updateLesson       → 커리큘럼 활동 내용(제목·설명·타입·URL) 수정 (토큰 필수, v17 신규)
 *  - action=addCheckinLesson   → 체크인 문항 새로 추가 (토큰 필수, v17 신규)
 *  - action=updateCheckinLesson → 체크인 문항 내용 수정 (토큰 필수, v17 신규)
 *  - action=deleteCheckinLesson → 체크인 문항 삭제 (토큰 필수, v17 신규)
 *  - action=deleteActivityRow  → 게임활동_로그에서 특정 제출 행 삭제 (토큰 필수, v18 신규,
 *    중복 제출 정리용 — teacherGet_이 내려준 _row 값으로 지정)
 * ════════════════════════════════════════════════════════ */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || '').trim();

    if (action === 'feedback') return feedbackPost_(data);
    if (action === 'aiReview') return aiReviewPost_(data);
    if (action === 'aiEdit') return aiEditPost_(data);
    if (action === 'askQuestion') return askQuestionPost_(data);       // v10 신규
    if (action === 'answerQuestion') return answerQuestionPost_(data); // v10 신규
    if (action === 'addAnnouncement') return addAnnouncementPost_(data);       // v11 신규
    if (action === 'toggleAnnouncement') return toggleAnnouncementPost_(data); // v11 신규
    if (action === 'addLesson') return addLessonPost_(data);                   // v12 신규
    if (action === 'toggleLessonPublic') return toggleLessonPublicPost_(data); // v12 신규
    if (action === 'updateGradeInfo') return updateGradeInfoPost_(data);       // v12 신규
    if (action === 'toggleLessonPast') return toggleLessonPastPost_(data);     // v13 신규
    if (action === 'reorderLessons') return reorderLessonsPost_(data);         // v13 신규
    if (action === 'checkin') return checkinPost_(data);                       // v15 신규
    if (action === 'setTodayCheckin') return setTodayCheckinPost_(data);       // v15 신규
    if (action === 'updateLesson') return updateLessonPost_(data);                     // v17 신규
    if (action === 'addCheckinLesson') return addCheckinLessonPost_(data);             // v17 신규
    if (action === 'updateCheckinLesson') return updateCheckinLessonPost_(data);       // v17 신규
    if (action === 'deleteCheckinLesson') return deleteCheckinLessonPost_(data);       // v17 신규
    if (action === 'deleteActivityRow') return deleteActivityRowPost_(data);           // v18 신규

    // ── 짝 활동 1차 판단: 임시 시트에만 기록, 게임활동_로그는 건드리지 않음 ──
    if (String(data.stage || '').trim() === 'judgment') {
      return groupTempPost_(data);
    }

    // ── 기본: 활동 기록 (최종 제출 등, 학생당 1행) ──
    // [v18-2] 여기서 Gemini를 동기 호출하지 않는다. 시트 기록만 하고 바로 반환 —
    // AI 코멘트는 ai_module_v6.gs의 배치 트리거(aiScheduledRun)가 나중에 채운다.
    const sheet = getOrCreateSheet_();
    if (!data.gameName) {
      throw new Error('gameName이 없습니다. 게임 HTML의 CONFIG.GAME_NAME을 확인하세요.');
    }

    // [v21-1] 순차진행 서버측 게이트 — studentId·gameName(활동id)이 둘 다 있을 때만
    // 검사한다(둘 중 하나라도 없으면 기존 요청 형태와 동일하게 그냥 통과시킴).
    // 이 활동이 순차 차시의 2번째 이후 활동인데 바로 앞 활동을 아직 안 끝냈으면
    // 시트에 기록하지 않고 즉시 에러로 응답한다 — 프론트 버튼 잠금을 우회해서
    // API를 직접 호출해도 더는 순차 위반 제출이 통과하지 않는다.
    const studentIdForGate = String(data.studentId || '').trim();
    const gameNameForGate = String(data.gameName || '').trim();
    if (studentIdForGate && gameNameForGate) {
      const gate = checkSequentialGate_(studentIdForGate, gameNameForGate);
      if (!gate.ok) {
        return json_({ result: 'error', message: gate.message, locked: true });
      }
    }

    sheet.appendRow([
      new Date(),
      data.studentId || '',
      data.studentName || '',
      data.gameName || '',
      data.choiceSummary || '',
      data.diffSummary || '',
      data.reflection || '',
      data.choicesJson || ''
    ]);
    const newRow = sheet.getLastRow();

    // ── groupId 기록 (있을 때만) ──
    if (data.groupId) {
      ensureGroupIdHeader_(sheet);
      sheet.getRange(newRow, COL_GROUP_ID).setValue(String(data.groupId));
    }

    return json_({ result: 'success' });

  } catch (err) {
    return json_({ result: 'error', message: err.message });
  }
}

/* ── 짝 활동 1차 판단 기록 (임시 시트 전용) ── */
function groupTempPost_(data) {
  if (!data.gameName || !data.groupId) {
    return json_({ result: 'error', message: 'gameName과 groupId가 필요합니다.' });
  }
  const sheet = getOrCreateGroupTempSheet_();
  sheet.appendRow([
    new Date(),
    data.studentId || '',
    data.studentName || '',
    data.gameName || '',
    data.groupId || '',
    data.role || '',
    data.give || '',
    data.want || '',
    data.why || ''
  ]);
  return json_({ result: 'success' });
}

/* ── 피드백 기록 (교사) ── */
function feedbackPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateFeedbackSheet_();
  sheet.appendRow([
    new Date(),
    data.studentId || '',
    data.studentName || '',
    data.activityId || '전체',
    data.feedback || ''
  ]);
  return json_({ result: 'success' });
}

/* ── AI 코멘트 검토 완료 표시 ── */
function aiReviewPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  sheet.getRange(row, COL_AI_CHECK).setValue('확인');
  return json_({ result: 'success' });
}

/* ── AI 코멘트 수정/숨김 (빈 문자열이면 숨김) ── */
function aiEditPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  sheet.getRange(row, COL_AI_COMMENT).setValue(String(data.comment == null ? '' : data.comment));
  sheet.getRange(row, COL_AI_CHECK).setValue('확인');
  return json_({ result: 'success' });
}

/* ── 질문 등록 (학생, 토큰 불필요, v10 신규) ── */
function askQuestionPost_(data) {
  const sid = String(data.studentId || '').trim();
  const name = String(data.studentName || '').trim();
  const question = String(data.question || '').trim();
  if (!sid || !name || !question) {
    return json_({ result: 'error', message: '학번·이름·질문 내용이 모두 필요합니다.' });
  }
  const sheet = getOrCreateQuestionSheet_();
  sheet.appendRow([
    new Date(),                  // 타임스탬프
    sid,                          // 학번
    name,                         // 이름
    data.grade || '',             // 학년
    data.ban || '',               // 반
    question,                     // 질문
    '',                           // 답변
    '',                           // 답변시각
    '대기'                        // 상태
  ]);
  return json_({ result: 'success' });
}

/* ── 답변 등록/수정 (교사, 토큰 필수, v10 신규) ──
 * row: questionsGet_이 내려준 _row 값 (시트상 실제 행 번호) */
function answerQuestionPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateQuestionSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const answer = String(data.answer == null ? '' : data.answer).trim();
  if (!answer) return json_({ result: 'error', message: '답변 내용이 비어 있습니다.' });

  sheet.getRange(row, QCOL_ANSWER).setValue(answer);
  sheet.getRange(row, QCOL_ANSWER_TIME).setValue(new Date());
  sheet.getRange(row, QCOL_STATUS).setValue('답변완료');
  return json_({ result: 'success' });
}

/* ── 공지 새로 게시 (교사, 토큰 필수, v11 신규) ──
 * grade: "전체" 또는 학년 숫자/문자열. ban: "전체" 또는 반 숫자/문자열. */
function addAnnouncementPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const content = String(data.content || '').trim();
  if (!content) return json_({ result: 'error', message: '공지 내용이 비어 있습니다.' });

  const sheet = getOrCreateAnnouncementSheet_();
  sheet.appendRow([
    new Date(),
    String(data.grade || '전체'),
    String(data.ban || '전체'),
    content,
    '게시'
  ]);
  return json_({ result: 'success' });
}

/* ── 공지 게시↔보류 전환 (교사, 토큰 필수, v11 신규) ──
 * row: announcementsAdminGet_이 내려준 _row 값 (시트상 실제 행 번호) */
function toggleAnnouncementPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateAnnouncementSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const cur = String(sheet.getRange(row, ACOL_STATUS).getValue() || '');
  sheet.getRange(row, ACOL_STATUS).setValue(cur === '게시' ? '보류' : '게시');
  return json_({ result: 'success' });
}

/* ── 커리큘럼: 새 활동 추가 (교사, 토큰 필수, v12 신규) ──
 * public이 true가 아니면 기본 비공개로 등록됨. */
function addLessonPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const grade = String(data.grade || '').trim();
  const id = String(data.id || '').trim();
  const title = String(data.title || '').trim();
  if (!grade || !id || !title) {
    return json_({ result: 'error', message: '학년·활동id·제목은 필수입니다.' });
  }
  const sheet = getOrCreateCurriculumSheet_();

  // v13: 같은 학년 내 최대 순서값 + 1을 자동 부여 (맨 뒤에 추가됨)
  let nextOrder = 1;
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CURRICULUM_HEADERS.length).getValues();
    values.forEach(function (row) {
      if (String(row[1] || '').trim() !== grade) return;
      const o = Number(row[CLCOL_ORDER - 1]) || 0;
      if (o >= nextOrder) nextOrder = o + 1;
    });
  }

  // v19: data.activities(배열)가 오면 활동 2개 이상짜리 차시 — JSON으로 저장하고
  // 기존 타입·URL 컬럼은 비워둠(활동목록JSON이 있으면 그쪽을 우선 읽으므로 의미 없음).
  // 안 오면 기존처럼 단일활동 방식 그대로.
  const hasMulti = Array.isArray(data.activities) && data.activities.length >= 2;
  const activitiesJson = hasMulti ? JSON.stringify(data.activities.map(function (a) {
    return { id: String(a.id || '').trim(), title: a.title || '', desc: a.desc || '', type: a.type || 'module', url: a.url || '' };
  })) : '';
  // v20: owner — '공통'(기본)·'효니'·'미현쌤' 외 값이 오면 안전하게 '공통'으로 취급.
  const ownerIn = String(data.owner || '').trim();
  const owner = (ownerIn === '효니' || ownerIn === '미현쌤') ? ownerIn : '공통';
  // v23: thinkingType — '판단'·'비교'·'해석'·'관점' 외 값(빈 문자열 포함)이 오면
  // 안전하게 빈칸으로 취급. owner와 달리 빈칸이 정상값(자유서술형 차시)이라 기본값도 ''.
  const thinkingTypeIn = String(data.thinkingType || '').trim();
  const thinkingType = ['판단', '비교', '해석', '관점'].indexOf(thinkingTypeIn) !== -1 ? thinkingTypeIn : '';
  // v24: badgeName — resolveBadgeName_이 사고유형 유무·하위호환 기본값까지 처리.
  const badgeName = resolveBadgeName_(thinkingType, data.badgeName);

  sheet.appendRow([
    new Date(),
    grade,
    id,
    title,
    data.desc || '',
    hasMulti ? '' : (data.type || 'module'),
    hasMulti ? '' : (data.url || ''),
    data.public ? '공개' : '비공개',
    nextOrder,   // v13: 순서
    '',          // v13: 지난활동 (기본 아니오)
    activitiesJson,                          // v19
    (hasMulti && data.sequential) ? '순차' : '', // v19
    owner,                                   // v20
    thinkingType,                            // v23
    badgeName                                // v24
  ]);
  return json_({ result: 'success' });
}

/* ── 커리큘럼: 활동 내용 수정 (교사, 토큰 필수, v17 신규) ──
 * row: curriculumAdminGet_이 내려준 _row 값. 활동id·공개여부·순서·지난활동 여부는
 * 여기서 안 건드림(각각 addLesson 시 확정되거나 별도 토글 액션으로 관리) —
 * 제목·설명·타입·URL(+ v19: 활동목록JSON·순차진행)만 수정 대상. */
function updateLessonPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateCurriculumSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const title = String(data.title || '').trim();
  if (!title) return json_({ result: 'error', message: '제목은 필수입니다.' });

  // v19: data.activities가 오면 활동 2개 이상짜리로 갱신, 안 오면 단일활동으로 되돌림.
  const hasMulti = Array.isArray(data.activities) && data.activities.length >= 2;
  const activitiesJson = hasMulti ? JSON.stringify(data.activities.map(function (a) {
    return { id: String(a.id || '').trim(), title: a.title || '', desc: a.desc || '', type: a.type || 'module', url: a.url || '' };
  })) : '';

  // 제목(D)·설명(E)·타입(F)·URL(G) 갱신
  sheet.getRange(row, 4, 1, 4).setValues([[
    title, data.desc || '', hasMulti ? '' : (data.type || 'module'), hasMulti ? '' : (data.url || '')
  ]]);
  // 활동목록JSON(K)·순차진행(L) 갱신
  sheet.getRange(row, CLCOL_ACTIVITIES, 1, 2).setValues([[
    activitiesJson, (hasMulti && data.sequential) ? '순차' : ''
  ]]);
  // v20: 담당(M) 갱신
  const ownerIn = String(data.owner || '').trim();
  const owner = (ownerIn === '효니' || ownerIn === '미현쌤') ? ownerIn : '공통';
  sheet.getRange(row, CLCOL_OWNER).setValue(owner);
  // v23: 사고유형(N) 갱신 — '판단'·'비교'·'해석'·'관점' 외 값(빈 문자열 포함)은 빈칸으로.
  const thinkingTypeIn = String(data.thinkingType || '').trim();
  const thinkingType = ['판단', '비교', '해석', '관점'].indexOf(thinkingTypeIn) !== -1 ? thinkingTypeIn : '';
  sheet.getRange(row, CLCOL_THINKING_TYPE).setValue(thinkingType);
  // v24: 칭호명(O) 갱신 — resolveBadgeName_이 사고유형 유무·하위호환 기본값까지 처리.
  const badgeName = resolveBadgeName_(thinkingType, data.badgeName);
  sheet.getRange(row, CLCOL_BADGE_NAME).setValue(badgeName);
  return json_({ result: 'success' });
}

/* ── 체크인문항: 새로 추가 (교사, 토큰 필수, v17 신규) ── */
function addCheckinLessonPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const grade = String(data.grade || '').trim();
  const id = String(data.id || '').trim();
  const topic = String(data.topic || '').trim();
  const type = String(data.type || '').trim();
  const prompt = String(data.prompt || '').trim();
  if (!grade || !id || !topic || !type || !prompt) {
    return json_({ result: 'error', message: '학년·차시id·제목·타입·발문은 필수입니다.' });
  }
  if (type === 'judgment' && (!String(data.optionA || '').trim() || !String(data.optionB || '').trim())) {
    return json_({ result: 'error', message: 'judgment 타입은 옵션A·옵션B가 필요합니다.' });
  }
  if (type === 'source_emotion' && !String(data.sourceText || '').trim()) {
    return json_({ result: 'error', message: 'source_emotion 타입은 사료텍스트가 필요합니다.' });
  }
  const sheet = getOrCreateCheckinLessonSheet_();
  sheet.appendRow([
    new Date(), grade, id, topic, data.textbook || '', type, prompt,
    data.optionA || '', data.optionB || '', data.sourceText || '', data.sourceOrigin || '',
    data.wordChips || '', data.recall || '', data.verify ? 'TRUE' : '', data.verifyNote || '', data.note || ''
  ]);
  return json_({ result: 'success' });
}

/* ── 체크인문항: 내용 수정 (교사, 토큰 필수, v17 신규) ──
 * row: checkinPlanAdminGet_이 내려준 _row 값. 학년·차시id를 포함해 전체 필드를 다시 씀 —
 * 단, 차시id를 바꾸면 이미 "오늘의 체크인 차시"로 지정돼 있던 설정이 그 차시를 못 찾게 될 수 있음. */
function updateCheckinLessonPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateCheckinLessonSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const grade = String(data.grade || '').trim();
  const id = String(data.id || '').trim();
  const topic = String(data.topic || '').trim();
  const type = String(data.type || '').trim();
  const prompt = String(data.prompt || '').trim();
  if (!grade || !id || !topic || !type || !prompt) {
    return json_({ result: 'error', message: '학년·차시id·제목·타입·발문은 필수입니다.' });
  }
  // 타임스탬프(A)는 그대로 두고 B~P(학년~교사메모)만 갱신
  sheet.getRange(row, 2, 1, CHECKIN_LESSON_HEADERS.length - 1).setValues([[
    grade, id, topic, data.textbook || '', type, prompt,
    data.optionA || '', data.optionB || '', data.sourceText || '', data.sourceOrigin || '',
    data.wordChips || '', data.recall || '', data.verify ? 'TRUE' : '', data.verifyNote || '', data.note || ''
  ]]);
  return json_({ result: 'success' });
}

/* ── 체크인문항: 삭제 (교사, 토큰 필수, v17 신규) ── */
function deleteCheckinLessonPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateCheckinLessonSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  sheet.deleteRow(row);
  return json_({ result: 'success' });
}

/* ── 게임활동_로그: 특정 제출 행 삭제 (교사, 토큰 필수, v18 신규) ──
 * row: teacherGet_이 내려준 _row 값(시트상 실제 행 번호). 학생이 같은 활동을
 * 재도전 없이 실수로 중복 제출했거나 테스트 제출을 지웠으면 하는 경우 사용.
 * 완전 삭제이며 되돌릴 수 없음 — 프론트에서 confirm으로 한 번 더 확인시킴. */
function deleteActivityRowPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  sheet.deleteRow(row);
  return json_({ result: 'success' });
}

/* ── 커리큘럼: 활동 공개↔비공개 전환 (교사, 토큰 필수, v12 신규) ──
 * row: curriculumAdminGet_이 내려준 _row 값 (시트상 실제 행 번호) */
function toggleLessonPublicPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateCurriculumSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const cur = String(sheet.getRange(row, CLCOL_PUBLIC).getValue() || '');
  sheet.getRange(row, CLCOL_PUBLIC).setValue(cur === '공개' ? '비공개' : '공개');
  return json_({ result: 'success' });
}

/* ── 커리큘럼: 지난활동 표시 on/off 전환 (교사, 토큰 필수, v13 신규) ──
 * 공개여부와는 완전히 별개 컬럼 — 공개 상태를 유지한 채로도 "지난 활동"으로
 * 표시할 수 있음(예: 복습용으로 계속 열어두는 경우). 대시보드 목록에서
 * 진행중/예정 그룹과 지난 활동 그룹을 나누는 데만 쓰임. */
function toggleLessonPastPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const sheet = getOrCreateCurriculumSheet_();
  const row = Number(data.row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return json_({ result: 'error', message: '잘못된 행 번호: ' + data.row });
  }
  const cur = String(sheet.getRange(row, CLCOL_PAST).getValue() || '');
  sheet.getRange(row, CLCOL_PAST).setValue(cur === '지난활동' ? '' : '지난활동');
  return json_({ result: 'success' });
}

/* ── 커리큘럼: 순서 일괄 재조정 (교사, 토큰 필수, v13 신규) ──
 * data.items: [{row, order}, ...] — row는 curriculumAdminGet_이 내려준 _row,
 * order는 새로 매길 순서값(숫자). 시트 행 자체는 이동하지 않고 순서 컬럼만 갱신됨.
 * 대시보드에서 드래그(또는 위/아래 버튼)로 순서를 바꾸면, 영향받은 항목들만
 * 이 배열로 묶어 한 번에 보냄. */
function reorderLessonsPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) return json_({ result: 'error', message: '재정렬할 항목이 없습니다.' });

  const sheet = getOrCreateCurriculumSheet_();
  const lastRow = sheet.getLastRow();
  items.forEach(function (item) {
    const row = Number(item.row);
    const order = Number(item.order);
    if (!row || row < 2 || row > lastRow || !order) return; // 잘못된 항목은 조용히 건너뜀
    sheet.getRange(row, CLCOL_ORDER).setValue(order);
  });
  return json_({ result: 'success' });
}

/* ── 학년정보 저장 (교사, 토큰 필수, v12 신규, upsert) ──
 * 해당 학년 행이 있으면 갱신, 없으면 새로 추가. subject는 기존 값을 유지하고 싶을 때
 * 프론트가 GRADE_INFO_ADMIN에 있던 값을 그대로 다시 보내는 방식으로 구현돼 있음. */
function updateGradeInfoPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const grade = String(data.grade || '').trim();
  if (!grade) return json_({ result: 'error', message: '학년이 필요합니다.' });

  const sheet = getOrCreateGradeInfoSheet_();
  let targetRow = 0;
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === grade) { targetRow = i + 2; break; }
    }
  }
  const rowData = [
    grade,
    data.subject || '',
    data.unitQuestion || '',
    data.portfolioTitle || '',
    data.portfolioDesc || '',
    data.portfolioUrlText || '',
    data.hyoBans || '',      // v20
    data.mihyunBans || ''    // v20
  ];
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return json_({ result: 'success' });
}

/* ── 웰컴 체크인: 응답 기록 (토큰 불필요, v15 신규, v17: 중복 무시 → upsert로 변경) ──
 * 하루 여러 번 다시 체크인할 수 있게 열어둠 — 학생이 실수로 잘못 누르거나 중간에
 * 나가버려도 다시 로그인해서 정정할 수 있어야 함. 같은 학번+날짜 행이 이미 있으면
 * 그 행을 덮어쓰고(최신 응답이 그날의 응답이 됨), 없으면 새로 추가. */
function checkinPost_(data) {
  const sid = String(data.studentId || '').trim();
  const name = String(data.studentName || '').trim();
  const lessonId = String(data.lessonId || '').trim();
  const temperature = Number(data.temperature);
  if (!sid || !name) return json_({ result: 'error', message: '학번과 이름이 필요합니다.' });
  if (!lessonId) return json_({ result: 'error', message: '차시id가 필요합니다.' });
  if (!temperature || temperature < 1 || temperature > 5) {
    return json_({ result: 'error', message: '온도(1~5)가 필요합니다.' });
  }

  const today = todayString_();
  const sheet = getOrCreateCheckinSheet_();

  let targetRow = 0;
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CHECKIN_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][CKCOL_HAKBUN - 1] || '').trim() === sid &&
          ckDateStr_(values[i][CKCOL_DATE - 1]) === today) {
        targetRow = i + 2; break;
      }
    }
  }

  const rowData = [
    new Date(), sid, name, today, lessonId, temperature,
    String(data.checkinType || ''), String(data.judgment || ''),
    String(data.word || ''), String(data.custom || '')
  ];
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return json_({ result: 'success', updated: true });
  }
  sheet.appendRow(rowData);
  return json_({ result: 'success', updated: false });
}

/* ── 웰컴 체크인: 학년+반별 오늘 차시id 설정 (교사, 토큰 필수, v15 신규, v16: 반 단위로 확장, upsert) ──
 * (학년,반) 조합 행이 이미 있으면 갱신, 없으면 새로 추가. ban을 안 보내거나 "전체"로 보내면
 * 그 학년 전체에 적용되는 공통 행으로 저장됨(특정 반 행이 따로 있으면 학생 조회 시 그게 우선).
 * checkin_data.js의 CHECKIN_PLAN 배열 순서·개수는 그대로 두고, 이 값만 바꿔서
 * "오늘 학생 화면에 뜨는 차시"를 결정함. */
function setTodayCheckinPost_(data) {
  if (!teacherNameForToken_(data.token)) return json_({ result: 'error', message: '인증 실패' });
  const grade = String(data.grade || '').trim();
  const ban = String(data.ban || '전체').trim();
  const lessonId = String(data.lessonId || '').trim();
  if (!grade || !lessonId) return json_({ result: 'error', message: '학년과 차시id가 필요합니다.' });

  const sheet = getOrCreateCheckinSettingSheet_();
  let targetRow = 0;
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === grade && String(values[i][1] || '').trim() === ban) {
        targetRow = i + 2; break;
      }
    }
  }
  const rowData = [grade, ban, lessonId, new Date()];
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return json_({ result: 'success' });
}

/**
 * ────────────────────────────────────────────────────────
 * [일회성 마이그레이션 — 처음 한 번만 실행]
 * 지금 쓰고 있는 config.js의 CURRICULUM 스냅샷을 "커리큘럼"·"학년정보" 시트로
 * 옮깁니다. 아래 내용은 이 대화에서 확인 가능했던 범위까지만 채워뒀습니다:
 *   - 2학년: 3개 활동 모두 URL 없음(준비 중) → 비공개로 등록
 *   - 3학년: 고려거란관계게임(이미 5~8반에 배포됨) → 공개로 등록,
 *            패들렛 포트폴리오(5~8반 링크, v3 핸드오프 문서 기준) 등록
 *   - 단원 관통 질문(unitQuestion): 정확한 문구를 확인할 수 없어서 비워뒀습니다.
 *     ⚠️ 실행 전에 실제 config.js와 대조해서 아래 내용을 맞게 고친 뒤 실행하세요.
 *     특히 unitQuestion은 반드시 채워 넣어야 배너가 뜹니다.
 * 실행 방법: Apps Script 편집기 상단 함수 목록에서
 * "migrateCurriculumFromConfig_"를 선택하고 ▶ 실행.
 * 재실행하면 중복 행이 쌓이니 한 번만 실행 권장.
 * ────────────────────────────────────────────────────────
 */
function migrateCurriculumFromConfig() {
  // [학년, 과목, 단원관통질문, 포트폴리오제목, 포트폴리오설명, 포트폴리오URL(반:URL 줄바꿈 가능)]
  const GRADE_INFO_SNAPSHOT = [
    ['2', '세계사', '', '', '', ''],
    ['3', '한국사', '', '나의 역사 패들렛', '',
      '5:https://padlet.com/dy_sch03/2026-2-3-5-cewq8vec8p3ew2yn\n' +
      '6:https://padlet.com/dy_sch03/2026-2-3-6-2xngg3v8pstkvld9\n' +
      '7:https://padlet.com/dy_sch03/2026-2-3-7-8ssvnriy75f7xwxs\n' +
      '8:https://padlet.com/dy_sch03/2026-2-3-8-gsrz2i3ca863675l'
    ]
  ];
  // [학년, 활동id, 제목, 설명, 타입, URL(반:URL 줄바꿈 가능), 공개여부]
  const LESSON_SNAPSHOT = [
    ['2', '세력권전략시뮬레이션', '세력권 전략 시뮬레이션', '게르만 왕국의 갈림길에서 직접 선택하고, 실제 역사와 비교해요.', 'module', '', '비공개'],
    ['2', '교황권자원게임', '교황권 자원 게임', '중세 교회와 국왕, 힘의 균형은 어떻게 움직였을까?', 'module', '', '비공개'],
    ['2', '산업혁명시뮬레이터', '산업혁명 시뮬레이터', '공장과 도시가 생겨나던 시대, 사람들의 삶은 어떻게 바뀌었을까?', 'module', '', '비공개'],
    ['3', '고려거란관계게임', '고려-거란 관계 게임', '서희의 담판과 귀주대첩의 갈림길에서 직접 선택해요.', 'module', 'https://hyonnie-t.github.io/Goryeo-Khitan/', '공개']
  ];

  const giSheet = getOrCreateGradeInfoSheet_();
  GRADE_INFO_SNAPSHOT.forEach(function (row) { giSheet.appendRow(row); });

  // v13: 마이그레이션 시점의 스냅샷 나열 순서를 그대로 학년별 순서(1,2,3…) 값으로 부여.
  // 지난활동은 전부 기본값(빈 값 = 진행중/예정)으로 시작 — 이미 끝난 활동은 대시보드에서 수동 표시할 것.
  const orderByGrade = {};
  const clSheet = getOrCreateCurriculumSheet_();
  LESSON_SNAPSHOT.forEach(function (row) {
    const grade = row[0];
    orderByGrade[grade] = (orderByGrade[grade] || 0) + 1;
    clSheet.appendRow([new Date()].concat(row).concat([orderByGrade[grade], '']));
  });

  Logger.log('마이그레이션 완료: 학년정보 ' + GRADE_INFO_SNAPSHOT.length + '행, 커리큘럼 ' + LESSON_SNAPSHOT.length + '행');
}

/**
 * ────────────────────────────────────────────────────────
 * [일회성 마이그레이션 — 처음 한 번만 실행]
 * checkin_data.js에 하드코딩돼 있던 CHECKIN_PLAN(문항 17개)을 "체크인문항" 시트로
 * 옮깁니다. 실행 후에는 checkin_data.js의 CHECKIN_PLAN 블록은 더 이상 안 쓰이니
 * 지워도 되고(이미 v17 checkin_data.js에서는 제거해뒀음), 이 시트가 원본이 됩니다.
 * 실행 방법: Apps Script 편집기 상단 함수 목록에서
 * "migrateCheckinLessonsFromData_"를 선택하고 ▶ 실행.
 * 재실행하면 중복 행이 쌓이니 한 번만 실행 권장.
 * ────────────────────────────────────────────────────────
 */
function migrateCheckinLessonsFromData() {
  // [학년, 차시id, 제목, 교과서, 타입, 발문, 옵션A, 옵션B, 사료텍스트, 사료출처, 단어칩(콤마구분), 회수질문, 사실검증(TRUE/''), 검증메모, 교사메모]
  const LESSON_SNAPSHOT = [
    ['2', 'w13-1', '서로마 붕괴와 프랑크 왕국의 성립', '주제13 / 01', 'judgment',
      '서로마가 망했어. 나라도 군대도 사라졌어.\n너는 마을 사람이야. 누구를 믿고 살지?',
      '새로 온 게르만 왕', '원래 있던 교회', '', '', '',
      '실제로 마을을 지킨 건 어디였지? 교회가 왜 그 역할까지 하게 됐을까?', '', '', ''],
    ['2', 'w13-2', '비잔티움 제국과 동서 교회의 분열', '주제13 / 03-04', 'judgment',
      '황제가 "성상을 다 부숴라"고 명령했어. 십계명에 우상 숭배를 금지한다고 적혀 있으니까.\n근데 교황은 반대해. 글을 모르는 사람들한테 선교하려면 그림이 꼭 필요하다는 거야.',
      '황제가 맞다', '교황이 맞다', '', '', '',
      '나중엔 비잔티움도 성상을 허용했어. 그럼 두 교회가 갈라선 진짜 이유는 뭐였을까? (교과서 탐구2)', '', '', ''],
    ['2', 'w14-1', '아바스 왕조의 등장', '주제14 / 01', 'judgment',
      '네가 새 왕조를 세웠어.\n앞 왕조는 아랍인만 우대해서 원성을 샀지.\n너라면?',
      '아랍인 우대를 유지한다', '비아랍인도 동등하게 대한다', '', '', '',
      '아바스 왕조의 선택은? 그 결과 바그다드는 어떤 도시가 됐지?', '', '', ''],
    ['2', 'w14-2', '셀주크 튀르크와 이슬람 문화', '주제14 / 02', 'judgment',
      '바그다드를 점령했어.\n칼리프(이슬람 세계 최고 종교 지도자)를 없앨까, 남겨둘까?',
      '없애고 내가 다 갖는다', '남겨두고 칭호만 받는다', '', '', '',
      '셀주크는 술탄이라는 칭호를 받았어. 왜 칼리프를 안 없앴을까?', '', '', ''],
    ['2', 'w15-1', '봉건제의 성립', '주제15 / 01', 'judgment',
      '바이킹이 쳐들어와서 마을이 불타. 왕한테 사람을 보내도 오지 않아.\n옆 마을 기사가 말해. "내가 지켜줄게. 대신 내 밑으로 들어와."\n그 밑에 들어가면 목숨은 건지는데 — 일주일에 며칠은 기사 땅에서 공짜로 일해야 하고, 허락 없이 마을을 떠날 수도 없어.',
      '그래도 받아들인다', '거절하고 버틴다', '', '', '',
      '농민들은 자유를 잃는데도 왜 기사를 지배자로 받아들였을까?', '', '', ''],
    ['2', 'w15-2', '교황과 황제의 대립 (카노사의 굴욕)', '주제15 / 02', 'judgment',
      '너는 황제야.\n교황이 "성직자는 내가 임명한다"고 해.\n근데 그 주교들은 네 영토 안에 살고, 땅도 갖고 있어.',
      '양보한다', '맞선다', '', '', '',
      '하인리히 4세는 맞섰다가 무릎을 꿇었어. 뭐가 그를 무너뜨렸지?', '', '', ''],
    ['2', 'w16-1', '십자군 전쟁의 전개', '주제16 / 01', 'judgment',
      '교황이 "성지를 되찾자"고 호소했어.\n너는 장원에 묶여 사는 농노야. 허락 없이는 마을을 떠날 수도 없어.',
      '간다', '안 간다', '', '', '',
      '왕·영주·기사·상인·농민이 간 이유가 다 달랐어. 네 이유는 어디에 가까웠어? (교과서 탐구1)', '', '', ''],
    ['2', 'w16-2', '중세 도시의 성장과 장원의 해체', '주제16 / 02-03', 'judgment',
      '흑사병으로 마을 사람 절반이 죽었어. 너는 살아남은 농노야.\n일할 사람이 확 줄어서, 영주는 너 말고 딴 사람을 구하기 어려워.\n그런데 영주는 예전이랑 똑같이 일하라고 해.',
      '조건을 요구한다', '그냥 일한다', '', '', '',
      '실제로 농노의 지위가 올라갔어. 왜 이제는 요구가 통했을까?', '', '', ''],
    ['2', 'w16-3', '교황권의 약화와 왕권의 강화', '주제16 / 04', 'judgment',
      '14세기 초, 프랑스 왕이 군대를 보내 교황을 체포했어.\n그리고 교황청을 로마에서 프랑스 아비뇽으로 옮겨버렸어.\n너는 프랑스에 사는 평범한 크리스트교도야. 이제 교황이 우리나라 안에 있어.',
      '잘된 일이다', '이상한 일이다', '', '', '',
      '이후 로마와 아비뇽에서 각각 교황이 뽑히는 일이 벌어졌어. w15-2 카노사 때는 황제가 무릎을 꿇었는데, 뭐가 달라진 거지?', '', '',
      '★ w15-2와 짝. 같은 구조의 대립이 정반대 결과로 끝난 걸 학생이 스스로 발견하게 하는 비교 축.'],
    ['2', 'w16-close', '대단원 마무리 — 종교는 분쟁의 씨앗일까', '주제16 이후 / 역사로 세상 읽기', 'source_emotion',
      '800년이 지난 뒤에 사과하는 사람은, 그때 어떤 상태였을까?\n한 단어로 골라봐.',
      '', '',
      "2001년, 교황 요한 바오로 2세는 그리스를 방문해 십자군이 비잔티움 제국을 침략하고 약탈한 일을 '교회가 저지른 범죄'라며 정식으로 사과했어.",
      '현대 공식 발언 (교과서 수록)', '부끄러움,후회,부담,홀가분,진심,계산',
      '왜 800년이나 걸렸을까? 그리고 사과가 늦으면 의미가 없어지는 걸까?', '', '',
      "학생 단어가 갈릴수록 좋음. '계산'을 고른 학생과 '진심'을 고른 학생을 각각 발표시켜 근거를 비교시키면 그대로 토의가 됨."],
    ['3', 'k-goryeo-1', '거란의 1차 침입과 서희의 담판', 'Ⅲ-2 / 거란의 침입과 격퇴', 'judgment',
      '거란이 쳐들어왔어.\n신하들은 "북쪽 땅을 떼어주고 화친하자"고 해.\n너는 왕이야.',
      '땅 주고 화친한다', '다른 길을 찾는다', '', '', '',
      '서희는 제3의 길을 갔어. 근데 서희도 하나는 내줬어. 뭐였지?', 'TRUE',
      '거란군 병력 수는 사료마다 다르고 과장 논란이 있음. 발문·수업 모두에서 숫자를 단정하지 말 것.', ''],
    ['3', 'k-goryeo-2', '거란의 2·3차 침입과 귀주 대첩', 'Ⅲ-2 / 거란의 침입과 격퇴', 'judgment',
      '거란이 또 왔어.\n개경이 함락됐고 왕은 피란 중이야.\n너는 조정의 신하야.',
      '협상한다', '끝까지 싸운다', '', '', '',
      '귀주에서 이겼어. 근데 이긴 다음 고려가 한 일은 천리장성을 쌓는 거였어. 이겼는데 왜 성을 쌓았을까?', '', '', ''],
    ['3', 'k-goryeo-3', '여진의 성장과 금의 사대 요구', 'Ⅲ-2 / 여진 정벌과 동북 9성', 'judgment',
      '예전에 우리한테 말과 담비 가죽을 바치던 여진이,\n이제 "나를 형으로 섬겨라"고 해.',
      '받아들인다', '거부한다', '', '', '',
      '이자겸 등은 받아들였어. 이 판단을 어떻게 봐야 할까?', 'TRUE',
      "이자겸의 금 사대 수용 평가는 해석이 갈림. '굴욕적 사대' 시각과 '현실적 판단' 시각이 병존. 교사가 한쪽으로 결론 내지 말 것.", ''],
    ['3', 'k-goryeo-4', '주변 국가와의 교류 — 벽란도', 'Ⅲ-2 / 송과의 교류', 'source_emotion',
      '이 글을 쓴 서긍은 어떤 상태로 이걸 적었을까?\n한 단어로 골라봐.',
      '', '',
      '송나라 사신 서긍이 고려에 와서 쓴 기록이야.\n"고려 사람들은 늘 중국인이 때가 많은 것을 비웃는다. 그래서 아침에 일어나면 먼저 목욕을 한 뒤에 집을 나선다."',
      '『선화봉사고려도경』 (12세기 초, 송 사신 서긍)', '놀람,감탄,불쾌,흥미,부끄러움,우월감',
      '잠깐. 이건 고려 사람의 감정일까, 서긍의 감정일까? 이 기록으로 우리가 알 수 있는 건 정확히 뭐지?', '', '',
      "★ 핵심 설계. 학생 상당수가 '고려인의 감정'으로 착각함. 그 혼동을 짚는 순간 '사료는 누군가의 시선으로 쓰인다'를 감정 질문 하나로 가르치게 됨. 정정하지 말고 발표시킨 뒤 스스로 발견하게 할 것."],
    ['3', 'k-goryeo-5', '몽골의 침입과 강화 천도', 'Ⅲ-3 / 몽골의 침입', 'judgment',
      '몽골이 쳐들어왔어. 조정은 수도를 강화도로 옮기자고 해.\n강화도는 농사지을 땅이 넉넉하고, 물살이 거세서 배 싸움에 약한 몽골군이 들어오기 어려워.\n그런데 육지에 사는 백성들은 따라갈 수가 없어.',
      '그래도 옮기는 게 맞다', '옮기면 안 된다', '', '', '',
      '백성들은 어디서 싸웠지? 이 선택의 대가는 누가 치렀을까?', '', '',
      '★ 왕조의 생존과 백성의 생존을 분리해서 보게 만드는 차시. 이후 몽골 항쟁 전체를 보는 렌즈가 됨.'],
    ['3', 'k-goryeo-6', '원의 내정 간섭과 권문세족', 'Ⅲ-3 / 원의 내정 간섭', 'judgment',
      '원이 고려 왕을 마음대로 갈아치워.\n근데 나라 이름은 그대로 남아있어.',
      '망한 거나 다름없다', '나라는 유지된 거다', '', '', '',
      '교과서는 "정치적 독립은 유지했다"고 써. 근데 왕을 마음대로 바꿨어. 이 둘이 어떻게 동시에 성립하지?', '', '', ''],
    ['3', 'k-goryeo-7', '공민왕의 개혁 정치', 'Ⅲ-3 / 공민왕의 개혁', 'judgment',
      '원이 급격히 약해지고 있어. 지금이 기회야.\n그런데 조정을 잡고 있는 세력은 원을 등에 업고 있어. 정면으로 치면 원이 개입할 수도 있어.\n기다리면 안전하지만, 원이 다시 강해지면 기회는 사라져.',
      '지금 친다', '더 기다린다', '', '', '',
      '공민왕은 정면으로 쳤어. 결과는 어땠지?', 'TRUE',
      "공민왕 개혁의 실패 원인은 학계 해석이 단일하지 않음. 회수 질문을 '왜 실패했을까'까지 밀지 말고 '결과는 어땠지'에서 멈출 것. 원인을 다룰 땐 교과서 서술 범위 안에서만.", '']
  ];

  const sheet = getOrCreateCheckinLessonSheet_();
  LESSON_SNAPSHOT.forEach(function (row) { sheet.appendRow([new Date()].concat(row)); });
  Logger.log('마이그레이션 완료: 체크인문항 ' + LESSON_SNAPSHOT.length + '행');
}
