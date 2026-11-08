#pragma once

// Superteam Brasil edition. Palette from the Superteam Brasil brand guide
// (superteam.com.br/en/brand, stbr-brand-guide.pdf, March 2026):
//   Emerald Green #008b4c, Yellow #ffd23f, Green #306c40,
//   Dark Green #1b231d, Off-White #f5e8ca.
//
// The macro names stay as upstream's because Lua apps pick colours by these
// names ("purple", "green", ...: main/lua/lua_ui.c). Read them as roles:
//   COL_PURPLE = primary brand colour (fills, borders, gradient start)
//   COL_GREEN  = highlight (focus, selection, !LAMPs, gradient end)
// Every value must stay distinct: ui_col() switches on them.

#define OS_NAME         "Superteam OS"

#define COL_PURPLE      0x008B4C    // ST Emerald Green
#define COL_GREEN       0xFFD23F    // ST Yellow
#define COL_STGREEN     0x306C40    // ST Green
#define COL_PINK        0xEB54BC
#define COL_LPURPLE     0xB6B0FF
#define COL_BLUE        0x64A8F2
#define COL_AQUA        0x80ECFF
#define COL_LIME        0xACFF9B
#define COL_YELLOW      0xFFA62B    // amber: warnings, kept apart from ST Yellow
#define COL_ORANGE      0xFF754A

// UI surfaces on the ST Dark Green background
#define COL_BG          0x1B231D    // ST Dark Green
#define COL_PANEL       0x243029
#define COL_PANEL_HI    0x2E3D33
#define COL_BORDER      0x3B4C40
#define COL_TEXT        0xF5E8CA    // ST Off-White
#define COL_DIM         0xA39E86

#define COL_OK          COL_LIME
#define COL_WARN        COL_YELLOW
#define COL_ERR         COL_ORANGE

// Guide page categories and rarities (docs/HHGTS.md; web: --cat-*, --rarity-*).
#define COL_CAT_EVENTS      COL_PINK
#define COL_CAT_CULTURE     COL_ORANGE
#define COL_CAT_TECH        COL_BLUE
#define COL_CAT_RELEASES    COL_GREEN
#define COL_CAT_ECOSYSTEM   COL_AQUA
#define COL_CAT_HISTORY     COL_YELLOW
#define COL_CAT_PEOPLE      COL_LPURPLE
#define COL_CAT_LORE        COL_LIME
#define COL_RARITY_COMMON   COL_DIM
#define COL_RARITY_RARE     COL_BLUE
#define COL_RARITY_EPIC     COL_PURPLE
#define COL_RARITY_LEGEND   COL_GREEN    // plus the gradient bar / purple->green LED sweep
#define COL_LAMPS           COL_GREEN    // !LAMPs amounts

// Screen layout: status bar on top, app root below.
#define OS_STATUS_H     22
#define OS_ROOT_W       BOARD_LCD_H_RES
#define OS_ROOT_H       (BOARD_LCD_V_RES - OS_STATUS_H)

// WS2812s are blinding at full power; nothing should exceed this.
#define OS_LED_MAX      24
