import ejs from "ejs";
import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";

import { defaultCompileOptions } from "./defaults";
import { ManagerZKit } from "./ManagerZKit";
import { Calldata, CompileOptions, DirType, FileType, Inputs, ProofStruct } from "./types";
import { readDirRecursively } from "./utils";

const { CircomRunner, bindings } = require("@distributedlab/circom2");

export class CircuitZKit {
  constructor(
    private readonly _manager: ManagerZKit,
    private readonly _circuit: string,
  ) {}

  public async compile(options: Partial<CompileOptions> = defaultCompileOptions): Promise<void> {
    const tempDir = this._manager.getTempDir();

    try {
      const artifactDir = this._getDir("artifact");

      fs.mkdirSync(tempDir, { recursive: true });

      const overriddenOptions: CompileOptions = {
        ...defaultCompileOptions,
        ...options,
      };

      await this._compile(overriddenOptions, tempDir);

      await this._generateZKey(tempDir);
      await this._generateVKey(tempDir);

      this._moveFromTempDirToOutDir(tempDir, artifactDir);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  public async createVerifier(): Promise<void> {
    const tempDir = this._manager.getTempDir();

    try {
      const verifierDir = this._getDir("verifier");

      fs.mkdirSync(tempDir, { recursive: true });

      const vKeyFile = this._mustGetFile("vkey");
      const verifierFile = this._getFile("sol", tempDir);

      const groth16Template = this._manager.getTemplate("groth16");

      const templateParams = JSON.parse(fs.readFileSync(vKeyFile, "utf-8"));
      templateParams["verifier_id"] = this.getVerifierId();

      const verifierCode = ejs.render(groth16Template, templateParams);

      fs.writeFileSync(verifierFile, verifierCode, "utf-8");

      this._moveFromTempDirToOutDir(tempDir, verifierDir);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  public async generateProof(inputs: Inputs): Promise<ProofStruct> {
    const zKeyFile = this._mustGetFile("zkey");
    const wasmFile = this._mustGetFile("wasm");

    return (await snarkjs.groth16.fullProve(inputs, wasmFile, zKeyFile)) as ProofStruct;
  }

  public async verifyProof(proof: ProofStruct): Promise<boolean> {
    const vKeyFile = this._mustGetFile("vkey");

    const verifier = JSON.parse(fs.readFileSync(vKeyFile).toString());

    return await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);
  }

  public async generateCalldata(proof: ProofStruct): Promise<Calldata> {
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    return JSON.parse(`[${calldata}]`) as Calldata;
  }

  public getCircuitId(): string {
    return path.parse(this._circuit).name;
  }

  public getVerifierId(): string {
    return `${path.parse(this._circuit).name}Verifier`;
  }

  private async _generateZKey(outDir: string): Promise<void> {
    const r1csFile = this._getFile("r1cs", outDir);
    const zKeyFile = this._getFile("zkey", outDir);

    const constraints = await this._getConstraints(outDir);
    const ptauFile = await this._manager.fetchPtauFile(constraints);

    await snarkjs.zKey.newZKey(r1csFile, ptauFile, zKeyFile);
  }

  private async _generateVKey(outDir: string): Promise<void> {
    const zKeyFile = this._getFile("zkey", outDir);
    const vKeyFile = this._getFile("vkey", outDir);

    const vKeyData = await snarkjs.zKey.exportVerificationKey(zKeyFile);

    fs.writeFileSync(vKeyFile, JSON.stringify(vKeyData));
  }

  private _getCompileArgs(options: CompileOptions, outDir: string): string[] {
    let args = [this._circuit, "--r1cs", "--wasm"];

    options.sym && args.push("--sym");
    options.json && args.push("--json");
    options.c && args.push("--c");

    args.push("-o", outDir);

    return args;
  }

  private async _compile(options: CompileOptions, outDir: string): Promise<void> {
    const args = this._getCompileArgs(options, outDir);

    try {
      await this._getCircomRunner(args, options.quiet).execute(this._manager.getCompiler());
    } catch (err) {
      if (options.quiet) {
        throw new Error(
          'Compilation failed with an unknown error. Consider passing "quiet=false" flag to see the compilation error.',
          { cause: err },
        );
      }

      throw new Error("Compilation failed.", { cause: err });
    }
  }

  async _getConstraints(outDir: string): Promise<number> {
    const r1csFile = this._getFile("r1cs", outDir);

    const r1csDescriptor = fs.openSync(r1csFile, "r");

    const readBytes = (position: number, length: number): bigint => {
      const buffer = Buffer.alloc(length);

      fs.readSync(r1csDescriptor, buffer, { length, position });

      return BigInt(`0x${buffer.reverse().toString("hex")}`);
    };

    /// @dev https://github.com/iden3/r1csfile/blob/d82959da1f88fbd06db0407051fde94afbf8824a/doc/r1cs_bin_format.md#format-of-the-file
    const numberOfSections = readBytes(8, 4);
    let sectionStart = 12;

    for (let i = 0; i < numberOfSections; ++i) {
      const sectionType = Number(readBytes(sectionStart, 4));
      const sectionSize = Number(readBytes(sectionStart + 4, 8));

      /// @dev Reading header section
      if (sectionType == 1) {
        const totalConstraintsOffset = 4 + 8 + 4 + 32 + 4 + 4 + 4 + 4 + 8;

        return Number(readBytes(sectionStart + totalConstraintsOffset, 4));
      }

      sectionStart += 4 + 8 + sectionSize;
    }

    throw new Error("Header section is not found.");
  }

  private _getFile(fileType: FileType, temp?: string): string {
    const circuitId = this.getCircuitId();

    switch (fileType) {
      case "r1cs":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}.r1cs`);
      case "zkey":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}.zkey`);
      case "vkey":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}.vkey.json`);
      case "sym":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}.sym`);
      case "json":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}.json`);
      case "wasm":
        return path.join(temp ?? this._getDir("artifact"), `${circuitId}_js`, `${circuitId}.wasm`);
      case "sol":
        return path.join(temp ?? this._getDir("verifier"), `${circuitId}Verifier.sol`);
      default:
        throw new Error(`Ambiguous file type: ${fileType}.`);
    }
  }

  private _getDir(dirType: DirType): string {
    const circuitRelativePath = path.relative(this._manager.getCircuitsDir(), this._circuit);

    switch (dirType) {
      case "circuit":
        return path.join(this._manager.getCircuitsDir(), circuitRelativePath, "..");
      case "artifact":
        return path.join(this._manager.getArtifactsDir(), circuitRelativePath);
      case "verifier":
        return path.join(this._manager.getVerifiersDir(), circuitRelativePath, "..");
      default:
        throw new Error(`Ambiguous dir type: ${dirType}.`);
    }
  }

  private _mustGetFile(fileType: FileType, temp?: string): string {
    const file = this._getFile(fileType, temp);

    if (!fs.existsSync(file)) {
      throw new Error(`Expected the file "${file}" to exist`);
    }

    return file;
  }

  private _moveFromTempDirToOutDir(tempDir: string, outDir: string) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    readDirRecursively(tempDir, (dir: string, file: string) => {
      const correspondingOutDir = path.join(outDir, path.relative(tempDir, dir));
      const correspondingOutFile = path.join(outDir, path.relative(tempDir, file));

      if (!fs.existsSync(correspondingOutDir)) {
        fs.mkdirSync(correspondingOutDir);
      }

      fs.copyFileSync(file, correspondingOutFile);
    });
  }

  private _getCircomRunner(args: string[], quiet: boolean): typeof CircomRunner {
    return new CircomRunner({
      args,
      preopens: { "/": "/" },
      bindings: {
        ...bindings,
        exit(code: number) {
          throw new Error(`Compilation error. Exit code: ${code}.`);
        },
        fs,
      },
      quiet,
    });
  }
}
