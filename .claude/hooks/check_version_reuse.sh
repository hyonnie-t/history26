#!/usr/bin/env bash
# Stop hook — index.html/js/*.js/style.css/config.js/checkin_data.js에 커밋 안 된 변경이
# 있으면 새로 추가된 vNN 주석 번호가 이미 쓰인 번호는 아닌지 grep으로 점검한다.
# AGENTS.md: "새 버전 번호를 붙이기 전에 이미 쓰인 번호인지 먼저 CHANGELOG.md에서
# 확인할 것 — 여러 기능이 같은 번호를 먼저 붙였다가 충돌을 발견해 재번호한 이력이
# 있음". 휴리스틱이라 오탐 가능(같은 기능의 후속 수정이면 정상) — 강제 차단 안 하고
# 참고용 경고만 systemMessage로 띄운다.
set -uo pipefail

# v163 — 경고 출력은 node로 한다. 효니 PC(Windows)의 python3는 스토어 바로가기라 실행되지 않아, 전에는 훅이 «통과»가 아니라 «조용히 못 돎»이었다.
emit_msg() {
  if command -v node >/dev/null 2>&1; then
    node -e 'console.log(JSON.stringify({systemMessage: process.argv[1]}))' "$1"
  else
    python3 -c "import json,sys; print(json.dumps({'systemMessage': sys.argv[1]}))" "$1"
  fi
}

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

FILES="index.html js/*.js style.css config.js checkin_data.js"

HTML_FILES="index.html picker.html groups.html picker-check.html"

CHANGED=$(git status --porcelain -- $FILES $HTML_FILES 2>/dev/null)
[ -z "$CHANGED" ] && exit 0

MSGS=()

# v163 — config.js?v= 번호가 HTML 4개에서 같은지. 한 곳만 올리면 페이지마다 다른 config.js가 캐시에서 나온다(v159 전에는 136과 133으로 어긋나 있었다).
CFG_VS=$(grep -ohE 'config\.js\?v=[0-9]+' $HTML_FILES 2>/dev/null | sort -u)
if [ "$(echo "$CFG_VS" | grep -c .)" -gt 1 ]; then
  MSGS+=("config.js?v= 번호가 HTML마다 다름: $(grep -oHE 'config\.js\?v=[0-9]+' $HTML_FILES 2>/dev/null | tr '\n' ' ')— 네 파일을 같은 번호로 맞출 것.")
fi
for h in $HTML_FILES; do
  [ -f "$h" ] || continue
  grep -q 'config\.js' "$h" && ! grep -qE 'config\.js\?v=[0-9]+' "$h" && MSGS+=("$h 의 config.js에 ?v= 번호가 없음.")
done

DIFF=$(git diff HEAD -- $FILES 2>/dev/null)
NEW_VNUMS=""
if [ -n "$DIFF" ] && [ -f CHANGELOG.md ]; then
  NEW_VNUMS=$(echo "$DIFF" | grep -E '^\+' | grep -oE '\bv[0-9]+\b' | sed 's/^v//' | sort -un)
fi

CL_MAX=$(grep -oE 'v[0-9]+' CHANGELOG.md 2>/dev/null | sed 's/^v//' | sort -n | tail -1)
CL_MAX=${CL_MAX:-0}

for NN in $NEW_VNUMS; do
  PRE_COUNT=0
  for f in $FILES; do
    c=$(git show "HEAD:$f" 2>/dev/null | grep -cE "\bv${NN}\b" || true)
    PRE_COUNT=$((PRE_COUNT + ${c:-0}))
  done
  if [ "$PRE_COUNT" -gt 0 ]; then
    MSGS+=("v${NN}는 이미 코드베이스에 쓰이고 있던 번호(HEAD 기준 ${PRE_COUNT}곳) — 같은 기능 후속 수정이면 무시해도 되지만, 새 기능이면 다른 번호 쓸 것. CHANGELOG.md에서 v${NN} 확인.")
    continue
  fi

  CL_COUNT=$(grep -cE "\bv${NN}\b" CHANGELOG.md || true)
  if [ "${CL_COUNT:-0}" -eq 0 ] && [ "$NN" -lt "$CL_MAX" ]; then
    MSGS+=("v${NN}는 CHANGELOG.md 최신 기록(v${CL_MAX})보다 작은 번호인데 CHANGELOG.md엔 없음 — 오래된 번호를 실수로 재사용한 건 아닌지 확인.")
  fi
done

if [ "${#MSGS[@]}" -gt 0 ]; then
  FULL_MSG="⚠️ 버전 번호 점검 (AGENTS.md 기준, 참고용 — 강제 차단 아님):"$'\n'"$(printf -- '- %s\n' "${MSGS[@]}")"
  emit_msg "$FULL_MSG"
fi

exit 0
