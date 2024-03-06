import { Keypair } from '@solana/web3.js'
import fs from 'fs'

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