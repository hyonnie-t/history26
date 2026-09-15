"""
[체크리스트 → 테스트 조건 #2] IIFE + 파일 하단 const 참조로 인한 TDZ 에러 회귀 테스트.

history26 자체(index.html)는 이미 initPortal() IIFE가 파일 최하단(스크립트가
선언부를 전부 지나온 뒤)에서 실행되도록 돼 있어 TDZ에 걸리지 않는다 — 이 파일은
"이미 안전한 상태"를 계속 지키는 회귀 테스트다.

더 중요한 용도는 **재사용 패턴**이다: webapp-builder 스킬로 새 개별 웹앱
(crusades류)을 만들 때 반복됐던 실수가 정확히 이 형태다 — IIFE가 파일 중간에서
바로 실행되면서, 자기보다 아래 줄에서 `const`로 선언될 값을 미리 참조해
"Cannot access 'X' before initialization" ReferenceError를 던진다. 이건 코드
리뷰로 눈으로 잡기보다, 페이지를 실제로 로드해 콘솔 에러를 수집하는 쪽이 훨씬
확실하다 — 그래서 정적 diff가 아니라 브라우저 기반 테스트로 만들었다.

판정 기준: 페이지 로드 + 첫 상호작용(로그인 버튼 클릭 1회) 동안 발생한
console error/pageerror 중 ReferenceError·"before initialization"이 하나라도
있으면 FAIL. (다른 종류의 콘솔 경고는 이 테스트의 관심사가 아니라서 무시한다 —
TDZ 회귀 하나만 좁게 잡는 게 목적.)

실행:
    python3 scripts/with_server.py --server "python3 -m http.server 8791" --port 8791 \
        -- python3 tests/webapp-testing/test_console_error_smoke.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _pw_helpers import launch_chromium
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8791"

TDZ_MARKERS = ("before initialization", "referenceerror")


def check(label, cond):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {label}")
    return cond


def main():
    failures = 0
    errors = []

    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page()

        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on(
            "console",
            lambda msg: errors.append(msg.text) if msg.type == "error" else None,
        )

        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        # 첫 상호작용 — 로그인 버튼을 눌러 이벤트 핸들러 경로도 같이 태운다.
        page.fill("#inputId", "30512")
        page.fill("#inputName", "테스트")
        page.click("#btnLogin")
        page.wait_for_timeout(500)

        browser.close()

    tdz_hits = [e for e in errors if any(m in e.lower() for m in TDZ_MARKERS)]
    if not check(f"TDZ류 콘솔 에러 없음 (전체 콘솔 에러 {len(errors)}건 중 TDZ 의심 {len(tdz_hits)}건)", not tdz_hits):
        failures += 1
        for e in tdz_hits:
            print(f"    -> {e}")

    if errors:
        print(f"\n(참고: TDZ는 아니지만 콘솔 에러 {len(errors)}건 발생 — 이 테스트의 판정 대상은 아님)")
        for e in errors:
            print(f"    - {e}")

    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
