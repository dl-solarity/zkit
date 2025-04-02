import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import { createHash } from "crypto";

import { ArtifactsFileType, CircuitZKitConfig, VerifierLanguageType } from "../types/circuit-zkit";
import { Signals } from "../types/proof-utils";
import { CalldataByProtocol, IProtocolImplementer, ProofStructByProtocol, ProvingSystemType } from "../types/protocols";

import { MAX_FILE_NAME_LENGTH } from "../constants";
import { getTmpDir, modifyWitnessArray, writeWitnessFile } from "../utils";

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
   * @returns {Promise<bigint[]>} The generated witness.
   */
  public async calculateWitness(inputs: Signals, witnessOverrides?: Record<string, bigint>): Promise<bigint[]> {
    const wtnsFile = this.getTemporaryWitnessPath();
    const wasmFile = this.mustGetArtifactsFilePath("wasm");
    const symFile = this.mustGetArtifactsFilePath("sym");

    await snarkjs.wtns.calculate(inputs, wasmFile, wtnsFile);

    const wtnsJson = (await snarkjs.wtns.exportJson(wtnsFile)) as bigint[];

    return witnessOverrides ? modifyWitnessArray(wtnsJson, symFile, witnessOverrides) : wtnsJson;
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
   * @returns {Promise<ProofStructByProtocol<Type>>} The generated proof.
   */
  public async generateProof(
    inputs: Signals,
    witnessOverrides?: Record<string, bigint>,
  ): Promise<ProofStructByProtocol<Type>> {
    const zKeyFile = this.mustGetArtifactsFilePath("zkey");
    const witnessFile = this.getTemporaryWitnessPath();

    let proof: ProofStructByProtocol<Type>;

    try {
      const witness = await this.calculateWitness(inputs, witnessOverrides);

      if (witnessOverrides) {
        await writeWitnessFile(witnessFile, witness);
      }

      proof = await this._implementer.generateProof(zKeyFile, witnessFile);
    } finally {
      fs.rmSync(witnessFile);
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

  private getTemporaryWitnessPath(): string {
    return path.join(getTmpDir(), `${this.getCircuitName()}.wtns`);
  }
}
