#!/usr/bin/env bash
# 自维护图标生成脚本，重新生成 icons/ 下的 <Name>.png
#
# 统一风格：144x144 RGBA 透明底，logo 铺满，无底盘
# keyline 三档（按视觉重量归一，参照 Material/HIG keyline 惯例）：
#   FILL_ROUND=136  圆形/有机/镂空形（circle 取最大）
#   FILL_BOX=126    实心方块类（方形缩 ~8% 抵消视觉偏大）
#   FILL_WIDE=142   横长字标（放宽找回视觉重量）
# 双主题（明暗自适应）策略，按 logo 特性选方法：
#   flat_png / flat_svg  本身彩色           → 原色铺满
#   monocolor            纯黑实心           → 染品牌色实心（双主题鲜明）
#   pngcolor             深色含细节/无单色源 → 从彩色 PNG 取形状染单色
#   grad_svg             线条/抽象          → simple-icons path 填渐变 + alpha 加粗
#   outline              纯黑且须保黑白气质 → 白填充 + 深色描边（浅色勾边、深色白实心）
#   自定义函数           无合适品牌源       → 内嵌 SVG（见 icon_AI / icon_Apple / icon_Telegram）
#
# 新增图标三步：
#   1. 选上面一种方法（或写 icon_<Name> 自定义函数）
#   2. 在 build_one 的 case 里加一行配方
#   3. 把名字追加进 ALL 数组（顺序即预览拼图顺序），跑一遍本脚本
#
# 用法：
#   bash scripts/build-icons.sh              # 全部重建 + 预览
#   bash scripts/build-icons.sh Netflix AI   # 只重建指定图标 + 预览
#   UPDATE_LOCK=1 bash scripts/build-icons.sh Netflix   # 换来源或升级版本后，重新记录来源的 sha256
#
# 可复现：上游来源都固定到版本或 commit，下载内容再按 scripts/icons.lock 校验 sha256，
# 内容一变就失败而不是静默产出不同的图（Disney 的抠图坐标尤其依赖源文件不变）
# 依赖：brew install imagemagick librsvg
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
LOCK="$here/icons.lock"

missing=""
for c in magick rsvg-convert curl shasum; do command -v "$c" >/dev/null || missing="$missing $c"; done
if [ -n "$missing" ]; then
  echo "缺少依赖：${missing}。安装：brew install imagemagick librsvg" >&2
  exit 1
fi

cd "$here/../icons"
out="$PWD"

CANVAS=144      # 画布
FILL_ROUND=136  # 圆形/有机/镂空（outline/grad_svg 的 size 需减去外扩量，使最终 ≈ 此值）
FILL_BOX=126    # 实心方块
FILL_WIDE=142   # 横长字标
SS=320          # SVG 超采样渲染高度

# 染色调色板：自选染色统一取此处色值，同一色相家族、明度三档错开。
# 全同色会抹掉列表扫视时的辨识信息，三档既保体系感又留区分度，深浅对应各品牌本来的气质。
C_BLUE_DEEP='#1D5FC2' # Speedtest（Ookla 深海军蓝气质）
C_BLUE='#2F7FD8'      # DeepL（中）
C_BLUE_SOFT='#587BE4' # Disney（Disney+ 长春花蓝气质）
C_BLUE_LT='#3A8BDF'   # Apple 双色上半
C_BLUE_DK='#2C6FC5'   # Apple 双色下半
C_PURPLE='#8957E5'    # GitHub（刻意与蓝系拉开）

# 上游来源，均固定版本；升级时改这里，再用 UPDATE_LOCK=1 重新记录 sha256 并核对图标 diff
SI="https://cdn.jsdelivr.net/npm/simple-icons@16.34.0/icons"                                            # simple-icons：单色 path（只取形状）
DB="https://raw.githubusercontent.com/homarr-labs/dashboard-icons/adca944175c9a3eb0471f78a4da87f237476d585/png" # dashboard-icons：彩色 PNG
SH="https://cdn.jsdelivr.net/gh/selfhst/icons@2053b70b283ffed5f2cc1424d1e17d9c554a846d/png"              # selfh.st：彩色 PNG
WM="https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg"                             # Wikimedia 无法按版本取，靠 sha256 锁定

ALL=(Apple AI ArcDia DeepL Disney GitHub Google JetBrains Netflix PayPal
     Twitter Telegram Speedtest WeChat YouTube)

b="$(mktemp -d)"; trap 'rm -rf "$b"' EXIT; cd "$b"

# ---------- 基础工序 ----------
# 下载并按 icons.lock 校验 sha256；UPDATE_LOCK=1 时改为记录
fetch()  { curl -fsSL "$1" -o "$2" || { echo "下载失败：$1" >&2; return 1; }
  local got want; got=$(shasum -a 256 "$2" | cut -d' ' -f1)
  if [ "${UPDATE_LOCK:-}" = 1 ]; then
    { grep -vF "  $1" "$LOCK" 2>/dev/null; echo "$got  $1"; } | sort -k2 > "$LOCK.tmp" && mv "$LOCK.tmp" "$LOCK"
    return 0
  fi
  want=$(awk -v u="$1" '$2 == u { print $1 }' "$LOCK" 2>/dev/null)
  [ -n "$want" ] || { echo "icons.lock 里没有这个来源：$1（用 UPDATE_LOCK=1 记录）" >&2; return 1; }
  [ "$got" = "$want" ] || { echo "来源内容与 icons.lock 不符：$1（上游变了，确认后用 UPDATE_LOCK=1 更新）" >&2; return 1; }; }
