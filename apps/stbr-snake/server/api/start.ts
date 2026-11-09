// POST /api/start (badge): a game begins. The session dates it, so a score can be checked
// against how long the game took.

import { randomBytes } from 'node:crypto';
import { config } from '../lib/config.js';
import { badgeRoute, json, today } from '../lib/http.js';
import { getStore } from '../lib/store.js';

export const POST = badgeRoute(async ({ user, badge }) => {
  const store = getStore();
  const session = randomBytes(12).toString('base64url');
  await store.set(`sess:${session}`, JSON.stringify({ user, badge, t: Date.now() }), 3600);
  const paid = Number((await store.get(`paid:${user}:${today()}`)) ?? 0);
  return json({ session, perPoint: config.lamportsPerPoint, minPoints: config.minPoints, remaining: Math.max(0, config.dailyCapLamports - paid) });
});
