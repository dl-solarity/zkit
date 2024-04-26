import fs from "fs";

export function createDirIfNotExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Expected the dir "${dirPath}" to exist`);
  }
}

export function ensureFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected the file "${filePath}" to exist`);
  }
}
