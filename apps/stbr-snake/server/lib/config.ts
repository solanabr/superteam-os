// Settings, from the Vercel project's environment variables.

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${name} must be a whole number`);
  return n;
}

export const config = {
  /** The app's id in the App Store: requests signed for any other app are refused. */
  app: process.env.APP_ID || 'stbr-snake',
  /** Where the badge server publishes the key it signs requests with. */
  badgeSite: (process.env.BADGE_SITE || 'https://solana.com/breakpoint/badge').replace(/\/$/, ''),
  /** This server's public https origin, as the badge calls it (e.g. https://stbr-snake.vercel.app). */
  origin: (process.env.PUBLIC_ORIGIN || '').replace(/\/$/, ''),
  rpc: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  /** 0.01 SOL per dot eaten. */
  lamportsPerPoint: num('LAMPORTS_PER_POINT', 10_000_000),
  /** 0.5 SOL per player per day (UTC). */
  dailyCapLamports: num('DAILY_CAP_LAMPORTS', 500_000_000),
  /** Dots before a game pays: below this the pot is lost (the cash-out line, 0.1 SOL). */
  minPoints: num('MIN_POINTS', 10),
  /** A dot takes at least this long to reach: a score faster than that is cut down to it. */
  minMsPerPoint: num('MIN_MS_PER_POINT', 350),
  /** Emulator badges (ids starting with "e") can earn too; set to 0 to pay real badges only. */
  allowEmulator: process.env.ALLOW_EMULATOR !== '0',
};

/** Fails loudly when a secret the server can't work without is missing. */
export function secret(name: 'TREASURY_SECRET' | 'PLAYER_KEY_SECRET'): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
