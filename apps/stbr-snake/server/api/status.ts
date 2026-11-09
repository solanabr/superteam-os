// GET /api/status: the faucet's address and DevNet balance, and the payout settings.

import { config } from '../lib/config.js';
import { json } from '../lib/http.js';
import { connection, sol } from '../lib/solana.js';
import { treasuryWallet } from '../lib/wallets.js';

export async function GET() {
  const address = treasuryWallet().publicKey;
  let balance: string | null = null;
  try {
    balance = sol(await connection().getBalance(address, 'confirmed'));
  } catch {}
  return json({
    app: config.app,
    faucet: address.toBase58(),
    balanceSol: balance,
    solPerPoint: sol(config.lamportsPerPoint),
    dailyCapSol: sol(config.dailyCapLamports),
  });
}
