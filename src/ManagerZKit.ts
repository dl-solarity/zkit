import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import process from "process";
import { v4 as uuid } from "uuid";

import { ManagerZKitConfig, ManagerZKitPrivateConfig, PtauInfo, TemplateType } from "./types";

export class ManagerZKit {
  private _config: ManagerZKitPrivateConfig;

  constructor(config: Partial<ManagerZKitConfig>) {
    const projectRoot = process.cwd();

    const ptau = config.ptau ? path.join(projectRoot, config.ptau) : path.join(os.tmpdir(), ".zkit/.ptau");

    this._config = {
      circuits: path.join(projectRoot, config.circuits ?? "circuits"),
      artifacts: path.join(projectRoot, config.artifacts ?? "zkit-artifacts"),
      verifiers: path.join(projectRoot, config.verifiers ?? "contracts/verifiers"),
      ptau,
      compiler: fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      templates: {
        groth16: fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8"),
      },
    };
  }

  public async fetchPtauInfo(constraints: number): Promise<PtauInfo> {
    const ptauId = Math.max(10, Math.ceil(Math.log2(constraints)));

    if (ptauId > 20) {
      throw new Error("Circuit has too many constraints. The maximum number of constraints is 2^20.");
    }

    fs.mkdirSync(this._config.ptau, { recursive: true });

    const ptauInfo = this._searchPtau(ptauId);

    if (ptauInfo.url) {
      await this._downloadPtau(ptauInfo);
    }

    return ptauInfo;
  }

  public getArtifactsDir(): string {
    return this._config.artifacts;
  }

  public getCircuitsDir(): string {
    return this._config.circuits;
  }

  public getVerifiersDir(): string {
    return this._config.verifiers;
  }

  public getPtauDir(): string {
    return this._config.ptau;
  }

  public getCompiler(): string {
    return this._config.compiler;
  }

  public getTempDir(): string {
    return path.join(this._config.artifacts, uuid());
  }

  public getTemplate(templateType: TemplateType): string {
    switch (templateType) {
      case "groth16":
        return this._config.templates.groth16;
      default:
        throw new Error(`Ambiguous template type: ${templateType}.`);
    }
  }

  private _searchPtau(ptauId: number): PtauInfo {
    const entries = fs.readdirSync(this._config.ptau, { withFileTypes: true });

    const entry = entries.find((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const match = entry.name.match(/^powers-of-tau-(\d+)\.ptau$/);

      if (!match) {
        return false;
      }

      const entryPtauId = parseInt(match[1]);

      return ptauId <= entryPtauId;
    });

    const file = path.join(this._config.ptau, entry ? entry.name : `powers-of-tau-${ptauId}.ptau`);
    const url = entry ? null : `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauId}.ptau`;

    return { file, url };
  }

  private async _downloadPtau(ptauInfo: PtauInfo): Promise<boolean> {
    const ptauFileStream = fs.createWriteStream(ptauInfo.file);

    return new Promise((resolve, reject) => {
      const request = https.get(ptauInfo.url!, (response) => {
        response.pipe(ptauFileStream);
      });

      ptauFileStream.on("finish", () => resolve(true));

      request.on("error", (err) => {
        fs.unlink(ptauInfo.file, () => reject(err));
      });

      ptauFileStream.on("error", (err) => {
        fs.unlink(ptauInfo.file, () => reject(err));
      });

      request.end();
    });
  }
}
