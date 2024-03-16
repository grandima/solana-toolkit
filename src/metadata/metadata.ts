import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { getMetadata } from './upload'
import { createSignerFromKeypair, HasWrappedInstructions } from '@metaplex-foundation/umi'
import { fromWeb3JsInstruction, fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { createMetadataAccountV3 } from '@metaplex-foundation/mpl-token-metadata'
import { base58 } from '@metaplex-foundation/umi/serializers'
import { WrappedInstruction } from '@metaplex-foundation/umi/src/Instruction'

export async function updateMetadata(connection: Connection, superWallet: Keypair, mint: PublicKey, imagePath: string, jsonPath: string) {
  const umi = createUmi(connection.rpcEndpoint);
  const userWallet = umi.eddsa.createKeypairFromSecretKey(superWallet.secretKey)
  const data = await getMetadata(imagePath, jsonPath)
  const json = data['json']
  const metadata = {
    // @ts-ignore
    name: json['name'] as string,
    // @ts-ignore
    symbol: json['symbol'] as string,
    // @ts-ignore
    uri: json['image'],
  };

  const signer = createSignerFromKeypair(umi, userWallet);
  umi.identity = signer;
  umi.payer = signer;

  let CreateMetadataAccountV3Args = {
    //accounts
    mint: fromWeb3JsPublicKey(mint),
    mintAuthority: umi.identity,
    payer: signer,
    updateAuthority: userWallet.publicKey,
    data: {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    },
    isMutable: false,
    collectionDetails: null,
  }
  let instruction = createMetadataAccountV3(
    umi,
    CreateMetadataAccountV3Args
  )
instruction.add([
  {
    instruction: fromWeb3JsInstruction(ComputeBudgetProgram.setComputeUnitLimit({units: 18500})),
    signers: [signer],
    bytesCreatedOnChain: 0
  },
  {
    instruction: fromWeb3JsInstruction(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 2000688})),
    signers: [signer],
    bytesCreatedOnChain: 0
  }
])
  const transaction = await instruction.buildAndSign(umi);
  const transactionSignature = await umi.rpc.sendTransaction(transaction, {skipPreflight: true, maxRetries: 100});
  const signature = base58.deserialize(transactionSignature)
  console.log('add metadata signature: ' + signature[0])
  return signature[0]
}

// updateMetadata(TRADE_INFO.token.mint)