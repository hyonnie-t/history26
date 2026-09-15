"""
[체크리스트 → 테스트 조건 #1의 일부] 학번/이름 형식 검증 (parseStudentId 회귀 테스트)

로그인 폼은 네트워크 호출 전에 클라이언트에서 먼저 형식을 검증한다
(index.html의 login(): parseStudentId(sid)가 null이면 즉시 에러 문구를 띄우고
fetch를 아예 안 보냄). 그래서 실제 GAS 백엔드나 실제 학번 없이도 결정적으로
테스트할 수 있다 — 이 파일은 백엔드에 어떤 요청도 보내지 않는다.

실행:
    python3 scripts/with_server.py --server "python3 -m http.server 8791" --port 8791 \
        -- python3 tests/webapp-testing/test_login_validation.py
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

        # 케이스 1: 학번 4자리(짧음) — "학번은 숫자 5자리예요" 에러, 로그인 화면 유지
        page.fill("#inputId", "3051")
        page.fill("#inputName", "테스트")
        page.click("#btnLogin")
        page.wait_for_timeout(300)
        err = page.inner_text("#loginError")
        if not check("4자리 학번 → 5자리 에러 문구", "5자리" in err):
            failures += 1
        if not check("형식 오류 시 portalView로 안 넘어감", page.is_hidden("#portalView")):
            failures += 1

        # 케이스 2: 학번에 문자 포함
        page.fill("#inputId", "3a512")
        page.fill("#inputName", "테스트")
        page.click("#btnLogin")
        page.wait_for_timeout(300)
        err = page.inner_text("#loginError")
        if not check("문자 섞인 학번 → 5자리 에러 문구", "5자리" in err):
            failures += 1

        # 케이스 3: 이름 빈 값
        page.fill("#inputId", "30512")
        page.fill("#inputName", "")
        page.click("#btnLogin")
        page.wait_for_timeout(300)
        err = page.inner_text("#loginError")
        if not check("이름 미입력 → 이름 입력 요청 에러", "이름" in err):
            failures += 1

        browser.close()

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
