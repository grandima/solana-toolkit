import '@solana/web3.js'
import {
  createInitializeMint2Instruction,
  createMint, MINT_SIZE
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { Token, TOKEN_PROGRAM_ID } from '@raydium-io/raydium-sdk'
import { sleepTime } from '../utils/other'
import { getMinimumBalanceForRentExemptMint } from '@solana/spl-token'
import { repeatTx } from '../utils'
export async function createToken(connection: Connection, superWallet: Keypair, decimals: number, mintAmount: number, sleep = 100) {
  let mintAddress: PublicKey | undefined
 do {
    try {
      const keypair = Keypair.generate()
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const instructions = [
        SystemProgram.createAccount({
          fromPubkey: superWallet.publicKey,
          newAccountPubkey: keypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(keypair.publicKey, decimals, superWallet.publicKey, null, TOKEN_PROGRAM_ID)
      ]
      await repeatTx(connection, instructions, [superWallet, keypair])
      mintAddress = keypair.publicKey
      console.log('New mint: ' + keypair.publicKey)
    } catch (e) {
      console.log(e)
      await sleepTime(sleep)
    }
  } while (!mintAddress)
  return mintAddress
}

