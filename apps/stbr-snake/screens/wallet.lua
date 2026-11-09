-- My wallet: the address (and balance), the recovery phrase, the private key.
local A = ...
local C, sol = A.C, A.sol

local PAGES = {"Address", "Recovery phrase", "Private key"}
local w = {page = 1, objs = {}}

local function add(o) w.objs[#w.objs + 1] = o return o end

local function page()
  for _, o in ipairs(w.objs) do o:remove() end
  w.objs, w.bal = {}, nil
  local wallet = A.wallet
  w.title:text(PAGES[w.page] .. "  " .. w.page .. "/" .. #PAGES)
  if w.page == 1 then
    w.qr:text(wallet.address)
    w.qr:show(true)
    add(ui.label(172, 30, "DevNet balance", {size = 12, color = C.dim}))
    w.bal = add(ui.label(172, 46, (A.balance and sol(A.balance) or "...") .. " SOL", {size = 20, color = C.yellow, w = 140}))
    local a = wallet.address
    add(ui.label(172, 80, a:sub(1, 15) .. "\n" .. a:sub(16, 30) .. "\n" .. a:sub(31), {size = 12, color = C.off, w = 140}))
    add(ui.label(172, 134, "Your badge wallet on Solana DevNet.", {size = 12, color = C.dim, w = 140}))
  elseif w.page == 2 then
    w.qr:show(false)
    local i = 0
    for word in wallet.mnemonic:gmatch("%S+") do
      local col, row = i // 6, i % 6
      i = i + 1
      add(ui.label(24 + col * 150, 30 + row * 20, string.format("%2d  %s", i, word), {size = 14, color = C.off}))
    end
    add(ui.label(12, 160, "Phantom: Add wallet > Recovery phrase\nKeep them secret: they are the wallet.",
      {size = 12, color = C.dim, w = ui.W - 24}))
  else
    w.qr:text(wallet.secret)
    w.qr:show(true)
    add(ui.label(172, 30, "Scan with your phone camera, copy it, and paste it in Phantom:", {size = 12, color = C.off, w = 140}))
    add(ui.label(172, 106, "Add wallet > Import private key", {size = 12, color = C.yellow, w = 140}))
    add(ui.label(172, 142, "Keep it secret. DevNet test wallet.", {size = 12, color = C.dim, w = 140}))
  end
end

local M = {}

function M.enter()
  if not A.wallet then
    w.retry = true
    ui.label(16, 50, "No wallet yet", {size = 20, color = C.yellow, w = ui.W - 32, align = "center"})
    local sub = ui.label(16, 84, badge.online() and "Asking the server..." or "Turn on Wi-Fi (Settings), then try again.",
      {size = 14, color = C.off, w = ui.W - 32, align = "center"})
    A.hint("SELECT retry   CANCEL menu")
    if badge.online() then
      A.fetchWallet(A.later(function(ok, r)
        if ok then A.show("wallet") else sub:text("Could not get it: " .. tostring(r)) end
      end))
    end
    return
  end
  w.title = ui.label(12, 6, "", {size = 14, color = C.yellow})
  w.qr = ui.qr(10, 28, 150, A.wallet.address)
  A.hint("LEFT/RIGHT page   CANCEL menu")
  page()
  A.fetchBalance(A.later(function(ok)
    if ok and w.bal then w.bal:text(sol(A.balance) .. " SOL") end
  end))
end

function M.key(k)
  if k == "back" then A.show("menu") return true end
  if w.retry then
    if k == "select" then A.show("wallet") end
    return true
  end
  local to = w.page + ((k == "right" and 1) or (k == "left" and -1) or 0)
  if to < 1 or to > #PAGES or to == w.page then return true end
  if to > 1 and not A.revealed then
    ui.confirm("Show your secret keys? Anyone who sees them can take this wallet's SOL.", A.later(function(yes)
      if yes then A.revealed = true w.page = to page() end
    end))
    return true
  end
  w.page = to
  page()
  return true
end

return M
