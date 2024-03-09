import '@solana/web3.js'
import {
  createMint,
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { Token, TOKEN_PROGRAM_ID } from '@raydium-io/raydium-sdk'
import { sleepTime } from '../utils/other'
export async function createToken(connection: Connection, superWallet: Keypair, decimals: number, mintAmount: number, sleep = 100) {
  let mintAddress: PublicKey | undefined
 do {
    try {
      mintAddress = await createMint(
        connection,
        superWallet,
        superWallet.publicKey,
        null,
        decimals,
        undefined,
        {maxRetries: 100},
        TOKEN_PROGRAM_ID,
      )
      console.log('New mint: ' + mintAddress)
    } catch (e) {
      console.log(e)
      await sleepTime(sleep)
    }
  } while (!mintAddress)
  return mintAddress
}

