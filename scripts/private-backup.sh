#!/usr/bin/env bash
# 把 private/ 打包存入 1Password（bun run private:backup，需要 op 已登录）
# 先数同名文档再决定 edit 还是 create：直接 edit || create 会在 edit 因登录过期或网络失败时误建同名文档，
# 之后 op document get 匹配到多项，private:restore 就失败了
set -euo pipefail
title=surge-rulekit-private
cd "$(dirname "$0")/.."

n=$(op item list --categories Document --format=json | jq --arg t "$title" '[.[] | select(.title == $t)] | length')

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
tar -czf "$tmp/private.tar.gz" --exclude .DS_Store private

case "$n" in
  0) op document create "$tmp/private.tar.gz" --title "$title" ;;
  1) op document edit "$title" "$tmp/private.tar.gz" ;;
  *) echo "1Password 里有 ${n} 个名为 ${title} 的文档，先删掉多余的再备份" >&2; exit 1 ;;
esac
