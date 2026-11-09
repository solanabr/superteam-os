// POST /api/wallet (badge): the player's DevNet wallet, for the badge to keep and show.

import { config } from '../lib/config.js';
import { badgeRoute, json, today } from '../lib/http.js';
import { getStore } from '../lib/store.js';
import { exportKey, playerWallet } from '../lib/wallets.js';

export const POST = badgeRoute(async ({ user }) => {
  const w = playerWallet(user);
  const paid = Number((await getStore().get(`paid:${user}:${today()}`)) ?? 0);
  return json({
    address: w.keypair.publicKey.toBase58(),
    mnemonic: w.mnemonic,
    secret: exportKey(w.keypair),
    perPoint: config.lamportsPerPoint,
    minPoints: config.minPoints,
    remaining: Math.max(0, config.dailyCapLamports - paid),
  });
});
