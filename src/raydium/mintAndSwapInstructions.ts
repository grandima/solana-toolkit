import { createMintToCheckedInstruction } from '@solana/spl-token'
import { LiquidityPoolKeys, Token, TokenAccount, TokenAmount, TxVersion } from '@raydium-io/raydium-sdk'
import { Connection, PublicKey } from '@solana/web3.js'
import { makeSwapInstructionSimple } from './swapAMMSync'

export const makeTxVersion = TxVersion.V0;

export const mintAndSwapInstructions = async (
  connection: Connection,
  poolKeys: LiquidityPoolKeys,
  baseToken: Token,
  leftAmount: number,
  quoteToken: Token,
  masterWalletTokenAccounts: TokenAccount[],
  tokenAccount: PublicKey,
  authority: PublicKey,
  sellInfo: {
    token: Token,
    amount: number
  }
  ) => {
  const sellInstructions = (await makeSwapInstructionSimple({
    connection,
    poolKeys,
    userKeys: {
      tokenAccounts: masterWalletTokenAccounts,
      owner: authority,
    },
    amountIn: new TokenAmount(baseToken, leftAmount),
    //TODO: figure out what should be this amountOut
    amountOut: new TokenAmount(quoteToken, 0.002 * (10 ** quoteToken.decimals)),
    fixedSide: 'in',
    makeTxVersion,
  }))
    .innerTransactions[0]
  const mintInstruction = createMintToCheckedInstruction(
    sellInfo.token.mint,
    tokenAccount,
    authority,
    sellInfo.amount,
    sellInfo.token.decimals
  )
  sellInstructions.instructions.unshift(mintInstruction)
  return sellInstructions
}