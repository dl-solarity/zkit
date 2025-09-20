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
export declare function checkWitnessOverrides(
  symFilePath: string,
  overrides: Record<string, bigint>,
): Promise<Record<string, NumberLike>>;
/**
 * Iterates over signal entries in a `.sym` file line by line.
 *
 * Each line is parsed into a `SignalInfo` object which is passed to the provided callback.
 *
 * @param {string} symFilePath - The full path to the `.sym` file to read.
 * @param {(signalInfo: SignalInfo) => void} onSignal - Callback invoked for each signal line.
 */
export declare function iterateSymFile(symFilePath: string, onSignal: (signalInfo: SignalInfo) => void): Promise<void>;
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
export declare function modifyWitnessArray(
  witness: bigint[],
  signalIndexes: Record<string, NumberLike>,
  overrides: Record<string, bigint>,
): Promise<bigint[]>;
/**
 * Writes a witness array to a `.wtns` binary file.
 *
 * Reference: https://github.com/iden3/snarkjs/blob/bf28b1cb5aefcefab7e0f70f1fa5e40f764cca72/src/wtns_utils.js#L25C42-L25C47
 *
 * @param {string} witnessPath - Path to the existing `.wtns` file to read prime and overwrite with new witness.
 * @param {bigint[]} witness - The witness array to write.
 */
export declare function writeWitnessFile(witnessPath: string, witness: bigint[]): Promise<void>;
//# sourceMappingURL=witness-utils.d.ts.map
