<h1 align="center">surge-rulekit</h1>

<p align="center">为 <a href="https://nssurge.com">Surge</a> 自维护的分流规则、策略组图标与一份脱敏的完整主配置，全部通过 <code>raw.githubusercontent.com</code> 远程引用，开箱即用。</p>

<p align="center"><em>Self-maintained rulesets, dark/light-adaptive policy-group icons, and a sanitized full-config template for <a href="https://nssurge.com">Surge</a> — everything referenced remotely via raw URLs, ready to drop in.</em></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Yixuling/surge-rulekit?color=blue" alt="License"></a>
  <img src="https://img.shields.io/github/last-commit/Yixuling/surge-rulekit" alt="Last commit">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Apple.png" width="42" alt="Apple">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/AI.png" width="42" alt="AI">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/ArcDia.png" width="42" alt="Arc & Dia">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/DeepL.png" width="42" alt="DeepL">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Disney.png" width="42" alt="Disney+">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/GitHub.png" width="42" alt="GitHub">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Google.png" width="42" alt="Google">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/JetBrains.png" width="42" alt="JetBrains">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Netflix.png" width="42" alt="Netflix">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/PayPal.png" width="42" alt="PayPal">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Twitter.png" width="42" alt="X">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Telegram.png" width="42" alt="Telegram">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Speedtest.png" width="42" alt="Speedtest">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/WeChat.png" width="42" alt="WeChat">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/YouTube.png" width="42" alt="YouTube">
</p>

<p align="center">
  <a href="#完整配置示例">完整配置</a> ·
  <a href="#单独引用">单独引用</a> ·
  <a href="#规则集">规则集</a> ·
  <a href="#策略组图标">图标</a> ·
  <a href="#faq">FAQ</a>
</p>

本仓库提供三类可公开引用的素材：补充社区列表未覆盖部分的**分流规则**、一套明暗自适应的**策略组图标**，以及一份演示三层多机场架构的**脱敏主配置**。全部经 `raw` URL 引用，无需本地维护副本。

## 特性

