-- How to play: four short pages. Opens by itself the first time the app runs.
local A = ...
local C = A.C

local PAGES = {
  {title = "Eat the dots", lines = {
    {"Move the snake with the arrows. Each yellow dot adds 0.01 SOL to your pot.", C.off},
    {"Don't hit the walls or your own tail. The snake speeds up as it grows.", C.dim},
  }},
  {title = "Cash out or risk it", lines = {
    {"At 10 dots (0.1 SOL) cash out unlocks. Press SELECT, then Cash out to bank your pot.", C.off},
    {"Or keep going for more. But if the snake dies, you lose the whole pot!", C.yellow},
  }},
  {title = "Your badge wallet", lines = {
    {"Cashed-out SOL goes to your own wallet on Solana DevNet. Up to 0.5 SOL a day.", C.off},
    {"Menu > My wallet: your address, 12 secret words and private key, to import in Phantom.", C.dim},
  }},
  {title = "Send it to your phone", lines = {
    {"1. Phantom: Settings > Developer Settings > Testnet Mode (Solana Devnet).", C.off},
    {"2. Menu > Send to Phantom. Scan the QR code in Phantom and approve.", C.off},
    {"DevNet SOL is test money: no real value. Needs Wi-Fi.", C.dim},
  }},
}

local page, objs, dots = 1, {}, {}

local function add(o) objs[#objs + 1] = o return o end

-- A small picture under the text of the first two pages.
local function picture()
  if page == 1 then
    add(ui.rect(90, 152, 84, 12, {color = C.emerald, radius = 6}))
    add(ui.rect(90, 128, 12, 36, {color = C.emerald, radius = 6}))
    add(ui.rect(164, 151, 14, 14, {color = C.head, radius = 5}))
    add(ui.rect(214, 153, 10, 10, {color = C.yellow, radius = 5}))
    add(ui.label(204, 132, "+0.01", {size = 12, color = C.yellow}))
  elseif page == 2 then
    -- The pot: nothing to win under the line, everything at risk above it.
    add(ui.rect(20, 152, 280, 12, {color = C.panel, radius = 6}))
    add(ui.rect(20, 152, 112, 12, {color = C.green, radius = 6}))
    add(ui.rect(132, 152, 168, 12, {color = C.yellow, radius = 6}))
    add(ui.rect(131, 144, 3, 28, {color = C.off}))
    add(ui.label(20, 170, "0", {size = 12, color = C.dim}))
    add(ui.label(104, 128, "0.1 SOL", {size = 12, color = C.off}))
    add(ui.label(200, 170, "cash out zone", {size = 12, color = C.yellow}))
  end
end

local function show()
  for _, o in ipairs(objs) do o:remove() end
  objs = {}
  local p = PAGES[page]
  add(ui.label(12, 6, p.title, {size = 20, color = C.yellow}))
  local y = 38
  for _, l in ipairs(p.lines) do
    add(ui.label(12, y, l[1], {size = 14, color = l[2], w = ui.W - 24}))
    y = y + (#l[1] > 84 and 64 or 44)
  end
  picture()
  for i, d in ipairs(dots) do d:color(i == page and C.yellow or C.panel) end
  add(A.hint(page < #PAGES and "SELECT next   LEFT back   CANCEL menu" or "SELECT play!   LEFT back   CANCEL menu"))
end

local M = {}

function M.enter()
  storage.set("guided", true)
  for i = 1, #PAGES do dots[i] = ui.rect(ui.W - 16 - (#PAGES - i) * 14, 12, 8, 8, {radius = 4}) end
  show()
end

function M.key(k)
  if k == "back" then A.show("menu")
  elseif k == "select" or k == "right" then
    if page < #PAGES then page = page + 1 show()
    elseif k == "select" then A.show("game") end
  elseif k == "left" and page > 1 then page = page - 1 show()
  end
  return true
end

return M
