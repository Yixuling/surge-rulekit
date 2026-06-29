#!/usr/bin/env bash
# 自维护图标生成脚本
# 统一风格：144x144 RGBA 透明底 + logo 铺满（无底盘，对齐主流开源图标库观感）
# 双主题（明暗自适应）策略：
#   - 本身彩色的 logo            → 原色铺满
#   - 纯黑实心 logo(Apple)       → 双色蓝苹果（彩色，双主题可见）
#   - 纯黑实心 logo(GitHub/Speedtest) → 染品牌色实心（GitHub 紫 / Speedtest 蓝，双主题鲜明）
#   - 线条/抽象 logo(ArcDia)     → simple-icons 官方 Arc path 填品牌渐变 + alpha 加粗（实心化+彩色化）
#   - 深色含细节 logo(DeepL)     → 染品牌蓝单色实心（双主题可见）
#   - 纯黑 logo(X/Twitter)       → 白填充 + 深色描边（浅色勾边、深色白实心）
# 视觉尺寸：按各 logo 视觉重量归一（自带圆底的 X/Telegram 圆径对齐，字标 Disney 给足宽度）
# 依赖：ImageMagick(magick)、librsvg(rsvg-convert)、curl
#   brew install imagemagick librsvg
# 用法：bash scripts/build-icons.sh   # 重新生成 icons/ 下全部 <Name>.png
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/../icons"
out="$PWD"

SI="https://cdn.simpleicons.org"                                              # simple-icons：纯单色 path，可带 /颜色
DB="https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png"   # dashboard-icons 彩色 PNG
SH="https://cdn.jsdelivr.net/gh/selfhst/icons/png"                            # selfh.st 彩色 PNG

b="$(mktemp -d)"; trap 'rm -rf "$b"' EXIT; cd "$b"

canvas() { magick "$1" -background none -gravity center -extent 144x144 -colorspace sRGB PNG32:"$out/$2.png"; }

# 彩色 PNG 源直接铺满
flat_png() { rm -f s.png l.png; curl -fsSL "$2" -o s.png || { echo "FAIL flat_png $1"; return 1; }
  magick s.png -trim +repage -resize "${3}x${3}" -background none l.png; canvas l.png "$1"; }
# 彩色 SVG 源(simple-icons)→ rsvg
flat_svg() { rm -f s.svg s.png l.png; curl -fsSL "$2" -o s.svg || { echo "FAIL flat_svg $1"; return 1; }
  rsvg-convert -h 320 s.svg -o s.png
  magick s.png -trim +repage -resize "${3}x${3}" -background none l.png; canvas l.png "$1"; }
# 染品牌色实心：si 白色 path 取形状填指定色
monocolor() { rm -f s.svg s.png m0.png t.png; curl -fsSL "$SI/$3/white" -o s.svg || { echo "FAIL monocolor $1"; return 1; }
  rsvg-convert -h 320 s.svg -o s.png
  magick s.png -trim +repage -resize "${4}x${4}" -background none m0.png
  magick m0.png -alpha extract -background "$2" -alpha shape t.png; canvas t.png "$1"; }
# png 源染单色（无 si 单色源时，从彩色 png 取形状填色，用于 Disney+ 双主题可见）
pngcolor() { rm -f s.png m0.png t.png; curl -fsSL "$3" -o s.png || { echo "FAIL pngcolor $1"; return 1; }
  magick s.png -trim +repage -resize "${4}x${4}" -background none m0.png
  magick m0.png -alpha extract -background "$2" -alpha shape t.png; canvas t.png "$1"; }
# si path 填线性渐变（实心化+彩色化，用于 Arc 这种线条/抽象 logo）
grad_svg() { rm -f s.svg aw.png aw2.png aw3.png grad.png ag.png; curl -fsSL "$SI/$2/white" -o s.svg || { echo "FAIL grad_svg $1"; return 1; }
  rsvg-convert -h 320 s.svg -o aw.png
  magick aw.png -trim +repage -resize "${3}x${3}" -background none aw2.png
  local dilate="${6:-0}"
  if [ "$dilate" != "0" ]; then magick aw2.png -channel A -morphology Dilate Disk:"$dilate" +channel aw3.png; else cp aw2.png aw3.png; fi
  local W H; W=$(magick aw3.png -format '%w' info:); H=$(magick aw3.png -format '%h' info:)
  magick -size "${W}x${H}" gradient:"$4"-"$5" grad.png
  magick grad.png \( aw3.png -alpha extract \) -compose CopyOpacity -composite ag.png; canvas ag.png "$1"; }
# logo 填色 + 描边（如 X：近黑填充 + 白描边，深色模式勾出白线框，浅色为黑实心）
outline() { # name svg-white-url logo-color halo-color size disk
  rm -f m.svg mr.png m.png logo.png halo.png o.png; curl -fsSL "$2" -o m.svg; rsvg-convert -h 320 m.svg -o mr.png
  magick mr.png -trim +repage -resize "${5}x${5}" -background none m.png
  magick m.png -alpha extract -background "$3" -alpha shape logo.png
  magick m.png -alpha extract -morphology Dilate Disk:"$6" -background "$4" -alpha shape halo.png
  magick halo.png logo.png -gravity center -composite o.png; canvas o.png "$1"; }