- **完整配置模板** — 脱敏的三层多机场聚合架构，替换几处占位即可套用，私密信息一律不入库。
- **自维护规则** — 补充 [blackmatrix7](https://github.com/blackmatrix7/ios_rule_script) 等社区规则未覆盖的部分（Apple Intelligence、AI 服务、浏览器等），来源可追溯、按服务拆分。
- **双主题图标** — 15 个策略组图标，144×144 透明底，浅色 / 深色界面下均清晰，logo 尺寸统一。
- **一键重建** — 图标由脚本从官方 logo 合成，新增服务后整套可复现重建。

## 完整配置示例

[`Surge.example.conf`](Surge.example.conf) 是一份脱敏的完整主配置（已移除订阅、证书、机场等全部私密信息），核心是一套 **三层多机场聚合架构**：同地区下多个机场互为主备，故障自动切换。

| 层 | 类型 | 作用 |
| --- | --- | --- |
| **L1 节点池** | `select` | 从订阅源按地区正则筛出各机场的原始节点 |
| **L2 Smart 引擎** | `smart` | 在各池上独立跑 Smart，按历史延迟 / 成功率选路 |
| **L3 可见路由** | `fallback` | 聚合各机场同地区出口，主力优先、备用冷备，故障自动切换与回切 |

配置已整合本仓库的规则与图标，并预置 DNS 防劫持、QUIC 阻断、防 IP 泄露等设置。

下载后替换占位即用：

```bash
curl -O https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/Surge.example.conf
```

> [!IMPORTANT]
> 套用前替换文件顶部清单标注的 4 处占位：机场订阅链接、`http-api` 密码、机场节点正则与图标、`[MITM]` CA 证书（在 Surge 内自行生成安装，切勿写入公开配置）。

订阅源支持两种接入方式，上层 L1 / L2 / L3 均按策略组名引用，切换时无需改动：

- **单一聚合订阅** — 一个订阅含多机场节点，用 `policy-regex-filter` 按节点名切分。
- **各机场独立订阅** — 每个机场各自一个 `policy-path`，再聚合作兜底。

只有一个机场时，删除「备用机场」相关组即可。

## 单独引用

只取规则或图标时，在 Surge 配置中按 `raw` URL 引用单个文件。

**规则**（`[Rule]` 段）：

```ini
RULE-SET, https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/rules/AI.list, AI
```

**图标**（`[Proxy Group]` 段）：

```ini
AI = select, ..., icon-url = https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/AI.png
```

> [!TIP]
> Surge 6 起 `icon-url` 也支持内置图标库、Emoji、SF Symbols；远程 URL 方案的优势是跨设备一致、可版本管理、风格自定。

### 国内直连备选（jsDelivr）

`raw.githubusercontent.com` 在部分网络环境下无法直连。冷启动阶段（代理尚未配好、配置反而拉不下来）可临时改用 jsDelivr CDN，URL 按如下对应替换：

```text
https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/<路径>
https://cdn.jsdelivr.net/gh/Yixuling/surge-rulekit@main/<路径>
```

> [!NOTE]
> jsDelivr 有缓存，更新非实时；代理可用后建议换回 raw URL 保证时效。

## 规则集

| 文件 | 覆盖 |
| --- | --- |
| `AI.list` | Claude、OpenAI / ChatGPT、Gemini、Grok、Perplexity、OpenRouter 等 |
| `AppleIntelligence.list` | Apple Intelligence / Siri / 搜索，对齐 Apple 官方 [101555](https://support.apple.com/zh-cn/101555)（6 条全覆盖） |
| `AppleExtra.list` | 社区列表未覆盖、需走代理的 Apple 域名（如 `gateway.icloud.com`） |
| `ArcDia.list` | Arc、Dia 浏览器（The Browser Company） |
| `DeepL.list` | DeepL 翻译（含旗下 Linguee） |

> [!WARNING]
> 规则有顺序依赖，引用时注意位置：
> - `AI.list` 须置于 Google 规则**之前**，否则 Gemini 等域名会被 Google 规则抢走。
> - `AppleExtra.list` 须置于 AppStore / iCloud 直连规则**之前**，否则 `gateway.icloud.com` 会被抢成直连。

## 策略组图标

图标遵循 **「原生为主 + 黑色克制改造」**，保证同一张静态 PNG 在浅色和深色界面下都清晰：

- **彩色品牌 logo** — 用官方原色，不改造（Google、Netflix、PayPal、WeChat、YouTube、JetBrains、Disney+、Arc & Dia）。
- **纯黑 / 深色 logo** — 仅这类做上色，避免在深色界面隐没：Apple 双色蓝、X 白底 + 深色描边、GitHub 品牌紫、Speedtest 品牌蓝、DeepL 品牌蓝。
- **抽象 / 自制** — AI 用渐变 sparkle（非品牌 logo），Arc & Dia 取官方 Arc 轮廓填珊瑚渐变。

所有图标 144×144、透明底、无底盘，logo 最长边统一 136（≈94% 填充，留少量安全边距）。

### 重建

图标由脚本从官方 logo 合成，新增服务或更换来源后重新生成全套：

```bash
brew install imagemagick librsvg   # 依赖
bash scripts/build-icons.sh        # 输出到 icons/，并在临时目录生成明暗预览
```

脚本结束会打印每张图的 alpha 包围盒，便于调参时对比尺寸是否归一。

> [!TIP]
> 新增一个服务图标：在 `scripts/build-icons.sh` 末尾的映射区按类型加一行——
> 彩色 PNG 用 `flat_png`、彩色 SVG 用 `flat_svg`、单色染品牌色用 `monocolor`（simple-icons 源）或 `pngcolor`（PNG 源）、线条 logo 填渐变用 `grad_svg`、需描边的用 `outline`。

## FAQ

**只有一个机场怎么用？**
删除所有「备用机场」相关组，L3 各 `fallback` 组只保留主力一项即可（或直接以 L2 的 smart 组作为出口）。

**smart 策略组用不了？**
Smart 是较新的策略组类型：Surge iOS 需订阅解锁，Surge Mac 5 免费可用（[官方说明](https://kb.nssurge.com/surge-knowledge-base/zh/guidelines/smart-group)）。不可用时把 L2 各组的 `smart` 改成 `url-test`，整体架构不变。

**图标改了但 Surge 里没刷新？**
Surge 会缓存 `icon-url`，给 URL 加版本参数强制刷新（如 `icons/AI.png?v=2`）。

**规则更新频率？**
随用随改、无固定周期；Surge 会按周期自动拉取外部资源，也可在 UI 中手动立即更新。

发现规则缺漏、图标需求或配置问题，欢迎提 [Issue](https://github.com/Yixuling/surge-rulekit/issues) / PR。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `Surge.example.conf` | 脱敏的完整主配置（三层多机场聚合架构） |
| `rules/` | 分流规则（`RULE-SET`），按服务拆分 |
| `icons/` | 策略组图标，PNG 144×144 |
| `scripts/build-icons.sh` | 图标生成脚本（ImageMagick + librsvg） |

## 许可

规则、配置与脚本以 [MIT](LICENSE) 授权。`icons/` 下的图标由各品牌官方 logo 合成，logo 版权与商标归各自所有者，仅作策略组标识用途，不在 MIT 授权范围内。

## 致谢

图标 logo 来源：[dashboard-icons](https://github.com/homarr-labs/dashboard-icons)、[selfh.st/icons](https://github.com/selfhst/icons)、[simple-icons](https://github.com/simple-icons/simple-icons)。

> [!NOTE]
> 仓库提供的主配置为脱敏模板，不含任何订阅、证书或机场等私密信息；作者的真实配置不入库。
