"""
webapp-testing 스킬용 공용 헬퍼.

이 저장소 전용 관례:
- 이 레포는 순수 정적 파일(index.html+config.js+checkin_data.js)이라 빌드가 없다.
  `scripts/with_server.py --server "python3 -m http.server <port>" --port <port> -- python3 tests/...`
  형태로 실행한다.
- 브라우저 실행 경로가 설치 환경마다 다를 수 있어(예: playwright 패키지 버전과
  사전 설치된 브라우저 버전이 어긋나는 컨테이너) PWTEST_CHROMIUM_PATH 환경변수로
  override할 수 있게 해둔다. 비어 있으면 playwright 기본 탐색을 그대로 쓴다.
"""
import os

from playwright.sync_api import sync_playwright


def launch_chromium(playwright, headless=True):
    exe = os.environ.get("PWTEST_CHROMIUM_PATH")
    kwargs = {"headless": headless}
    if exe:
        kwargs["executable_path"] = exe
    return playwright.chromium.launch(**kwargs)
