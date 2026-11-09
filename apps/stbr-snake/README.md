# Superteam Snake

A badge game for the App Store: eat the yellow dots, earn DevNet SOL from the Superteam
Brasil faucet. Each dot puts 0.01 SOL in the pot. From 10 dots (0.1 SOL) the player can
cash out from the pause menu (SELECT), into their own DevNet wallet, up to 0.5 SOL a day;
or keep going for more. If the snake dies, the pot is gone.

The badge keeps that wallet's recovery phrase and private key (My wallet: import them
into Phantom), and Send to Phantom moves everything to the phone with one QR code (a
Solana Pay transaction request).

DevNet SOL is test money: it has no value. The app runs on any badge with Solana OS
0.5.3 or later (stock or Superteam OS) and draws in the Superteam Brasil palette
whatever the theme.

```
main.lua            state, server calls, the screen switcher
screens/*.lua       menu, game, wallet, send, help (the how-to-play guide): one file per
                    screen, loaded when it opens
app.json            the manifest (permissions led, http, rpc; host stbr-snake.vercel.app)
server/             the faucet: Vercel functions
```

## How the money moves

```
badge ──http──▶ badge server ──signed X-Badge-* headers──▶ server/ (Vercel)
                                                             │ checks the signature, the session,
                                                             │ the score's pace and the daily limit
                                                             ▼
                                   faucet wallet ──transfer──▶ player's DevNet wallet
```

- **Faucet wallet**: `3Q8wJvSvnMuzsJXAx3CgfWj2UgrFbMedm4n1NBEjxrA9` (DevNet). Its key lives only
  in the server's `TREASURY_SECRET`: anyone who installs an app can read its code.
- **Player wallet**: derived from `PLAYER_KEY_SECRET` and the player's account id (the
  badge server's `X-Badge-User`), as a 12-word phrase that Phantom imports
  (`m/44'/501'/0'/0'`). Same player, same wallet, on any badge; the server stores no
  keys. The badge keeps a copy in the app's `storage`.
- **Limits**: a game pays only from `MIN_POINTS` dots (10) on; it is a session
  (`/api/start`, `/api/finish`, used once); a score faster
  than one dot per 350 ms is cut down; 0.5 SOL per player per UTC day, enforced in Redis.
- **Send to Phantom**: `/api/sweep` makes a `solana:https://…/api/tx/<id>` link (10 min).
  The wallet that scans it gets a transaction moving the whole badge-wallet balance to
  itself, with the fee paid by the badge wallet and signed by the server; the phone signs
  a memo, approves and sends it.

The Solana OS docs say not to keep keys on a badge (the microSD card reads on any
computer). That's why this is a DevNet-only, test-money wallet, and why the screens say so.

## Server

```sh
cd server
npm install
npm test          # offline: signatures, wallet derivation vs. Phantom's, limits, payouts, sweep
```

Deploy on Vercel with **Root Directory** `apps/stbr-snake/server`, and:

| Variable | What |
|---|---|
| `TREASURY_SECRET` | the faucet keypair: the Solana CLI JSON array (or base58) |
| `PLAYER_KEY_SECRET` | random, ≥ 32 bytes. Changing it gives every player a new, empty wallet |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (Vercel Marketplace > Upstash) |
| `PUBLIC_ORIGIN` | `https://stbr-snake.vercel.app` (the URL the badge calls) |
| `SOLANA_RPC_URL` | optional; a DevNet RPC with room (Helius, Triton). Default: the public one |
| `LAMPORTS_PER_POINT`, `DAILY_CAP_LAMPORTS`, `MIN_POINTS`, `MIN_MS_PER_POINT`, `ALLOW_EMULATOR` | optional |

`GET /api/status` shows the faucet's address and balance.

If the project gets another domain, change `SERVER` in `main.lua` and `hosts` in `app.json`.

## Badge app

Publish on the App Store (`/apps/submit` on the badge site, an account with X linked):
upload this folder without `server/` and `README.md`. **Try in emulator** and **Run on
badge** there start a 12-hour test run, so `http` and `rpc` work before the app is in the
store. Compiled on the badge (a test run) the app peaks near the 48 KB heap; from the
store it runs from flash and uses much less.
