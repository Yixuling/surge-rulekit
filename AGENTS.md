# AGENTS.md

Surge 个人配置与规则库，用法与机制见 README。本文件只记维护约束与决策。私有上下文（机场实名、实测数据、本机端口）在 `private/NOTES.md`。

## 工作流

- 改配置只改 `Surge.tpl.conf` 或 `private/`，改完依次跑 `bun run render`、`bun test`、`surge-cli -c dist/Surge.conf`（render 不检查 Surge 语法）。`dist/` 是产物，勿手改
- **`bun run deploy` 必须先征得用户同意**：它会改写 iCloud 里正在运行的 `Surge.conf`（Mac 与 iOS 共用）并重载
- deploy 因漂移停下，说明 UI 或 iOS 上改过配置：先把要保留的部分回填进模板，再用 `--force`
- 新增模板变量时，同步在 `private.example/` 里加示例值，否则 CI 失败。改过 `private/` 后执行 `bun run private:backup`（需要 `op` 已登录）
- `rules/`、`icons/` 通过 raw URL 引用：推送后 Surge 按外部资源的 `update-interval`（默认 86400 秒）自动刷新，最多滞后 24 小时；要立即生效执行 `surge-cli external-resource update all`
- `icons/*.png` 由 `scripts/build-icons.sh` 生成，勿手工出图。上游来源固定版本并按 `scripts/icons.lock` 校验 sha256，重建逐字节可复现：`git status` 里出现的图标就是像素真的变了。换来源或升级版本时用 `UPDATE_LOCK=1` 重新记录，再核对图标 diff
- surge-cli 不在 PATH：`/Applications/Surge.app/Contents/Applications/surge-cli`

surge-cli 实测行为（官方文档没写）：`test-policy` 对订阅节点静默无效，测延迟要用 `test-group "<地区 Smart 组名>"`，再读 HTTP API 的 `benchmark_results`；`test-all-policies` 并发高，可能出现假超时，下结论前先低并发复测。

## 脱敏

公开仓库（含提交信息）不得出现：MITM CA、订阅 URL、HTTP API 密钥、隐私直连域名、机场实名。公开层一律用「主力机场 / 备用机场 / 专线」。

`values.env` 只放模板变量，其中 `SECRET_*` 的值会进入提交扫描清单；其余要扫描的片段写在 `private/deny.txt`。太短或太常见、会误报的值不要用 `SECRET_` 前缀，改在 `deny.txt` 加一条带更长上下文的片段。扫描只认得已知的值，提交前仍要人工过目 diff。

## 约束与决策

- **规则顺序**：约束在 `src/order.ts`（`ORDER` 成对约束 + `FIRST_RULE_SET` 置顶规则集 + `CATCH_ALL` 兜底规则集，所有非 DIRECT 的 RULE-SET 都须在兜底之前）。新增有顺序依赖的规则时，在 `ORDER` 里加一条 `[先, 后, 原因]` 并补测试
- **策略引用**：`[Rule]` 用到的策略、策略组成员、`include-other-group` 引用的组都须已定义，render 时由 `src/references.ts` 检查（CI 与 fork 没有 surge-cli，不能只靠 deploy 时的校验）
- **rules/ 格式由测试强制**：`src/tests/rules.test.ts` 检查三行头部、条目写法与尾部换行，并核对模板引用的本仓库 `rules/`、`icons/` 文件都存在
- **策略组选择按组名记忆**：可见组（如 `🚄 Static`、服务组）改名后，引用它的组会丢失当前选择、退回第一项，改名前先告知
- **候选项顺序**：手写候选项总排在 `include-other-group` 引入项之前，重复项自动去重
- **服务组保持对称**：15 个服务组候选项写法一致，不按服务单独调默认出口（试过，因不对称撤回）。`🔰 Guard` 规则集停用中但保留备用
- **always-real-ip**：不可加 `*.apple.com` 这类宽条目，否则需代理的 Apple 域名会变成裸 IP 连接，被 `17.0.0.0/8` 抢成直连
- **extended-matching**：需代理的规则集带这个参数，直连规则集不带
- **不跨机场合并 Smart 组**：把两家机场合进同一个 Smart 组的方案已经实测否决，两家机场质量档位差太多（数据见 NOTES）。除非格局变化，不要重提
- **两层路由**：每家机场每个地区一个 Smart 组（直接用正则筛节点），再由 fallback 做跨机场主备。手选节点走服务组里的 `📡 Subscription`
- **rules/ 格式**：三行头部（名称 / 说明 / 来源）加 `# ===== 分组 =====`；条目写成 `DOMAIN-SUFFIX, example.com`。`AppleIntelligence.list` 以 Apple 官方 101555 文档为准
- **icons/ 规范**：144×144 透明底，keyline 分三档（圆形 136、方块 126、横长字标 142），染色取脚本里的调色板常量

## 代码与风格

- 源码：`src/template.ts` 渲染与产物头部、`src/order.ts` 顺序约束、`src/references.ts` 策略引用检查、`src/normalize.ts` 规范化与漂移判断、`src/private.ts` 私有层与扫描清单、`src/cli/` 命令入口、`src/tests/` 测试
- 模板等号按块（空行分隔）对齐，emoji 与中文按 2 列宽计；行内参数列（如 `icon-url`）也对齐
- `scripts/` 运行在 macOS 自带 bash 3.2：变量后紧跟中文写 `${var}`，不用关联数组
- 提交信息遵循 Conventional Commits，subject 用中文

## 换机器

clone 后依次执行 `bun run private:restore` 和 `bun run hooks`（后者同时启用提交扫描 hook 与 Claude Code 的 Surge 技能软链）。各代理工具自己的配置另见其专属文件（Claude Code 见 CLAUDE.md）。
