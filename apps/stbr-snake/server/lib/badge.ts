// Checks that a request really comes from our app on a badge, through the badge
// server (docs/LUA_API.md, "What your server receives"). The badge server signs
// the X-Badge-* headers with Ed25519; its public key is at <site>/api/http/key.

import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto';
import { config } from './config.js';
import { getStore } from './store.js';

export interface Badge {
  badge: string; // X-Badge-Id, "e..." for an emulator
  user: string; // X-Badge-User: the badge owner's account id
}

const keys = new Map<string, KeyObject>();
let fetchedAt = 0;

async function badgeKey(id: string): Promise<KeyObject | null> {
  if (!keys.has(id) && Date.now() - fetchedAt > 60_000) {
    fetchedAt = Date.now();
    try {
      const res = await fetch(`${config.badgeSite}/api/http/key`);
      const k = (await res.json()) as { id: string; key: string };
      const x = Buffer.from(k.key, 'base64').toString('base64url');
      keys.set(k.id, createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }));
    } catch {
      return null;
    }
  }
  return keys.get(id) ?? null;
}

/** The URL the badge asked for: behind Vercel's proxy, rebuilt from PUBLIC_ORIGIN when set. */
export function publicUrl(req: Request): string {
  const u = new URL(req.url);
  return config.origin ? config.origin + u.pathname + u.search : u.origin + u.pathname + u.search;
}

/** The badge and player behind a request, or null. `body` is the raw body as received. */
export async function fromBadge(req: Request, body: string): Promise<Badge | null> {
  const h = (n: string) => req.headers.get(n) ?? '';
  const time = Number(h('x-badge-time'));
  const id = h('x-badge-request');
  const user = h('x-badge-user');
  const badge = h('x-badge-id');
  if (h('x-badge-app') !== config.app || !user || !badge || !id) return null;
  if (!(Math.abs(Date.now() - time) < 60_000)) return null;
  if (!config.allowEmulator && badge.startsWith('e')) return null;
  const key = await badgeKey(h('x-badge-key'));
  if (!key) return null;
  const hash = createHash('sha256').update(body).digest('hex');
  const signed = ['badge-http-v1', req.method, publicUrl(req), hash, config.app, badge, user, h('x-badge-time'), id].join('\n');
  const sig = Buffer.from(h('x-badge-signature'), 'base64');
  if (!verify(null, Buffer.from(signed), key, sig)) return null;
  // Each request id once: a replayed request is refused (ids are kept a little over the minute).
  if (!(await getStore().setNew(`req:${id}`, '1', 120))) return null;
  return { badge, user };
}

/** For tests: trust this key under this id instead of fetching the badge server's. */
export function trustKey(id: string, key: KeyObject) {
  keys.set(id, key);
}
