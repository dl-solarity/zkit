import fs from "fs";

import path from "path";

import * as snarkjs from "snarkjs";
import * as https from "https";
import { Calldata, CircuitZKitConfig, CircuitZKitPrivateConfig, CompileOptions, Inputs, ProofStruct } from "./types";
import { createDirIfNotExists, ensureFileExists } from "./utils";

const { CircomRunner, bindings, Context } = require("@distributedlab/circom2");

export class CircuitZKit<I extends Inputs> {
  public readonly config: CircuitZKitPrivateConfig;

  constructor(config: CircuitZKitConfig) {
    const circuitId = path.parse(config.circuitFile).name;
    const verifierId = `${circuitId}Verifier`;

    this.config = {
      circuitFile: config.circuitFile,
      artifactsDir: config.artifactsDir,
      circuitOutDir: config.circuitOutDir,
      verifierOutDir: config.verifierOutDir,
      r1csFile: path.join(config.circuitOutDir, `${circuitId}.r1cs`),
      zKeyFile: path.join(config.circuitOutDir, `${circuitId}.zkey`),
      vKeyFile: path.join(config.circuitOutDir, `${circuitId}.vkey.json`),
      wasmFile: path.join(config.circuitOutDir, `${circuitId}_js`, `${circuitId}.wasm`),
      verifierFile: path.join(config.verifierOutDir, `${verifierId}.sol`),
      ptauDir: path.join(config.artifactsDir, ".ptau"),
      ptauFile: "",
      circuitId,
      verifierId,
      wasmBytes: fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      groth16Template: fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8"),
    };
  }

  public async compile(options = {} as CompileOptions): Promise<void> {
    createDirIfNotExists(this.config.circuitOutDir);

    const args = this._getCompileArgs({
      sym: options.sym ?? true,
      c: options.c ?? false,
    });

    await this._compile(args, options.quiet ?? true);

    await this._fetchPtauFile();
    await this._generateZKey();
    await this._generateVKey();
  }

  public async generateProof(inputs: I): Promise<ProofStruct> {
    ensureFileExists(this.config.zKeyFile);
    ensureFileExists(this.config.wasmFile);

    return (await snarkjs.groth16.fullProve(inputs, this.config.wasmFile, this.config.zKeyFile)) as ProofStruct;
  }

  public async verifyProof(proof: ProofStruct): Promise<boolean> {
    ensureFileExists(this.config.vKeyFile);

    const verifier = JSON.parse(fs.readFileSync(this.config.vKeyFile).toString());

    return await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);
  }

  public async createVerifier(): Promise<void> {
    createDirIfNotExists(this.config.verifierOutDir);
    ensureFileExists(this.config.zKeyFile);

    let verifierCode = await snarkjs.zKey.exportSolidityVerifier(this.config.zKeyFile, {
      groth16: this.config.groth16Template,
    });

    verifierCode = verifierCode.replace("contract Verifier", `contract ${this.config.verifierId}`);

    fs.writeFileSync(this.config.verifierFile, verifierCode, "utf-8");
  }

  public async generateCalldata(proof: ProofStruct): Promise<Calldata> {
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    return JSON.parse(`[${calldata}]`) as Calldata;
  }

  private async _generateZKey(): Promise<void> {
    await snarkjs.zKey.newZKey(this.config.r1csFile, this.config.ptauFile, this.config.zKeyFile);
  }

  private async _generateVKey(): Promise<void> {
    const vKeyData = await snarkjs.zKey.exportVerificationKey(this.config.zKeyFile);

    fs.writeFileSync(this.config.vKeyFile, JSON.stringify(vKeyData));
  }

  private _getCompileArgs(options: CompileOptions): string[] {
    let args = [this.config.circuitFile, "--r1cs", "--wasm"];

    options.sym && args.push("--sym");
    options.c && args.push("--c");

    args.push("-o", this.config.circuitOutDir);

    return args;
  }

  private async _compile(args: string[], quiet: boolean): Promise<void> {
    try {
      await this._getCircomRunner(args, quiet).execute(this.config.wasmBytes);
    } catch {
      if (quiet) {
        throw new Error(
          'Compilation failed with an unknown error. Consider pass "quiet=false" flag to see the compilation error.',
        );
      }

      throw new Error("Compilation failed.");
    }
  }

  private async _fetchPtauFile(): Promise<void> {
    const exists = await this._updatePtauFile();

    if (!exists) {
      await this._downloadPtauFile();
    }
  }

  private async _updatePtauFile(): Promise<boolean> {
    createDirIfNotExists(this.config.ptauDir);

    const totalConstraintsLog2 = await this._getTotalConstraintsLog2();

    const entries = fs.readdirSync(this.config.ptauDir, { withFileTypes: true });

    const entry = entries.find((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const match = entry.name.match(/^powers-of-tau-(\d+)\.ptau$/);

      if (!match) {
        return false;
      }

      const entryConstraintsLog2 = parseInt(match[1]);

      return totalConstraintsLog2 <= entryConstraintsLog2;
    });

    this.config.ptauFile = entry
      ? path.join(this.config.ptauDir, entry.name)
      : path.join(this.config.ptauDir, `powers-of-tau-${totalConstraintsLog2}.ptau`);

    return !!entry;
  }

  private async _downloadPtauFile(): Promise<boolean> {
    const ptauFileUrl = await this._getPtauFileUrl();
    const ptauFileStream = fs.createWriteStream(this.config.ptauFile);

    return new Promise((resolve, reject) => {
      const request = https.get(ptauFileUrl, (response) => {
        response.pipe(ptauFileStream);
      });

      ptauFileStream.on("finish", () => resolve(true));

      request.on("error", (err) => {
        fs.unlink(this.config.ptauFile, () => reject(err));
      });

      ptauFileStream.on("error", (err) => {
        fs.unlink(this.config.ptauFile, () => reject(err));
      });

      request.end();
    });
  }

  private async _getPtauFileUrl(): Promise<string> {
    const totalConstraints = await this._getTotalConstraints();
    const totalConstraintsLog2 = await this._getTotalConstraintsLog2();

    if (totalConstraintsLog2 <= 27) {
      return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${totalConstraintsLog2}.ptau`;
    }

    if (totalConstraintsLog2 == 28) {
      return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final.ptau`;
    }

    throw new Error(
      `Cannot find ptau file. Circuit has ${totalConstraints} constraints while the maximum number is 2^28`,
    );
  }

  private async _getTotalConstraints(): Promise<number> {
    const r1csInfo = await snarkjs.r1cs.info(this.config.r1csFile);

    return r1csInfo.nConstraints;
  }

  private async _getTotalConstraintsLog2(): Promise<number> {
    const totalConstraints = await this._getTotalConstraints();

    return Math.max(10, Math.ceil(Math.log2(totalConstraints)));
  }

  private _getCircomRunner(args: string[], quiet: boolean): typeof CircomRunner {
    return new CircomRunner({
      args,
      preopens: { "/": "/" },
      bindings: {
        ...bindings,
        exit(_code: number) {},
        fs,
      },
      quiet,
    });
  }
}
