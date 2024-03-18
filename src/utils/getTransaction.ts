import {
  ComputeBudgetProgram,
  Connection,
  Finality,
  Keypair,
  ParsedTransactionWithMeta, Signer, Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import { sleepTime } from './other'

export async function getTransaction(connection: Connection, id: string, commitment: Finality = 'finalized', maxRetries = 120,  sleep = 1000) {
  let retries = 0
  let result: boolean = false
  while (retries < maxRetries) {
    const status = (await connection.getSignatureStatus(id, {searchTransactionHistory: true}))
    // console.log('Tx status: ' + status)
    if (status.value?.err === null &&
      status.value?.confirmationStatus === "finalized") {
      return true
    }
    await sleepTime(sleep)
    retries += 1
  }
  console.log('Failed to get transaction info tx: ' + id)
  return result
}

export async function solanaRepeatTx(connection: Connection, instructions: TransactionInstruction[], signers: Signer[], CULimit = 389326, CUPrice = 770562, retries = 30, sleep = 1000, skipPreflight = false) {
  let blockhashResponse = await connection.getLatestBlockhashAndContext();
  instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units: CULimit}))
  instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({microLamports: CUPrice}))
  let txId: string = undefined!
  let transaction: Transaction = undefined!
  let blockheight = await connection.getBlockHeight()
  let lastValidBlockHeight = blockheight
  let result = false
  while (!result) {
    if (!(blockheight < lastValidBlockHeight)) {
      blockhashResponse = await connection.getLatestBlockhashAndContext()
      let blockhash = blockhashResponse.value.blockhash
      lastValidBlockHeight = blockhashResponse.context.slot + 150
      transaction = new Transaction()
      transaction.add(...instructions)
      transaction.lastValidBlockHeight = lastValidBlockHeight
      transaction.recentBlockhash = blockhash
      transaction.sign(...signers)
    }
    txId = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
    });
    result = await getTransaction(connection, txId)
    blockheight = await connection.getBlockHeight()
  }
  return txId
}

export async function repeatTx(connection: Connection, instructions: TransactionInstruction[], signers: Signer[], CULimit = 389326, CUPrice = 770562, retries = 30, sleep = 1000, skipPreflight = false) {
  let result = false
  let txId: string = undefined!
  instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units: CULimit}))
  instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({microLamports: CUPrice}))
  while (!result) {
    let blockhash: string = undefined!
    while (blockhash === undefined)
      try {
        blockhash = (await connection
          .getLatestBlockhash()).blockhash
      } catch {}
    const transaction = new Transaction();
    transaction.add(...instructions)
    transaction.recentBlockhash = blockhash
    try {
      txId = await connection.sendTransaction(transaction, signers)
    } catch (e) {
      console.log(e)
    }
    if (txId === undefined) {
      continue
    }
    result = await getTransaction(connection, txId)
  }
  return txId
}

export function extractPairAddress(tx: ParsedTransactionWithMeta): string {
  // @ts-ignore
  const data = tx.meta.innerInstructions[0].instructions.flatMap(function (instruction) {
    // @ts-ignore
    const x = instruction['parsed'] as Object
    return x
  }).filter(function(x){return x != undefined})
    .map(function(x){ // @ts-ignore
      return x['info']})
    .reverse()
    .find((object)=>{return object['owner'] == '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'})
  // LIQUIDITY_PAIR_PUBKEY.pair = data['account']
  return data['account']
}

// async function howToUse() {
//   const ts = await getTransaction('DRN8qiGXogAX3RUJ4Knzpg9DhsRL9d5pJCQVzwaLSFw681mM7rvBouB1FLxtbJFffaYN3doTvEyBGGfDBsNHoqd')
//   // @ts-ignore
//   const data = ts.meta.innerInstructions[0].instructions.flatMap(function (instruction) {
//     // @ts-ignore
//     const x = instruction['parsed'] as Object
//     return x
//   }).filter(function(x){return x != undefined})
//     .map(function(x){ // @ts-ignore
//       return x['info']})
//     .reverse()
//     .find((object)=>{return object['owner'] == '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'})
//   // LIQUIDITY_PAIR_PUBKEY.pair = data['account']
//   // console.dir(LIQUIDITY_PAIR_PUBKEY.pair, {'maxArrayLength': null})
// }
