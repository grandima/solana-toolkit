import * as fs from "fs";
import {Dirent, existsSync, mkdirSync} from "fs";
import * as path from 'path';
import {join} from 'path';
export async function getNewFileName(directory: string){
  // Read the directory contents
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory)
  }
  const files = await fs.promises.readdir(directory)
  // Filter and sort the files that match the pattern "file<number>"
  const filePattern = /^wallet(\d+)\.json$/;
  const fileNumbers = files
    .map(file => {
      const match = file.match(filePattern);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((num): num is number => num !== null)
    .sort((a, b) => a - b);

  // Determine the next file number
  const lastNumber = fileNumbers[fileNumbers.length - 1];
  const nextNumber = lastNumber !== undefined ? lastNumber + 1 : 1;

  // Create the next file
  const newFileName = `wallet${nextNumber}`;
  return path.join(directory, newFileName)
}

export async function writeFile(data: string, path: string) {
  try {
    await fs.promises.access(path)
    await fs.promises.unlink(path)
  } catch (_) {
  }
  await fs.promises.writeFile(path, data)
}

export function getLatestDirNumber(basePath: string) {
  let latestNumber = 1;

  // Loop to find the next available folder number
  while (existsSync(join(basePath, latestNumber.toString()))) {
    latestNumber++;
  }
  return latestNumber - 1
}
export function createNextFolder(basePath: string) {
  let nextFolderNumber = 1;

  // Loop to find the next available folder number
  while (existsSync(join(basePath, nextFolderNumber.toString()))) {
    nextFolderNumber++;
  }

  // Create the folder with the next available number
  const folderPath = join(basePath, nextFolderNumber.toString());
  mkdirSync(folderPath);
  return folderPath
}

export async function getFirstFolderName(directoryPath: string): Promise<string | null> {
  try {
    const dirents: Dirent[] = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const firstFolder = dirents.find(dirent => dirent.isDirectory());
    return firstFolder ? firstFolder.name : null;
  } catch (error) {
    console.error('An error occurred:', error);
    return null;
  }
}