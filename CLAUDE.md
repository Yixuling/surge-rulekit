@AGENTS.md

## Claude Code

- `.claude/settings.json` 已入库：PreToolUse（matcher `Edit|Write`）接 `scripts/hooks/block-generated-edits.sh`，拦截对 `dist/`、根目录 `Surge-*.conf` 与 `icons/*.png` 的直接编辑。本地覆盖写 `.claude/settings.local.json`（不入库）
- `.claude/skills/surge` 是指向 Surge 内置技能的软链，由 `bun run hooks` 建立，运行时操作走它
- `.claude/skills/rule-audit` 入库：审计落到 FINAL 的域名、分类、补规则的流程，数据采集由 `bun run audit` 完成
