import { ComputeBudgetConfig, InstructionType, TxVersion } from '@raydium-io/raydium-sdk'
import {
  AccountMeta,
  AccountMetaReadonly,
  CacheLTA,
  splitTxAndSigners,
  TOKEN_PROGRAM_ID
} from '@raydium-io/raydium-sdk'
import { parseBigNumberish, Token, TokenAmount } from '@raydium-io/raydium-sdk'
import { PublicKey, Signer, TransactionInstruction } from '@solana/web3.js'
import {
  LiquiditySwapFixedInInstructionParamsV4, LiquiditySwapFixedOutInstructionParamsV4,
  LiquiditySwapInstructionParams,
  LiquiditySwapInstructionSimpleParams
} from '@raydium-io/raydium-sdk'
import { Spl } from '@raydium-io/raydium-sdk'
import { HandleTokenAccountParams, SelectTokenAccountParams } from '@raydium-io/raydium-sdk'
import { AccountLayout } from '@solana/spl-token'
import { struct, u64, u8 } from '@raydium-io/raydium-sdk'
import { ModelDataPubkey } from '@raydium-io/raydium-sdk'
import { Base, Logger } from '@raydium-io/raydium-sdk'

const logger = Logger.from('SwapAMMSync')
export async function makeSwapInstructionSimple<T extends TxVersion>(
  params: LiquiditySwapInstructionSimpleParams & {
  makeTxVersion: T
  lookupTableCache?: CacheLTA
  computeBudgetConfig?: ComputeBudgetConfig
},
) {
  const {
    connection,
    poolKeys,
    userKeys,
    amountIn,
    amountOut,
    fixedSide,
    config,
    makeTxVersion,
    lookupTableCache,
    computeBudgetConfig,
  } = params
  const { tokenAccounts, owner, payer = owner } = userKeys

  console.log('amountIn:', amountIn)
  console.log('amountOut:', amountOut)
  // console.assertArgument(
  //   !amountIn.isZero() && !amountOut.isZero(),
  //   'amounts must greater than zero',
  //   'currencyAmounts',
  //   {
  //     amountIn: amountIn.toFixed(),
  //     amountOut: amountOut.toFixed(),
  //   },
  // )

  const { bypassAssociatedCheck, checkCreateATAOwner } = {
    // default
    ...{ bypassAssociatedCheck: false, checkCreateATAOwner: false },
    // custom
    ...config,
  }

  // handle currency in & out (convert SOL to WSOL)
  const tokenIn = amountIn instanceof TokenAmount ? amountIn.token : Token.WSOL
  const tokenOut = amountOut instanceof TokenAmount ? amountOut.token : Token.WSOL

  const tokenAccountIn = _selectTokenAccount({
    programId: TOKEN_PROGRAM_ID,
    tokenAccounts,
    mint: tokenIn.mint,
    owner,
    config: { associatedOnly: false },
  })
  const tokenAccountOut = _selectTokenAccount({
    programId: TOKEN_PROGRAM_ID,
    tokenAccounts,
    mint: tokenOut.mint,
    owner,
  })

  const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw]

  const frontInstructions: TransactionInstruction[] = []
  const endInstructions: TransactionInstruction[] = []
  const frontInstructionsType: InstructionType[] = []
  const endInstructionsType: InstructionType[] = []
  const signers: Signer[] = []

  const _tokenAccountIn = await _handleTokenAccount({
    programId: TOKEN_PROGRAM_ID,
    connection,
    side: 'in',
    amount: amountInRaw,
    mint: tokenIn.mint,
    tokenAccount: tokenAccountIn,
    owner,
    payer,
    frontInstructions,
    endInstructions,
    signers,
    bypassAssociatedCheck,
    frontInstructionsType,
    checkCreateATAOwner,
  })
  const _tokenAccountOut = await _handleTokenAccount({
    programId: TOKEN_PROGRAM_ID,
    connection,
    side: 'out',
    amount: 0,
    mint: tokenOut.mint,
    tokenAccount: tokenAccountOut,
    owner,
    payer,
    frontInstructions,
    endInstructions,
    signers,
    bypassAssociatedCheck,
    frontInstructionsType,
    checkCreateATAOwner,
  })

  const ins = makeSwapInstruction({
    poolKeys,
    userKeys: {
      tokenAccountIn: _tokenAccountIn,
      tokenAccountOut: _tokenAccountOut,
      owner,
    },
    amountIn: amountInRaw,
    amountOut: amountOutRaw,
    fixedSide,
  })

  return {
    address: {},
    innerTransactions: await splitTxAndSigners({
      connection,
      makeTxVersion,
      computeBudgetConfig,
      payer,
      innerTransaction: [
        { instructionTypes: frontInstructionsType, instructions: frontInstructions, signers },
        ins.innerTransaction,
        { instructionTypes: endInstructionsType, instructions: endInstructions, signers: [] },
      ],
      lookupTableCache,
    }),
  }
}

