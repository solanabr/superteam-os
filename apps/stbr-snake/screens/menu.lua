-- The main menu.
local A = ...
local C, sol = A.C, A.sol

local NAMES = {"Play", "My wallet", "Send to Phantom", "How to play"}
local GO = {"game", "wallet", "send", "help"}
local items, status = {}, nil
A.menuSel = A.menuSel or 1

local function draw()
  for i, it in ipairs(items) do
    local on = i == A.menuSel
    it.box:color(on and C.yellow or C.panel)
    it.text:color(on and C.bg or C.off)
  end
end

local function showStatus()
  local parts = {}
  if A.wallet then parts[#parts + 1] = "Wallet " .. (A.balance and sol(A.balance) or "...") .. " SOL" end
  if A.remaining then parts[#parts + 1] = "today " .. sol(A.remaining) .. " left" end
  if not badge.online() then parts[#parts + 1] = "offline: Wi-Fi to earn" end
  status:text(#parts > 0 and table.concat(parts, "  |  ") or "DevNet SOL faucet")
end

local M = {}

function M.enter()
  ui.label(16, 6, "SNAKE", {size = 32, color = C.yellow})
  ui.label(18, 44, "by Superteam Brasil", {size = 14, color = C.off})
  -- A little snake chasing a dot, top right.
  ui.rect(196, 28, 70, 10, {color = C.emerald, radius = 5})
  ui.rect(196, 14, 10, 24, {color = C.emerald, radius = 5})
  ui.rect(256, 26, 14, 14, {color = C.head, radius = 5})
  ui.rect(286, 28, 10, 10, {color = C.yellow, radius = 5})
  for i, name in ipairs(NAMES) do
    local y = 72 + (i - 1) * 27
    items[i] = {box = ui.rect(16, y, ui.W - 32, 23, {radius = 7}), text = ui.label(30, y + 3, name, {size = 14})}
  end
  draw()
  status = ui.label(0, 182, "", {size = 12, color = C.dim, w = ui.W, align = "center"})
  A.hint("SELECT choose   CANCEL exit")
  showStatus()
  local refresh = A.later(showStatus)
  if A.wallet then
    A.fetchBalance(refresh)
  else
    A.fetchWallet(A.later(function() showStatus() A.fetchBalance(refresh) end))
  end
end

function M.key(k)
  if k == "up" then A.menuSel = (A.menuSel - 2) % #NAMES + 1 draw()
  elseif k == "down" then A.menuSel = A.menuSel % #NAMES + 1 draw()
  elseif k == "select" then A.show(GO[A.menuSel])
  elseif k == "back" then return false end
  return true
end

return M
