"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWitnessOverrides = checkWitnessOverrides;
exports.iterateSymFile = iterateSymFile;
exports.modifyWitnessArray = modifyWitnessArray;
exports.writeWitnessFile = writeWitnessFile;
const fs_1 = __importDefault(require("fs"));
const readline = __importStar(require("readline"));
// @ts-ignore
const ffjavascript_1 = require("ffjavascript");
// @ts-ignore
const binFileUtils = __importStar(require("@iden3/binfileutils"));
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
async function checkWitnessOverrides(symFilePath, overrides) {
    const signalToWitnessIndex = {};
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
async function iterateSymFile(symFilePath, onSignal) {
    const fileStream = fs_1.default.createReadStream(symFilePath, { encoding: "utf8" });
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
async function modifyWitnessArray(witness, signalIndexes, overrides) {
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
async function writeWitnessFile(witnessPath, witness) {
    const prime = await getWitnessPrime(witnessPath);
    const fd = await binFileUtils.createBinFile(witnessPath, "wtns", 2, 2);
    await binFileUtils.startWriteSection(fd, 1);
    const n8 = (Math.floor((ffjavascript_1.Scalar.bitLength(prime) - 1) / 64) + 1) * 8;
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
async function getWitnessPrime(wtnsPath) {
    const { fd, sections } = await binFileUtils.readBinFile(wtnsPath, "wtns", 2);
    await binFileUtils.startReadUniqueSection(fd, sections, 1);
    const n8 = await fd.readULE32();
    const prime = await binFileUtils.readBigInt(fd, n8);
    await fd.readULE32();
    await binFileUtils.endReadSection(fd);
    await fd.close();
    return prime;
}
//# sourceMappingURL=witness-utils.js.map