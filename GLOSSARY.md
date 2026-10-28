# Glossary

**规则 id**：`[Rule]` 里一条规则的标识，用于顺序约束与报错。RULE-SET 取 URL 文件名（`AI.list`）或内置名（`LAN`），FINAL 取 `FINAL`，逻辑规则（AND/OR/NOT）取整个表达式，其余取匹配值（`17.0.0.0/8`）。由 `src/conf.ts` 的 `rules()` 推导。
