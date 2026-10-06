@AGENTS.md

## Claude Code

换机器后重建 gitignore 掉的 `.claude/`：

- 建软链：`ln -s /Applications/Surge.app/Contents/Resources/Skills/surge .claude/skills/surge`（Surge 内置技能，运行时操作走它）
- 在 `.claude/settings.json` 的 PreToolUse（matcher `Edit|Write`）里接上 `bash "$CLAUDE_PROJECT_DIR/scripts/hooks/block-generated-edits.sh"`，拦截对 `dist/` 与 `icons/*.png` 的直接编辑
