// POST /api/finish {session, points} (badge): the player cashed out; the faucet pays for the dots
// (from MIN_POINTS on), up to the player's daily limit. A game that died never calls this.

import { config } from '../lib/config.js';
import { badgeRoute, json, today } from '../lib/http.js';
import { pay } from '../lib/solana.js';
import { getStore } from '../lib/store.js';
import { playerWallet, treasuryWallet } from '../lib/wallets.js';

const DAY = 2 * 86_400;

export const POST = badgeRoute(async ({ user, badge }, body) => {
  const store = getStore();
  const raw = typeof body.session === 'string' ? await store.take(`sess:${body.session}`) : null;
  const sess = raw ? (JSON.parse(raw) as { user: string; t: number }) : null;
  if (!sess || sess.user !== user) return json({ error: 'no such game' }, 400);

  // A score can't come faster than the snake can reach the dots.
  const claimed = Math.floor(Number(body.points));
  if (!Number.isFinite(claimed) || claimed < 0) return json({ error: 'bad points' }, 400);
  const fastest = config.minMsPerPoint ? Math.floor((Date.now() - sess.t) / config.minMsPerPoint) : Infinity;
  const points = Math.min(claimed, fastest, 10_000);

  const key = `paid:${user}:${today()}`;
  const want = points * config.lamportsPerPoint;
  // Under the cash-out line a game pays nothing (the badge only cashes out from there).
  if (want === 0 || points < config.minPoints) {
    const paid = Number((await store.get(key)) ?? 0);
    return json({ points, lamports: 0, below: points < config.minPoints, remaining: Math.max(0, config.dailyCapLamports - paid) });
  }
  // Reserve first, so two games ending at once can't both pass the limit.
  const total = await store.add(key, want, DAY);
  const over = Math.max(0, total - config.dailyCapLamports);
  const lamports = Math.max(0, want - over);
  if (want - lamports > 0) await store.add(key, -(want - lamports), DAY);
  if (lamports === 0) return json({ points, lamports: 0, remaining: 0, capped: true });

  try {
    const signature = await pay(treasuryWallet(), playerWallet(user).keypair.publicKey, lamports,
      `Superteam Snake: ${points} dots, badge ${badge}`);
    return json({ points, lamports, signature, remaining: Math.max(0, config.dailyCapLamports - total + over), capped: lamports < want });
  } catch (e) {
    await store.add(key, -lamports, DAY); // not paid: give the allowance back
    console.error('payout failed', e);
    const empty = /insufficient|0x1\b|no record of a prior credit/i.test(String(e));
    return json({ error: empty ? 'faucet empty' : 'payout failed' }, 503);
  }
});
