// Offline checks of the whole server: signed badge requests (with a test key in place of
// the badge server's), wallet derivation against an independent implementation, the
// daily limit, the score check, the payout and the sweep transaction. No network.
//   npm test

import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { HDKey } from 'micro-ed25519-hdkey';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair, PublicKey, SystemInstruction, Transaction, type Connection } from '@solana/web3.js';
import bs58 from 'bs58';

process.env.PLAYER_KEY_SECRET = 'test-secret';
const treasury = Keypair.generate();
process.env.TREASURY_SECRET = JSON.stringify([...treasury.secretKey]);
process.env.PUBLIC_ORIGIN = 'https://snake.test';
process.env.MIN_MS_PER_POINT = '0'; // tests end games at once

const { trustKey } = await import('../lib/badge.js');
const { useConnection, MEMO, SWEEP_FEE } = await import('../lib/solana.js');
const { playerWallet, slip10, PATH } = await import('../lib/wallets.js');
const wallet = await import('../api/wallet.js');
const start = await import('../api/start.js');
const finish = await import('../api/finish.js');
const sweepRoute = await import('../api/sweep.js');
const txRoute = await import('../api/tx/[id].js');

// --- a stand-in badge server and chain -------------------------------------------------
const badgeKeys = generateKeyPairSync('ed25519');
trustKey('testkey', badgeKeys.publicKey);

const balances = new Map<string, number>();
const sent: Transaction[] = [];
useConnection({
  async getLatestBlockhash() {
    return { blockhash: bs58.encode(randomBytes(32)), lastValidBlockHeight: 1000 };
  },
  async getBalance(k: PublicKey) {
    return balances.get(k.toBase58()) ?? 0;
  },
  async sendRawTransaction(raw: Buffer) {
    const tx = Transaction.from(raw);
    assert.ok(tx.verifySignatures(), 'payout must be fully signed');
    const t = SystemInstruction.decodeTransfer(tx.instructions[0]);
    const from = balances.get(t.fromPubkey.toBase58()) ?? 0;
    if (from < Number(t.lamports) + 5000) throw new Error('Attempt to debit an account but found no record of a prior credit.');
    balances.set(t.fromPubkey.toBase58(), from - Number(t.lamports) - 5000);
    balances.set(t.toPubkey.toBase58(), (balances.get(t.toPubkey.toBase58()) ?? 0) + Number(t.lamports));
    sent.push(tx);
    return bs58.encode(tx.signature!);
  },
} as unknown as Connection);

function badgeRequest(path: string, body: unknown, who = { badge: '7K2Q9M', user: 'user-1' }, tamper = false) {
  const url = `https://snake.test${path}`;
  const text = body === undefined ? '' : JSON.stringify(body);
  const time = String(Date.now());
  const id = randomBytes(8).toString('hex');
  const hash = createHash('sha256').update(text).digest('hex');
  const signed = ['badge-http-v1', 'POST', url, hash, 'stbr-snake', who.badge, who.user, time, id].join('\n');
  const headers = {
    'x-badge-app': 'stbr-snake', 'x-badge-id': who.badge, 'x-badge-user': who.user, 'x-badge-time': time,
    'x-badge-request': id, 'x-badge-key': 'testkey', 'content-type': 'application/json',
    'x-badge-signature': sign(null, Buffer.from(signed), badgeKeys.privateKey).toString('base64'),
  };
  return new Request(url, { method: 'POST', headers, body: tamper ? text.replace('1', '9') : text });
}
const call = async (r: Promise<Response> | Response) => {
  const res = await r;
  return { status: res.status, body: (await res.json()) as any };
};

