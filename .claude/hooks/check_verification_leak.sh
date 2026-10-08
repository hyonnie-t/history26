#!/usr/bin/env bash
# Stop hook — index.html/config.js/checkin_data.js에 커밋 안 된 변경이 있으면
# .claude/rules/student-screen.md "검증 메타데이터 분리 원칙"의 완료 기준
# ("검수", "대조", "미확인", "2차", "확인 전" 문자열이 학생 화면 렌더링
# 문자열에 0건이어야 한다")을 점검한다.
#
# 전체 파일 상태를 그대로 grep하면 안 된다 — 이미 기존 코드에 "미확인"이
# 피드백 읽음/안읽음 배지 텍스트로 정상적으로 쓰이고 있어서(교사 검수 여부와
# 무관), 매번 걸리는 오탐이 나 훅 자체가 무시당하게 된다. 그래서 HEAD(직전
# 커밋) 대비 각 문자열의 등장 횟수가 "늘었는지"만 본다 — 기존 줄을 그대로
# 두면 조용하고, 새로 이런 라벨을 렌더링 문자열에 박아 넣을 때만 걸린다.
# 휴리스틱이라 오탐 가능(학생/교사 화면 구분은 안 함) — 강제 차단 안 하고
# 참고용 경고만 systemMessage로 띄운다.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

FILES="index.html config.js checkin_data.js"

CHANGED=$(git status --porcelain -- $FILES 2>/dev/null)
[ -z "$CHANGED" ] && exit 0

DIFF=$(git diff HEAD -- $FILES 2>/dev/null)
[ -z "$DIFF" ] && exit 0

TARGETS=("검수" "대조" "미확인" "2차" "확인 전")
MSGS=()

for S in "${TARGETS[@]}"; do
  HEAD_COUNT=0
  NEW_COUNT=0
  for f in $FILES; do
    [ -f "$f" ] || continue
    hc=$(git show "HEAD:$f" 2>/dev/null | grep -oF "$S" | wc -l)
    nc=$(grep -oF "$S" "$f" 2>/dev/null | wc -l)
    HEAD_COUNT=$((HEAD_COUNT + hc))
    NEW_COUNT=$((NEW_COUNT + nc))
  done
  if [ "$NEW_COUNT" -gt "$HEAD_COUNT" ]; then
    SAMPLE=$(echo "$DIFF" | grep -E '^\+' | grep -F "$S" | head -2 | sed 's/^+/    /')
    MSGS+=("'${S}' 등장 횟수가 늘어남(${HEAD_COUNT}→${NEW_COUNT}) — 검증 메타데이터가 학생 화면 렌더링 문자열에 새로 들어간 건 아닌지 확인:"$'\n'"${SAMPLE}")
  fi
done

if [ "${#MSGS[@]}" -gt 0 ]; then
  FULL_MSG="⚠️ 검증 메타데이터 유출 점검 (.claude/rules/student-screen.md 기준, 참고용 — 강제 차단 아님):"$'\n'"$(printf -- '- %s\n' "${MSGS[@]}")"
  python3 -c "import json,sys; print(json.dumps({'systemMessage': sys.argv[1]}))" "$FULL_MSG"
fi

exit 0
