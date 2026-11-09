// DevNet transactions: the faucet's payouts, and the sweep a phone wallet co-signs.

import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, type Keypair } from '@solana/web3.js';
import { config } from './config.js';

export const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
/** Two signatures at 5000 lamports each: the badge wallet's and the phone wallet's. */
export const SWEEP_FEE = 10_000;

let conn: Connection | undefined;
export function connection(): Connection {
  conn ??= new Connection(config.rpc, 'confirmed');
  return conn;
}

/** For tests. */
export function useConnection(c: Connection) {
  conn = c;
}

function memo(text: string, signer?: PublicKey) {
  return new TransactionInstruction({
    programId: MEMO,
    keys: signer ? [{ pubkey: signer, isSigner: true, isWritable: false }] : [],
    data: Buffer.from(text, 'utf8'),
  });
}

/** Sends lamports from the faucet to a player; answers the signature without waiting for it to confirm. */
export async function pay(from: Keypair, to: PublicKey, lamports: number, note: string): Promise<string> {
  const c = connection();
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: from.publicKey, blockhash, lastValidBlockHeight })
    .add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports }))
    .add(memo(note));
  tx.sign(from);
  return c.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed', maxRetries: 5 });
}

/**
 * Everything in the badge wallet to the phone wallet. The badge wallet pays the fee
 * (a fresh phone wallet has no SOL on DevNet) and signs here; the phone wallet signs
 * the memo, so it is the one that approves and sends the transaction.
 */
export async function sweep(badgeWallet: Keypair, phone: PublicKey): Promise<{ tx: string; lamports: number } | null> {
  const c = connection();
  const [balance, { blockhash, lastValidBlockHeight }] = await Promise.all([
    c.getBalance(badgeWallet.publicKey, 'confirmed'),
    c.getLatestBlockhash('confirmed'),
  ]);
  const lamports = balance - SWEEP_FEE;
  if (lamports <= 0) return null;
  const tx = new Transaction({ feePayer: badgeWallet.publicKey, blockhash, lastValidBlockHeight })
    .add(SystemProgram.transfer({ fromPubkey: badgeWallet.publicKey, toPubkey: phone, lamports }))
    .add(memo('Superteam Snake: badge wallet to phone', phone));
  tx.partialSign(badgeWallet);
  return { tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), lamports };
}

export function sol(lamports: number): string {
  return (lamports / 1e9).toFixed(9).replace(/\.?0+$/, '');
}
