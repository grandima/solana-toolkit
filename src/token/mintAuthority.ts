import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import {
  Account,
  AuthorityType,
  createSetAuthorityInstruction,
  getOrCreateAssociatedTokenAccount
} from '@solana/spl-token'
import { sleepTime } from '../utils/other'

async function updateMintAuthority(connection: Connection, superWallet: Keypair, token: PublicKey, shoudlDisable: boolean = true) {
  let transaction = new Transaction()
  transaction.add(createSetAuthorityInstruction(token, superWallet.publicKey, AuthorityType.MintTokens, shoudlDisable ? null : superWallet.publicKey))
  const txId = await sendAndConfirmTransaction(connection, transaction, [superWallet])
  console.log('Disable mint' + txId)
  return txId
}

export async function safeGetOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  maxRetries: number = 100,
  time: number = 100
) {
  let tokenAccount: Account = undefined!
  while (tokenAccount === undefined) {
    try {
      tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner,
        undefined,
        undefined,
        { maxRetries: maxRetries }
      );
    } catch (e) {
      console.log(e)
      await sleepTime(time)
    }
  }
    return tokenAccount
}
