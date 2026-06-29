# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

为 Surge 维护两类可公开远程引用的素材:`rules/`(分流规则 `.list`,补充 blackmatrix7 等社区列表)与 `icons/`(策略组图标 PNG,脚本从官方 logo 合成)。均通过 `raw.githubusercontent.com/Yixuling/surge-rulekit/main/...` 在用户 Surge 配置里引用。无 build / test / lint。

## 命令

```bash
brew install imagemagick librsvg     # 依赖:magick + rsvg-convert
bash scripts/build-icons.sh          # 重新生成 icons/ 下全部图标
```

脚本末尾打印每张图的 alpha 包围盒作尺寸归一的回归证据,并在临时目录生成明暗预览。改图标 = 改脚本后重跑,产物 PNG 与脚本一起提交。

## 图标生成架构(scripts/build-icons.sh)

核心理念 **「原生为主 + 黑色克制改造」**,服务于硬约束:同一张静态 PNG 必须同时适配浅色(`#F2F2F7`)与深色(`#1C1C1E`)。

- 彩色品牌 logo → 官方原色,不改造
- 纯黑 / 深色 logo → 才上色,否则深色模式隐没(Apple 双色蓝、X 白+深描边、GitHub 紫、Speedtest/DeepL 蓝)
- 抽象 / 无现成源 → 手写 SVG 或填渐变

脚本 = 顶部处理函数 + 末尾「服务 → 处理方式」映射表(一行一图标,函数名后首参即图标文件名 / Surge 组名)。增改图标 = 在映射表加 / 改一行。

| 函数 | 用途 |
|---|---|
| `flat_png` / `flat_svg` | 彩色 PNG / SVG 直接铺满 |
| `monocolor` | simple-icons 白 path 染单一品牌色 |
| `pngcolor` | 彩色 PNG 取形状染单色 |
| `grad_svg` | simple-icons path 填渐变,可选 dilate 加粗 |
| `outline` | 填色 + 膨胀描边(X) |
| `blue_apple` / `ai` / `telegram` | 专用合成 |

统一经 `canvas()` 输出 144×144,用 `PNG32:` 强制 RGBA(否则纯色 logo 被优化成灰度而变灰)。尺寸统一最长边 136(≈94% 填充,每边留 ~4px 安全边距);outline/grad_svg 因描边/膨胀外扩,映射表 size 已减去外扩量。dashboard-icons 的 SVG 用 `style=` 着色,rsvg 渲染会丢色 → 这类必须用其 PNG。

## 规则顺序依赖

主配置 `[Rule]` 段的引用顺序影响命中(见各 `.list` 头部):`AI.list` 须在 Google 规则前;`AppleExtra.list` 须在 AppStore / iCloud 直连规则前。

## 约束

- `Surge.conf`(本地个人配置,已 gitignore)绝不提交 / 打印。
- 提交信息用英文。
