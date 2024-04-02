import { createMintToCheckedInstruction } from '@solana/spl-token'
import { LiquidityPoolKeys, Token, TokenAccount, TokenAmount, TxVersion } from '@raydium-io/raydium-sdk'
import { Connection, PublicKey } from '@solana/web3.js'
import { makeSwapInstructionSimple } from './swapAMMSync'

const makeTxVersion = TxVersion.V0;

export const createMintAndSwapInstructions = async (
  sellInfo: {
    connection: Connection,
    poolKeys: LiquidityPoolKeys,
    amount: number,
    masterWalletTokenAccounts: TokenAccount[],
    baseToken: Token,
    quoteToken: Token,
  },
  mintInfo: {
    token: Token,
    tokenAccount: PublicKey,
    authority: PublicKey,
    amount: number
  }
  ) => {
  const sellInstructions = (await makeSwapInstructionSimple({
    connection: sellInfo.connection,
    poolKeys: sellInfo.poolKeys,
    userKeys: {
      tokenAccounts: sellInfo.masterWalletTokenAccounts,
      owner: mintInfo.authority,
    },
    amountIn: new TokenAmount(sellInfo.baseToken, sellInfo.amount),
    //TODO: figure out what should be this amountOut
    amountOut: new TokenAmount(sellInfo.quoteToken, 0.002 * (10 ** sellInfo.quoteToken.decimals)),
    fixedSide: 'in',
    makeTxVersion,
  }))
    .innerTransactions[0]
  const mintInstruction = createMintToCheckedInstruction(
    mintInfo.token.mint,
    mintInfo.tokenAccount,
    mintInfo.authority,
    mintInfo.amount,
    mintInfo.token.decimals
  )
  sellInstructions.instructions.unshift(mintInstruction)
  return sellInstructions
}