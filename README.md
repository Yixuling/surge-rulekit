<h1 align="center">surge-rulekit</h1>

<p align="center">Surge 自维护的分流规则集与策略组图标，通过 <code>raw.githubusercontent.com</code> 远程引用，开箱即用。</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/AI.png" width="46" alt="AI">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Apple.png" width="46" alt="Apple">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/ArcDia.png" width="46" alt="Arc & Dia">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/DeepL.png" width="46" alt="DeepL">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Disney.png" width="46" alt="Disney+">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/GitHub.png" width="46" alt="GitHub">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Google.png" width="46" alt="Google">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/JetBrains.png" width="46" alt="JetBrains">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/Netflix.png" width="46" alt="Netflix">
  <img src="https://raw.githubusercontent.com/Yixuling/surge-rulekit/main/icons/YouTube.png" width="46" alt="YouTube">
</p>

## 特性

- **自维护规则** — 补充 [blackmatrix7](https://github.com/blackmatrix7/ios_rule_script) 等社区规则未覆盖的部分（Apple Intelligence、AI 服务、浏览器等）。
- **统一风格图标** — 15 个策略组图标，144×144、白色圆角底 + 彩色官方 logo，可脚本一键重建。
- **即取即用** — 全部通过 `raw` URL 远程引用，无需本地维护副本。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `rules/` | 分流规则（`RULE-SET`），按服务拆分 |
| `icons/` | 策略组图标，PNG 144×144 |
| `scripts/build-icons.sh` | 图标生成脚本（ImageMagick + librsvg） |

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

## 规则清单

| 文件 | 覆盖 |
| --- | --- |
| `AI.list` | Claude、OpenAI、Gemini、Grok、Perplexity、OpenRouter 等 |
| `AppleIntelligence.list` | Apple Intelligence / Siri / Private Cloud Compute（对齐 Apple 官方 [101555](https://support.apple.com/zh-cn/101555)） |
| `AppleExtra.list` | 社区列表未覆盖、需走代理的 Apple 域名（如 `gateway.icloud.com`） |
| `ArcDia.list` | Arc、Dia 浏览器（The Browser Company） |
| `DeepL.list` | DeepL 翻译（含 Linguee） |

## 图标重建

图标由脚本从官方 logo 合成，新增服务或更换来源后重新生成全套：

```bash
brew install imagemagick librsvg   # 依赖
bash scripts/build-icons.sh        # 输出到 icons/，预览生成到临时目录
```

> [!TIP]
> 新增一个服务图标：在 `scripts/build-icons.sh` 的映射表里加一行 `fetch`，并在末尾的循环加上对应名称即可。

## 致谢

图标 logo 来源：[dashboard-icons](https://github.com/homarr-labs/dashboard-icons)、[selfh.st/icons](https://github.com/selfhst/icons)、[simple-icons](https://github.com/simple-icons/simple-icons)。

> [!NOTE]
> 个人 Surge 主配置（含 MITM 证书、机场订阅等隐私信息）不在本仓库；这里只提供可公开引用的规则与图标。