# Apple：双色蓝苹果（上浅蓝 #3A81D3 / 下深蓝 #306EC2 直接相接，无分割线）
blue_apple() { curl -fsSL "$SI/apple/white" -o a.svg; rsvg-convert -h 136 a.svg -o aw.png
  local W H mid; W=$(magick aw.png -format '%w' info:); H=$(magick aw.png -format '%h' info:); mid=$((H*60/100))
  magick -size "${W}x${mid}" xc:'#3A81D3' t.png
  magick -size "${W}x$((H-mid))" xc:'#306EC2' bt.png
  magick t.png bt.png -append st.png
  magick st.png \( aw.png -alpha extract \) -compose CopyOpacity -composite ba.png; canvas ba.png Apple; }
# AI：彩色 sparkle（紫蓝粉提饱和渐变；调两星相对布局+主星放大，-trim 后按 alpha 包围盒居中）
ai() { cat > sp.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8B5CF6"/><stop offset="0.5" stop-color="#6366F1"/><stop offset="1" stop-color="#EC4899"/>
  </linearGradient></defs>
  <g fill="url(#g)">
    <path transform="translate(248,252) scale(1.15) translate(-232,-231)" d="M232 70 C246 205 258 217 393 231 C258 245 246 257 232 392 C218 257 206 245 71 231 C206 217 218 205 232 70 Z"/>
    <path transform="translate(372,366) translate(-408,-362)" d="M408 300 C414 348 422 356 470 362 C422 368 414 376 408 424 C402 376 394 368 346 362 C394 356 402 348 408 300 Z"/>
  </g>
</svg>
SVG
  rsvg-convert -h 320 sp.svg -o sp.png
  magick sp.png -trim +repage -resize 136x136 -background none l.png; canvas l.png AI; }
# Telegram：纯纸飞机（无圆底），Telegram 蓝
telegram() { cat > tg.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#29A9EB" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
</svg>
SVG
  rsvg-convert -h 320 tg.svg -o tg.png
  magick tg.png -trim +repage -resize 136x136 -background none l.png; canvas l.png Telegram; }
# 服务 -> 处理方式/源映射（out名即 Surge 组的图标文件名）
# 尺寸：统一最长边 136（136/144≈94% 填充，每边留 ~4px 安全边距）；
#   outline/grad_svg 因描边/膨胀外扩，size 已减去外扩量使最终最长边≈136。
blue_apple                                                   # Apple 双色蓝苹果（rsvg -h 136）
ai                                                           # AI      sparkle（resize 136）
grad_svg  ArcDia    arc       130 "#FF7A4D" "#D6418F" 3      # ArcDia  官方 Arc + 珊瑚渐变（130 + dilate3*2 ≈ 136）
monocolor DeepL     "#1A73C7" deepl        136
pngcolor  Disney    "#2F88E0" "$SH/disney-plus.png" 136
monocolor GitHub    "#8957E5" github       136
flat_png  Google    "$DB/google.png"       136
flat_png  JetBrains "$SH/jetbrains.png"    136
flat_png  Netflix   "$DB/netflix.png"      136
flat_png  PayPal    "$DB/paypal.png"       136
outline   Twitter   "$SI/x/white" "#FFFFFF" "#2C2C2E" 124 6  # X 白 + 深描边（124 + disk6*2 = 136）
telegram                                                     # Telegram 纯纸飞机（resize 136）
monocolor Speedtest "#1A5FD0" speedtest    136
flat_png  WeChat    "$DB/wechat.png"       136
flat_png  YouTube   "$SH/youtube.png"      136

# 预览拼图（明暗双主题，输出到临时位置）
F="/System/Library/Fonts/Supplemental/Arial.ttf"
ord=(Apple AI ArcDia DeepL Disney GitHub Google JetBrains Netflix PayPal Twitter Telegram Speedtest WeChat YouTube)
args=(); for n in "${ord[@]}"; do args+=("$out/$n.png"); done
preview="${TMPDIR:-/tmp}/surge-icons-preview.png"
magick montage -font "$F" -label '%t' -pointsize 22 -fill black "${args[@]}" -tile 5x3 -geometry 144x160+12+8 -background "#FFFFFF" PNG32:lt.png 2>/dev/null
magick montage -font "$F" -label '%t' -pointsize 22 -fill white "${args[@]}" -tile 5x3 -geometry 144x160+12+8 -background "#1C1C1E" PNG32:dk.png 2>/dev/null
magick lt.png dk.png +append -background "#888888" PNG32:"$preview" 2>/dev/null
echo "完成：icons/ 下 15 个图标。明暗预览：$preview"
echo "--- alpha 包围盒（宽x高+偏移，调参回归证据）---"
for n in "${ord[@]}"; do printf "  %-10s %s\n" "$n" "$(magick "$out/$n.png" -format '%@' info:)"; done
