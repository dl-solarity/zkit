import fs from "fs";

import path from "path";

import * as snarkjs from "snarkjs";
import * as https from "https";
import {
  Calldata,
  CircuitZKitConfig,
  CircuitZKitPrivateConfig,
  CompileOptions,
  Groth16Proof,
  Inputs,
  ProofStruct,
} from "./types";

const { CircomRunner, bindings, Context } = require("@distributedlab/circom2");

export class CircuitZKit<I extends Inputs> {
  public readonly config: CircuitZKitPrivateConfig;

  constructor(config: CircuitZKitConfig) {
    const circuitId = path.parse(config.circuitFile).name;
    const verifierId = `${circuitId}Verifier`;

    this.config = {
      circuitFile: config.circuitFile,
      artifactsDir: config.globalOutDir,
      circuitOutDir: config.circuitOutDir,
      verifierOutDir: config.verifierOutDir,
      r1csFile: path.join(config.circuitOutDir, `${circuitId}.r1cs`),
      zKeyFile: path.join(config.circuitOutDir, `${circuitId}.zkey`),
      vKeyFile: path.join(config.circuitOutDir, `${circuitId}.vkey.json`),
      wasmFile: path.join(config.circuitOutDir, `${circuitId}_js`, `${circuitId}.wasm`),
      verifierFile: path.join(config.verifierOutDir, `${verifierId}.sol`),
      ptauDir: path.join(config.globalOutDir, ".ptau"),
      ptauFile: "",
      circuitId,
      verifierId,
      wasmBytes: fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      groth16Template: fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8"),
    };
  }

  private _getCompileArgs(options: CompileOptions): string[] {
    let args = [this.config.circuitFile];

    options.r1cs && args.push("--r1cs");
    options.wasm && args.push("--wasm");
    options.sym && args.push("--sym");
    options.c && args.push("--c");

    args.push("-o", this.config.circuitOutDir);

    return args;
  }

  private _ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private _ensureFileExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Expected the file "${filePath}" to exist`);
    }
  }

  private async getR1CSInfo(): Promise<snarkjs.R1CSInfoType> {
    return await snarkjs.r1cs.info(this.config.r1csFile);
  }

  public async getTotalConstraints(): Promise<number> {
    const r1csInfo = await this.getR1CSInfo();

    return r1csInfo.nConstraints;
  }

  public async getPtauLog2(): Promise<number> {
    const totalConstraints = await this.getTotalConstraints();

    return Math.max(10, Math.ceil(Math.log2(totalConstraints)));
  }

  private async _updatePtauFile(): Promise<boolean> {
    this._ensureDirExists(this.config.ptauDir);

    const ptauLog2 = await this.getPtauLog2();

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

      return ptauLog2 <= entryConstraintsLog2;
    });

    this.config.ptauFile = entry
      ? path.join(this.config.ptauDir, entry.name)
      : path.join(this.config.ptauDir, `powers-of-tau-${ptauLog2}.ptau`);

    return !!entry;
  }

  private async _getPtauFileUrl(): Promise<string> {
    const totalConstraints = await this.getTotalConstraints();
    const ptauLog2 = await this.getPtauLog2();

    if (ptauLog2 <= 27) {
      return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauLog2}.ptau`;
    }

    if (ptauLog2 == 28) {
      return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final.ptau`;
    }

    throw new Error(
      `Cannot find ptau file. Circuit has ${totalConstraints} constraints while the maximum number is 2^28`,
    );
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

  private async _fetchPtauFile(): Promise<void> {
    const exists = await this._updatePtauFile();

    if (!exists) {
      await this._downloadPtauFile();
    }
  }

  public async generateZKey(): Promise<void> {
    const { r1csFile, ptauFile, zKeyFile } = this.config;

    this._ensureFileExists(r1csFile);
    this._ensureFileExists(ptauFile);

    await snarkjs.zKey.newZKey(r1csFile, ptauFile, zKeyFile);
  }

  public async generateVKey(): Promise<void> {
    const { zKeyFile, vKeyFile } = this.config;

    this._ensureFileExists(zKeyFile);

    const vKeyData = await snarkjs.zKey.exportVerificationKey(zKeyFile);

    fs.writeFileSync(vKeyFile, JSON.stringify(vKeyData));
  }

  public async compile(options = {} as CompileOptions): Promise<void> {
    this._ensureDirExists(this.config.circuitOutDir);

    const args = this._getCompileArgs({
      r1cs: options.r1cs ?? true,
      wasm: options.wasm ?? true,
      sym: options.sym ?? true,
      c: options.c ?? false,
    });

    try {
      await this._getCircomRunner(args, true).execute(this.config.wasmBytes);
    } catch (err) {
      throw new Error("Compilation error", { cause: err });
    }

    await this._fetchPtauFile();
    await this.generateZKey();
    await this.generateVKey();
  }

  async createVerifier(): Promise<void> {
    this._ensureFileExists(this.config.zKeyFile);
    this._ensureDirExists(this.config.verifierOutDir);

    let verifierCode = await snarkjs.zKey.exportSolidityVerifier(this.config.zKeyFile, {
      groth16: this.config.groth16Template,
    });

    verifierCode = verifierCode.replace("contract Verifier", `contract ${this.config.verifierId}`);

    fs.writeFileSync(this.config.verifierFile, verifierCode, "utf-8");
  }

  public async generateProof(inputs: I): Promise<ProofStruct> {
    const { zKeyFile, wasmFile } = this.config;

    this._ensureFileExists(zKeyFile);
    this._ensureFileExists(wasmFile);

    const proof = await snarkjs.groth16.fullProve(inputs, wasmFile, zKeyFile);

    return {
      proof: proof.proof as Groth16Proof,
      publicSignals: proof.publicSignals,
    };
  }

  public async verifyProof(proof: ProofStruct): Promise<boolean> {
    this._ensureFileExists(this.config.vKeyFile);

    const verifier = JSON.parse(fs.readFileSync(this.config.vKeyFile).toString());

    return await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);
  }

  public async generateCalldata(proof: ProofStruct): Promise<Calldata> {
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    return JSON.parse(`[${calldata}]`) as Calldata;
  }

  private _getCircomRunner(args: string[], quiet: boolean = false): typeof CircomRunner {
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
