<div align="center">

# Surge Rulekit

[![CI](https://img.shields.io/github/actions/workflow/status/Yixuling/surge-rulekit/ci.yml?style=flat-square&label=CI)](https://github.com/Yixuling/surge-rulekit/actions)
[![Surge](https://img.shields.io/badge/Surge-macOS%20%7C%20iOS-0a84ff?style=flat-square)](https://nssurge.com)
[![Bun](https://img.shields.io/badge/Bun-runtime-f9f1e1?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<img src="icons/Apple.png" width="36" alt="Apple"> <img src="icons/AI.png" width="36" alt="AI"> <img src="icons/ArcDia.png" width="36" alt="Arc & Dia"> <img src="icons/DeepL.png" width="36" alt="DeepL"> <img src="icons/Disney.png" width="36" alt="Disney+"> <img src="icons/GitHub.png" width="36" alt="GitHub"> <img src="icons/Google.png" width="36" alt="Google"> <img src="icons/JetBrains.png" width="36" alt="JetBrains"> <img src="icons/Netflix.png" width="36" alt="Netflix"> <img src="icons/PayPal.png" width="36" alt="PayPal"> <img src="icons/Twitter.png" width="36" alt="X"> <img src="icons/Telegram.png" width="36" alt="Telegram"> <img src="icons/Speedtest.png" width="36" alt="Speedtest"> <img src="icons/WeChat.png" width="36" alt="WeChat"> <img src="icons/YouTube.png" width="36" alt="YouTube">

[下载现成配置](#下载现成配置) • [直接引用规则集与图标](#直接引用规则集与图标) • [概览](#概览) • [快速开始](#快速开始) • [模板与私有层](#模板与私有层) • [路由架构](#路由架构) • [规则集](#规则集) • [图标](#图标)

</div>

[Surge](https://nssurge.com) 的规则集与个人配置框架。`rules/` 补的是社区规则没覆盖的部分（AI 服务、Apple Intelligence、追踪拦截等），一行 `RULE-SET` 就能引用到自己的配置里，策略组图标也一样，不必用这套配置框架。配置部分是一份不含敏感值的公开模板，订阅地址、证书、机场名称等私有值留在本地，渲染时才合成完整配置。

## 下载现成配置

不想装工具、改模板，可以直接用生成好的完整配置，填上自己的订阅链接就能用：

| 配置 | 适合 |
|---|---|
| [`Surge-Single.conf`](Surge-Single.conf) | 只有一家机场 |
| [`Surge-Dual.conf`](Surge-Dual.conf) | 两家机场，各有一条订阅链接 |
| [`Surge-Merged.conf`](Surge-Merged.conf) | 两家机场的订阅已合并成一条（比如用 [Sub-Store](https://github.com/sub-store-org/Sub-Store) 合并），按节点名里的关键词区分两家 |

1. 在 Surge 里选「从 URL 安装配置」，粘贴对应文件的 raw 链接，比如 `https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/Surge-Single.conf`
2. 编辑这份配置的文本，把标着 👇 的几行换成自己的订阅链接；合并订阅版还要填两家机场的节点关键词
3. 双机场版里 `机场A` 是主力，`机场B` 是备用：各地区优先用 `机场A`，它不通时自动切到 `机场B`

> [!NOTE]
> 装好的配置是一份本地副本，不会跟着仓库更新；规则集和图标通过链接引用，会自动更新。

## 直接引用规则集与图标

把需要的几行加进自己配置的 `[Rule]` 段，策略名换成自己的：

```ini
# 追踪拦截，放在所有规则集之前
RULE-SET, https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/rules/Guard.list, REJECT
# AI 服务（含 IP 段），放在 Google、Twitter 规则之前
RULE-SET, https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/rules/AI.list, AI, no-resolve, extended-matching
# Apple Intelligence，放在 17.0.0.0/8 直连之前
RULE-SET, https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/rules/AppleIntelligence.list, Proxy, extended-matching
# 社区 Global 列表未收录的常用境外服务
RULE-SET, https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/rules/GlobalExtra.list, Proxy, extended-matching
```

其余规则集和用途见[规则集](#规则集)。

策略组图标在组定义末尾加 `icon-url`，文件名就是顶部那排图标的名字，全部在 [`icons/`](icons/)：

```ini
Netflix = select, Proxy, DIRECT, icon-url = https://raw.githubusercontent.com/Yixuling/surge-rulekit/refs/heads/main/icons/Netflix.png
```

> [!TIP]
> 规则集更新后，Surge 按外部资源的更新间隔（默认 24 小时）自动拉取。想马上生效，在 Surge 的「外部资源」里点「更新全部外部资源」。

## 概览

```mermaid
flowchart LR
    T["Surge.tpl.conf<br>公开模板"] --> R{{"bun run render<br>替换占位符 + 检查规则顺序"}}
    P["private/<br>私有值（不入库）"] --> R
    R --> D["dist/Surge.conf"]
    D --> Y{{"bun run deploy<br>校验 + 漂移检查"}}
    Y --> I["iCloud 里的 Surge.conf<br>Mac 与 iOS 共用"]
```

模板是 Surge 原生语法加占位符，读起来就是一份完整配置；私有层只有几个变量和片段。改配置只改模板或私有层，渲染与部署由脚本完成。

## 特性

- **模板与私有值分离**：公开模板可以直接给别人参考，敏感值永远不进仓库
- **规则顺序与引用检查**：`[Rule]` 段的先后依赖写成约束表，顺序被打乱时渲染直接报错；引用了未定义的策略或策略组同样报错，不必等 Surge 加载时才发现
- **部署防覆盖**：部署前先校验语法，再比较 iCloud 里的配置有没有在 UI 或 iOS 上被改过，改过就停下并列出语义差异
- **提交前防泄露**：pre-commit 与 commit-msg 两个 hook 用私有层的值扫描暂存内容和提交信息，命中即拒绝
- **自维护规则集**：补[社区规则](#上游规则)没覆盖或更新滞后的域名，Apple Intelligence 那份与官方文档逐条对应
- **可复现的图标**：15 个策略组图标由脚本生成，上游素材固定版本并校验 sha256，重建逐字节一致

## 快速开始

需要：

- [Surge for Mac](https://nssurge.com)（部署与语法校验用到其自带的 `surge-cli`）
- [Bun](https://bun.sh)
- 可选：`imagemagick` 与 `librsvg`（重建图标）、[1Password CLI](https://developer.1password.com/docs/cli/)（备份私有层）

先 fork 本仓库，再 clone 自己的 fork：

```bash
git clone https://github.com/<你的用户名>/surge-rulekit.git
cd surge-rulekit
cp -R private.example private   # 私有层，不入库
bun run hooks                   # 启用提交前扫描
```

### 改成自己的配置

模板按「一份订阅里有两家机场的节点」来写：`📡 Subscription` 拉取整份订阅，再按节点名里的关键词分出主力机场和备用机场。两家机场的订阅可以先用 Sub-Store 之类的工具合并成一份。

照着 `private.example/values.env` 里的注释填 `private/values.env`，至少要改这几项：

| 变量 | 填什么 |
|---|---|
| `SECRET_SUB_URL` | 订阅地址 |
| `SECRET_PRIMARY_AIRPORT`、`SECRET_BACKUP_AIRPORT` | 节点名里能区分两家机场的关键词，同时用作这两个策略组的组名 |
| `SECRET_STATIC_KEYWORD` | 专线节点名里的关键词。这些节点不进地区组，单独放进 `🚄 Static` |
| `HTTP_API_KEY` | 本机 HTTP API 的密钥，换成随机串 |
| `SECRET_CA_PASSPHRASE`、`SECRET_CA_P12` | MITM 证书，在 Surge 的 MITM 设置里生成后填入 |

其余私有文件的作用见[模板与私有层](#模板与私有层)。

模板 `Surge.tpl.conf` 按需改：

- **地区**：每个地区的 Smart 组按节点名正则筛选（`policy-regex-filter`），机场的节点命名不同就改正则。增删地区时，Smart 组、fallback 组和 `📍 Regions` 要一起改
- **只有一家机场**：删掉备用机场的子集组和 Smart 组，fallback 组里只留主力机场，再删掉 `values.env` 里备用机场的两个变量（没用到的变量会让 `render` 报错）
- **服务组与规则**：新增服务组后，在 `[Rule]` 加对应的 `RULE-SET`。和别的规则有先后依赖的，在 `src/order.ts` 登记，`render` 会检查
- **自己维护规则或图标**：把模板里的 `Yixuling/surge-rulekit` 换成自己 fork 的路径，否则 Surge 拉的仍是本仓库的文件

改完渲染，确认 `dist/Surge.conf` 无误后再部署：

```bash
bun run render   # 生成 dist/Surge.conf
bun run deploy   # 校验、检查漂移后写入 iCloud 并重载
```

> [!WARNING]
> `deploy` 会覆盖 iCloud 里正在使用的 `Surge.conf` 并让 Surge 重新加载，Mac 与 iOS 同时生效。不用 iCloud 时，用 `SURGE_PROFILE=<路径> bun run deploy` 指定配置文件。

### 命令

| 命令 | 作用 |
|---|---|
| `bun run render [目录]` | 用私有层（默认 `private/`）渲染模板到 `dist/Surge.conf`，同时在根目录生成公开配置 `Surge-*.conf`，并检查规则顺序 |
| `bun run deploy [--force]` | 渲染 → `surge-cli` 校验 → 漂移检查 → 写入 iCloud → 重载 |
| `bun run audit [--speed 主机...]` | 只读列出本月落到 FINAL 的域名，供补规则参考；`--speed` 对比指定主机直连与走代理的首字节耗时 |
| `bun test` | 单元测试（含用 `private.example/` 完整渲染一遍模板） |
| `bun run icons [名称...]` | 重建全部或指定图标，并输出明暗双主题预览图 |
| `bun run hooks` | 启用 `scripts/hooks/` 里的提交扫描，并建立 Claude Code 的 Surge 技能软链 |
| `bun run private:backup` / `private:restore` | 把 `private/` 打包存入 / 取回 1Password |

## 模板与私有层

模板里有两种占位符：

- `{{变量名}}`：替换为 `private/values.env` 中的同名变量
- `{{> 片段名}}`：独占一行，内联 `private/snippets/片段名.conf` 的多行内容

模板开头第一段注释只描述模板本身，渲染时会换成「由模板生成，勿直接编辑」的说明。

| 私有层文件 | 内容 |
|---|---|
| `values.env` | 模板变量，`KEY=value`。`SECRET_` 开头的值会进入提交扫描清单 |
| `snippets/*.conf` | 多行私有片段，如本地直连规则；其中出现的域名会进入扫描清单 |
| `deny.txt` | 扫描清单的补充：被截断、换写法或本身太短的敏感片段，每行一条 |
| `state/` | `deploy` 记录的上次部署内容，用于漂移检查 |

> [!IMPORTANT]
> 未定义的变量、缺失的片段、没用到的变量或片段、写错格式的占位符，都会让 `render` 直接失败，不会产出半成品配置。新增变量时记得同步在 `private.example/` 里加示例值，否则 CI 会失败。

没有私有值可扫描的 fork，用 `git config surge-rulekit.allow-no-private true` 放行提交扫描。

## 路由架构

```mermaid
flowchart LR
    S["📡 Subscription<br>订阅源"] --> A[主力机场] & B[备用机场]
    A --> L1A["L1 地区 Smart 组<br>正则筛选 + 智能选路"]
    B --> L1B["L1 地区 Smart 组<br>正则筛选 + 智能选路"]
    L1A & L1B --> L2["L2 fallback<br>主力优先，故障切备用"]
    L2 --> G["服务分流组 × 15"]
```

每家机场的每个地区（香港、新加坡、美国、日本、台湾）各有一个 Smart 组，直接按节点名正则筛选并智能选路；同地区两家机场再由 fallback 做主备切换。两家机场没有混进同一个 Smart 组：实测两家的延迟档位差得多，混编后选路反而不稳。

15 个服务分流组（Apple、AI、Google、Netflix 等）各自独立选择出口：代理、直连、专线、任一地区或具体节点。

> [!NOTE]
> `[Rule]` 段有顺序依赖，比如 Apple 需代理的规则须在 `17.0.0.0/8` 直连之前、AI 须在 Google 之前、Guard 拦截与微信须是最前面的两个规则集。约束与原因都写在 [`src/order.ts`](src/order.ts)，调整规则顺序前先看那里。

## 规则集

服务分流的主体直接引用社区规则，本仓库只维护社区没覆盖、更新滞后或不适合直接用的部分。

### 上游规则

| 来源 | 用到的规则 |
|---|---|
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 微信、App Store、iCloud、Apple 媒体与开发者、TestFlight、YouTube、Google、GitHub、Twitter、Telegram、Netflix、Disney+、PayPal、Speedtest，以及兜底的 Global 与 China 两份大列表 |
| [VirgilClyne/GetSomeFries](https://github.com/VirgilClyne/GetSomeFries) | `ASN.China`，国内 IP 直连 |

上游规则都在模板里通过 raw URL 引用、跟随上游更新，仓库不存副本。感谢 blackmatrix7 长期维护这套规则。

### 自维护规则

| 规则集 | 用途 |
|---|---|
| [`AI.list`](rules/AI.list) | OpenAI / Anthropic / Gemini 等 AI 服务（含登录验证域名） |
| [`AppleIntelligence.list`](rules/AppleIntelligence.list) | Apple Intelligence 所需代理域名，与 Apple 官方 [101555](https://support.apple.com/101555) 文档逐条对应 |
| [`AppleExtra.list`](rules/AppleExtra.list) | 社区 Apple 规则未覆盖的账户 API 与媒体边缘域 |
| [`AppleDirect.list`](rules/AppleDirect.list) | App Store 购买 API 与安装包 CDN（直连） |
| [`ArcDia.list`](rules/ArcDia.list) | Arc / Dia 浏览器 |
| [`DeepL.list`](rules/DeepL.list) | DeepL 翻译 |
| [`JetBrains.list`](rules/JetBrains.list) | JetBrains 全家（IDE、Toolbox、插件市场、AI、团队工具），补全上游列表后替代它 |
| [`GlobalExtra.list`](rules/GlobalExtra.list) | Global 列表未收录、实测落到兜底规则的常用境外服务 |
| [`Guard.list`](rules/Guard.list) | 本机实测的纯追踪域名（拦截）；带跳转、风控、表单功能的追踪不收，拦了会坏功能 |

## 图标

144×144 透明底 PNG，logo 铺满无底盘。黑色系官方标（Apple、GitHub、X 等）逐个做了双主题处理，深浅色界面下都看得清。

```bash
bun run icons              # 全部重建 + 明暗预览
bun run icons Netflix AI   # 只重建指定图标
```

上游素材（simple-icons、dashboard-icons 等）固定到版本或 commit，下载后按 [`scripts/icons.lock`](scripts/icons.lock) 校验 sha256；上游内容变化时脚本直接失败，不会静默产出不同的图。升级来源后用 `UPDATE_LOCK=1 bun run icons <名称>` 重新记录。新增图标的步骤见脚本头部注释。

## 项目结构

```
Surge.tpl.conf        配置模板
Surge-*.conf          公开配置（由模板生成，可直接下载）
private.example/      私有层示例（复制为 private/ 后填值）
rules/                自维护规则集
icons/                策略组图标（由脚本生成）
src/                  渲染、公开配置转换、顺序约束、策略引用检查、规范化与私有层读取
src/cli/              render、deploy、scan、audit 命令入口
src/tests/            单元测试
scripts/              图标生成脚本与 git hooks
```

维护约定与架构决策见 [AGENTS.md](AGENTS.md)。
