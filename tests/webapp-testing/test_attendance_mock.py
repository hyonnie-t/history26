"""
[v74] 출석 도장 + 오늘의 기분 — 백엔드(v51)를 가짜로 대신해 학생 카드·교사 탭 흐름을 확인한다.
상태가 있는 가짜 서버: attend POST가 오면 일수가 오르고, 칭호 문턱(5일)을 넘기면 badges에 att_lv1이 실린다.

실행:
    python3 scripts/with_server.py ... 가 없으면: python3 -m http.server 8791 & 뒤
    python3 tests/webapp-testing/test_attendance_mock.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pw_helpers import launch_chromium
from fixtures import route_history26_backend, CURRICULUM_FIXTURE
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8791"
BACKEND_GLOB = "https://script.google.com/macros/s/*/exec*"
OUT = sys.argv[1] if len(sys.argv) > 1 else None

state = {"days": 4, "done": False, "mood": "", "posts": []}
NEXT = {"name": "꾸준한 붓", "emoji": "🖋️", "need": 10, "min": 15}


def attendance():
    return {"days": state["days"], "todayDone": state["done"], "mood": state["mood"], "last": "", "next": NEXT}


def badges():
    return [{"id": "att_lv1", "name": "Lv1 첫 도장", "emoji": "🔖", "category": "behavior", "type": "once", "earned": True, "count": state["days"]}] if state["days"] >= 5 else []


def handler(route, request):
    url = request.url
    if request.method == "GET" and "mode=student" in url:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "result": "success", "activities": [], "presentationGrants": [], "badges": badges(),
            "messages": [], "questions": [], "feedback": [], "classFeedback": [], "attendance": attendance()}))
        return
    if request.method == "GET" and "mode=attendanceAdmin" in url:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "result": "success", "today": "2026-10-06",
            "tiers": [{"lv": 1, "name": "첫 도장", "min": 5}, {"lv": 2, "name": "꾸준한 붓", "min": 15}],
            "rows": [{"studentId": "20101", "studentName": "김", "days": 16, "last": "2026-10-06", "todayDone": True, "tier": 2, "tierName": "꾸준한 붓", "mood": "green"},
                     {"studentId": "30501", "studentName": "이", "days": 3, "last": "2026-10-02", "todayDone": False, "tier": 0, "tierName": "", "mood": ""}]}))
        return
    if request.method == "POST":
        body = json.loads(request.post_data or "{}")
        if body.get("action") == "attend":
            state["posts"].append(body)
            if not state["done"]:
                state["days"] += 1
                state["done"] = True
            if body.get("mood"):
                state["mood"] = body["mood"]
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"result": "success", "marked": True, "days": state["days"], "mood": state["mood"], "next": NEXT}))
            return
    route_history26_backend(route, request)


def check(label, cond):
    print(f"[{'PASS' if cond else 'FAIL'}] {label}")
    return cond


def main():
    fails = 0
    errors = []
    with sync_playwright() as p:
        browser = launch_chromium(p)
        for w, h in ((390, 800), (820, 1000), (1280, 900)):
            state.update(days=4, done=False, mood="", posts=[])
            page = browser.new_page(viewport={"width": w, "height": h})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route(BACKEND_GLOB, handler)
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.fill("#inputId", "20101")
            page.fill("#inputName", "김")
            page.click("#btnLogin")
            page.wait_for_selector("#portalView", state="visible")
            page.wait_for_selector("#attCard:not([hidden])")
            if w == 390:
                fails += not check("출석 전: 누적 4일 + 도장 버튼", "4" in page.inner_text("#attCard") and page.is_visible("#attBtn"))
                fails += not check("출석 전엔 칭호 없음", "첫 도장" not in page.inner_text("#badgeGroups"))
                page.click('.att-mood[data-mood="yellow"]')
                fails += not check("기분 칩 선택 표시", page.get_attribute('.att-mood[data-mood="yellow"]', "aria-pressed") == "true")
                page.click("#attBtn")
                page.wait_for_function("document.querySelector('#attCard').innerText.includes('오늘 출석했어요')")
                fails += not check("요청 본문: action=attend, mood=yellow, 학번·이름", state["posts"] and state["posts"][0]["mood"] == "yellow" and state["posts"][0]["studentId"] == "20101")
                fails += not check("5일째: 칭호첩에 Lv1 첫 도장", "첫 도장" in page.inner_text("#badgeGroups"))
                fails += not check("출석·기분 후 기분 칩/버튼 사라짐", not page.is_visible("#attBtn") and page.locator(".att-mood").count() == 0)
            if OUT:
                page.screenshot(path=f"{OUT}/att_{w}.png", full_page=False)
            page.close()
        # 교사 탭
        page = browser.new_page(viewport={"width": 1000, "height": 800})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route(BACKEND_GLOB, handler)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.evaluate("document.getElementById('dashView').style.display='block'; TOKEN='x'; switchDashTab('attend')")
        page.wait_for_selector("#attBody tr td b")
        txt = page.inner_text("#attBody")
        fails += not check("교사 탭: 누적순 정렬(김 16일이 먼저)", txt.index("김") < txt.index("이"))
        fails += not check("교사 탭: 기분·칭호 표시", "편안해요" in txt and "꾸준한 붓" in txt)
        page.select_option("#attTier", "2")
        fails += not check("칭호 필터 Lv2 → 1명", page.locator("#attBody tr").count() == 1)
        if OUT:
            page.screenshot(path=f"{OUT}/att_teacher.png")
        browser.close()
    fails += not check("콘솔 오류 없음 " + str(errors[:2]), not errors)
    sys.exit(1 if fails else 0)


main()
