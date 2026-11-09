// The faucet's wallet, and each player's DevNet wallet.
//
// A player's wallet is derived, not stored: its 12-word recovery phrase comes from
// HMAC-SHA256(PLAYER_KEY_SECRET, player id), and the key from that phrase the way
// Phantom and Solflare derive their first account (BIP39 seed, SLIP-10 ed25519,
// m/44'/501'/0'/0'). So the same account gets the same wallet on any badge, the
// badge keeps a copy the player can import, and the server keeps no list of keys.
// Changing PLAYER_KEY_SECRET gives every player a new, empty wallet.

import { createHmac } from 'node:crypto';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { secret } from './config.js';

export const PATH = "m/44'/501'/0'/0'";

/** SLIP-10 for ed25519 (hardened steps only, which is all ed25519 has). */
export function slip10(seed: Uint8Array, path: string): Uint8Array {
  let I = createHmac('sha512', 'ed25519 seed').update(seed).digest();
  let key = I.subarray(0, 32);
  let chain = I.subarray(32);
  for (const step of path.split('/').slice(1)) {
    if (!step.endsWith("'")) throw new Error('ed25519 has hardened steps only');
    const index = Buffer.alloc(4);
    index.writeUInt32BE((Number(step.slice(0, -1)) + 0x80000000) >>> 0);
    I = createHmac('sha512', chain).update(Buffer.concat([Buffer.from([0]), key, index])).digest();
    key = I.subarray(0, 32);
    chain = I.subarray(32);
  }
  return new Uint8Array(key);
}

export interface PlayerWallet {
  keypair: Keypair;
  mnemonic: string;
}

const players = new Map<string, PlayerWallet>();

export function playerWallet(user: string): PlayerWallet {
  let w = players.get(user);
  if (!w) {
    const entropy = createHmac('sha256', secret('PLAYER_KEY_SECRET')).update(`stbr-snake/player/v1/${user}`).digest().subarray(0, 16);
    const mnemonic = entropyToMnemonic(entropy, wordlist);
    const keypair = Keypair.fromSeed(slip10(mnemonicToSeedSync(mnemonic), PATH));
    w = { keypair, mnemonic };
    players.set(user, w);
  }
  return w;
}

/** The private key as Phantom's "Import private key" takes it: base58 of the 64 bytes. */
export function exportKey(k: Keypair): string {
  return bs58.encode(k.secretKey);
}

let treasury: Keypair | undefined;

/** TREASURY_SECRET: the Solana CLI keypair file's JSON array, or its base58 private key. */
export function treasuryWallet(): Keypair {
  if (!treasury) {
    const s = secret('TREASURY_SECRET').trim();
    const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s);
    treasury = Keypair.fromSecretKey(bytes);
  }
  return treasury;
}
