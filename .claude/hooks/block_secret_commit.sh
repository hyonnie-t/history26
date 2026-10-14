#!/usr/bin/env bash
# PreToolUse(Bash) 훅 — 절대 규칙 5·6을 문장 말고 훅으로 막는다(다른 훅과 달리 경고가 아니라 차단).
# 이 레포는 public이라 한 번 커밋되면 히스토리에 남고, 토큰·키를 교체하는 것 말고는 되돌릴 방법이 없다.
#   1) `git add -f`/`--force`로 .gs 파일을 올리려 할 때
#   2) `git commit`을 할 때 .gs 파일이 스테이징돼 있으면
#   3) `git commit`을 할 때 변경분의 추가된 줄에 새 비밀값 꼴이 보이면
#      - Google API 키(AIza…), 개인키 블록
#      - HEAD에 없던 새 Apps Script 배포 URL·스프레드시트 ID
#        (WEBAPP_URL처럼 이미 공개된 값은 그대로 두면 안 걸린다)
# 정상적으로 새 URL을 넣는 경우(새 웹앱 연결 등)는 효니에게 확인받은 뒤
# 명령 앞에 HISTORY26_ALLOW_SECRET=1 을 붙여 다시 실행한다.
# jq 없는 PC도 있어서 입력 JSON은 문자열 그대로 grep한다.
set -uo pipefail

INPUT=$(cat)
echo "$INPUT" | grep -q 'git' || exit 0

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

block() {
  echo "커밋 차단(.claude/hooks/block_secret_commit.sh): $1" >&2
  echo "AGENTS.md 절대 규칙 5·6 참고. 의도한 것이면 효니에게 확인받고 명령 앞에 HISTORY26_ALLOW_SECRET=1 을 붙여." >&2
  exit 2
}

echo "$INPUT" | grep -q 'HISTORY26_ALLOW_SECRET=1' && exit 0

# 1) git add -f 로 .gs
if echo "$INPUT" | grep -Eq 'git add[^"]*(-f|--force)' && echo "$INPUT" | grep -Eq '\.gs([^a-zA-Z]|$)'; then
  block "git add -f 로 .gs 파일을 올리려 함. 백엔드 코드는 history26_backend 레포에서 고친다."
fi

echo "$INPUT" | grep -q 'git commit' || exit 0

# 2) 스테이징된 .gs
GS=$(git diff --cached --name-only --diff-filter=AM 2>/dev/null | grep -E '\.gs$')
[ -n "$GS" ] && block ".gs 파일이 스테이징돼 있음: $GS"

# 3) 추가된 줄의 비밀값 꼴 — 아직 add 전인 변경(`git add . && git commit`, `commit -a`)도 잡으려고
#    HEAD 대비 전체 변경 + 스테이징된 새 파일을 같이 본다.
ADDED=$( { git diff HEAD 2>/dev/null; git diff --cached 2>/dev/null; } | grep -E '^\+[^+]' )
[ -z "$ADDED" ] && exit 0

if echo "$ADDED" | grep -Eq 'AIza[0-9A-Za-z_-]{35}'; then
  block "Google API 키 꼴(AIza…)이 추가된 줄에 있음."
fi
if echo "$ADDED" | grep -Eq -- '-----BEGIN [A-Z ]*PRIVATE KEY'; then
  block "개인키 블록이 추가된 줄에 있음."
fi

for ID in $(echo "$ADDED" | grep -Eo 'script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}|spreadsheets/d/[A-Za-z0-9_-]{25,}' | sort -u); do
  if ! git grep -qF "$ID" HEAD -- . 2>/dev/null; then
    block "HEAD에 없던 새 배포 URL·시트 ID가 추가됨: ${ID:0:40}…"
  fi
done

exit 0
