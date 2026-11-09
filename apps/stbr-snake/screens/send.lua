-- Send to Phantom: a Solana Pay QR code. The phone wallet that scans it gets everything
-- in the badge wallet (the server builds the transaction; the phone approves it).
local A = ...
local C, sol = A.C, A.sol
local s = {}

local function amount() return tonumber(tostring(A.balance)) or 0 end

local function watch()
  A.fetchBalance(A.later(function(ok)
    if not ok or amount() >= s.start // 2 then return end
    timer.cancel(s.poll)
    s.poll = nil
    s.status:color(C.yellow)
    s.status:text("Sent! Open Phantom (Devnet) to see it.")
    A.leds(C.emerald)
    timer.after(1200, A.later(led.off))
  end))
end

local function showQr(url)
  s.msg:remove()
  ui.qr(8, 26, 176, url)
  ui.label(194, 26, sol(A.balance) .. " SOL", {size = 20, color = C.yellow, w = 120})
  ui.label(194, 54, "1. Phantom: Settings > Developer Settings > Testnet Mode (Devnet)", {size = 12, color = C.off, w = 120})
  ui.label(194, 128, "2. Scan in Phantom and approve", {size = 12, color = C.off, w = 120})
  s.status = ui.label(194, 168, "Waiting...", {size = 12, color = C.dim, w = 120})
  s.poll = timer.every(3000, A.later(watch))
end

local M = {}

function M.enter()
  ui.label(12, 6, "Send to Phantom", {size = 14, color = C.yellow})
  s.msg = ui.label(16, 60, "Checking your balance...", {size = 14, color = C.off, w = ui.W - 32, align = "center"})
  A.hint("CANCEL menu")
  if not A.wallet then s.msg:text("No wallet yet: play a game first.") return end
  if not badge.online() then s.msg:text("Offline: turn on Wi-Fi in Settings.") return end
  A.fetchBalance(A.later(function(ok)
    if not ok then s.msg:text("Could not read the balance. Try again.") return end
    s.start = amount()
    if s.start <= 10000 then s.msg:text("Your badge wallet is empty: play to earn DevNet SOL!") return end
    s.msg:text("Making the QR code...")
    A.post("/api/sweep", {}, A.later(function(ok2, r)
      if ok2 and r.url then showQr(r.url) else s.msg:text("Server said: " .. tostring(r)) end
    end))
  end))
end

function M.key(k)
  if k == "back" then A.show("menu") end
  return true
end

function M.leave()
  if s.poll then timer.cancel(s.poll) end
end

return M
