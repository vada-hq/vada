#!/usr/bin/env bash
# 끝난 작업이 남긴 작업 폴더(git worktree)와 가지를 지운다. 세션을 열 때 훅이 돌린다(.claude/settings.json).
#
# 끝난 작업: 다음 둘 중 하나다.
#   - 커밋이 모두 origin/main에 같은 내용으로 들어 있다(git cherry. 그냥 다시 올린 가지도 알아본다).
#   - 닫힌 기능의 작업 가지(work/<기능>-*)에 든 커밋이다. 닫힌 기능은 origin/main의 docs/features/<기능>-*.md에서
#     조각 제목(### N. 이름 [x])이 모두 [x]인 기능이다. 충돌을 풀며 다시 올려 내용 비교로는 증명이 안 되는 가지를 위한 것이다.
# 작업 폴더는 여기에 더해 내용이 바뀐 파일과 새 파일이 없고(줄바꿈 표시만 다른 것은 바뀐 것으로 보지 않는다), 잠겨 있지 않고(Claude Code가 돌고 있는 에이전트의 폴더를 잠근다),
# 한 시간 넘게 손대지 않았을 때만 지운다. 하나라도 아니면 남긴다.
#
# --remote: origin을 먼저 받아 오고, 끝난 원격 가지도 지운다(main과 dependabot/* 빼고).
# DRY_RUN=1: 지우지 않고 지울 것만 찍는다.
set -uo pipefail

IDLE_MINUTES=${IDLE_MINUTES:-60}
base=origin/main
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

dry=${DRY_RUN:-0}
run() { if [ "$dry" = 1 ]; then echo "지울 것: $*"; else "$@" 2>/dev/null; fi; }

remote=false
[ "${1:-}" = "--remote" ] && remote=true
$remote && { git fetch --quiet --prune origin 2>/dev/null || remote=false; }

# 닫힌 기능의 작업 가지 패턴(refs/heads/work/r01-* 와 refs/remotes/origin/work/r01-*)
closed_refs=()
while IFS= read -r spec; do
  slices=$(git show "$base:$spec" 2>/dev/null | grep -E '^### [0-9]+\. .*\[[ x]\]$') || continue
  grep -q '\[ \]$' <<<"$slices" && continue
  id=$(basename "$spec" .md)
  id=${id%%-*}
  closed_refs+=("refs/heads/work/$id-*" "refs/remotes/origin/work/$id-*")
done < <(git ls-tree --name-only "$base" docs/features/ 2>/dev/null)

finished() {
  local out
  if out=$(git cherry "$base" "$1" 2>/dev/null) && ! grep -q '^+' <<<"$out"; then
    return 0
  fi
  [ ${#closed_refs[@]} -gt 0 ] && [ -n "$(git for-each-ref --count=1 --contains "$1" "${closed_refs[@]}")" ]
}

# 폴더를 지운다. 연결(Windows junction, symlink)은 따라가지 않고 연결만 지운다.
# Windows의 git worktree remove는 node_modules 안의 연결에서 멈춰 폴더를 남기기도 해서 이것으로 마저 지운다.
remove_dir() {
  [ -d "$1" ] || return 0
  case ${OSTYPE:-} in
    # Git Bash는 /s, /q 같은 인자를 Windows 경로(S:/, Q:/)로 바꿔 넘긴다. 바꾸지 않게 막는다.
    msys* | cygwin*) MSYS2_ARG_CONV_EXCL='*' cmd /c rmdir /s /q "$(cygpath -w "$1")" >/dev/null 2>&1 ;;
    *) rm -rf -- "$1" ;;
  esac
  [ ! -d "$1" ]
}

registered() { git worktree list --porcelain | grep -qxF "worktree $1"; }

removed_trees=0
removed_branches=0
removed_remote=0
checked_out=" main "

remove_tree() {
  local path=$1 head=$2 locked=$3
  [ "$path" = "$root" ] && return
  [ -d "$path" ] || return
  [ "$locked" = true ] && return
  git -C "$path" diff --quiet HEAD 2>/dev/null || return
  [ -z "$(git -C "$path" ls-files --others --exclude-standard 2>/dev/null)" ] || return
  local index
  index="$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null)/index"
  [ -n "$(find "$index" -mmin "-$IDLE_MINUTES" 2>/dev/null)" ] && return
  finished "$head" || return
  # 위에서 내용이 HEAD와 같고 새 파일이 없음을 확인했다. --force는 줄바꿈 표시만 다른 파일 때문에 거절되지 않게 한다.
  run git worktree remove --force "$path"
  [ "$dry" = 1 ] && return
  registered "$path" && return
  remove_dir "$path" && removed_trees=$((removed_trees + 1))
}

path="" head="" branch="" locked=false
while IFS= read -r line; do
  case $line in
    "worktree "*) path=${line#worktree } head="" branch="" locked=false ;;
    "HEAD "*) head=${line#HEAD } ;;
    "branch refs/heads/"*) branch=${line#branch refs/heads/} ;;
    locked*) locked=true ;;
    "")
      [ -n "$path" ] || continue
      remove_tree "$path" "$head" "$locked"
      [ -d "$path" ] && [ -n "$branch" ] && checked_out+="$branch "
      path=""
      ;;
  esac
done < <(git worktree list --porcelain; echo)
[ "$dry" = 1 ] || git worktree prune

# 지우다 멈춰 git이 더는 모르는 폴더(.git 파일이 없는 .claude/worktrees/*)를 치운다. 막 만들어지는 폴더는 건드리지 않는다.
for dir in "$root"/.claude/worktrees/*/; do
  dir=${dir%/}
  [ -d "$dir" ] && [ ! -e "$dir/.git" ] || continue
  registered "$dir" && continue
  [ -n "$(find "$dir" -maxdepth 0 -mmin "-$IDLE_MINUTES" 2>/dev/null)" ] && continue
  run remove_dir "$dir" && removed_trees=$((removed_trees + 1))
done

# 원격 가지를 먼저 본다. 닫힌 기능인지는 로컬 가지도 보고 판단하므로, 로컬 가지를 지우기 전에 해야 한다.
remote_done=()
if $remote; then
  while IFS= read -r ref; do
    case $ref in origin | origin/main | origin/HEAD | origin/dependabot/*) continue ;; esac
    finished "refs/remotes/$ref" && remote_done+=("${ref#origin/}")
  done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)
fi

branches_done=()
while IFS= read -r branch; do
  case $checked_out in *" $branch "*) continue ;; esac
  finished "refs/heads/$branch" && branches_done+=("$branch")
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

for branch in "${branches_done[@]}"; do
  run git branch -D --quiet "$branch" && removed_branches=$((removed_branches + 1))
done
for branch in "${remote_done[@]}"; do
  run git push --quiet origin --delete "$branch" && removed_remote=$((removed_remote + 1))
done

total=$((removed_trees + removed_branches + removed_remote))
[ "$total" -gt 0 ] && echo "정리: 끝난 작업의 작업 폴더 ${removed_trees}개, 가지 ${removed_branches}개, 원격 가지 ${removed_remote}개를 지웠다"
exit 0
