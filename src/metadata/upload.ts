// Import the NFTStorage class and File constructor from the 'nft.storage' package
import { NFTStorage, File } from 'nft.storage'

// The 'mime' npm package helps us set the correct file type on our File objects
import mime from 'mime'

// The 'fs' builtin module on Node.js provides access to the file system
import fs from 'fs'
import {promises} from 'fs'
// The 'path' module provides helpers for manipulating filesystem paths
import path from 'path'
import { NFT_STORAGE_KEY } from '../config'

// Paste your NFT.Storage API key into the quotes:


async function storeNFT(data: Blob) {
  const nftstorage = new NFTStorage({ token: NFT_STORAGE_KEY })
  return await nftstorage.storeBlob(data)
}

/**
 * A helper to read a file from a location on disk and return a File object.
 * Note that this reads the entire file into memory and should not be used for
 * very large files.
 * @param {string} filePath the path to a file to store
 * @returns {File} a File object containing the file content
 */
async function fileFromPath(filePath: string) {
  const content = await fs.promises.readFile(filePath)
  const type = mime.getType(filePath) as string
  return new File([content], path.basename(filePath), { type })
}

//'metadata/info.json'
async function metadataJSON(jsonPath: string): Promise<Object> {
  // @ts-ignore
  return JSON.parse(await fs.promises.readFile(jsonPath))
}
// 'metadata/picture.png'
export async function getMetadata(imagePath: string, jsonPath: string, shouldStoreNFT = false) {
  const image = await fileFromPath(imagePath)
  if (shouldStoreNFT) {
    const imageResult = await storeNFT(image)
  }
  const desc = await metadataJSON(jsonPath)

  if (shouldStoreNFT) {
    // @ts-ignore
    desc['image'] = 'https://' + imageResult + '.ipfs.nftstorage.link/'
  }

  const metadataResult = await storeNFT(new Blob([JSON.stringify(desc)]))
  if (shouldStoreNFT) {
    return {'link': 'https://' + metadataResult + '.ipfs.nftstorage.link/', 'json': desc}
  }
  return {'json': desc}
}

// Don't forget to actually call the main function!
// We can't `await` things at the top level, so this adds
// a .catch() to grab any errors and print them to the console.
// getMetadata()
//   .catch(err => {
//     console.error(err)
//     process.exit(1)
//   })