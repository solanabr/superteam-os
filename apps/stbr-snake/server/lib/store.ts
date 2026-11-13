// Short-lived state: game sessions, daily totals, seen request ids, sweep links.
// Upstash Redis on Vercel (Marketplace > Upstash, which sets KV_REST_API_URL and
// KV_REST_API_TOKEN), or memory for local runs.

import { Redis } from '@upstash/redis';

export interface Store {
  /** Sets key only if it doesn't exist yet; true if it was set. */
  setNew(key: string, value: string, ttlSec: number): Promise<boolean>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Reads and deletes in one step, so a value is taken once. */
  take(key: string): Promise<string | null>;
  /** Adds by to the counter (creating it at 0) and returns the new total. */
  add(key: string, by: number, ttlSec: number): Promise<number>;
}

class MemoryStore implements Store {
  private m = new Map<string, { v: string; until: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (e && e.until < Date.now()) this.m.delete(key);
    return this.m.get(key);
  }
  async setNew(key: string, value: string, ttl: number) {
    if (this.live(key)) return false;
    this.m.set(key, { v: value, until: Date.now() + ttl * 1000 });
    return true;
  }
  async set(key: string, value: string, ttl: number) {
    this.m.set(key, { v: value, until: Date.now() + ttl * 1000 });
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async take(key: string) {
    const v = this.live(key)?.v ?? null;
    this.m.delete(key);
    return v;
  }
  async add(key: string, by: number, ttl: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + by;
    this.m.set(key, { v: String(n), until: e?.until ?? Date.now() + ttl * 1000 });
    return n;
  }
}

class RedisStore implements Store {
  constructor(private r: Redis) {}
  async setNew(key: string, value: string, ttl: number) {
    return (await this.r.set(key, value, { nx: true, ex: ttl })) === 'OK';
  }
  async set(key: string, value: string, ttl: number) {
    await this.r.set(key, value, { ex: ttl });
  }
  async get(key: string) {
    const v = await this.r.get<string>(key);
    return v == null ? null : String(v);
  }
  async take(key: string) {
    const v = await this.r.getdel<string>(key);
    return v == null ? null : String(v);
  }
  async add(key: string, by: number, ttl: number) {
    const p = this.r.multi();
    p.incrby(key, by);
    p.expire(key, ttl, 'NX');
    const [n] = (await p.exec()) as [number | string, number];
    return Number(n);
  }
}

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // Values stay strings: by default the client would turn a stored JSON text (a game
    // session) back into an object.
    store = new RedisStore(new Redis({ url, token, automaticDeserialization: false }));
  } else if (process.env.VERCEL) {
    // Serverless instances don't share memory: the daily limit wouldn't hold.
    throw new Error('No Redis: add Upstash to the Vercel project (Storage / Marketplace)');
  } else {
    store = new MemoryStore();
  }
  return store;
}

/** For tests. */
export function useStore(s: Store) {
  store = s;
}