# 唯一落盘点。排除 date/tIME 块，否则每次重建都写入当前时间，
# 像素没变的图也会出现在 git status 里，真实改动被淹没
canvas() { magick "$1" -background none -gravity center -extent ${CANVAS}x${CANVAS} \
                  -colorspace sRGB -define png:exclude-chunks=date,time \
                  PNG32:"$out/$2.png"; }
# SVG → 裁边 → 等比缩放到最长边 $2
svg2fit() { rsvg-convert -h $SS "$1" -o _r.png && magick _r.png -trim +repage -resize "${2}x${2}" -background none _fit.png; }
png2fit() { magick "$1" -trim +repage -resize "${2}x${2}" -background none _fit.png; }
# 取 _fit.png 形状染纯色 $1 → _fit.png
tint()    { magick _fit.png -alpha extract -background "$1" -alpha shape _t.png && mv _t.png _fit.png; }

# ---------- 方法（配方行调用）----------
flat_png()  { fetch "$2" _s.png && png2fit _s.png "$3"           && canvas _fit.png "$1"; }
flat_svg()  { fetch "$2" _s.svg && svg2fit _s.svg "$3"           && canvas _fit.png "$1"; }
monocolor() { fetch "$SI/$3.svg" _s.svg && svg2fit _s.svg "$4" && tint "$2" && canvas _fit.png "$1"; }
pngcolor()  { fetch "$3" _s.png && png2fit _s.png "$4"           && tint "$2" && canvas _fit.png "$1"; }
# si path 填线性渐变，可选 alpha 膨胀加粗：grad_svg 名 slug 尺寸 起色 止色 [dilate]
# 注意：Dilate 不扩画布，膨胀前必须先加同宽透明边框，否则贴边处被裁平
grad_svg()  { fetch "$SI/$2.svg" _s.svg && svg2fit _s.svg "$3" || return 1
  local d="${6:-0}"
  if [ "$d" != 0 ]; then
    magick _fit.png -bordercolor none -border "$d" -channel A -morphology Dilate Disk:"$d" +channel _t.png && mv _t.png _fit.png || return 1
  fi
  local W H; W=$(magick _fit.png -format '%w' info:) && H=$(magick _fit.png -format '%h' info:) &&
  magick -size "${W}x${H}" gradient:"$4"-"$5" _g.png &&
  magick _g.png \( _fit.png -alpha extract \) -compose CopyOpacity -composite _fit.png &&
  canvas _fit.png "$1"; }
# 填色 + 描边：outline 名 svg-url 填充色 描边色 尺寸 disk（最终最长边 = 尺寸 + disk*2）
# 同上：先加透明边框再膨胀，保证描边在 logo 端头不被画布裁掉
outline()   { fetch "$2" _s.svg && svg2fit _s.svg "$5" || return 1
  magick _fit.png -bordercolor none -border "$6" _p.png &&
  magick _p.png -alpha extract -background "$3" -alpha shape _logo.png &&
  magick _p.png -alpha extract -morphology Dilate Disk:"$6" -background "$4" -alpha shape _halo.png &&
  magick _halo.png _logo.png -gravity center -composite _fit.png &&
  canvas _fit.png "$1"; }

# ---------- 自定义图标 ----------
# Apple：双色蓝苹果（上浅下深直接相接），纯黑官方标的双主题化
icon_Apple() { fetch "$SI/apple.svg" _a.svg && rsvg-convert -h $FILL_ROUND _a.svg -o _aw.png || return 1
  local W H mid; W=$(magick _aw.png -format '%w' info:) && H=$(magick _aw.png -format '%h' info:) || return 1
  mid=$((H*60/100))
  magick \( -size "${W}x${mid}" xc:"$C_BLUE_LT" \) \( -size "${W}x$((H-mid))" xc:"$C_BLUE_DK" \) -append _bg.png &&
  magick _bg.png \( _aw.png -alpha extract \) -compose CopyOpacity -composite _ba.png &&
  canvas _ba.png Apple; }
# AI：sparkle 主星+副星，紫蓝粉渐变
icon_AI() { cat > _sp.svg <<'SVG'
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
  svg2fit _sp.svg $FILL_ROUND && canvas _fit.png AI; }
