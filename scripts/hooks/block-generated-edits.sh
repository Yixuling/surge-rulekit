#!/usr/bin/env bash
# Claude Code PreToolUse 守卫：拦截对生成物的直接编辑（下次重新生成时手改会被静默覆盖）
# 接线方式见 CLAUDE.md。退出码 2 = 阻止工具调用并把 stderr 交回给 Claude。
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty')
[ -n "$path" ] || exit 0

case "$path" in
  */icons/*.png|icons/*.png)
    name=$(basename "$path" .png)
    echo "icons/ 下的 PNG 由 scripts/build-icons.sh 生成，不要直接编辑。改配方后跑：bun run icons $name" >&2
    exit 2 ;;
  */dist/*|dist/*)
    echo "dist/ 是 bun run render 的产物，不要直接编辑。改 Surge.tpl.conf 或 private/ 后重新渲染。" >&2
    exit 2 ;;
esac
exit 0
