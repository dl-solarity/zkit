import {
  ArtifactsFileType,
  CircuitZKitConfig,
  VerifierLanguageType,
  Signals,
  CalldataByProtocol,
  IProtocolImplementer,
  ProofStructByProtocol,
  ProvingSystemType,
} from "../types";
/**
 * `CircuitZKit` represents a single circuit and provides a high-level API to work with it.
 */
export declare class CircuitZKit<Type extends ProvingSystemType> {
  private readonly _config;
  private readonly _implementer;
  constructor(_config: CircuitZKitConfig, _implementer: IProtocolImplementer<Type>);
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
  createVerifier(languageExtension: VerifierLanguageType, verifierNameSuffix?: string): Promise<void>;
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
  calculateWitness(
    inputs: Signals,
    witnessOverrides?: Record<string, bigint>,
    witnessFilePath?: string,
  ): Promise<bigint[]>;
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
  generateProof(
    inputs: Signals,
    witnessOverrides?: Record<string, bigint>,
    uniqueWitnessPath?: boolean,
  ): Promise<ProofStructByProtocol<Type>>;
  /**
   * Verifies the given proof.
   *
   * @dev The `proof` can be generated using the `generateProof` method.
   * @dev The `proof.publicSignals` should be in the same order as the circuit expects them.
   *
   * @param {ProofStructByProtocol<Type>} proof - The proof to verify.
   * @returns {Promise<boolean>} Whether the proof is valid.
   */
  verifyProof(proof: ProofStructByProtocol<Type>): Promise<boolean>;
  /**
   * Generates the calldata for the given proof. The calldata can be used to verify the proof on-chain.
   *
   * @param {ProofStructByProtocol<Type>} proof - The proof to generate calldata for.
   * @returns {Promise<CalldataByProtocol<Type>>} - The generated calldata.
   */
  generateCalldata(proof: ProofStructByProtocol<Type>): Promise<CalldataByProtocol<Type>>;
  /**
   * Returns the circuit name. The circuit name is the name of the circuit file without the extension.
   *
   * @returns {string} The circuit name.
   */
  getCircuitName(): string;
  /**
   * Returns the verifier name. The verifier name has the next structure:
   * `<template name><suffix><proving system>Verifier.<extension>`.
   *
   * @param {string} verifierNameSuffix - The optional verifier name suffix.
   *
   * @returns {string} The verifier name.
   */
  getVerifierName(verifierNameSuffix?: string): string;
  /**
   * Returns the type of the proving protocol
   *
   * @returns {ProvingSystemType} The protocol proving system type.
   */
  getProvingSystemType(): ProvingSystemType;
  /**
   * Returns the Solidity verifier template.
   *
   * @returns {string} The Solidity verifier template.
   */
  getVerifierTemplate(languageExtension: VerifierLanguageType): string;
  /**
   * Returns the path to the temporary witness file.
   *
   * The file is stored in the system temporary directory and is named after the circuit.
   * This file is used for intermediate witness generation and may be deleted after usage.
   *
   * @returns {string} The full path to the temporary `.wtns` file.
   */
  getTemporaryWitnessPath(): string;
  /**
   * Returns the path to the temporary witness file with uniqueness.
   *
   * The file is stored in the system temporary directory and is named after the circuit with uniqueness.
   * This file is used for intermediate witness generation and may be deleted after usage.
   *
   * @returns {string} The full path to the temporary `.wtns` file.
   */
  getTemporaryUniqueWitnessPath(): string;
  /**
   * Returns the path to the file of the given type inside artifacts directory. Throws an error if the file doesn't exist.
   *
   * @param {ArtifactsFileType} fileType - The type of the file.
   * @returns {string} The path to the file.
   */
  mustGetArtifactsFilePath(fileType: ArtifactsFileType): string;
  /**
   * Returns the path to the file of the given type inside artifacts directory.
   *
   * @param {ArtifactsFileType} fileType - The type of the file.
   * @returns {string} The path to the file.
   */
  getArtifactsFilePath(fileType: ArtifactsFileType): string;
}
//# sourceMappingURL=CircuitZKit.d.ts.map
