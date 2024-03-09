import { Keypair } from '@solana/web3.js'
import fs from 'fs'

export async function saveKeypair(keypair: Keypair, path: string) {
  const secret_array = keypair.secretKey
    .toString()
    .split(',')
    .map(value=>Number(value));
  const secret = JSON.stringify(secret_array);
  await fs.promises.writeFile(path, secret, 'utf8');
}
export async function loadKeyFrom(path: string) {
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(await fs.promises.readFile(path, 'utf8'))))
}
export async function loadKeys(directory: string): Promise<Keypair[]> {
  const filePaths = (await fs.promises.readdir(directory)).filter((name) => name.includes('wallet'))
  let files = []
  for (const filePath of filePaths) {
    files.push(Keypair.fromSecretKey(new Uint8Array(JSON.parse(await fs.promises.readFile(directory+'/'+filePath, 'utf8')))));
  }
  return files;
}