import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction
} from '@solana/web3.js'
import {
  Account, ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'

import { promises as fs } from 'fs'
import { safeGetOrCreateAssociatedTokenAccount } from './mintAuthority'
import { getLatestDirNumber } from '../utils'
import { loadKeys } from '../utils'
import { TOKEN_PROGRAM_ID } from '@raydium-io/raydium-sdk'

function createInstructionToSendTokens(connection: Connection, sourceTokenAccount: Account, rawAmount: number, destinationTokenAccount: PublicKey, mint: PublicKey, wallet: Keypair) {
  //Step 1
  return createTransferInstruction(
    sourceTokenAccount.address,
    destinationTokenAccount,
    wallet.publicKey,
    rawAmount
  )
}

function createTokenAccountInstruction(connection: Connection, mint: PublicKey, payer: PublicKey, owner: PublicKey):
  {associatedAccount: PublicKey, instruction: TransactionInstruction} {
    const associatedAccount = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    return {associatedAccount: associatedAccount, instruction: createAssociatedTokenAccountInstruction(
      payer,
      associatedAccount,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )}
}

function batchCreateTokenAccountsAndInstructions(connection: Connection, mint: PublicKey, payer: PublicKey, accounts: PublicKey[]) {
  return accounts.map(owner => {
    return createTokenAccountInstruction(connection, mint, payer, owner)
  })
}

function splitNumbers(total: number, length: number): number[] {
  let evenSplit = Math.floor(total / length);
  let splits: number[] = new Array(length - 1).fill(evenSplit);
  let remainder = total - evenSplit * (length - 1);

  // Randomly adjust pairs
  for (let i = 0; i < splits.length - 1; i += 2) {
    let baseValue = splits[i];
    // Calculate a random adjustment up to 25%
    let adjustment = Math.floor(baseValue * (Math.random() * 0.5)); // Up to 25% of baseValue

    // Adjust the pair
    splits[i] -= adjustment; // Decrease the first number of the pair
    splits[i + 1] += adjustment; // Increase the second number of the pair
  }
  splits.push(remainder);
  return splits;
}

//'wallets/'
export async function batchInstructions(connection: Connection, mint: PublicKey, rawAmountToSplit: number, startPath: string, wallet: Keypair):
  Promise<{amounts: number[], instructions: TransactionInstruction[]}> {
  const path = startPath + '/' + getLatestDirNumber(startPath) + '/' + mint
  const keypairs = await loadKeys(path)
  const amounts = splitNumbers(rawAmountToSplit, keypairs.length)
  await fs.writeFile(path + '/adjusted_amounts.json', JSON.stringify(amounts))

  let tokenAccount = await safeGetOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    wallet.publicKey,
  )
  let tokenAccountsAndInstructions = batchCreateTokenAccountsAndInstructions(connection, mint, wallet.publicKey, keypairs.map(keypair => {return keypair.publicKey}))
  // return { amounts, instructions: [...tokenAccountsAndInstructions, tokenAccountsAndInstructions.map(data)] }
  return { amounts, instructions: [...tokenAccountsAndInstructions.map(data => data.instruction), ...tokenAccountsAndInstructions.map(data => createInstructionToSendTokens(connection, tokenAccount, rawAmountToSplit, data.associatedAccount, mint, wallet))] }
}

