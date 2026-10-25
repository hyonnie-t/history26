"""
[v70 갱신] 교사 미리보기는 읽기 전용 샘플이 아니라 99번 "미리보기 학생" 계정으로 진짜 로그인하는
"기록 테스트 모드"가 됐다 — 이 테스트의 쓰기(POST)는 fixtures.py가 전부 스텁이라 실제 시트에 안 닿는다.

[v83 갱신] 테스트 모드는 이제 교사 토큰이 있어야 시작된다(#previewToken이 비면 «교사 토큰을 입력해 주세요.» 토스트만 뜨고
멈춘다). 이 테스트는 더미 토큰을 채우고, 서버로는 안 나간다 — fixtures.py가 action=issueTestSession을 가로채 가짜 세션을 돌려준다.

[우선순위 플로우 #1] 교사 "학생 화면 미리보기" — 학생 포털 전체 렌더 스모크 테스트.

이 저장소는 GAS 백엔드가 별도 레포에 있고, 게임활동_로그 시트를 여러 개별
웹앱과 공유한다(history26 AGENTS.md 참고) — 그래서 실제 학번으로 로그인하거나
체크인을 "제출"하는 흐름을 자동화 테스트에서 그대로 돌리면 실제 시트에 테스트
데이터가 남을 위험이 있다.

PREVIEW_MODE(교사용 "학생 화면 미리보기")는 정확히 이 문제를 이미 해결해둔
기존 기능이다 — SESSION·STUDENT_DATA를 서버 조회 없이 클라이언트에서만 채우고,
체크인 제출(submitCheckin)도 PREVIEW_MODE일 때 실제 fetch를 건너뛴다
(index.html submitCheckin() 참고). 그래서 이 테스트는 "학생이 로그인하면
포털이 정상적으로 그려지는가"를 검증하는 첫 번째 우선순위 플로우로 골랐다.

읽기 전용 mode=curriculum/mode=checkinPlan까지 fixtures.py로 mock한 이유:
실제 호출로 두면 "그날 교사가 등록해둔 커리큘럼 내용"에 결과가 좌우돼(특정
학년에 차시가 없으면 SKIP, 그날 체크인이 지정돼 있으면 포털 대신 체크인
화면이 뜸) 테스트가 deterministic하지 않다. 고정 픽스처로 이 변동성을
없앴다 — 그 대신 "실제 커리큘럼 시트 응답 형태가 fixtures.py의 가정과
어긋나지 않는지"는 이 테스트가 보장해주지 않는다(README의 트레이드오프 참고).

실행:
    python3 scripts/with_server.py --server "python3 -m http.server 8791" --port 8791 \
        -- python3 tests/webapp-testing/test_preview_mode_render.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pw_helpers import launch_chromium
from fixtures import route_history26_backend
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright

BASE_URL = "http://localhost:8791"
BACKEND_GLOB = "https://script.google.com/macros/s/*/exec*"
PREVIEW_DUMMY_TOKEN = "dummy-teacher-token"  # 진짜 교사 토큰이 아니다 — fixtures.py 스텁이 받아서 끝난다


def check(label, cond):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {label}")
    return cond


def run_preview(page, grade_value):
    page.route(BACKEND_GLOB, route_history26_backend)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    page.click("#btnPreviewMode")
    page.wait_for_selector("#previewGate", state="visible")
    page.wait_for_function("document.querySelectorAll('#previewGrade option').length > 0")

    page.select_option("#previewGrade", grade_value)
    page.fill("#previewBan", "1")
    page.fill("#previewToken", PREVIEW_DUMMY_TOKEN)  # v83 — 비면 startPreview가 토스트만 띄우고 끝난다
    page.click("#btnPreviewStart")
    # v70 이후 테스트 모드는 진짜 로그인(mode=student → announcements)을 거친다 — 고정 500ms로는
    # 그 왕복이 끝나기 전에 검사해서 늘 FAIL이 났다. 포털이 뜰 때까지 기다리고, 안 뜨면 아래 check가 FAIL을 찍는다.
    try:
        page.wait_for_selector("#portalView", state="visible", timeout=10000)
    except PlaywrightTimeoutError:
        pass


def main():
    failures = 0
    with sync_playwright() as p:
        browser = launch_chromium(p)

        for grade in ["2", "3"]:
            if True:
                page = browser.new_page()
                label_prefix = f"[{grade}학년/테스트모드]"
                run_preview(page, grade)

                if not check(f"{label_prefix} portalView 표시", page.is_visible("#portalView")):
                    failures += 1
                if not check(f"{label_prefix} previewBanner(미리보기 안내) 표시", page.is_visible("#previewBanner")):
                    failures += 1
                if not check(f"{label_prefix} loginView 숨김", page.is_hidden("#loginView")):
                    failures += 1

                # v83 — issueTestSession 응답의 session이 H26Auth(localStorage h26_auth)에 저장돼야 한다
                auth = page.evaluate("JSON.parse(localStorage.getItem('h26_auth') || 'null')")
                if not check(f"{label_prefix} 테스트 계정 세션 저장됨 (h26_auth sid={auth and auth.get('sid')!r})",
                             bool(auth) and auth.get("sid") == f"{grade}0199"):
                    failures += 1

                title = page.inner_text("#portalTitle")
                if not check(f"{label_prefix} 포털 제목 렌더됨 ({title!r})", bool(title.strip())):
                    failures += 1

                page.close()

        browser.close()

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
