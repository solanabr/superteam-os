#!/bin/sh
# Regenerate firmware/main/assets: Superteam Brasil edition.
#   Fonts: Archivo Semi Expanded + Inter (brand guide) and JetBrains Mono, all
#          SIL OFL 1.1 from Google Fonts (tools/fonts/src, licences alongside).
#   Logos: Superteam Brasil brand pack (tools/brand, superteam.com.br/en/brand).
# Needs Node (npx), and Python with Pillow + fontTools: python3 -m venv .venv &&
# .venv/bin/pip install pillow fonttools (PY=.venv/bin/python is the default).
set -e
cd "$(dirname "$0")/.."
PY=${PY:-.venv/bin/python}
[ -x "$PY" ] || PY=python3
F=tools/fonts/build
"$PY" tools/fonts/instance.py "$F"

# ASCII plus Latin-1 (ç, ã, é, ...) so Portuguese text renders, the degree
# sign and the bullet.
RANGE=0x20-0x7E,0xA0-0xFF,0x2022
font() { # file size name fallback
    npx --yes lv_font_conv@1.5.3 --no-compress --no-prefilter --bpp 4 --size "$2" --font "$1" \
        --range "$RANGE" --format lvgl --lv-include lvgl.h ${4:+--lv-fallback $4} \
        --force-fast-kern-format -o "main/assets/$3.c"
}
font "$F/JetBrainsMono-Regular.ttf" 12 sol_mono_12 lv_font_montserrat_12
font "$F/Inter-Regular.ttf" 14 sol_font_14 lv_font_montserrat_14
font "$F/Archivo-SemiExpanded-SemiBold.ttf" 20 sol_font_20 lv_font_montserrat_20
font "$F/Archivo-SemiExpanded-Bold.ttf" 32 sol_font_32

# Logos. Dark theme (Dark Green background): Yellow, as in the brand guide's
# colour variations. Light theme (Off-White background): Emerald Green.
B=tools/brand
img() { "$PY" tools/img2lvgl.py "$B/$1" "$2" "main/assets/$2.c" "$3"; }
img SYMBOL-YELLOW.png               img_logomark_16 16
img SYMBOL-EMERALD-GREEN.png        img_logomark_16_light 16
img SYMBOL-YELLOW.png               img_logomark_40 40
img SYMBOL-EMERALD-GREEN.png        img_logomark_40_light 40
img ST-YELLOW-VERTICAL.png          img_st_vertical 120
img ST-EMERALD-GREEN-VERTICAL.png   img_st_vertical_light 120
img ST-YELLOW-HORIZONTAL.png        img_st_horizontal 22
img ST-EMERAL-GREEN-HORIZONTAL.png  img_st_horizontal_light 22
