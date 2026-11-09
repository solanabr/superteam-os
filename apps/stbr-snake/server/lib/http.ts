// Small helpers shared by the routes.

import { fromBadge, type Badge } from './badge.js';

export const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    // Solana Pay wallets fetch the transaction-request routes cross-origin.
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });

/** Today in UTC, for the daily limit. */
export const today = () => new Date().toISOString().slice(0, 10);

/** Runs a badge route: checks the signature, parses the JSON body (or {}), turns errors into 500s. */
export function badgeRoute(handler: (from: Badge, body: Record<string, unknown>) => Promise<Response>) {
  return async (req: Request) => {
    try {
      const raw = await req.text();
      const from = await fromBadge(req, raw);
      if (!from) return json({ error: 'not a badge running this app' }, 403);
      let body: Record<string, unknown> = {};
      try {
        const v = raw ? JSON.parse(raw) : {};
        if (v && typeof v === 'object') body = v;
      } catch {}
      return await handler(from, body);
    } catch (e) {
      console.error(e);
      return json({ error: 'server error' }, 500);
    }
  };
}
