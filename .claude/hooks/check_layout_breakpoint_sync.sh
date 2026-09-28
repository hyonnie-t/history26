#!/usr/bin/env bash
# Stop hook — style.css에 커밋 안 된 변경이 있으면 .side-card의 sticky↔static
# 전환 조건과 .side-combined 내부 스크롤 높이 제한 조건이 정확히 서로 반대
# 조건인지 확인한다. CLAUDE.md: "이 두 조건은 정확히 같은(반대) 조건으로
# 맞춰야 한다 — 하나만 바꾸면 어긋난다". 불일치를 찾으면 참고용 경고만
# systemMessage로 띄운다(강제 차단 없음).
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

CHANGED=$(git status --porcelain -- style.css 2>/dev/null)
[ -z "$CHANGED" ] && exit 0
[ -f style.css ] || exit 0

STATIC_LINE=$(grep -n "\.side-card{position:static" style.css | head -1 | cut -d: -f1)
COMBINED_LINE=$(grep -n "\.side-combined{display:flex" style.css | head -1 | cut -d: -f1)
[ -z "$STATIC_LINE" ] || [ -z "$COMBINED_LINE" ] && exit 0

nearest_media_query() {
  # $1 = 기준 라인, 그 라인 바로 위쪽에서 가장 가까운 @media 줄을 찾는다
  awk -v target="$1" 'NR<target && /^@media/{line=$0} NR==target{print line}' style.css
}

STATIC_MQ=$(nearest_media_query "$STATIC_LINE")
COMBINED_MQ=$(nearest_media_query "$COMBINED_LINE")
[ -z "$STATIC_MQ" ] || [ -z "$COMBINED_MQ" ] && exit 0

STATIC_PORTRAIT=$(echo "$STATIC_MQ" | grep -oE "\(max-width:[0-9]+px\) and \(orientation:portrait\)" | grep -oE "[0-9]+")
STATIC_LANDSCAPE=$(echo "$STATIC_MQ" | grep -oE "\(max-width:[0-9]+px\) and \(orientation:landscape\)" | grep -oE "[0-9]+")
COMBINED_PORTRAIT=$(echo "$COMBINED_MQ" | grep -oE "\(orientation:portrait\) and \(min-width:[0-9]+px\)" | grep -oE "[0-9]+")
COMBINED_LANDSCAPE=$(echo "$COMBINED_MQ" | grep -oE "\(orientation:landscape\) and \(min-width:[0-9]+px\)" | grep -oE "[0-9]+")

MSGS=()

if [ -n "$STATIC_PORTRAIT" ] && [ -n "$COMBINED_PORTRAIT" ]; then
  if [ $((STATIC_PORTRAIT + 1)) -ne "$COMBINED_PORTRAIT" ]; then
    MSGS+=("세로모드: .side-card static 조건은 max-width:${STATIC_PORTRAIT}px인데 .side-combined 스크롤 제한 조건은 min-width:${COMBINED_PORTRAIT}px — 서로 정확한 반대 조건(min = max+1)이 아님")
  fi
else
  MSGS+=("세로모드(orientation:portrait) 조건을 두 미디어쿼리 중 한쪽에서 못 찾음 — style.css:${STATIC_LINE} 근처, style.css:${COMBINED_LINE} 근처 직접 확인")
fi

if [ -n "$STATIC_LANDSCAPE" ] && [ -n "$COMBINED_LANDSCAPE" ]; then
  if [ $((STATIC_LANDSCAPE + 1)) -ne "$COMBINED_LANDSCAPE" ]; then
    MSGS+=("가로모드: .side-card static 조건은 max-width:${STATIC_LANDSCAPE}px인데 .side-combined 스크롤 제한 조건은 min-width:${COMBINED_LANDSCAPE}px — 서로 정확한 반대 조건(min = max+1)이 아님")
  fi
else
  MSGS+=("가로모드(orientation:landscape) 조건을 두 미디어쿼리 중 한쪽에서 못 찾음 — style.css:${STATIC_LINE} 근처, style.css:${COMBINED_LINE} 근처 직접 확인")
fi

if [ "${#MSGS[@]}" -gt 0 ]; then
  FULL_MSG="⚠️ .side-card/.side-combined 브레이크포인트 동기화 점검 (CLAUDE.md 기준, 참고용 — 강제 차단 아님):"$'\n'"$(printf -- '- %s\n' "${MSGS[@]}")"
  python3 -c "import json,sys; print(json.dumps({'systemMessage': sys.argv[1]}))" "$FULL_MSG"
fi

exit 0
