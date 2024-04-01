import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js'
import { useRentExemption } from './utils/useRentExemption'
import { ACCOUNT_SIZE, createInitializeAccountInstruction } from '@solana/spl-token'
import { useSerumMarketAccountSizes } from './utils/useSerumMarketAccountSizes'
import { getVaultOwnerAndNonce } from './utils/serum'
import { TOKEN_PROGRAM_ID, Token } from '@raydium-io/raydium-sdk'
import { DexInstructions, Market } from '@project-serum/serum'
import { BN } from 'bn.js'
import { getLatestDirNumber, writeFile } from '../../../solana-toolkit/src/utils/fileMethods'
import { repeatTx } from '../../../solana-toolkit/src/utils/getTransaction'

const OPENBOOK_DEX = "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"; // openbook now
const programID = new PublicKey(OPENBOOK_DEX)
export async function createOpenMarket(connection: Connection, wallet: Keypair, basetToken: Token, quoteToken: Token, eventQueueLength = 128, requestQueueLength = 1, orderbookLength = 201) {

  const {lotSize, tickSize}  = {lotSize: 1, tickSize: 1}
  const mintRent = await useRentExemption(0);
  const vaultRent = useRentExemption(ACCOUNT_SIZE);
  let {
    marketRent,
    totalEventQueueSize,
    totalOrderbookSize,
    totalRequestQueueSize,
  } = await useSerumMarketAccountSizes({
    eventQueueLength,
    requestQueueLength,
    orderbookLength,
  });
  let baseMintKeypair: Keypair | undefined;
  let baseMint: PublicKey = basetToken.mint
  let baseMintDecimals: number = basetToken.decimals

  let quoteMintKeypair: Keypair | undefined;
  let quoteMint: PublicKey = quoteToken.mint
  let quoteMintDecimals: number = quoteToken.decimals

  const mintInstructions: TransactionInstruction[] = [];
  const mintSigners: Keypair[] = [];

  const vaultInstructions: TransactionInstruction[] = [];
  const vaultSigners: Keypair[] = [];

  const marketInstructions: TransactionInstruction[] = [];
  const marketSigners: Keypair[] = [];

  const marketAccounts = {
    market: Keypair.generate(),
    requestQueue: Keypair.generate(),
    eventQueue: Keypair.generate(),
    bids: Keypair.generate(),
    asks: Keypair.generate(),
    baseVault: Keypair.generate(),
    quoteVault: Keypair.generate(),
  };
  console.log('Open Market id: ' + marketAccounts.market.publicKey.toString())
  const [vaultOwner, vaultOwnerNonce] = await getVaultOwnerAndNonce(
    marketAccounts.market.publicKey,
    programID
  );

  vaultInstructions.push(
    ...[
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: marketAccounts.baseVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(
          ACCOUNT_SIZE
        ),
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: marketAccounts.quoteVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(
          ACCOUNT_SIZE
        ),
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        marketAccounts.baseVault.publicKey,
        baseMint,
        vaultOwner
      ),
      createInitializeAccountInstruction(
        marketAccounts.quoteVault.publicKey,
        quoteMint,
        vaultOwner
      ),
    ]
  );

  vaultSigners.push(marketAccounts.baseVault, marketAccounts.quoteVault);

  // tickSize and lotSize here are the 1e^(-x) values, so no check for ><= 0
  const baseLotSize = Math.round(
    10 ** baseMintDecimals * Math.pow(10, -1 * lotSize)
  );
  const quoteLotSize = Math.round(
    10 ** quoteMintDecimals *
    Math.pow(10, -1 * lotSize) *
    Math.pow(10, -1 * tickSize)
  );

  // create market account
  marketInstructions.push(
    SystemProgram.createAccount({
      newAccountPubkey: marketAccounts.market.publicKey,
      fromPubkey: wallet.publicKey,
      space: Market.getLayout(programID).span,
      lamports: await connection.getMinimumBalanceForRentExemption(
        Market.getLayout(programID).span
      ),
      programId: programID,
    })
  );

  // create request queue
  marketInstructions.push(
    SystemProgram.createAccount({
      newAccountPubkey: marketAccounts.requestQueue.publicKey,
      fromPubkey: wallet.publicKey,
      space: totalRequestQueueSize,
      lamports: await connection.getMinimumBalanceForRentExemption(
        totalRequestQueueSize
      ),
      programId: programID,
    })
  );

  // create event queue
  marketInstructions.push(
    SystemProgram.createAccount({
      newAccountPubkey: marketAccounts.eventQueue.publicKey,
      fromPubkey: wallet.publicKey,
      space: totalEventQueueSize,
      lamports: await connection.getMinimumBalanceForRentExemption(
        totalEventQueueSize
      ),
      programId: programID,
    })
  );

  const orderBookRentExempt =
    await connection.getMinimumBalanceForRentExemption(totalOrderbookSize);

  // create bids
  marketInstructions.push(
    SystemProgram.createAccount({
      newAccountPubkey: marketAccounts.bids.publicKey,
      fromPubkey: wallet.publicKey,
      space: totalOrderbookSize,
      lamports: orderBookRentExempt,
      programId: programID,
    })
  );

  // create asks
  marketInstructions.push(
    SystemProgram.createAccount({
      newAccountPubkey: marketAccounts.asks.publicKey,
      fromPubkey: wallet.publicKey,
      space: totalOrderbookSize,
      lamports: orderBookRentExempt,
      programId: programID,
    })
  );

  marketSigners.push(
    marketAccounts.market,
    marketAccounts.requestQueue,
    marketAccounts.eventQueue,
    marketAccounts.bids,
    marketAccounts.asks
  );

  marketInstructions.push(
    DexInstructions.initializeMarket({
      market: marketAccounts.market.publicKey,
      requestQueue: marketAccounts.requestQueue.publicKey,
      eventQueue: marketAccounts.eventQueue.publicKey,
      bids: marketAccounts.bids.publicKey,
      asks: marketAccounts.asks.publicKey,
      baseVault: marketAccounts.baseVault.publicKey,
      quoteVault: marketAccounts.quoteVault.publicKey,
      baseMint,
      quoteMint,
      baseLotSize: new BN(baseLotSize),
      quoteLotSize: new BN(quoteLotSize),
      feeRateBps: 150, // Unused in v3
      quoteDustThreshold: new BN(500), // Unused in v3
      vaultSignerNonce: vaultOwnerNonce,
      programId: programID,
    })
  );

  console.log('Vaults created: ' + (await repeatTx(connection, vaultInstructions, [wallet, ...vaultSigners])))
  console.log('Market created: ' + (await repeatTx(connection, marketInstructions, [wallet, ...marketSigners])))
  const number = getLatestDirNumber('wallets')
  await writeFile(marketAccounts.market.publicKey.toString(), 'wallets/' + number + '/' + basetToken.toString() + '/marketId.json')
  return marketAccounts.market.publicKey
}