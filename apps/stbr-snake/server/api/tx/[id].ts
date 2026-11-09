// /api/tx/<id>: the Solana Pay transaction request behind a sweep QR code. The wallet GETs
// the label and icon, then POSTs its account and gets the transaction to approve.

import { PublicKey } from '@solana/web3.js';
import { config } from '../../lib/config.js';
import { publicUrl } from '../../lib/badge.js';
import { json } from '../../lib/http.js';
import { sol, sweep } from '../../lib/solana.js';
import { getStore } from '../../lib/store.js';
import { playerWallet } from '../../lib/wallets.js';

const idOf = (req: Request) => new URL(req.url).pathname.split('/').pop() ?? '';

export async function GET(req: Request) {
  const user = await getStore().get(`sweep:${idOf(req)}`);
  if (!user) return json({ error: 'This QR code expired. Make a new one on the badge.' }, 404);
  const origin = config.origin || new URL(publicUrl(req)).origin;
  return json({ label: 'Superteam Snake', icon: `${origin}/icon.png` });
}

export async function POST(req: Request) {
  try {
    const user = await getStore().get(`sweep:${idOf(req)}`);
    if (!user) return json({ error: 'This QR code expired. Make a new one on the badge.' }, 404);
    let phone: PublicKey;
    try {
      phone = new PublicKey(String(((await req.json()) as { account?: unknown }).account));
    } catch {
      return json({ error: 'No wallet account in the request' }, 400);
    }
    const badge = playerWallet(user).keypair;
    if (phone.equals(badge.publicKey)) return json({ error: 'That is the badge wallet itself' }, 400);
    const s = await sweep(badge, phone);
    if (!s) return json({ error: 'The badge wallet is empty: play to earn some DevNet SOL' }, 400);
    return json({ transaction: s.tx, message: `Superteam Snake: ${sol(s.lamports)} DevNet SOL from your badge` });
  } catch (e) {
    console.error(e);
    return json({ error: 'Server error, try again' }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}
