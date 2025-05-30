import fs from "fs";

import * as readline from "readline";

// @ts-ignore
import { Scalar } from "ffjavascript";
// @ts-ignore
import * as binFileUtils from "@iden3/binfileutils";

import { NumberLike, SignalInfo } from "../types";

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
 * @param {string} symFilePath - Path to the `.sym` file.
 * @param {Record<string, bigint>} overrides - Map of signal names to new witness values.
 * @returns {Promise<Record<string, NumberLike>>} Map of signal names to their corresponding witness indices.
 */
export async function checkWitnessOverrides(
  symFilePath: string,
  overrides: Record<string, bigint>,
): Promise<Record<string, NumberLike>> {
  const signalToWitnessIndex: Record<string, NumberLike> = {};

  const missingSignals = new Set(Object.keys(overrides));

  await iterateSymFile(symFilePath, (signalInfo) => {
    if (BigInt(signalInfo.witnessIndex) >= 0) {
      signalToWitnessIndex[signalInfo.signalName] = signalInfo.witnessIndex;

      missingSignals.delete(signalInfo.signalName);
    }
  });

  if (missingSignals.size > 0) {
    throw new Error(`Signals not found in .sym file: ${Array.from(missingSignals).join(", ")}`);
  }

  return signalToWitnessIndex;
}

/**
 * Iterates over signal entries in a `.sym` file line by line.
 *
 * Each line is parsed into a `SignalInfo` object which is passed to the provided callback.
 *
 * @param {string} symFilePath - The full path to the `.sym` file to read.
 * @param {(signalInfo: SignalInfo) => void} onSignal - Callback invoked for each signal line.
 */
export async function iterateSymFile(symFilePath: string, onSignal: (signalInfo: SignalInfo) => void) {
  const fileStream = fs.createReadStream(symFilePath, { encoding: "utf8" });
  const signals = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const signal of signals) {
    const signalInfo = signal.split(",");

    if (signalInfo.length != 4) {
      continue;
    }

    onSignal({
      id: BigInt(signalInfo[0]),
      witnessIndex: BigInt(signalInfo[1]),
      componentId: BigInt(signalInfo[2]),
      signalName: signalInfo[3],
    });
  }
}

/**
 * Modifies specific signal values in a witness array.
 * Substitutes signal from `overrides` in the witness array at positions defined in `signalIndexes`.
 *
 * Signal names in `overrides` must be provided in their full form as represented in the `.sym` file, e.g.,
 * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
 *
 * @param {bigint[]} witness - The original witness array.
 * @param {Record<string, NumberLike>} signalIndexes - Map of signal names to their witness indices.
 * @param {Record<string, bigint>} overrides - Map of signal names to new witness values.
 * @returns {Promise<bigint[]>} The modified witness array.
 */
export async function modifyWitnessArray(
  witness: bigint[],
  signalIndexes: Record<string, NumberLike>,
  overrides: Record<string, bigint>,
): Promise<bigint[]> {
  for (const [signal, value] of Object.entries(overrides)) {
    const index = Number(signalIndexes[signal]);

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
