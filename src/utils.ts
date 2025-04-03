import os from "os";
import fs from "fs";
import path from "path";

import { BN128_CURVE_NAME } from "./constants";

import * as readline from "readline";

import * as snarkjs from "snarkjs";
// @ts-ignore
import { Scalar } from "ffjavascript";
// @ts-ignore
import * as binFileUtils from "@iden3/binfileutils";

/**
 * Terminates the BN128 curve instance used by SnarkJS.
 */
export async function terminateCurve() {
  await (await (snarkjs as any).curves.getCurveFromName(BN128_CURVE_NAME)).terminate();
}

/**
 * Returns the path to the temporary directory used by ZKit.
 *
 * Creates the directory if it does not exist.
 *
 * @returns {string} The path to the temporary `.zkit` directory inside the OS temp folder.
 */
export function getTmpDir(): string {
  const tmpDir = path.join(os.tmpdir(), ".zkit");

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  return tmpDir;
}

/**
 * Validates the provided witness overrides against the `.sym` file and returns the signal-to-index map.
 *
 * Reads the `.sym` file line by line and builds a mapping of signal names to their witness indices.
 * Ensures that all keys in `overrides` exist in the `.sym` file.
 * Throws an error listing all missing signals if any override key is not found.
 *
 * Signal names in `overrides` must be in their full form as represented in the `.sym` file, e.g.,
 * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
 *
 * @param {string} symFile - Path to the `.sym` file.
 * @param {Record<string, bigint>} overrides - Map of signal names to new witness values.
 * @returns {Promise<Record<string, number>>} Map of signal names to their corresponding witness indices.
 */
export async function checkWitnessOverrides(
  symFile: string,
  overrides: Record<string, bigint>,
): Promise<Record<string, number>> {
  const signalToWitnessIndex: Record<string, number> = {};

  const missingSignals = new Set(Object.keys(overrides));

  const fileStream = fs.createReadStream(symFile, { encoding: "utf8" });
  const signals = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const signal of signals) {
    const signalInfo = signal.split(",");

    if (signalInfo.length != 4 || Number(signalInfo[1]) < 0) {
      continue;
    }

    signalToWitnessIndex[signalInfo[3]] = Number(signalInfo[1]);

    missingSignals.delete(signalInfo[3]);
  }

  if (missingSignals.size > 0) {
    throw new Error(`Signals not found in .sym file: ${Array.from(missingSignals).join(", ")}`);
  }

  return signalToWitnessIndex;
}

/**
 * Modifies specific signal values in a witness array.
 * Substitutes signal from `overrides` in the witness array at positions defined in `signalIndexes`.
 *
 * Signal names in `overrides` must be provided in their full form as represented in the `.sym` file, e.g.,
 * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
 *
 * @param {bigint[]} witness - The original witness array.
 * @param {Record<string, number>} signalIndexes - Map of signal names to their witness indices.
 * @param {Record<string, bigint>} overrides - Map of signal names to new witness values.
 * @returns {Promise<bigint[]>} The modified witness array.
 */
export async function modifyWitnessArray(
  witness: bigint[],
  signalIndexes: Record<string, number>,
  overrides: Record<string, bigint>,
): Promise<bigint[]> {
  for (const [signal, value] of Object.entries(overrides)) {
    const index = signalIndexes[signal];

    witness[index] = value;
  }

  return witness;
}

/**
 * Writes a witness array to a `.wtns` binary file.
 *
 * Reference: https://github.com/iden3/snarkjs/blob/bf28b1cb5aefcefab7e0f70f1fa5e40f764cca72/src/wtns_utils.js#L25C42-L25C47
 *
 * @param {string} witnessPath - Path to the existing `.wtns` file to read prime and overwrite with new witness.
 * @param {bigint[]} witness - The witness array to write.
 */
export async function writeWitnessFile(witnessPath: string, witness: bigint[]) {
  const prime = await getWitnessPrime(witnessPath);

  const fd = await binFileUtils.createBinFile(witnessPath, "wtns", 2, 2);

  await binFileUtils.startWriteSection(fd, 1);

  const n8 = (Math.floor((Scalar.bitLength(prime) - 1) / 64) + 1) * 8;
  await fd.writeULE32(n8);
  await binFileUtils.writeBigInt(fd, prime, n8);

  await fd.writeULE32(witness.length);

  await binFileUtils.endWriteSection(fd);

  await binFileUtils.startWriteSection(fd, 2);

  for (let i = 0; i < witness.length; i++) {
    await binFileUtils.writeBigInt(fd, witness[i], n8);
  }

  await binFileUtils.endWriteSection(fd, 2);

  await fd.close();
}

/**
 * Extracts the prime field value from a `.wtns` witness file.
 *
 * @param {string} wtnsPath - Full path to the `.wtns` witness file.
 * @returns {Promise<bigint>} The prime field value used in the witness file.
 */
async function getWitnessPrime(wtnsPath: string): Promise<bigint> {
  const { fd, sections } = await binFileUtils.readBinFile(wtnsPath, "wtns", 2);

  await binFileUtils.startReadUniqueSection(fd, sections, 1);

  const n8 = await fd.readULE32();
  const prime = await binFileUtils.readBigInt(fd, n8);
  await fd.readULE32();

  await binFileUtils.endReadSection(fd);
  await fd.close();

  return prime;
}
