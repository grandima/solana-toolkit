import { Keypair,  sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import {
  Account,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  AuthorityType,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  createAssociatedTokenAccountInstruction, TokenInvalidMintError, TokenInvalidOwnerError
} from '@solana/spl-token'
import { sleepTime } from '../utils/other'
import type { Commitment, ConfirmOptions, Connection, PublicKey, Signer } from '@solana/web3.js';
import { solanaRepeatTx } from '../utils'
import { createMintToInstruction } from '@solana/spl-token'
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
      tokenAccount = await myGetOrCreateAssociatedTokenAccount(
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

export async function myGetOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  commitment?: Commitment,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
) {
  const associatedToken = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    programId,
    associatedTokenProgramId
  );

  // This is the optimal logic, considering TX fee, client-side computation, RPC roundtrips and guaranteed idempotent.
  // Sadly we can't do this atomically.
  let account: Account;
  try {
    account = await getAccount(connection, associatedToken, commitment, programId);
  } catch (error: unknown) {
    // TokenAccountNotFoundError can be possible if the associated address has already received some lamports,
    // becoming a system account. Assuming program derived addressing is safe, this is the only case for the
    // TokenInvalidAccountOwnerError in this code path.
    if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
      // As this isn't atomic, it's possible others can create associated accounts meanwhile.
      try {
        const instructions = [createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedToken,
          owner,
          mint,
          programId,
          associatedTokenProgramId
        )]
        await solanaRepeatTx(connection, instructions, [payer])
      } catch (error: unknown) {
        // Ignore all errors; for now there is no API-compatible way to selectively ignore the expected
        // instruction error if the associated account exists already.
      }

      // Now this should always succeed
      account = await getAccount(connection, associatedToken, commitment, programId);
    } else {
      throw error;
    }
  }

  if (!account.mint.equals(mint)) throw new TokenInvalidMintError();
  if (!account.owner.equals(owner)) throw new TokenInvalidOwnerError();

  return account;
}

export async function mintTo(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = TOKEN_PROGRAM_ID
) {
  return await solanaRepeatTx(connection, [createMintToInstruction(mint, destination, payer.publicKey, amount, multiSigners, programId)], [payer])
}
