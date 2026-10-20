#!/usr/bin/env bash
# 깊은 검토 조각의 두 번째 검토자로 Codex를 읽기 전용으로 돌린다(docs/agent-operations.md 'Codex').
# 쓰기: tools/codex-review.sh <가지> <명세 경로> <조각 번호> [결과 파일]
# BASE 환경 변수로 비교 기준을 바꾼다(기본 main). 결과는 JSON 파일 하나, 토큰 수는 마지막 줄에 찍는다.
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "쓰기: $0 <가지> <명세 경로> <조각 번호> [결과 파일]" >&2
  exit 64
fi

branch=$1
spec=$2
slice=$3
base=${BASE:-main}
root=$(git rev-parse --show-toplevel)
out=${4:-$root/.superpowers/codex/$(echo "$branch" | tr '/~^' '---')-$slice.json}
events=${out%.json}.events.jsonl

git rev-parse --verify --quiet "$branch^{commit}" > /dev/null || { echo "가지가 없다: $branch" >&2; exit 65; }
[ -f "$root/$spec" ] || { echo "명세가 없다: $spec" >&2; exit 65; }
mkdir -p "$(dirname "$out")"

before=$(git -C "$root" status --porcelain)

prompt="이 저장소에서 git diff $base...$branch 와 $spec 의 조각 $slice 만 보라.
정확성, 수용 기준, AGENTS.md 위반만 Critical 또는 Important로 내라. 형식, 린트, 타입, 이름 짓기는 보지 마라.
지적마다 파일, 줄, 실패하는 입력이나 상황을 적고, 줄 하나가 아니라 버그의 부류(bug_class)로 묶어라.
.env 파일은 열지 마라. 파일은 고치지 마라. 지적이 없으면 verdict를 pass로, 있으면 fix로 하라."

# -s read-only는 매번 준다. 이 컴퓨터의 Codex 기본 설정이 쓰기를 허용한다.
codex exec -C "$root" -s read-only -m gpt-6.1-sol -c model_reasoning_effort="high" \
  --ephemeral --json --output-schema "$root/tools/codex-review-schema.json" -o "$out" \
  "$prompt" > "$events"

after=$(git -C "$root" status --porcelain)
if [ "$before" != "$after" ]; then
  echo "경고: Codex가 돈 뒤 작업 트리가 바뀌었다" >&2
  exit 70
fi

echo "결과: $out"
grep '"turn.completed"' "$events" | tail -1 || echo "토큰 수를 찾지 못했다: $events"
