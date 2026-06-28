#!/usr/bin/env bash
# 自维护图标生成脚本
# 统一风格：144x144 RGBA，白色圆角底（半径30）+ 彩色官方 logo 居中
# 依赖：ImageMagick(magick)、librsvg(rsvg-convert)、curl
#   brew install imagemagick librsvg
# 用法：bash scripts/build-icons.sh   # 重新生成 icons/ 下全部 <Name>.png 与 preview.png
set -euo pipefail
# 输出到项目的 icons/ 目录（脚本在 scripts/，与 icons/ 同级）
cd "$(cd "$(dirname "$0")" && pwd)/../icons"

DB="https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png"   # 彩色 PNG（注意：其 svg 用 style= 着色，rsvg 渲染会丢色，必须用 png）
SH="https://cdn.jsdelivr.net/gh/selfhst/icons/png"                            # selfh.st 彩色 PNG
SI="https://cdn.simpleicons.org"                                              # simple-icons（svg，fill 属性形式，rsvg 可正确着色）

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# 白色圆角底（PNG32 强制 RGBA，避免被优化成 grayscale 导致彩色 logo 变灰）
magick -size 144x144 xc:none -fill white -draw "roundrectangle 0,0,143,143,30,30" PNG32:"$tmp/bg.png"

# 自制中立 AI sparkle（双星 + 紫蓝粉渐变），不偏向任何厂商
cat > "$tmp/ai.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8B5CF6"/><stop offset="0.5" stop-color="#6366F1"/><stop offset="1" stop-color="#EC4899"/>
  </linearGradient></defs>
  <path fill="url(#g)" d="M236 60 C246 150 266 170 356 180 C266 190 246 210 236 300 C226 210 206 190 116 180 C206 170 226 150 236 60 Z"/>
  <path fill="url(#g)" d="M390 300 C396 350 406 360 456 366 C406 372 396 382 390 432 C384 382 374 372 324 366 C374 360 384 350 390 300 Z"/>
</svg>
SVG

# 取得某服务的 logo 源 png 到 $tmp/<out>.src.png
fetch() {  # $1=out名  $2=类型(db|sh|si|ai)  $3=源名/颜色
  local out="$1" kind="$2" key="$3"
  local png="$tmp/$out.src.png"
  case "$kind" in
    db) curl -fsSL "$DB/$key.png" -o "$png" ;;
    sh) curl -fsSL "$SH/$key.png" -o "$png" ;;
    si) curl -fsSL "$SI/$key" -o "$tmp/$out.svg"; rsvg-convert -h 320 "$tmp/$out.svg" -o "$png" ;;
    ai) rsvg-convert -h 320 "$tmp/ai.svg" -o "$png" ;;
  esac
}

# 合成：源 png -> trim 归一 -> 缩放 -> 居中叠加到白圆角底
compose() {  # $1=out名 $2=缩放尺寸(默认94)
  local out="$1" size="${2:-94}"
  magick "$tmp/$out.src.png" -trim +repage -resize "${size}x${size}" -background none -gravity center "$tmp/$out.lg.png"
  magick "$tmp/bg.png" "$tmp/$out.lg.png" -gravity center -composite -colorspace sRGB PNG32:"$out.png"
}

# 服务 -> 源映射（out名即 Surge 组的图标文件名）
fetch Apple     db apple
fetch AI        ai  -
fetch ArcDia    si  arc/F1668B          # 内置/第三方均无 Arc 彩色矢量，用 simple-icons path 填 Arc 珊瑚粉
fetch DeepL     db deepl
fetch Disney    sh disney-plus          # selfh.st 为透明底深蓝字样（dashboard 版自带深色容器，不用）
fetch GitHub    db github
fetch Google    db google
fetch JetBrains sh jetbrains
fetch Netflix   db netflix
fetch PayPal    db paypal
fetch Twitter   db x                    # 组名仍叫 Twitter，图标用 X
fetch Telegram  db telegram
fetch Speedtest sh speedtest
fetch WeChat    db wechat
fetch YouTube   db youtube

for n in Apple AI ArcDia DeepL Disney GitHub Google JetBrains Netflix PayPal Twitter Telegram Speedtest WeChat YouTube; do
  [ "$n" = Disney ] && compose "$n" 100 || compose "$n" 94
done

# 预览拼图（仅供查看，输出到临时位置，不进 icons/）
preview="${TMPDIR:-/tmp}/surge-icons-preview.png"
magick montage Apple.png AI.png ArcDia.png DeepL.png Disney.png GitHub.png Google.png JetBrains.png Netflix.png PayPal.png Twitter.png Telegram.png Speedtest.png WeChat.png YouTube.png \
  -tile 5x3 -geometry 144x144+10+10 -background "#999999" "$preview" 2>/dev/null
echo "完成：icons/ 下 15 个图标。预览（临时）：$preview"
