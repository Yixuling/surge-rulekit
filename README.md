<h1 align="center">surge-rulekit</h1>

<p align="center">为 <a href="https://nssurge.com">Surge</a> 自维护的分流规则集与策略组图标，通过 <code>raw.githubusercontent.com</code> 远程引用，开箱即用。</p>

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

本仓库收集两类可公开引用的素材：补充社区列表未覆盖部分的**分流规则**，以及一套风格统一、明暗主题自适应的**策略组图标**。全部通过 `raw` URL 引用，无需本地维护副本。

## 特性

- **自维护规则** — 补充 [blackmatrix7](https://github.com/blackmatrix7/ios_rule_script) 等社区规则未覆盖的部分（Apple Intelligence、AI 服务、浏览器等），来源可追溯、按服务拆分。
- **双主题图标** — 15 个策略组图标，144×144 透明底，浅色 / 深色界面下均清晰，视觉大小归一。
- **即取即用** — 规则与图标均通过 `raw` URL 远程引用，配置里写一行即可。
- **一键重建** — 图标由脚本从官方 logo 合成，新增服务后整套可复现重建。

## 使用

在 Surge 配置中通过 `raw` URL 引用。

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

所有图标 144×144、透明底、无底盘，视觉重量按光学大小归一。

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

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `rules/` | 分流规则（`RULE-SET`），按服务拆分 |
| `icons/` | 策略组图标，PNG 144×144 |
| `scripts/build-icons.sh` | 图标生成脚本（ImageMagick + librsvg） |

## 致谢

图标 logo 来源：[dashboard-icons](https://github.com/homarr-labs/dashboard-icons)、[selfh.st/icons](https://github.com/selfhst/icons)、[simple-icons](https://github.com/simple-icons/simple-icons)。

> [!NOTE]
> 本仓库只提供可公开引用的规则与图标，不含任何个人主配置。