function _selectTokenAccount(params: SelectTokenAccountParams) {
  const { tokenAccounts, programId, mint, owner, config } = params

  const { associatedOnly } = {
    // default
    ...{ associatedOnly: true },
    // custom
    ...config,
  }

  const _tokenAccounts = tokenAccounts
    // filter by mint
    .filter(({ accountInfo }) => accountInfo.mint.equals(mint))
    // sort by balance
    .sort((a, b) => (a.accountInfo.amount.lt(b.accountInfo.amount) ? 1 : -1))

  const ata = Spl.getAssociatedTokenAccount({ mint, owner, programId })

  for (const tokenAccount of _tokenAccounts) {
    const { pubkey } = tokenAccount

    if (associatedOnly) {
      // return ata only
      if (ata.equals(pubkey)) return pubkey
    } else {
      // return the first account
      return pubkey
    }
  }

  return null
}

async function _handleTokenAccount(params: HandleTokenAccountParams) {
  const {
    connection,
    side,
    amount,
    programId,
    mint,
    tokenAccount,
    owner,
    payer = owner,
    frontInstructions,
    endInstructions,
    signers,
    bypassAssociatedCheck,
    frontInstructionsType,
    endInstructionsType,
    checkCreateATAOwner,
  } = params

  const ata = Spl.getAssociatedTokenAccount({ mint, owner, programId })

  if (Token.WSOL.mint.equals(mint)) {
    const newTokenAccount = await Spl.insertCreateWrappedNativeAccount({
      connection,
      owner,
      payer,
      instructions: frontInstructions,
      instructionsType: frontInstructionsType,
      signers,
      amount,
    })
    // if no endInstructions provide, no need to close
    if (endInstructions) {
      endInstructions.push(
        Spl.makeCloseAccountInstruction({
          programId: TOKEN_PROGRAM_ID,
          tokenAccount: newTokenAccount,
          owner,
          payer,
          instructionsType: endInstructionsType ?? [],
        }),
      )
    }

    return newTokenAccount
  } else if (!tokenAccount || (side === 'out' && !ata.equals(tokenAccount) && !bypassAssociatedCheck)) {
    const _createATAIns = Spl.makeCreateAssociatedTokenAccountInstruction({
      programId,
      mint,
      associatedAccount: ata,
      owner,
      payer,
      instructionsType: frontInstructionsType,
    })
    if (checkCreateATAOwner) {
      const ataInfo = await connection.getAccountInfo(ata)
      if (ataInfo === null) {
        frontInstructions.push(_createATAIns)
      } else if (
        ataInfo.owner.equals(TOKEN_PROGRAM_ID) &&
        AccountLayout.decode(ataInfo.data).mint.equals(mint) &&
        AccountLayout.decode(ataInfo.data).owner.equals(owner)
      ) {
        /* empty */
      } else {
        throw Error(`create ata check error -> mint: ${mint.toString()}, ata: ${ata.toString()}`)
      }
    } else {
      frontInstructions.push(_createATAIns)
    }
    return ata
  }

  return tokenAccount
}

function makeSwapInstruction(params: LiquiditySwapInstructionParams) {
  const { poolKeys, userKeys, amountIn, amountOut, fixedSide } = params
  const { version } = poolKeys

  if (version === 4 || version === 5) {
    if (fixedSide === 'in') {
      return makeSwapFixedInInstruction(
        {
          poolKeys,
          userKeys,
          amountIn,
          minAmountOut: amountOut,
        },
        version,
      )
    } else if (fixedSide === 'out') {
      return makeSwapFixedOutInstruction(
        {
          poolKeys,
          userKeys,
          maxAmountIn: amountIn,
          amountOut,
        },
        version,
      )
    }
    return logger.throwArgumentError('invalid params', 'params', params)
  }

  return logger.throwArgumentError('invalid version', 'poolKeys.version', version)
}

