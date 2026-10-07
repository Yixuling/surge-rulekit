@AGENTS.md

## Claude Code

- `.claude/settings.json` 已入库：PreToolUse（matcher `Edit|Write`）接 `scripts/hooks/block-generated-edits.sh`，拦截对 `dist/` 与 `icons/*.png` 的直接编辑。本地覆盖写 `.claude/settings.local.json`（不入库）
- `.claude/skills/surge` 是指向 Surge 内置技能的软链，由 `bun run hooks` 建立，运行时操作走它
