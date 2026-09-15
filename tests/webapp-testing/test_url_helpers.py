"""
[체크리스트 → 테스트 조건 #1] URL/ID 오탈자 회귀 테스트 — 순수 함수 단위 검증판.

핸드오프가 요구한 "원본과 grep/diff 대조" 중, 이 저장소 안에서 완결되는 부분은
`ensureUrlScheme_()`(v48: 스킴 없는 URL이 상대경로로 깨지던 버그의 수정 함수)와
`parseStudentId()`(학번 파싱의 단일 소스) 두 헬퍼다. 둘 다 브라우저 콘솔에서
page.evaluate로 직접 호출해 순수 함수처럼 검증할 수 있다 — DOM 상호작용도,
백엔드 호출도 필요 없다.

⚠️ 이 파일이 못 하는 것 (범위 밖, 열린 질문 문서에 남겨둔 이유):
커리큘럼 시트에 실제로 등록된 활동id가 각 개별 웹앱(crusades, his_judge_goryeo 등)의
CONFIG.GAME_NAME과 정확히 일치하는지는 (1) 커리큘럼 시트 값이 이 레포 밖(Google
Sheets)에 있고 (2) 개별 웹앱 레포들이 현재 세션의 GitHub 접근 범위 밖이라
여기서 자동화할 수 없다. 아래 README의 "다른 레포로 확장할 때" 절 참고.

실행:
    python3 scripts/with_server.py --server "python3 -m http.server 8791" --port 8791 \
        -- python3 tests/webapp-testing/test_url_helpers.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pw_helpers import launch_chromium
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8791"


def check(label, cond):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {label}")
    return cond


def main():
    failures = 0
    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page()
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        # ── ensureUrlScheme_ (v48 회귀 방지: 스킴 없는 값 → 상대경로로 깨지던 버그) ──
        cases = [
            ("www.classcard.net", "https://www.classcard.net"),
            ("classcard.net/abc", "https://classcard.net/abc"),
            ("https://already-has-scheme.com", "https://already-has-scheme.com"),
            ("http://already-http.com", "http://already-http.com"),
            ("", ""),  # 빈 값은 그대로(포트폴리오/클래스카드 없음 처리와 충돌하면 안 됨)
        ]
        for raw, expected in cases:
            actual = page.evaluate("(v) => ensureUrlScheme_(v)", raw)
            if not check(f"ensureUrlScheme_({raw!r}) == {expected!r} (실제: {actual!r})", actual == expected):
                failures += 1

        # ── parseStudentId (학번 파싱 단일 소스) ──
        parsed = page.evaluate("(v) => parseStudentId(v)", "30512")
        if not check(
            "parseStudentId('30512') == {grade:3, ban:5, num:12}",
            parsed == {"grade": 3, "ban": 5, "num": 12},
        ):
            failures += 1

        for bad in ["3051", "305123", "3a512", ""]:
            result = page.evaluate("(v) => parseStudentId(v)", bad)
            if not check(f"parseStudentId({bad!r}) == null", result is None):
                failures += 1

        browser.close()

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
