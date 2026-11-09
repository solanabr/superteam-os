-- The game: a snake on a 22 x 12 grid. Each dot puts 0.01 SOL in the pot; the player
-- cashes out from the pause menu (from 10 dots on) or dies and loses the pot.
local A = ...
local C, sol = A.C, A.sol

local CELL, COLS, ROWS = 14, 22, 12
local X0, Y0 = 6, 26                    -- the field's top-left corner on screen
local POOL = 36                         -- rects for the body: one per straight run
local DIRS = {up = {0, -1}, down = {0, 1}, left = {-1, 0}, right = {1, 0}}
local g

local function free(x, y) return not g.occ[y * COLS + x] end

local function placeFood()
  local x, y
  for _ = 1, 60 do
    x, y = math.random(0, COLS - 1), math.random(0, ROWS - 1)
    if free(x, y) then break end
  end
  if not free(x, y) then                -- nearly full: take the first free cell
    for i = 0, COLS * ROWS - 1 do
      if not g.occ[i] then x, y = i % COLS, i // COLS break end
    end
  end
  g.food = {x, y}
  g.foodRect:pos(X0 + x * CELL + 2, Y0 + y * CELL + 2)
end

-- One rounded bar per straight run of the body; neighbouring runs share their corner cell.
local function bar(n, a, c)
  local r = g.pool[n]
  if not r then return end
  local x1, x2 = math.min(a[1], c[1]), math.max(a[1], c[1])
  local y1, y2 = math.min(a[2], c[2]), math.max(a[2], c[2])
  r:pos(X0 + x1 * CELL + 2, Y0 + y1 * CELL + 2)
  r:size((x2 - x1 + 1) * CELL - 4, (y2 - y1 + 1) * CELL - 4)
  r:show(true)
end

local function render()
  local b, n, used, i = g.body, #g.body, 0, 1
  while i < n do
    local dx, dy = b[i + 1][1] - b[i][1], b[i + 1][2] - b[i][2]
    local j = i + 1
    while j < n and b[j + 1][1] - b[j][1] == dx and b[j + 1][2] - b[j][2] == dy do j = j + 1 end
    used = used + 1
    bar(used, b[i], b[j])
    i = j
  end
  for k = used + 1, math.min(g.shown, POOL) do g.pool[k]:show(false) end
  g.shown = used
  local hx, hy = X0 + b[1][1] * CELL, Y0 + b[1][2] * CELL
  g.head:pos(hx + 1, hy + 1)
  local d = g.dir                       -- the eyes look where the snake goes
  local ex, ey = hx + 5 + d[1] * 2, hy + 5 + d[2] * 2
  if d[1] ~= 0 then g.eye1:pos(ex, ey - 3) g.eye2:pos(ex, ey + 3)
  else g.eye1:pos(ex - 3, ey) g.eye2:pos(ex + 3, ey) end
end

