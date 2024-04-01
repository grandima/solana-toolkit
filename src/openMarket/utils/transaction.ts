
import {
  Connection,
  Keypair,
  Signer,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

export type TransactionWithSigners = {
  transaction: Transaction;
  signers: Array<Signer>;
};

export async function sendWalletTransaction(
  connection: Connection,
  tx: Transaction,
  wallet: Keypair,
  signers?: Signer[]
) {
  if (!wallet.publicKey) throw new Error("Wallet is not initialized");


  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  tx.sign(wallet)

  if (signers && signers.length > 0) tx.partialSign(...signers);

  const txSig = await connection.sendRawTransaction(await tx.serialize());

  await connection.confirmTransaction({
    signature: txSig,
    blockhash,
    lastValidBlockHeight,
  });

  return txSig;
}

export async function signTransactions({
                                         transactionsAndSigners,
                                         wallet,
                                         connection,
                                       }: {
  transactionsAndSigners: TransactionWithSigners[];
  wallet: Keypair
  connection: Connection;
}) {

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("max");
  transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.setSigners(
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    );
    if (signers?.length > 0) {
      transaction.partialSign(...signers);
    }
  });

  return transactionsAndSigners.map(({ transaction }) => {
    transaction.sign(wallet)
    return transaction
  })
}

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

const DEFAULT_TIMEOUT = 30000;

