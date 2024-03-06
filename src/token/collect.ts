import {
  Connection,
  Keypair, LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction, TransactionMessage,
  TransactionSignature, VersionedMessage, VersionedTransaction
} from '@solana/web3.js'

import { simulateTransaction } from '@raydium-io/raydium-sdk'
import bs58 from 'bs58'

export async function sendAllSOL(connection: Connection, from: Keypair, to: Keypair): Promise<TransactionSignature | null> {
  const balance = await connection.getBalance(from.publicKey)

  const lamports = balance
  if (lamports > 0) {
    let blockhash = await connection
      .getLatestBlockhash()
      .then(res => res.blockhash);
    const instructions = [
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to.publicKey,
        lamports: lamports,
      }),
    ];
    const messageV0 = new TransactionMessage({
      payerKey: to.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([from, to]);

    console.log('Sent from ' + from.publicKey.toString() + ' to: ' + to.publicKey.toString() + ' SOL: ' + lamports / LAMPORTS_PER_SOL)
    const tx = await connection.sendTransaction(transaction)
    return tx
  }
  return null
}

export async function createCollectInstructions(connection: Connection, from: Keypair[], to: Keypair) {
  const balances = (await Promise.all(
    from
      .map((account) => connection.getBalance(account.publicKey))
  ))
  return from.map((wallet, i) => SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: to.publicKey,
    lamports: balances[i],
  }))
}

export async function collectAllSOL(connection: Connection, from: Keypair[], to: Keypair) {
  let instructions = await createCollectInstructions(connection, from, to)
  let blockhash = await connection
    .getLatestBlockhash()
    .then(res => res.blockhash);
  const messageV0 = new TransactionMessage({
    payerKey: to.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([...from, ...[to]])
  return await connection.sendTransaction(transaction)
}