# Disney：D+ 单标，官方字标 SVG 用连通域抠出手写 D 与加号重拼（整词字标 32px 下糊成一团）
# 连通域 id 与裁切几何绑定 h=600 渲染下的该 SVG，换源需重新标定（跑一次 verbose 看 id/bbox）
icon_Disney() { fetch "$WM" _wm.svg && rsvg-convert -h 600 _wm.svg -o _wm.png || return 1
  _cc() { magick _wm.png -alpha extract -threshold 15% -define connected-components:area-threshold=200 \
          -define connected-components:mean-color=true -define connected-components:keep-ids="$1" \
          -connected-components 8 -crop "$2" +repage "$3"; }
  _cc 2 372x301+0+224 _d.png &&    # 手写体 D
  _cc 7 170x169+936+324 _p.png &&  # 加号
  magick -size 590x301 xc:black _d.png -geometry +0+0 -composite _p.png -geometry +420+18 -composite _m.png &&
  magick -size 590x301 xc:"$C_BLUE_SOFT" _m.png -alpha off -compose CopyOpacity -composite -trim +repage \
         -resize "${FILL_WIDE}x${FILL_WIDE}" -background none _fit.png &&
  canvas _fit.png Disney; }
# Telegram：纯纸飞机（去掉圆底），Telegram 蓝
icon_Telegram() { cat > _tg.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#29A9EB" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
</svg>
SVG
  svg2fit _tg.svg $FILL_ROUND && canvas _fit.png Telegram; }

# ---------- 配方表（新图标在此加一行）----------
build_one() { case "$1" in
  Apple)     icon_Apple ;;
  AI)        icon_AI ;;
  ArcDia)    grad_svg  ArcDia    arc $((FILL_ROUND-6)) '#FF7A4D' '#D6418F' 3 ;;   # +dilate3*2 ≈ ROUND
  DeepL)     monocolor DeepL     "$C_BLUE" deepl      $FILL_BOX ;;    # 实心六边形
  Disney)    icon_Disney ;;   # D+ 单标（见函数注释）
  GitHub)    monocolor GitHub    "$C_PURPLE" github   $FILL_ROUND ;;
  Google)    flat_png  Google    "$DB/google.png"     $FILL_ROUND ;;
  JetBrains) flat_png  JetBrains "$SH/jetbrains.png"  $FILL_BOX ;;    # 实心方块
  Netflix)   flat_png  Netflix   "$DB/netflix.png"    $FILL_ROUND ;;
  PayPal)    flat_png  PayPal    "$DB/paypal.png"     $FILL_ROUND ;;
  Twitter)   outline   Twitter   "$SI/x.svg" '#FFFFFF' '#2C2C2E' $((FILL_ROUND-12)) 6 ;;  # +disk6*2 = ROUND
  Telegram)  icon_Telegram ;;
  Speedtest) monocolor Speedtest "$C_BLUE_DEEP" speedtest $FILL_ROUND ;;  # 镂空表盘
  WeChat)    flat_png  WeChat    "$DB/wechat.png"     $FILL_ROUND ;;
  YouTube)   flat_png  YouTube   "$SH/youtube.png"    $FILL_BOX ;;    # 实心圆角矩形
  *) echo "未知图标：$1（配方表里没有）" >&2; return 1 ;;
esac }

# ---------- 主流程 ----------
targets=("${@:-}"); [ -z "${targets[0]}" ] && targets=("${ALL[@]}")
fails=()
for n in "${targets[@]}"; do
  rm -f "$b"/_*; build_one "$n" || fails+=("$n")
done

# 明暗双主题预览拼图（含全部已有图标 + 32px 实际显示尺寸行，输出到临时位置，不入库）
F="/System/Library/Fonts/Supplemental/Arial.ttf"
fontarg=(); [ -f "$F" ] && fontarg=(-font "$F" -label '%t' -pointsize 22)
args=(); for n in "${ALL[@]}"; do [ -f "$out/$n.png" ] && args+=("$out/$n.png"); done
preview="${TMPDIR:-/tmp}/surge-icons-preview.png"
small() { # $1=底色 $2=输出：全部图标缩到 32px 排成一行（Surge 实际显示尺寸的辨识度检查）
  magick "${args[@]}" -resize 32x32 -background none +smush 22 \
         -bordercolor "$1" -border 30x20 PNG32:"$2"; }
magick montage "${fontarg[@]}" -fill black "${args[@]}" -tile 5x -geometry ${CANVAS}x160+12+8 -background '#FFFFFF' PNG32:_lt.png
magick montage "${fontarg[@]}" -fill white "${args[@]}" -tile 5x -geometry ${CANVAS}x160+12+8 -background '#1C1C1E' PNG32:_dk.png
small '#FFFFFF' _slt.png && magick _lt.png _slt.png -background '#FFFFFF' -gravity center -append _lt2.png
small '#1C1C1E' _sdk.png && magick _dk.png _sdk.png -background '#1C1C1E' -gravity center -append _dk2.png
magick _lt2.png _dk2.png +append -background '#888888' PNG32:"$preview"

echo "完成：${#targets[@]} 个图标。明暗预览：$preview"
echo "--- alpha 包围盒（WxH+偏移，调参回归证据）---"
for n in "${ALL[@]}"; do [ -f "$out/$n.png" ] && printf "  %-10s %s\n" "$n" "$(magick "$out/$n.png" -format '%@' info:)"; done
if [ ${#fails[@]} -gt 0 ]; then echo "失败：${fails[*]}" >&2; exit 1; fi
