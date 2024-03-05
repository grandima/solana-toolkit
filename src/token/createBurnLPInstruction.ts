import { createBurnCheckedInstruction, getAssociatedTokenAddress } from '@solana/spl-token'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { ApiPoolInfoV4, Token } from '@raydium-io/raydium-sdk'

export async function createBurnLPInstruction(
  owner: PublicKey,
  targetPoolInfo: ApiPoolInfoV4,
  baseToken: Token,
  quoteToken: Token,
  rawBaseAmount: number,
  rawQuoteAmount: number): Promise<TransactionInstruction> {

  let lpMintOwnerAssociatedAccount = await getAssociatedTokenAddress(
    new PublicKey(targetPoolInfo.lpMint),
    owner,
    true)
  const diffAbs = Math.abs(baseToken.decimals - quoteToken.decimals)
  const lpAmount = Math.trunc((Math.sqrt(rawBaseAmount * rawQuoteAmount * (10 ** diffAbs)) - 1) * (10 ** targetPoolInfo.lpDecimals))

  return createBurnCheckedInstruction(
    lpMintOwnerAssociatedAccount, // PublicKey of Owner's Associated Token Account
    new PublicKey(targetPoolInfo.lpMint), // Public Key of the Token Mint Address
    owner, // Public Key of Owner's Wallet
    lpAmount, // Number of tokens to burn
    targetPoolInfo.lpDecimals // Number of Decimals of the Token Mint
  )
}
