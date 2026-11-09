// POST /api/sweep (badge): a Solana Pay link for the badge to show as a QR code. The phone
// wallet that scans it gets everything in the player's badge wallet.

import { randomBytes } from 'node:crypto';
import { config } from '../lib/config.js';
import { publicUrl } from '../lib/badge.js';
import { badgeRoute, json } from '../lib/http.js';
import { getStore } from '../lib/store.js';

export const POST = (req: Request) =>
  badgeRoute(async ({ user }) => {
    const id = randomBytes(9).toString('base64url');
    await getStore().set(`sweep:${id}`, user, 600);
    const origin = config.origin || new URL(publicUrl(req)).origin;
    return json({ url: `solana:${origin}/api/tx/${id}` });
  })(req);
