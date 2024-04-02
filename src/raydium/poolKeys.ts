import { Connection, PublicKey } from '@solana/web3.js'
import {
  ApiPoolInfoV4, jsonInfo2PoolKeys,
  Liquidity,
  LiquidityAssociatedPoolKeys,
  MAINNET_PROGRAM_ID,
  Market,
  MARKET_STATE_LAYOUT_V3,
  Token
} from '@raydium-io/raydium-sdk'

export const createAssociatedPoolKeysAndPoolKeys = async (connection: Connection, baseToken: Token, quoteToken: Token, openMarketId: PublicKey) => {
  const associatedPoolKeys = getMarketAssociatedPoolKeys({baseToken, quoteToken, targetMargetId: openMarketId})
  const info = await createPoolKeysAndPoolInfo(connection, associatedPoolKeys)
  return {
    associatedPoolKeys,
    poolKeys: info.poolKeys,
    poolInfo: info.targetPoolInfo
  }
}
const createPoolKeysAndPoolInfo = async (connection: Connection, associatedPoolKeys: LiquidityAssociatedPoolKeys) => {
  const targetPoolInfo = await formatAmmKeysByInfo(connection, associatedPoolKeys)
// @ts-ignore
  delete targetPoolInfo['lookupTableAccount'];
  // @ts-ignore
  targetPoolInfo['marketVersion'] = 4;
  let poolKeys = jsonInfo2PoolKeys(targetPoolInfo)
  return {poolKeys, targetPoolInfo}
}

export async function formatAmmKeysByInfo(connection: Connection, info: LiquidityAssociatedPoolKeys): Promise<ApiPoolInfoV4> {
  const marketId= info.marketId
  const marketAccount = await connection.getAccountInfo(marketId)
  if (marketAccount === null) throw Error(' get market info error')
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

  const lpMint = info.lpMint

  return {
    id: info.id.toString(),
    baseMint: info.baseMint.toString(),
    quoteMint: info.quoteMint.toString(),
    lpMint: info.lpMint.toString(),
    baseDecimals: info.baseDecimals,
    quoteDecimals: info.quoteDecimals,
    lpDecimals: info.lpDecimals,
    version: 4,
    programId: MAINNET_PROGRAM_ID.AmmV4.toString(),
    authority: Liquidity.getAssociatedAuthority({ programId: MAINNET_PROGRAM_ID.AmmV4 }).publicKey.toString(),
    openOrders: info.openOrders.toString(),
    targetOrders: info.targetOrders.toString(),
    baseVault: info.baseVault.toString(),
    quoteVault: info.quoteVault.toString(),
    withdrawQueue: info.withdrawQueue.toString(),
    lpVault: info.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: info.marketProgramId.toString(),
    marketId: info.marketId.toString(),
    marketAuthority: Market.getAssociatedAuthority({ programId: info.marketProgramId, marketId: info.marketId }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString()
  }
}

const PROGRAMIDS = MAINNET_PROGRAM_ID;

type LiquidityPairTargetInfo = {
  baseToken: Token
  quoteToken: Token
  targetMargetId: PublicKey
}

function getMarketAssociatedPoolKeys(input: LiquidityPairTargetInfo) {
  return Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: input.baseToken.mint,
    quoteMint: input.quoteToken.mint,
    baseDecimals: input.baseToken.decimals,
    quoteDecimals: input.quoteToken.decimals,
    marketId: input.targetMargetId,
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  })
}