// --- wallet derivation -------------------------------------------------------------------
// SLIP-10 test vector 1 (ed25519), m/0'/1'/2'/2'/1000000000'.
assert.equal(Buffer.from(slip10(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'), "m/0'/1'/2'/2'/1000000000'")).toString('hex'),
  '8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793');
{
  const w = playerWallet('user-1');
  assert.ok(validateMnemonic(w.mnemonic, wordlist));
  assert.equal(w.mnemonic.split(' ').length, 12);
  // The same key Phantom gets from these 12 words (independent library).
  const hd = HDKey.fromMasterSeed(Buffer.from(mnemonicToSeedSync(w.mnemonic)).toString('hex')).derive(PATH);
  assert.equal(Keypair.fromSeed(hd.privateKey).publicKey.toBase58(), w.keypair.publicKey.toBase58());
  assert.equal(playerWallet('user-1').mnemonic, w.mnemonic, 'same player, same wallet');
  assert.notEqual(playerWallet('user-2').mnemonic, w.mnemonic);
  console.log('ok  wallet derivation matches Phantom (m/44\'/501\'/0\'/0\')');
}

// --- signatures --------------------------------------------------------------------------
{
  const r = await call(wallet.POST(badgeRequest('/api/wallet', {})));
  assert.equal(r.status, 200);
  const k = Keypair.fromSecretKey(bs58.decode(r.body.secret));
  assert.equal(k.publicKey.toBase58(), r.body.address);
  assert.equal(r.body.mnemonic, playerWallet('user-1').mnemonic);
  assert.equal(r.body.remaining, 500_000_000);
  assert.equal(r.body.perPoint, 10_000_000);

  assert.equal((await call(wallet.POST(badgeRequest('/api/wallet', { a: 1 }, undefined, true)))).status, 403, 'tampered body');
  const req = badgeRequest('/api/wallet', {});
  const again = req.clone();
  assert.equal((await call(wallet.POST(req))).status, 200);
  assert.equal((await call(wallet.POST(again))).status, 403, 'replayed request');
  const unsigned = new Request('https://snake.test/api/wallet', { method: 'POST', body: '{}' });
  assert.equal((await call(wallet.POST(unsigned))).status, 403, 'no signature');
  console.log('ok  badge signatures: valid passes, tampered, replayed and unsigned refused');
}

// --- games and the daily limit ------------------------------------------------------------
const player = playerWallet('user-1').keypair.publicKey.toBase58();
async function game(points: number, who?: { badge: string; user: string }) {
  const s = await call(start.POST(badgeRequest('/api/start', {}, who)));
  assert.equal(s.status, 200);
  return call(finish.POST(badgeRequest('/api/finish', { session: s.body.session, points }, who)));
}
{
  let r = await game(12);
  assert.equal(r.status, 503, 'empty faucet');
  assert.equal(r.body.error, 'faucet empty');
  assert.equal((await call(wallet.POST(badgeRequest('/api/wallet', {})))).body.remaining, 500_000_000, 'allowance given back');

  balances.set(treasury.publicKey.toBase58(), 10e9);
  r = await game(12);
  assert.equal(r.status, 200);
  assert.equal(r.body.lamports, 120_000_000);
  assert.equal(r.body.remaining, 380_000_000);
  assert.equal(balances.get(player), 120_000_000);
  assert.ok(sent.at(-1)!.instructions[1].programId.equals(MEMO));

  r = await game(30);
  assert.equal(r.body.lamports, 300_000_000);
  r = await game(30);
  assert.equal(r.body.lamports, 80_000_000, 'cut at the 0.5 SOL daily limit');
  assert.equal(r.body.capped, true);
  assert.equal(r.body.remaining, 0);
  r = await game(10);
  assert.equal(r.body.lamports, 0);
  assert.equal(balances.get(player), 500_000_000);

  // Another badge of the same player shares the limit; another player has their own.
  assert.equal((await game(10, { badge: 'e1234', user: 'user-1' })).body.lamports, 0);
  assert.equal((await game(10, { badge: 'X9X9X9', user: 'user-2' })).body.lamports, 100_000_000);
  // Under the cash-out line (10 dots) a game pays nothing and spends none of the allowance.
  r = await game(9, { badge: 'X9X9X9', user: 'user-2' });
  assert.equal(r.body.lamports, 0);
  assert.equal(r.body.below, true);
  assert.equal(r.body.remaining, 400_000_000);

  // A session is good for one finish, and only for the player who started it.
  const s = await call(start.POST(badgeRequest('/api/start', {}, { badge: 'X9X9X9', user: 'user-2' })));
  assert.equal((await call(finish.POST(badgeRequest('/api/finish', { session: s.body.session, points: 1 })))).status, 400, 'other player');
  assert.equal((await call(finish.POST(badgeRequest('/api/finish', { session: 'nope', points: 1 })))).status, 400);
  console.log('ok  payouts: 0.01 SOL a dot from 10 dots on, 0.5 SOL a day per player, sessions used once');
}

// --- sweep to a phone wallet ----------------------------------------------------------------
{
  const r = await call(sweepRoute.POST(badgeRequest('/api/sweep', {})));
  assert.equal(r.status, 200);
  assert.match(r.body.url, /^solana:https:\/\/snake\.test\/api\/tx\/[\w-]+$/);
  const txUrl = r.body.url.slice('solana:'.length);

  const meta = await call(txRoute.GET(new Request(txUrl)));
  assert.equal(meta.body.label, 'Superteam Snake');
  assert.equal(meta.body.icon, 'https://snake.test/icon.png');

  const phone = Keypair.generate();
  const t = await call(txRoute.POST(new Request(txUrl, { method: 'POST', body: JSON.stringify({ account: phone.publicKey.toBase58() }) })));
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const tx = Transaction.from(Buffer.from(t.body.transaction, 'base64'));
  assert.equal(tx.feePayer!.toBase58(), player, 'the badge wallet pays the fee');
  const tr = SystemInstruction.decodeTransfer(tx.instructions[0]);
  assert.equal(tr.toPubkey.toBase58(), phone.publicKey.toBase58());
  assert.equal(Number(tr.lamports), 500_000_000 - SWEEP_FEE);
  // The phone wallet must sign (it approves the move); then the transaction is complete.
  assert.ok(tx.instructions[1].keys.some((k) => k.isSigner && k.pubkey.equals(phone.publicKey)));
  assert.equal(tx.signatures.length, 2);
  assert.equal(tx.verifySignatures(false), true, 'badge wallet signature is there');
  tx.partialSign(phone);
  assert.equal(tx.verifySignatures(), true);
  console.log(`ok  sweep: phone wallet co-signs a ${Number(tr.lamports) / 1e9} SOL transfer, fee paid by the badge wallet`);

  const self = await call(txRoute.POST(new Request(txUrl, { method: 'POST', body: JSON.stringify({ account: player }) })));
  assert.equal(self.status, 400);
  assert.equal((await call(txRoute.GET(new Request('https://snake.test/api/tx/expired')))).status, 404);
}
console.log('all good');
