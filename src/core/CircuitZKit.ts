import ejs from "ejs";
import fs from "fs";
import * as os from "os";
import path from "path";
import * as snarkjs from "snarkjs";

import {
  ArtifactsFileType,
  Calldata,
  CircuitZKitConfig,
  Inputs,
  ProofStruct,
  VerifierTemplateType,
} from "../types/circuit-zkit";

/**
 * `CircuitZKit` represents a single circuit and provides a high-level API to work with it.
 */
export class CircuitZKit {
  constructor(private readonly _config: CircuitZKitConfig) {}

  /**
   * Returns the Solidity verifier template for the specified proving system.
   *
   * @param {VerifierTemplateType} templateType - The template type.
   * @returns {string} The Solidity verifier template.
   */
  public static getTemplate(templateType: VerifierTemplateType): string {
    switch (templateType) {
      case "groth16":
        return fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8");
      default:
        throw new Error(`Ambiguous template type: ${templateType}.`);
    }
  }

  /**
   * Creates a Solidity verifier contract.
   */
  public async createVerifier(): Promise<void> {
    const vKeyFilePath: string = this.mustGetArtifactsFilePath("vkey");
    const verifierFilePath = path.join(this._config.verifierDirPath, `${this.getVerifierName()}.sol`);

    const verifierTemplate: string = CircuitZKit.getTemplate(this.getTemplateType());

    if (!fs.existsSync(this._config.verifierDirPath)) {
      fs.mkdirSync(this._config.verifierDirPath, { recursive: true });
    }

    const templateParams = JSON.parse(fs.readFileSync(vKeyFilePath, "utf-8"));
    templateParams["verifier_id"] = this.getVerifierName();

    const verifierCode = ejs.render(verifierTemplate, templateParams);

    fs.writeFileSync(verifierFilePath, verifierCode, "utf-8");
  }

  /**
   * Calculates a witness for the given inputs.
   *
   * @param {Inputs} inputs - The inputs for the circuit.
   * @returns {Promise<bigint[]>} The generated witness.
   */
  public async calculateWitness(inputs: Inputs): Promise<bigint[]> {
    const tmpDir = path.join(os.tmpdir(), ".zkit");

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const wtnsFile = path.join(tmpDir, `${this.getCircuitName()}.wtns`);
    const wasmFile = this.mustGetArtifactsFilePath("wasm");

    await snarkjs.wtns.calculate(inputs, wasmFile, wtnsFile);

    return (await snarkjs.wtns.exportJson(wtnsFile)) as bigint[];
  }

  /**
   * Generates a proof for the given inputs.
   *
   * @dev The `inputs` should be in the same order as the circuit expects them.
   *
   * @param {Inputs} inputs - The inputs for the circuit.
   * @returns {Promise<ProofStruct>} The generated proof.
   * @todo Add support for other proving systems.
   */
  public async generateProof(inputs: Inputs): Promise<ProofStruct> {
    const zKeyFile = this.mustGetArtifactsFilePath("zkey");
    const wasmFile = this.mustGetArtifactsFilePath("wasm");

    return (await snarkjs.groth16.fullProve(inputs, wasmFile, zKeyFile)) as ProofStruct;
  }

  /**
   * Verifies the given proof.
   *
   * @dev The `proof` can be generated using the `generateProof` method.
   * @dev The `proof.publicSignals` should be in the same order as the circuit expects them.
   *
   * @param {ProofStruct} proof - The proof to verify.
   * @returns {Promise<boolean>} Whether the proof is valid.
   */
  public async verifyProof(proof: ProofStruct): Promise<boolean> {
    const vKeyFile = this.mustGetArtifactsFilePath("vkey");

    const verifier = JSON.parse(fs.readFileSync(vKeyFile).toString());

    return await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);
  }

  /**
   * Generates the calldata for the given proof. The calldata can be used to verify the proof on-chain.
   *
   * @param {ProofStruct} proof - The proof to generate calldata for.
   * @returns {Promise<Calldata>} - The generated calldata.
   * @todo Add other types of calldata.
   */
  public async generateCalldata(proof: ProofStruct): Promise<Calldata> {
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    return JSON.parse(`[${calldata}]`) as Calldata;
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
    return `${this._config.circuitName}Verifier`;
  }

  /**
   * Returns the type of verifier template that was stored in the config
   *
   * @returns {VerifierTemplateType} The verifier template type.
   */
  public getTemplateType(): VerifierTemplateType {
    return this._config.templateType ?? "groth16";
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
        fileName = `${circuitName}.zkey`;
        break;
      case "vkey":
        fileName = `${circuitName}.vkey.json`;
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
