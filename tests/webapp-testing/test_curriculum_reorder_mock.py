"""
[체크리스트 → 테스트 조건 #3] 커리큘럼 관리 탭의 차시 순서 변경 — 드래그 + ▲▼
버튼 이중 지원 검증.

핸드오프 문서는 이 기능을 "SortableJS 드래그"라고 적었지만, 실제 구현
(index.html clLessonItemHtml/bindClListEvents, 약 3147~3226행)은 외부
라이브러리 없이 네이티브 HTML5 Drag and Drop API(draggable + dragstart/
dragover/dragend)로 짜여 있다 — SortableJS는 이 저장소 어디에도 없다
(index.html 전체에서 <script src=...> 태그는 config.js/checkin_data.js
둘뿐). 그래서 이 테스트는 SortableJS가 아니라 네이티브 dragstart/dragend
이벤트를 직접 디스패치해서 드래그 경로를 검증한다.

두 경로 모두 결과적으로 `action:'reorderLessons'` POST 하나로 수렴한다
(드래그 → dashCommitReorder, 버튼 → dashMoveLesson) — "이중 지원"이 실제로
동작한다는 건 (1) 버튼 클릭 후 DOM 순서가 바뀌고 (2) 드래그 후에도 DOM
순서가 바뀌고 (3) 두 경우 모두 서버로 reorderLessons가 나가는 것, 이
세 가지로 판정한다.

교사 대시보드는 토큰 검증 없이 전체 GET 6개를 mock으로 통과시켜 진입한다
(TOKEN 값 자체는 검증하지 않음 — 이 테스트의 관심사가 아니라서). 쓰기
action은 전부 fixtures.route_history26_backend가 성공 응답으로 스텁하므로
실제 게임활동_로그 시트에는 어떤 것도 기록되지 않는다.

실행:
    python3 scripts/with_server.py --server "python3 -m http.server 8791" --port 8791 \
        -- python3 tests/webapp-testing/test_curriculum_reorder_mock.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pw_helpers import launch_chromium
from fixtures import CURRICULUM_FIXTURE
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8791"
BACKEND_GLOB = "https://script.google.com/macros/s/*/exec*"

LESSONS_ADMIN_FIXTURE = [
    {"_row": 2, "grade": "2", "order": 1, "isPast": False, "id": "L1", "title": "1차시", "type": "judgment", "urlText": "https://example.com/1", "activitiesCount": 1, "sequential": False, "owner": ""},
    {"_row": 3, "grade": "2", "order": 2, "isPast": False, "id": "L2", "title": "2차시", "type": "judgment", "urlText": "https://example.com/2", "activitiesCount": 1, "sequential": False, "owner": ""},
    {"_row": 4, "grade": "2", "order": 3, "isPast": False, "id": "L3", "title": "3차시", "type": "judgment", "urlText": "https://example.com/3", "activitiesCount": 1, "sequential": False, "owner": ""},
]

reorder_calls = []


def route_dashboard(route, request):
    url = request.url
    if request.method == "GET":
        if "mode=curriculumAdmin" in url:
            body = {"result": "success", "lessons": LESSONS_ADMIN_FIXTURE, "gradeInfo": {}, "badgeNamePool": {}}
        elif "mode=curriculum" in url:
            # v22: initPortal()의 loadCurriculum()이 부팅 시 이미 이 mode를 부른다.
            # 처음엔 여기 grades:{}(빈 값)를 줬는데, 그러면 dashInitFilters()가
            # #selGrade 옵션을 하나도 못 만들고, 뒤이어 dashRefreshActivityOptions()가
            # `CONFIG.CURRICULUM[Number('')]`(=CONFIG.CURRICULUM[0])를 참조해
            # "Cannot read properties of undefined (reading 'lessons')"로 죽었다 —
            # 즉 교사 대시보드는 학생 화면 미리보기와 달리 CONFIG.CURRICULUM이
            # 완전히 비어 있는 상태를 방어하지 않는다(발견 사항 — README 참고).
            # 그래서 대시보드 계열 테스트는 fixtures.CURRICULUM_FIXTURE처럼 학년이
            # 최소 하나 있는 값을 써야 한다.
            body = CURRICULUM_FIXTURE
        elif "mode=checkinPlan" in url:
            body = {"result": "success", "plan": {}}
        elif "mode=" not in url:
            body = {"result": "success", "rows": [], "teacher": "테스트교사"}
        else:
            # feedback / questions / announcementsAdmin / classFeedback 등 — 빈 배열이면 충분
            body = {"result": "success", "rows": []}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        return
    if request.method == "POST":
        payload = json.loads(request.post_data or "{}")
        if payload.get("action") == "reorderLessons":
            reorder_calls.append(payload)
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"result": "success"}))
        return
    route.continue_()


def check(label, cond):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {label}")
    return cond


def get_order(page):
    return page.eval_on_selector_all(
        "#clList .cl-active-list[data-grade='2'] .cl-item",
        "els => els.map(e => e.dataset.row)",
    )


def main():
    failures = 0
    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page()
        page.route(BACKEND_GLOB, route_dashboard)

        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.click("#btnTeacherMode")
        page.fill("#tokenInput", "dummy-token")
        page.click("#btnGate")
        page.wait_for_selector("#dashView", state="visible")

        # 커리큘럼 관리 탭 → "등록된 활동" 서브탭(#clList는 이 서브탭 안에 있음,
        # 기본 활성 서브탭은 "새 활동 추가"라 이것도 눌러야 함)
        page.click(".dash-tab[data-tab='curriculum']")
        page.click(".cl-subtab[data-sub='list']")
        page.wait_for_selector("#clList .cl-item")

        before = get_order(page)
        if not check(f"초기 순서 = ['2','3','4'] (실제: {before})", before == ["2", "3", "4"]):
            failures += 1

        # ── 경로 1: ▲▼ 버튼으로 2번째 항목을 위로 ──
        page.click("#clList .cl-move[data-row='3'][data-dir='up']")
        page.wait_for_timeout(300)
        after_button = get_order(page)
        if not check(f"버튼 이동 후 순서 = ['3','2','4'] (실제: {after_button})", after_button == ["3", "2", "4"]):
            failures += 1
        if not check("버튼 경로가 reorderLessons POST를 보냄", any(c for c in reorder_calls)):
            failures += 1

        reorder_calls.clear()

        # ── 경로 2: 네이티브 HTML5 드래그(dragstart/dragover/dragend)로 3번째를 맨 위로 ──
        # jsdom/Playwright는 실제 OS 드래그 제스처를 못 만들기 때문에, 이 코드가
        # 리스닝하는 DragEvent들을 evaluate로 직접 디스패치한다 — SortableJS였다면
        # 라이브러리 내부 상태까지 흉내내야 했겠지만, 네이티브 드래그라 DOM 이벤트
        # 시뮬레이션만으로 실제 핸들러(dragstart/dragover/dragend) 경로를 그대로 태운다.
        page.evaluate(
            """
            () => {
              const list = document.querySelector("#clList .cl-active-list[data-grade='2']");
              const items = [...list.querySelectorAll('.cl-item')];
              const dragged = items[2]; // 현재 3번째(맨 뒤)
              const target = items[0];  // 맨 앞으로 옮긴다

              const fire = (el, type) => {
                const ev = new Event(type, { bubbles: true, cancelable: true });
                ev.clientY = el.getBoundingClientRect().top + 2;
                el.dispatchEvent(ev);
              };
              fire(dragged, 'dragstart');
              fire(list, 'dragover');
              fire(dragged, 'dragend');
            }
            """
        )
        page.wait_for_timeout(300)
        after_drag = get_order(page)
        # dragover에서 clDragAfterElement가 clientY 기준으로 삽입 위치를 정하는데,
        # list 맨 위 근처로 이벤트를 쐈으니 맨 뒤(row '4')가 맨 앞으로 와야 한다:
        # ['3','2','4'] → ['4','3','2'].
        if not check(f"드래그 후 순서 = ['4','3','2'] (실제: {after_drag})", after_drag == ["4", "3", "2"]):
            failures += 1
        if not check("드래그 경로가 reorderLessons POST를 보냄(dashCommitReorder)", any(c for c in reorder_calls)):
            failures += 1

        browser.close()

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
