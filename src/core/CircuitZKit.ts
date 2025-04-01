import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import { createHash } from "crypto";

// @ts-ignore
import * as binFileUtils from "@iden3/binfileutils";
// @ts-ignore
import * as wtnsUtils from "snarkjs/src/wtns_utils.js";

import { ArtifactsFileType, CircuitZKitConfig, VerifierLanguageType } from "../types/circuit-zkit";
import { Signals } from "../types/proof-utils";
import { CalldataByProtocol, IProtocolImplementer, ProofStructByProtocol, ProvingSystemType } from "../types/protocols";

import { MAX_FILE_NAME_LENGTH } from "../constants";
import { getTmpDir, getWitnessPrime, writeWitnessFile } from "../utils";

/**
 * `CircuitZKit` represents a single circuit and provides a high-level API to work with it.
 */
export class CircuitZKit<Type extends ProvingSystemType> {
  constructor(
    private readonly _config: CircuitZKitConfig,
    private readonly _implementer: IProtocolImplementer<Type>,
  ) {}

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
  public async createVerifier(languageExtension: VerifierLanguageType, verifierNameSuffix?: string): Promise<void> {
    const vKeyFilePath: string = this.mustGetArtifactsFilePath("vkey");

    let verifierFileName: string = `${this.getVerifierName(verifierNameSuffix)}.${languageExtension}`;

    if (verifierFileName.length >= MAX_FILE_NAME_LENGTH) {
      const modifiedSuffix: string = verifierNameSuffix
        ? `_0x${createHash("sha1").update(verifierNameSuffix).digest("hex").slice(0, 8)}_`
        : "";

      verifierFileName = `${this.getVerifierName(modifiedSuffix)}.${languageExtension}`;

      if (verifierFileName.length >= MAX_FILE_NAME_LENGTH) {
        throw new Error(`Verifier file name "${verifierFileName}" exceeds the maximum file name length`);
      }
    }

    const verifierFilePath = path.join(this._config.verifierDirPath, verifierFileName);

    this._implementer.createVerifier(vKeyFilePath, verifierFilePath, languageExtension);
  }

  /**
   * Calculates a witness for the given inputs.
   *
   * @param {Signals} inputs - The inputs for the circuit.
   * @returns {Promise<bigint[]>} The generated witness.
   */
  public async calculateWitness(inputs: Signals): Promise<bigint[]> {
    const wtnsFile = path.join(getTmpDir(), `${this.getCircuitName()}.wtns`);
    const wasmFile = this.mustGetArtifactsFilePath("wasm");

    await snarkjs.wtns.calculate(inputs, wasmFile, wtnsFile);

    const wtnsJson = await snarkjs.wtns.exportJson(wtnsFile);

    return wtnsJson as bigint[];
  }

  /**
   * Modifies specific signals in the existing witness and saves the result to a new `_modified.wtns` file.
   *
   * Enables creation of an invalid witness for testing negative scenarios.
   * Once called, the circuit will use the modified witness file instead of the original one during proof generation.
   *
   * Signal names must be provided in their full form as represented in the `.sym` file, e.g.,
   * `main.signal`, `main.component.signal`, or `main.component.signal[n][m]`.
   *
   * Throws an error if any of the provided signal names is not in the witness file.
   *
   * @param {Record<string, bigint>} overrides - A map of signal names to new witness values.
   * @returns {Promise<bigint[]>} The modified witness.
   */
  public async modifyWitness(overrides: Record<string, bigint>): Promise<bigint[]> {
    const tmpDir = getTmpDir();
    const circuitName = this.getCircuitName();

    const wtnsFile = path.join(tmpDir, `${circuitName}.wtns`);
    const modifiedWtnsFile = path.join(tmpDir, `${circuitName}_modified.wtns`);

    const witness = (await snarkjs.wtns.exportJson(wtnsFile)) as bigint[];

    const signalIndexes = await this.loadSignalToIndexMap();

    for (const [signal, value] of Object.entries(overrides)) {
      const index = signalIndexes[signal];

      if (index === undefined) {
        throw new Error(`Signal ${signal} not found in .sym file`);
      }

      witness[index] = value;
    }

    const prime = await getWitnessPrime(wtnsFile);
    await writeWitnessFile(modifiedWtnsFile, witness, prime);

    return witness;
  }

  /**
   * Removes the modified witness file, if it exists.
   *
   * After calling this method, the circuit will fall back to using the original witness file during proof generation.
   *
   * It does nothing if the modified witness file does not exist.
   */
  public async resetWitness() {
    const modifiedWtnsFile = path.join(getTmpDir(), `${this.getCircuitName()}_modified.wtns`);

    if (fs.existsSync(modifiedWtnsFile)) {
      fs.rmSync(modifiedWtnsFile);
    }
  }

