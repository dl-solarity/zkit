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
exports.CircuitZKit = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const snarkjs = __importStar(require("snarkjs"));
const crypto_1 = require("crypto");
const uuid_1 = require("uuid");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
/**
 * `CircuitZKit` represents a single circuit and provides a high-level API to work with it.
 */
class CircuitZKit {
    _config;
    _implementer;
    constructor(_config, _implementer) {
        this._config = _config;
        this._implementer = _implementer;
    }
    /**
     * Creates a verifier contract for the specified contract language with optional name suffix.
     * For more details regarding the structure of the contract verifier name, see {@link getVerifierName} description.
     *
     * In case the length of the verifier filename exceeds the {@link MAX_FILE_NAME_LENGTH},
     * the `verifierNameSuffix` will be replaced by the first four bytes of its `sha1` hash.
     *
     * If no suffix was passed, but the verifier's filename still exceeds {@link MAX_FILE_NAME_LENGTH}, an error will be thrown.
     *
     * @param {VerifierLanguageType} languageExtension - The verifier contract language extension.
     * @param {string} verifierNameSuffix - The optional verifier name suffix.
     */
    async createVerifier(languageExtension, verifierNameSuffix) {
        const vKeyFilePath = this.mustGetArtifactsFilePath("vkey");
        let verifierFileName = `${this.getVerifierName(verifierNameSuffix)}.${languageExtension}`;
        if (verifierFileName.length >= constants_1.MAX_FILE_NAME_LENGTH) {
            const modifiedSuffix = verifierNameSuffix
                ? `_0x${(0, crypto_1.createHash)("sha1").update(verifierNameSuffix).digest("hex").slice(0, 8)}_`
                : "";
            verifierFileName = `${this.getVerifierName(modifiedSuffix)}.${languageExtension}`;
            if (verifierFileName.length >= constants_1.MAX_FILE_NAME_LENGTH) {
                throw new Error(`Verifier file name "${verifierFileName}" exceeds the maximum file name length`);
            }
        }
        const verifierFilePath = path_1.default.join(this._config.verifierDirPath, verifierFileName);
        await this._implementer.createVerifier(vKeyFilePath, verifierFilePath, languageExtension);
    }
    /**
     * Calculates a witness for the given inputs.
     *
     * If `witnessOverrides` are provided, the corresponding witness values will be substituted in the result.
     *
     * Signal names in `witnessOverrides` must be provided in their full form as represented in the `.sym` file, e.g.,
     * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
     *
     * @param {Signals} inputs - The inputs for the circuit.
     * @param {Record<string, bigint>} [witnessOverrides] - Optional map of signal names to override their witness values.
     * @param {string} witnessFilePath - The inputs for the witness file path.
     * @returns {Promise<bigint[]>} The generated witness.
     */
    async calculateWitness(inputs, witnessOverrides, witnessFilePath) {
        const wtnsFile = witnessFilePath ?? this.getTemporaryWitnessPath();
        const wasmFile = this.mustGetArtifactsFilePath("wasm");
        let signalIndexes = {};
        if (witnessOverrides) {
            const symFile = this.mustGetArtifactsFilePath("sym");
            signalIndexes = await (0, utils_1.checkWitnessOverrides)(symFile, witnessOverrides);
        }
        await snarkjs.wtns.calculate(inputs, wasmFile, wtnsFile);
        const wtnsJson = (await snarkjs.wtns.exportJson(wtnsFile));
        return witnessOverrides ? (0, utils_1.modifyWitnessArray)(wtnsJson, signalIndexes, witnessOverrides) : wtnsJson;
    }
    /**
     * Generates a proof for the given inputs.
     *
     * @dev The `inputs` should be in the same order as the circuit expects them.
     *
     * If `witnessOverrides` are provided, the witness will be calculated from the inputs and overridden accordingly.
     * Otherwise, a standard witness will be calculated and used.
     *
     * Signal names in `witnessOverrides` must be provided in their full form as represented in the `.sym` file, e.g.,
     * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
     *
     * @param {Signals} inputs - The inputs for the circuit.
     * @param {Record<string, bigint>} [witnessOverrides] - Optional map of signal names to override their witness values.
     * @param {boolean} uniqueWitnessPath - The flag for unique witness path to avoid I/O concurrent conflicts. default - false
     * @returns {Promise<ProofStructByProtocol<Type>>} The generated proof.
     */
    async generateProof(inputs, witnessOverrides, uniqueWitnessPath = false) {
        const zKeyFile = this.mustGetArtifactsFilePath("zkey");
        const witnessFile = uniqueWitnessPath ? this.getTemporaryUniqueWitnessPath() : this.getTemporaryWitnessPath();
        let proof;
        try {
            const witness = await this.calculateWitness(inputs, witnessOverrides, witnessFile);
            if (witnessOverrides) {
                await (0, utils_1.writeWitnessFile)(witnessFile, witness);
            }
            proof = await this._implementer.generateProof(zKeyFile, witnessFile);
        }
        finally {
            if (fs_1.default.existsSync(witnessFile)) {
                fs_1.default.rmSync(witnessFile);
            }
        }
        return proof;
    }
    /**
     * Verifies the given proof.
     *
     * @dev The `proof` can be generated using the `generateProof` method.
     * @dev The `proof.publicSignals` should be in the same order as the circuit expects them.
     *
     * @param {ProofStructByProtocol<Type>} proof - The proof to verify.
     * @returns {Promise<boolean>} Whether the proof is valid.
     */
    async verifyProof(proof) {
        const vKeyFile = this.mustGetArtifactsFilePath("vkey");
        return this._implementer.verifyProof(proof, vKeyFile);
    }
    /**
     * Generates the calldata for the given proof. The calldata can be used to verify the proof on-chain.
     *
     * @param {ProofStructByProtocol<Type>} proof - The proof to generate calldata for.
     * @returns {Promise<CalldataByProtocol<Type>>} - The generated calldata.
     */
    async generateCalldata(proof) {
        return await this._implementer.generateCalldata(proof);
    }
    /**
     * Returns the circuit name. The circuit name is the name of the circuit file without the extension.
     *
     * @returns {string} The circuit name.
     */
    getCircuitName() {
        return this._config.circuitName;
    }
    /**
     * Returns the verifier name. The verifier name has the next structure:
     * `<template name><suffix><proving system>Verifier.<extension>`.
     *
     * @param {string} verifierNameSuffix - The optional verifier name suffix.
     *
     * @returns {string} The verifier name.
     */
    getVerifierName(verifierNameSuffix) {
        return this._implementer.getVerifierName(this._config.circuitName, verifierNameSuffix);
    }
    /**
     * Returns the type of the proving protocol
     *
     * @returns {ProvingSystemType} The protocol proving system type.
     */
    getProvingSystemType() {
        return this._implementer.getProvingSystemType();
    }
    /**
     * Returns the Solidity verifier template.
     *
     * @returns {string} The Solidity verifier template.
     */
    getVerifierTemplate(languageExtension) {
        return this._implementer.getTemplate(languageExtension);
    }
    /**
     * Returns the path to the temporary witness file.
     *
     * The file is stored in the system temporary directory and is named after the circuit.
     * This file is used for intermediate witness generation and may be deleted after usage.
     *
     * @returns {string} The full path to the temporary `.wtns` file.
     */
    getTemporaryWitnessPath() {
        return path_1.default.join((0, utils_1.getTmpDir)(), `${this.getCircuitName()}.wtns`);
    }
    /**
     * Returns the path to the temporary witness file with uniqueness.
     *
     * The file is stored in the system temporary directory and is named after the circuit with uniqueness.
     * This file is used for intermediate witness generation and may be deleted after usage.
     *
     * @returns {string} The full path to the temporary `.wtns` file.
     */
    getTemporaryUniqueWitnessPath() {
        return path_1.default.join((0, utils_1.getTmpDir)(), `${this.getCircuitName()}-${(0, uuid_1.v4)()}.wtns`);
    }
    /**
     * Returns the path to the file of the given type inside artifacts directory. Throws an error if the file doesn't exist.
     *
     * @param {ArtifactsFileType} fileType - The type of the file.
     * @returns {string} The path to the file.
     */
    mustGetArtifactsFilePath(fileType) {
        const file = this.getArtifactsFilePath(fileType);
        if (!fs_1.default.existsSync(file)) {
            throw new Error(`Expected the file "${file}" to exist`);
        }
        return file;
    }
    /**
     * Returns the path to the file of the given type inside artifacts directory.
     *
     * @param {ArtifactsFileType} fileType - The type of the file.
     * @returns {string} The path to the file.
     */
    getArtifactsFilePath(fileType) {
        const circuitName = this.getCircuitName();
        let fileName;
        let fileDir = this._config.circuitArtifactsPath;
        switch (fileType) {
            case "r1cs":
                fileName = `${circuitName}.r1cs`;
                break;
            case "zkey":
                fileName = `${this._implementer.getZKeyFileName(circuitName)}`;
                break;
            case "vkey":
                fileName = `${this._implementer.getVKeyFileName(circuitName)}`;
                break;
            case "sym":
                fileName = `${circuitName}.sym`;
                break;
            case "json":
                fileName = `${circuitName}_constraints.json`;
                break;
            case "wasm":
                fileName = `${circuitName}.wasm`;
                fileDir = path_1.default.join(fileDir, `${circuitName}_js`);
                break;
            default:
                throw new Error(`Ambiguous file type: ${fileType}.`);
        }
        return path_1.default.join(fileDir, fileName);
    }
}
exports.CircuitZKit = CircuitZKit;
//# sourceMappingURL=CircuitZKit.js.map