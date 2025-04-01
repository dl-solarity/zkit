import os from "os";
import fs from "fs";
import path from "path";

import { BN128_CURVE_NAME } from "./constants";

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
 * Modifies specific signal values in a witness array.
 * Substitutes values in the witness array at positions defined by the `.sym` file.
 *
 * Signal names in `witnessOverrides` must be provided in their full form as represented in the `.sym` file, e.g.,
 * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
 *
 * Throws an error if any of the provided signal names is not found in the `.sym` file.
 *
 * @param {bigint[]} witness - The original witness array.
 * @param {string} symFile - Path to the `.sym` file containing signal-to-witness index mappings.
 * @param {Record<string, bigint>} overrides - Map of signal names to new witness values.
 * @returns {Promise<bigint[]>} The modified witness array.
 */
export async function modifyWitnessArray(
  witness: bigint[],
  symFile: string,
  overrides: Record<string, bigint>,
): Promise<bigint[]> {
  const signalIndexes = await loadSignalToIndexMap(symFile);

  for (const [signal, value] of Object.entries(overrides)) {
    const index = signalIndexes[signal];

    if (index === undefined) {
      throw new Error(`Signal ${signal} not found in .sym file`);
    }

    witness[index] = value;
  }

  return witness;
}

/**
 * Extracts the prime field value from a `.wtns` witness file.
 *
 * @param {string} wtnsPath - Full path to the `.wtns` witness file.
 * @returns {Promise<bigint>} The prime field value used in the witness file.
 */
export async function getWitnessPrime(wtnsPath: string): Promise<bigint> {
  const { fd, sections } = await binFileUtils.readBinFile(wtnsPath, "wtns", 2);

  await binFileUtils.startReadUniqueSection(fd, sections, 1);

  const n8 = await fd.readULE32();
  const prime = await binFileUtils.readBigInt(fd, n8);
  await fd.readULE32();

  await binFileUtils.endReadSection(fd);
  await fd.close();

  return prime;
}

/**
 * Writes a witness array to a `.wtns` binary file.
 *
 * Reference: https://github.com/iden3/snarkjs/blob/bf28b1cb5aefcefab7e0f70f1fa5e40f764cca72/src/wtns_utils.js#L25C42-L25C47
 *
 * @param {string} witnessPath - Full path where the `.wtns` file will be saved.
 * @param {bigint[]} witness - The witness array to write.
 * @param {bigint} prime - The prime field of the circuit.
 */
export async function writeWitnessFile(witnessPath: string, witness: bigint[], prime: bigint) {
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
 * Loads a map of circuit signal names to their corresponding witness indices.
 *
 * Parses the `.sym` file generated during circuit compilation to build the mapping.
 * Signals that do not appear in the witness are skipped.
 *
 * @param {string} symFilePath - The `.sym` file path.
 * @returns {Promise<Partial<Record<string, number>>>} A map of signal names to witness indices.
 */
async function loadSignalToIndexMap(symFilePath: string): Promise<Partial<Record<string, number>>> {
  const signalToWitnessIndex: Record<string, number> = {};

  const symsStr = await fs.promises.readFile(symFilePath, "utf8");

  const signals = symsStr.split("\n");

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i].split(",");

    if (signal.length != 4 || Number(signal[1]) < 0) {
      continue;
    }

    signalToWitnessIndex[signal[3]] = Number(signal[1]);
  }

  return signalToWitnessIndex;
}
