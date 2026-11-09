-- Superteam Snake: eat the yellow dots, earn DevNet SOL from the Superteam Brasil faucet.
--
-- Each dot puts 0.01 SOL in the pot. From 10 dots on the player can cash out (paid into
-- their own DevNet wallet, up to 0.5 SOL a day) or keep going: dying loses the pot.
-- The badge keeps that wallet's recovery phrase and private key (My wallet), and Send
-- to Phantom moves everything to the phone with one QR code.
-- DevNet SOL is test money. The server is in server/ (Vercel).
--
-- Each screen is its own file in screens/, loaded when it opens and dropped when it
-- closes, so the app fits the 48 KB heap even when the badge compiles it from source.
-- Texts are ASCII: the stock Solana OS fonts have no accents.

local A = {
  SERVER = "https://stbr-snake.vercel.app",
  -- Superteam Brasil palette, fixed so the game looks the same on any badge and theme.
  C = {
    bg = 0x1B231D, panel = 0x243029, line = 0x3B4C40, field = 0x202A23, emerald = 0x008B4C, head = 0x00B862,
    yellow = 0xFFD23F, green = 0x306C40, off = 0xF5E8CA, dim = 0xA39E86, warn = 0xFF754A,
  },
  wallet = storage.get("wallet"),        -- {address=, mnemonic=, secret=} once the server sent it
  best = storage.get("best") or 0,
  perPoint = 10000000,                   -- lamports a dot (the server says): 0.01 SOL
  dailyCap = 500000000,                  -- until the server says how much is left today
  minPoints = 10,                        -- dots before the pot can be cashed out (the server says)
  remaining = nil,                       -- lamports the player can still earn today
  balance = nil,                         -- the wallet's DevNet balance, as rpc gives it
  token = 0,                             -- changes with every screen, so late answers are dropped
}

-- 5000000000 or "5000000000" lamports -> "5"; 120000000 -> "0.12" (docs/LUA_API.md, rpc)
function A.sol(lamports)
  local s = string.rep("0", 10) .. tostring(lamports)
  local whole = s:sub(1, -10):gsub("^0+", "")
  local frac = s:sub(-9):gsub("0+$", "")
  return (whole == "" and "0" or whole) .. (frac ~= "" and "." .. frac or "")
end

-- POST to our server; cb(true, decoded answer) or cb(false, why).
function A.post(path, body, cb)
  if not badge.online() then cb(false, "offline") return end
  http.post(A.SERVER .. path, body or {}, function(ok, res)
    if not ok then cb(false, res) return end
    local data = json.decode(res.body or "") or {}
    if res.status ~= 200 then cb(false, data.error or ("server " .. res.status)) return end
    cb(true, data)
  end)
end

function A.fetchWallet(done)
  A.post("/api/wallet", {}, function(ok, r)
    if ok and r.address then
      A.wallet = {address = r.address, mnemonic = r.mnemonic, secret = r.secret}
      storage.set("wallet", A.wallet)
      A.perPoint, A.remaining = r.perPoint or A.perPoint, r.remaining
    end
    if done then done(ok, r) end
  end)
end

function A.fetchBalance(done)
  if not (A.wallet and badge.online()) then if done then done(false) end return end
  rpc.call("getBalance", {A.wallet.address, {commitment = "confirmed"}}, {cluster = "devnet"}, function(ok, r)
    if ok then A.balance = r.value end
    if done then done(ok) end
  end)
end

function A.leds(c)
  led.fill((c >> 16) & 255, (c >> 8) & 255, c & 255)
end

function A.hint(text)
  return ui.label(0, ui.H - 16, text, {size = 12, color = A.C.dim, w = ui.W, align = "center"})
end

-- Runs fn later only if the player is still on the same screen.
function A.later(fn)
  local t = A.token
  return function(...) if A.token == t then return fn(...) end end
end

local screen, pending

-- Swaps screens from a timer, not from inside the old screen's own key handler or callback:
-- while that handler is running its file's code and data stay alive, and compiling the
-- next screen next to them can run out of heap.
local function switch()
  local name = pending
  pending = nil
  if screen and screen.leave then screen.leave() end
  screen = nil
  A.token = A.token + 1
  led.off()
  ui.clear()
  ui.bg(A.C.bg)
  local chunk, err = fs.load("screens/" .. name .. ".lua")
  if not chunk then error(err) end
  screen = chunk(A)
  screen.enter()
end

function A.show(name)
  if not pending then timer.after(20, switch) end
  pending = name
end

-- The same screen again from the start, without compiling its file again (a game's "play
-- again").
function A.restart()
  A.token = A.token + 1
  led.off()
  ui.clear()
  ui.bg(A.C.bg)
  screen.enter()
end

function on_key(k, rep)
  if not screen or pending then return true end
  if rep and k ~= "up" and k ~= "down" then return true end
  return screen.key(k)
end

function on_tick(ms)
  if screen and not pending and screen.tick then screen.tick(ms) end
end

function on_exit()
  led.off()
end

-- The guide the first time, the menu after that.
pending = storage.get("guided") and "menu" or "help"
switch()
