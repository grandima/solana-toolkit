import { createMintToCheckedInstruction } from '@solana/spl-token'
import { Token } from '@raydium-io/raydium-sdk'
import { Connection, PublicKey } from '@solana/web3.js'

export const mintAndSwapInstructions = async (
  connection: Connection,
  tokenAccount: PublicKey,
  authority: PublicKey,
  sellInfo: {token: Token, amount: number}) => {

  //TODO: add makeSwapInstructionSimple


  const mintInstruction = createMintToCheckedInstruction(
    sellInfo.token.mint,
    tokenAccount,
    authority,
    sellInfo.amount,
    sellInfo.token.decimals
  )
}