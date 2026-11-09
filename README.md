# Superteam OS (Solana OS, Superteam Brasil edition)

A fork of [solana-foundation/solana-os](https://github.com/solana-foundation/solana-os)
with the Superteam Brasil brand: palette, logos, boot screen and typefaces. Everything
else (apps, game, mesh, App Store, server) is upstream's and keeps working.

What the edition changes:

| What | Where |
|---|---|
| Palette (Emerald `#008b4c`, Yellow `#ffd23f`, Dark Green `#1b231d`, Off-White `#f5e8ca`) and `OS_NAME` | `main/core/theme.h` |
| Light theme colours | `ui_col()` in `main/core/ui.c` |
| Logos (status bar, boot screen, About) | `tools/brand/` -> `tools/gen_assets.sh` |
| Fonts: Archivo Semi Expanded, Inter, JetBrains Mono (OFL), with Latin-1 accents | `tools/fonts/` -> `tools/gen_assets.sh` |
| Boot screen / About | `os_splash()` in `main/core/os.c`, `main/apps/about/about_app.c` |

The version stays upstream's (`CONFIG_APP_PROJECT_VER`) so the badge server and the
App Store treat the badge as a normal one. Regenerate assets with
`python3 -m venv .venv && .venv/bin/pip install pillow fonttools && sh tools/gen_assets.sh`.

### Build, flash, emulate

```sh
source ~/.espressif/v6.0.1/esp-idf/export.sh     # ESP-IDF v6.0.1 (Python >= 3.10)
idf.py build
idf.py -p /dev/cu.usbserial-XXX -b 460800 flash  # keeps NVS: the badge keeps its ID

# Browser emulator (needs Emscripten and one idf.py build first)
emcmake cmake -S emulator -B emulator/build -DCMAKE_BUILD_TYPE=MinSizeRel -DEMU_OUT_DIR="$PWD/emulator/web"
cmake --build emulator/build -j
cd emulator/web && python3 -m http.server 8787   # open http://127.0.0.1:8787
```

`emulator/web/index.html` is a standalone page for the emulator (screen, buttons,
LEDs, console); upstream's page lives in Solana Foundation's private site repo.
Without that site's server the emulator runs offline: the UI, apps and themes work,
the game's server features don't.

### Superteam Snake (App Store game)

`apps/stbr-snake/`: a snake game that pays DevNet SOL from a Superteam Brasil faucet into
the player's own wallet (cash out from 10 dots, or risk the pot), with its Vercel server.
It runs on any badge, stock or not. See its README; launch steps and what's left:
`apps/stbr-snake/LANCAMENTO.md`. Try it in the local emulator at
`http://127.0.0.1:8787/?app=stbr-snake` (offline there: practice games).

Back to stock firmware: the USB flasher at solana.com/breakpoint/badge/stock.
Don't accept Settings > Software update on a Superteam OS badge unless you want
stock Solana OS back.

---

# Solana OS

Firmware for the Solana Breakpoint 2026 conference badge (ESP32-C5, ILI9341
320x240, microSD, 6 buttons, 8 WS2812s): an app launcher, Wi-Fi, an ESP-NOW
badge-to-badge mesh, the *Hitchhiker's Guide to Solana* game apps and a
sandboxed Lua 5.5 app host. The same sources also build to WebAssembly for a
browser emulator (`emulator/`) and for the store's Lua compiler (`tools/luac/`).

Stack: ESP-IDF v6.0.1, C, LVGL 9, Lua 5.5. What changed in each release: [CHANGELOG.md](CHANGELOG.md).

## Lua apps and memory

The badge has no PSRAM, so a Lua app has to share ~90 KB of free heap with
Wi-Fi, TLS and the mesh. Since 0.5.0:

- Store apps arrive compiled: the App Store compiles them with this firmware's
  own Lua (`tools/luac/`, the same `main/lua/vendor/` built to wasm) and the
  badge runs the bytecode **in place from flash** (`main/lua/lua_xip.c`: slots
  in the otherwise unused `storage` partition, mapped through the flash cache).
  Instructions, line info and long strings never enter the heap and nothing is
  parsed at launch. Bytecode is only ever loaded from a store install whose
  SHA-256 matched; sideloaded apps compile from source.
- Libraries are lazy (`luaL_newlib`, a vendor patch): their tables start empty
  and a function costs RAM only once a script uses it.
- Source is compiled before the libraries are opened, the string table grows
  at two strings per slot, and the collector runs young collections at 10 %
  growth.

Measured on a badge (Lua heap peak, `lua mem`): snake 30.9 KB on 0.4.5, 17.5 KB
on 0.5.0; magic-8 22.8 KB, then 13.6 KB. While snake runs the badge keeps
~15 KB more heap free, and its largest free block doubled (15 KB to 33 KB).

## Build and flash

```sh
source ~/.espressif/v6.0.1/esp-idf/export.sh
idf.py build
idf.py -p /dev/cu.usbserial-110 -b 460800 flash
```

`tools/badge.py` drives the badge's serial console from the host and saves
`shot` screenshots as PNGs (`python3 tools/badge.py --reset "shot"`).

## Layout

| Path | What |
|---|---|
| `components/bsp/` | Board drivers: display, microSD, buttons, RGB LEDs, battery |
| `main/core/` | The OS: app manager, Wi-Fi, mesh, server link, OTA, UI kit |
| `main/apps/` | Built-in apps (one folder each, registered in `apps/registry.c`) |
| `main/game/` | Game services (X Dex, trades, quests) |
| `main/lua/` | Lua host and the vendored Lua 5.5.1 (patches listed in `vendor/LICENSE`) |
| `emulator/` | WebAssembly build of the same firmware |
| `tools/` | Console driver, asset generators, web export, the store's Lua compiler (`luac/`) |

## Part of solana-bp26-badges

This repo is a git submodule (at `firmware/`) of solana-bp26-badges, Solana
Foundation's private repo for the server, website, beacon firmware and the
protocol contracts (`docs/MESH.md`, `server/API.md`). The Lua app API (`docs/LUA_API.md`) lives
here, next to the host that implements it; the site renders it at `/apps/docs`.
So does the quest-building guide (`docs/QUESTS.md`, at `/apps/docs/quests`).
A few tools assume that
layout: `tools/export_web.ts` / `tools/build_web.sh`, `tools/gen_assets.sh`
(brand fonts) and the emulator build (writes to `../web/static/emulator`).
The firmware itself builds standalone.

`sdkconfig.defaults` points the badge at the production server
(`CONFIG_SOLANA_OS_SERVER_URL`); override it there or on the console with
`server <url>`.

## License

MIT (see `LICENSE`), except the fonts and logos in `main/assets/`: the fonts are
rendered from Archivo, Inter and JetBrains Mono (SIL OFL 1.1), and the logos are
Superteam Brasil brand assets. See `LICENSE` for details.