-- The pot: what the dots are worth, within what the player can still earn today.
local function pot()
  return math.min(g.points, (A.remaining or A.dailyCap) // A.perPoint) * A.perPoint
end
local function unlocked() return g.points >= A.minPoints end
local function maxed() return A.remaining and pot() >= A.remaining end

local function hud()
  g.score:text(g.points .. (g.points == 1 and " dot" or " dots"))
  if not unlocked() then
    g.sol:color(C.dim)
    g.sol:text("pot " .. sol(pot()) .. " / " .. sol(A.minPoints * A.perPoint))
  else
    g.sol:color(C.yellow)
    g.sol:text("POT " .. sol(pot()) .. (maxed() and " MAX" or " SOL"))
  end
end

-- LEDs: emerald ones fill up on the way to the cash-out line, then all yellow (at risk).
local function meter()
  if g.over then return end
  if unlocked() then A.leds(maxed() and C.yellow or C.green) return end
  local lit = g.points * led.count // A.minPoints
  for i = 1, led.count do
    if i <= lit then led.set(i, 0x00, 0x8B, 0x4C) else led.set(i, 0, 0, 0) end
  end
end

local function infoText()
  if g.paused then return "PAUSED" end
  if unlocked() and g.session then return maxed() and "daily max: cash out!" or "SELECT cash out" end
  return g.status or ""
end

local function celebrate()                -- Emerald to Yellow, one LED at a time (one timer:
  local t, i, id = A.token, 0, nil        -- an app has 8 at most)
  id = timer.every(70, function()
    i = i + 1
    if A.token ~= t or i > led.count then
      timer.cancel(id)
      if A.token == t then timer.after(1500, A.later(led.off)) end
      return
    end
    local f = i / led.count
    led.set(i, math.floor(0xFF * f), math.floor(0x8B + (0xD2 - 0x8B) * f), math.floor(0x4C + (0x3F - 0x4C) * f))
  end)
end

local function closeMenu()
  for _, o in ipairs(g.menu or {}) do o:remove() end
  g.menu, g.opts = nil, nil
end

-- how: "dead" (the pot is lost), "cashout" (the pot is paid) or "quit" (lost too).
local function finish(how)
  closeMenu()
  g.over, g.paused = true, false
  led.off()
  g.info:text("")
  if g.points > A.best then A.best = g.points storage.set("best", A.best) end
  local title = how == "cashout" and "CASHED OUT" or (how == "quit" and "YOU LEFT" or "GAME OVER")
  ui.rect(40, 50, 240, 118, {color = C.panel, radius = 12, border = how == "cashout" and C.yellow or C.emerald})
  ui.label(40, 60, title, {size = 20, color = how == "cashout" and C.yellow or C.off, w = 240, align = "center"})
  ui.label(40, 88, g.points .. " dots   best " .. A.best, {size = 14, color = C.off, w = 240, align = "center"})
  local msg = ui.label(48, 110, "", {size = 14, color = C.off, w = 224, align = "center"})
  ui.label(40, 146, "SELECT again   CANCEL menu", {size = 12, color = C.dim, w = 240, align = "center"})
  if how ~= "cashout" then
    if g.points == 0 then msg:text("Eat dots to fill the pot!")
    elseif not unlocked() then msg:text("Pot under " .. sol(A.minPoints * A.perPoint) .. " SOL: nothing paid")
    else
      msg:color(C.warn)
      msg:text("You lost " .. sol(pot()) .. " SOL!")
      A.leds(C.warn)
      timer.after(500, A.later(led.off))
    end
    return
  end
  if not g.session then
    msg:text(g.offline and "Offline: practice game, not paid" or "Not on the server: not paid")
    return
  end
  msg:text("Sending " .. sol(pot()) .. " SOL...")
  A.post("/api/finish", {session = g.session, points = g.points}, A.later(function(ok, r)
    if not ok then
      msg:color(C.warn)
      msg:text(r == "faucet empty" and "The faucet is empty, sorry!" or ("Not paid: " .. tostring(r)))
      return
    end
    A.remaining = r.remaining
    if (r.lamports or 0) == 0 then
      msg:text(r.below and "Under the cash-out line: not paid" or "Daily limit reached: back tomorrow!")
      return
    end
    msg:color(C.yellow)
    msg:text("+" .. sol(r.lamports) .. " SOL sent to your wallet!" .. (r.capped and " (daily limit)" or ""))
    celebrate()
    if not A.wallet then A.fetchWallet() end
  end))
end

-- The pause menu: keep playing, cash out (from the line on), or quit.
local function drawMenu()
  for i, o in ipairs(g.opts) do
    local on = i == g.sel
    o.box:color(on and (o.ok and C.yellow or C.line) or C.field)
    o.text:color(on and o.ok and C.bg or (o.ok and C.off or C.dim))
  end
end

local function openMenu()
  g.paused, g.sel = true, 1
  g.info:text(infoText())
  local m = {}
  local function add(o) m[#m + 1] = o return o end
  add(ui.rect(50, 44, 220, 140, {color = C.panel, radius = 12, border = C.emerald}))
  add(ui.label(50, 52, "PAUSED", {size = 14, color = C.dim, w = 220, align = "center"}))
  add(ui.label(50, 70, "pot " .. sol(pot()) .. " SOL", {size = 20, color = unlocked() and C.yellow or C.dim, w = 220, align = "center"}))
  local cash = unlocked() and ("Cash out " .. sol(pot()) .. " SOL") or ("Cash out at " .. A.minPoints .. " dots")
  local names = {"Keep playing", cash, unlocked() and "Quit and lose the pot" or "Quit"}
  g.opts = {}
  for i, name in ipairs(names) do
    local y = 100 + (i - 1) * 27
    g.opts[i] = {ok = i ~= 2 or (unlocked() and g.session ~= nil),
      box = add(ui.rect(62, y, 196, 23, {radius = 7})), text = add(ui.label(62, y + 3, name, {size = 14, w = 196, align = "center"}))}
  end
  if unlocked() and not g.session then g.opts[2].text:text("Offline: can't cash out") end
  g.menu = m
  drawMenu()
end

local function menuKey(k)
  if k == "up" then g.sel = (g.sel - 2) % #g.opts + 1 drawMenu()
  elseif k == "down" then g.sel = g.sel % #g.opts + 1 drawMenu()
  elseif k == "back" or (k == "select" and g.sel == 1) then
    closeMenu()
    g.paused = false
    g.info:text(infoText())
    meter()
  elseif k == "select" and g.opts[g.sel].ok then
    finish(g.sel == 2 and "cashout" or "quit")
  end
end

local function step()
  if #g.queue > 0 then g.dir = table.remove(g.queue, 1) end
  local h = g.body[1]
  local nx, ny = h[1] + g.dir[1], h[2] + g.dir[2]
  local eats = g.food[1] == nx and g.food[2] == ny
  local tail = g.body[#g.body]
  if not eats then g.occ[tail[2] * COLS + tail[1]] = nil end   -- the tail moves out of the way
  if nx < 0 or ny < 0 or nx >= COLS or ny >= ROWS or not free(nx, ny) then
    if not eats then g.occ[tail[2] * COLS + tail[1]] = true end
    return finish("dead")
  end
  table.insert(g.body, 1, {nx, ny})
  g.occ[ny * COLS + nx] = true
  if eats then
    g.points = g.points + 1
    g.every = math.max(80, 170 - g.points * 3)
    hud()
    if g.points == A.minPoints then              -- the cash-out line: say so for 2.5 s
      g.info:color(C.yellow)
      g.info:text("CASH OUT UNLOCKED!")
      timer.after(2500, A.later(function() g.info:color(C.dim) if not g.paused then g.info:text(infoText()) end end))
    end
    A.leds(C.yellow)
    timer.after(90, A.later(meter))
    placeFood()
  else
    table.remove(g.body)
  end
  render()
end

local M = {}

function M.enter()
  g = {points = 0, every = 170, acc = 0, queue = {}, dir = {1, 0}, occ = {}, shown = 0, pool = {}, body = {}}
  ui.rect(0, 0, ui.W, 22, {color = C.panel})
  g.score = ui.label(8, 3, "", {size = 14, color = C.off})
  g.sol = ui.label(80, 3, "", {size = 14, color = C.yellow})
  g.info = ui.label(0, 5, "", {size = 12, color = C.dim, w = ui.W - 8, align = "right"})
  ui.rect(X0 - 2, Y0 - 2, COLS * CELL + 4, ROWS * CELL + 4, {color = C.field, radius = 4, border = C.green})
  g.foodRect = ui.rect(0, 0, CELL - 4, CELL - 4, {color = C.yellow, radius = 5})
  for i = 1, POOL do
    g.pool[i] = ui.rect(0, 0, 1, 1, {color = C.emerald, radius = 5})
    g.pool[i]:show(false)
  end
  g.head = ui.rect(0, 0, CELL - 2, CELL - 2, {color = C.head, radius = 5})
  g.eye1 = ui.rect(0, 0, 3, 3, {color = C.bg})
  g.eye2 = ui.rect(0, 0, 3, 3, {color = C.bg})
  A.hint("ARROWS move   SELECT pause / cash out")
  for i = 3, 0, -1 do
    g.body[#g.body + 1] = {4 + i, 6}
    g.occ[6 * COLS + 4 + i] = true
  end
  placeFood()
  render()
  hud()
  -- The server dates the game, so it can tell a real score; without it the game is practice.
  g.offline = not badge.online()
  g.status = g.offline and "offline: practice" or "connecting..."
  g.info:text(infoText())
  A.post("/api/start", {}, A.later(function(ok, r)
    if ok and r.session then
      g.session, A.perPoint, A.remaining = r.session, r.perPoint or A.perPoint, r.remaining
      A.minPoints = r.minPoints or A.minPoints
      g.status = "today " .. sol(A.remaining) .. " left"
      hud()
    else
      g.offline = r == "offline"
      g.status = g.offline and "offline: practice" or "server: " .. tostring(r)
    end
    g.info:text(infoText())
  end))
end

function M.key(k)
  if g.over then
    if k == "select" then A.restart() elseif k == "back" then A.show("menu") end
  elseif g.menu then
    menuKey(k)
  elseif k == "select" or k == "back" then
    openMenu()
  else
    local d = DIRS[k]
    if d and #g.queue < 2 then
      local last = g.queue[#g.queue] or g.dir
      if d[1] ~= -last[1] and d[2] ~= -last[2] and (d[1] ~= last[1] or d[2] ~= last[2]) then
        g.queue[#g.queue + 1] = d
      end
    end
  end
  return true
end

function M.tick(ms)
  if g.over or g.paused then return end
  g.acc = g.acc + ms
  if g.acc >= g.every then
    g.acc = math.min(g.acc - g.every, g.every)
    step()
  end
end

return M
