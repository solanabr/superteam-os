#!/usr/bin/env python3
# Cut static instances out of the Google Fonts variable fonts in src/, for
# lv_font_conv (which only renders a variable font's default instance).
# usage: python3 tools/fonts/instance.py <out_dir>
# Needs fontTools (pip install fonttools).
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "build")

# Superteam Brasil brand guide: Archivo Semi Expanded for display, Inter for
# text. JetBrains Mono stands in for the mono face the brand doesn't define.
INSTANCES = {
    "Archivo-SemiExpanded-SemiBold.ttf": ("Archivo[wdth,wght].ttf", {"wdth": 112.5, "wght": 600}),
    "Archivo-SemiExpanded-Bold.ttf":     ("Archivo[wdth,wght].ttf", {"wdth": 112.5, "wght": 700}),
    "Inter-Regular.ttf":                 ("Inter[opsz,wght].ttf", {"opsz": 14, "wght": 400}),
    "JetBrainsMono-Regular.ttf":         ("JetBrainsMono[wght].ttf", {"wght": 400}),
}

os.makedirs(OUT, exist_ok=True)
for out, (src, axes) in INSTANCES.items():
    font = TTFont(os.path.join(HERE, "src", src))
    instantiateVariableFont(font, axes, inplace=True, updateFontNames=False)
    font.save(os.path.join(OUT, out))
    print(f"{out}: {src} {axes}")
