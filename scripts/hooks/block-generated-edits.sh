#!/usr/bin/env bash
# Claude Code PreToolUse 守卫：拦截对生成物的直接编辑（下次重新生成时手改会被静默覆盖）
# 接线方式见 CLAUDE.md（Claude Code 专属部分）。退出码 2 = 阻止工具调用并把 stderr 交回给 Claude。
set -uo pipefail

# 缺 jq 时宁可全拦也不放行：静默放行等于守卫失效
command -v jq >/dev/null || { echo "缺少 jq，生成物守卫无法解析工具输入，已拦截。macOS 15 起自带 /usr/bin/jq" >&2; exit 2; }
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
  */Surge-*.conf|Surge-*.conf)
    echo "根目录的 Surge-*.conf 是 bun run render 生成的公开配置，不要直接编辑。改 Surge.tpl.conf 或 src/public.ts 后重新渲染。" >&2
    exit 2 ;;
esac
exit 0
