import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction
} from '@solana/web3.js'
import {
  Account,
  createTransferInstruction,
} from '@solana/spl-token'

import { promises as fs } from 'fs'
import { safeGetOrCreateAssociatedTokenAccount } from './mintAuthority'
import { getLatestDirNumber } from '../utils/fileMethods'
import { loadKeys } from '../utils/keypair'

async function createInstructionToSendTokens(connection: Connection, sourceAccount: Account, rawAmount: number, destination: PublicKey, mint: PublicKey, wallet: Keypair) {
  //Step 1
  let destinationAccount = await safeGetOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    destination
  );
  return createTransferInstruction(
    sourceAccount.address,
    destinationAccount.address,
    wallet.publicKey,
    rawAmount
  )
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
  let instructions = [] as TransactionInstruction[]
  for (let i = 0; i < keypairs.length; i++) {
    instructions.push(await createInstructionToSendTokens(connection, tokenAccount, amounts[i], keypairs[i].publicKey, mint, wallet))
  }
  return { amounts,instructions }
}
