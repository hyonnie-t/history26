#!/usr/bin/env bash
# Stop hook — index.html/config.js/checkin_data.js에 커밋 안 된 변경이 있으면
# tests/webapp-testing/의 Playwright 테스트 5개를 자동으로 돌리고 결과를 보여준다.
# 파일을 고칠 때마다(Edit 호출마다)가 아니라 턴이 끝날 때 한 번만 실행해서
# 브라우저를 반복해서 켜는 비용을 줄인다. 변경된 파일이 없으면 조용히 종료한다.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

CHANGED=$(git status --porcelain -- index.html config.js checkin_data.js 2>/dev/null)
[ -z "$CHANGED" ] && exit 0

if ! python3 -c "import playwright" 2>/dev/null; then
  pip install --quiet playwright >/dev/null 2>&1
fi

CHROMIUM_PATH=""
for p in /opt/pw-browsers/chromium-*/chrome-linux/chrome "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux/chrome; do
  if [ -x "$p" ]; then CHROMIUM_PATH="$p"; break; fi
done

PORT=8791
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT
sleep 1

OVERALL=0
SUMMARY_LINES=()
for f in tests/webapp-testing/test_login_validation.py \
         tests/webapp-testing/test_url_helpers.py \
         tests/webapp-testing/test_console_error_smoke.py \
         tests/webapp-testing/test_preview_mode_render.py \
         tests/webapp-testing/test_curriculum_reorder_mock.py; do
  NAME="$(basename "$f")"
  if [ -n "$CHROMIUM_PATH" ]; then
    OUT=$(PWTEST_CHROMIUM_PATH="$CHROMIUM_PATH" python3 "$f" 2>&1)
  else
    OUT=$(python3 "$f" 2>&1)
  fi
  STATUS=$?
  LAST_LINE=$(echo "$OUT" | tail -1)
  if [ $STATUS -ne 0 ]; then
    OVERALL=1
    SUMMARY_LINES+=("❌ $NAME: $LAST_LINE")
  else
    SUMMARY_LINES+=("✅ $NAME")
  fi
done

if [ $OVERALL -eq 0 ]; then
  HEADER="webapp-testing 자동 검증 통과 (index.html/config.js/checkin_data.js 변경 감지)"
else
  HEADER="webapp-testing 자동 검증 실패 — 커밋 전에 확인 필요"
fi

FULL_MSG="$HEADER"$'\n'"$(printf '%s\n' "${SUMMARY_LINES[@]}")"
python3 -c "import json,sys; print(json.dumps({'systemMessage': sys.argv[1]}))" "$FULL_MSG"