function makeSwapFixedInInstruction(
  { poolKeys, userKeys, amountIn, minAmountOut }: LiquiditySwapFixedInInstructionParamsV4,
  version: number,
) {
  const LAYOUT = struct([u8('instruction'), u64('amountIn'), u64('minAmountOut')])
  const data = Buffer.alloc(LAYOUT.span)
  LAYOUT.encode(
    {
      instruction: 9,
      amountIn: parseBigNumberish(amountIn),
      minAmountOut: parseBigNumberish(minAmountOut),
    },
    data,
  )

  const keys = [
    // system
    AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    // amm
    AccountMeta(poolKeys.id, false),
    AccountMetaReadonly(poolKeys.authority, false),
    AccountMeta(poolKeys.openOrders, false),
  ]

  if (version === 4) {
    keys.push(AccountMeta(poolKeys.targetOrders, false))
  }

  keys.push(AccountMeta(poolKeys.baseVault, false), AccountMeta(poolKeys.quoteVault, false))

  if (version === 5) {
    keys.push(AccountMeta(ModelDataPubkey, false))
  }

  keys.push(
    // serum
    AccountMetaReadonly(poolKeys.marketProgramId, false),
    AccountMeta(poolKeys.marketId, false),
    AccountMeta(poolKeys.marketBids, false),
    AccountMeta(poolKeys.marketAsks, false),
    AccountMeta(poolKeys.marketEventQueue, false),
    AccountMeta(poolKeys.marketBaseVault, false),
    AccountMeta(poolKeys.marketQuoteVault, false),
    AccountMetaReadonly(poolKeys.marketAuthority, false),
    // user
    AccountMeta(userKeys.tokenAccountIn, false),
    AccountMeta(userKeys.tokenAccountOut, false),
    AccountMetaReadonly(userKeys.owner, true),
  )

  return {
    address: {},
    innerTransaction: {
      instructions: [
        new TransactionInstruction({
          programId: poolKeys.programId,
          keys,
          data,
        }),
      ],
      signers: [],
      lookupTableAddress: [poolKeys.lookupTableAccount].filter((i) => i && !i.equals(PublicKey.default)),
      instructionTypes: [version === 4 ? InstructionType.ammV4SwapBaseIn : InstructionType.ammV5SwapBaseIn],
    },
  }
}

function makeSwapFixedOutInstruction(
  { poolKeys, userKeys, maxAmountIn, amountOut }: LiquiditySwapFixedOutInstructionParamsV4,
  version: number,
) {
  const LAYOUT = struct([u8('instruction'), u64('maxAmountIn'), u64('amountOut')])
  const data = Buffer.alloc(LAYOUT.span)
  LAYOUT.encode(
    {
      instruction: 11,
      maxAmountIn: parseBigNumberish(maxAmountIn),
      amountOut: parseBigNumberish(amountOut),
    },
    data,
  )

  const keys = [
    // system
    AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    // amm
    AccountMeta(poolKeys.id, false),
    AccountMetaReadonly(poolKeys.authority, false),
    AccountMeta(poolKeys.openOrders, false),
    AccountMeta(poolKeys.targetOrders, false),
    AccountMeta(poolKeys.baseVault, false),
    AccountMeta(poolKeys.quoteVault, false),
  ]

  if (version === 5) {
    keys.push(AccountMeta(ModelDataPubkey, false))
  }

  keys.push(
    // serum
    AccountMetaReadonly(poolKeys.marketProgramId, false),
    AccountMeta(poolKeys.marketId, false),
    AccountMeta(poolKeys.marketBids, false),
    AccountMeta(poolKeys.marketAsks, false),
    AccountMeta(poolKeys.marketEventQueue, false),
    AccountMeta(poolKeys.marketBaseVault, false),
    AccountMeta(poolKeys.marketQuoteVault, false),
    AccountMetaReadonly(poolKeys.marketAuthority, false),
    // user
    AccountMeta(userKeys.tokenAccountIn, false),
    AccountMeta(userKeys.tokenAccountOut, false),
    AccountMetaReadonly(userKeys.owner, true),
  )

  return {
    address: {},
    innerTransaction: {
      instructions: [
        new TransactionInstruction({
          programId: poolKeys.programId,
          keys,
          data,
        }),
      ],
      signers: [],
      lookupTableAddress: [poolKeys.lookupTableAccount].filter((i) => i && !i.equals(PublicKey.default)),
      instructionTypes: [version === 4 ? InstructionType.ammV4SwapBaseOut : InstructionType.ammV5SwapBaseOut],
    },
  }
}