  /**
   * Generates a proof for the existing witness file or given inputs.
   *
   * The proof is generated using the modified witness if it exists, otherwise the original witness.
   * If no witness is available, it will be calculated from the provided inputs.
   *
   * @dev The `inputs` are required only if no witness file exists.
   *      They should be in the same order as the circuit expects them.
   *
   * @param {Signals} inputs - Optional inputs to calculate the witness if missing.
   * @returns {Promise<ProofStructByProtocol<Type>>} The generated proof.
   */
  public async generateProof(inputs?: Signals): Promise<ProofStructByProtocol<Type>> {
    const zKeyFile = this.mustGetArtifactsFilePath("zkey");
    const witnessFile = await this.getWitnessFilePath(inputs);

    return await this._implementer.generateProof(zKeyFile, witnessFile);
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
  public async verifyProof(proof: ProofStructByProtocol<Type>): Promise<boolean> {
    const vKeyFile = this.mustGetArtifactsFilePath("vkey");

    return this._implementer.verifyProof(proof, vKeyFile);
  }

  /**
   * Generates the calldata for the given proof. The calldata can be used to verify the proof on-chain.
   *
   * @param {ProofStructByProtocol<Type>} proof - The proof to generate calldata for.
   * @returns {Promise<CalldataByProtocol<Type>>} - The generated calldata.
   */
  public async generateCalldata(proof: ProofStructByProtocol<Type>): Promise<CalldataByProtocol<Type>> {
    return await this._implementer.generateCalldata(proof);
  }

  /**
   * Returns the circuit name. The circuit name is the name of the circuit file without the extension.
   *
   * @returns {string} The circuit name.
   */
  public getCircuitName(): string {
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
  public getVerifierName(verifierNameSuffix?: string): string {
    return this._implementer.getVerifierName(this._config.circuitName, verifierNameSuffix);
  }

  /**
   * Returns the type of the proving protocol
   *
   * @returns {ProvingSystemType} The protocol proving system type.
   */
  public getProvingSystemType(): ProvingSystemType {
    return this._implementer.getProvingSystemType();
  }

  /**
   * Returns the Solidity verifier template.
   *
   * @returns {string} The Solidity verifier template.
   */
  public getVerifierTemplate(languageExtension: VerifierLanguageType): string {
    return this._implementer.getTemplate(languageExtension);
  }

  /**
   * Returns the path to the file of the given type inside artifacts directory. Throws an error if the file doesn't exist.
   *
   * @param {ArtifactsFileType} fileType - The type of the file.
   * @returns {string} The path to the file.
   */
  public mustGetArtifactsFilePath(fileType: ArtifactsFileType): string {
    const file = this.getArtifactsFilePath(fileType);

    if (!fs.existsSync(file)) {
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
  public getArtifactsFilePath(fileType: ArtifactsFileType): string {
    const circuitName = this.getCircuitName();

    let fileName: string;
    let fileDir: string = this._config.circuitArtifactsPath;

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
        fileDir = path.join(fileDir, `${circuitName}_js`);
        break;
      default:
        throw new Error(`Ambiguous file type: ${fileType}.`);
    }

    return path.join(fileDir, fileName);
  }

  /**
   * Retrieves the path to the witness file.
   *
   * Returns the path to the modified witness file if available;
   * otherwise, returns the original or calculates it using provided `inputs`.
   *
   * Throws an error if the witness file is missing and `inputs` are not provided.
   *
   * @param {Signals} [inputs] - Optional inputs to calculate the witness if missing.
   * @returns {Promise<string>} The path to the witness file.
   */
  public async getWitnessFilePath(inputs?: Signals): Promise<string> {
    const tmpDir = getTmpDir();
    const circuitName = this.getCircuitName();

    const modifiedWitness = path.join(tmpDir, `${circuitName}_modified.wtns`);
    const originalWitness = path.join(tmpDir, `${circuitName}.wtns`);

    if (fs.existsSync(modifiedWitness)) {
      return modifiedWitness;
    }

    if (fs.existsSync(originalWitness)) {
      return originalWitness;
    }

    if (!inputs) {
      throw new Error(`Witness file not found. Inputs are required to calculate witness.`);
    }

    await this.calculateWitness(inputs);

    return originalWitness;
  }

  /**
   * Loads a map of circuit signal names to their corresponding witness indices.
   *
   * Parses the `.sym` file generated during circuit compilation to build the mapping.
   * Signals that do not appear in the witness are skipped.
   *
   * @returns {Promise<Partial<Record<string, number>>>} A map of signal names to witness indices.
   */
  private async loadSignalToIndexMap(): Promise<Partial<Record<string, number>>> {
    const symFile = this.mustGetArtifactsFilePath("sym");

    const signalToWitnessIndex: Record<string, number> = {};

    const symsStr = await fs.promises.readFile(symFile, "utf8");

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
}
