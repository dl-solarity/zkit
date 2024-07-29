import fs from "fs";
import path from "path";

import { ArtifactsFileType, CircuitZKitConfig } from "../types/circuit-zkit";
import { Inputs } from "../types/proof-utils";
import { CalldataByProtocol, IProtocolImplementer, ProofStructByProtocol, ProtocolType } from "../types/protocols";

/**
 * `CircuitZKit` represents a single circuit and provides a high-level API to work with it.
 */
export class CircuitZKit<Type extends ProtocolType> {
  constructor(
    private readonly _config: CircuitZKitConfig,
    private readonly _implementer: IProtocolImplementer<Type>,
  ) {}

  /**
   * Creates a Solidity verifier contract.
   */
  public async createVerifier(): Promise<void> {
    const vKeyFilePath: string = this.mustGetArtifactsFilePath("vkey");
    const verifierFilePath = path.join(
      this._config.verifierDirPath,
      `${this._implementer.getVerifierName(this._config.circuitName)}.sol`,
    );

    this._implementer.createVerifier(this._config.circuitName, vKeyFilePath, verifierFilePath);
  }

  /**
   * Generates a proof for the given inputs.
   *
   * @dev The `inputs` should be in the same order as the circuit expects them.
   *
   * @param {Inputs} inputs - The inputs for the circuit.
   * @returns {Promise<ProofStructByProtocol<Type>>} The generated proof.
   * @todo Add support for other proving systems.
   */
  public async generateProof(inputs: Inputs): Promise<ProofStructByProtocol<Type>> {
    const zKeyFile = this.mustGetArtifactsFilePath("zkey");
    const wasmFile = this.mustGetArtifactsFilePath("wasm");

    return await this._implementer.generateProof(inputs, zKeyFile, wasmFile);
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
   * @todo Add other types of calldata.
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
   * Returns the verifier name. The verifier name is the name of the circuit file without the extension, suffixed with "Verifier".
   *
   * @returns {string} The verifier name.
   */
  public getVerifierName(): string {
    return this._implementer.getVerifierName(this._config.circuitName);
  }

  /**
   * Returns the type of the proving protocol
   *
   * @returns {ProtocolType} The protocol type.
   */
  public getProtocolType(): ProtocolType {
    return this._implementer.getProtocolType();
  }

  /**
   * Returns the Solidity verifier template.
   *
   * @returns {string} The Solidity verifier template.
   */
  public getVerifierTemplate(): string {
    return this._implementer.getTemplate();
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
}
