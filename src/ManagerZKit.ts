import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import process from "process";
import * as readline from "readline";
import { v4 as uuid } from "uuid";

import { ManagerZKitConfig, ManagerZKitPrivateConfig, TemplateType } from "./types";

export class ManagerZKit {
  private _config: ManagerZKitPrivateConfig;

  constructor(config: Partial<ManagerZKitConfig>) {
    const projectRoot = process.cwd();

    const isGlobalPtau = !config.ptauFile;

    if (!isGlobalPtau && path.extname(config.ptauFile!) != ".ptau") {
      throw new Error('Ptau file must have ".ptau" extension.');
    }

    const tempDir = path.join(os.tmpdir(), ".zkit");
    const ptauPath = isGlobalPtau
      ? path.join(os.homedir(), ".zkit", ".ptau")
      : path.join(projectRoot, config.ptauFile!);

    this._config = {
      circuitsDir: path.join(projectRoot, config.circuits ?? "circuits"),
      artifactsDir: path.join(projectRoot, config.artifacts ?? "zkit-artifacts"),
      verifiersDir: path.join(projectRoot, config.verifiers ?? "contracts/verifiers"),
      tempDir,
      ptau: {
        isGlobal: isGlobalPtau,
        path: ptauPath,
      },
      compiler: fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      templates: {
        groth16: fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8"),
      },
    };
  }

  public async fetchPtauFile(minConstraints: number): Promise<string> {
    if (this._config.ptau.isGlobal) {
      return await this._fetchGlobalPtau(minConstraints);
    }

    return this._fetchLocalPtau();
  }

  public getArtifactsDir(): string {
    return this._config.artifactsDir;
  }

  public getCircuitsDir(): string {
    return this._config.circuitsDir;
  }

  public getVerifiersDir(): string {
    return this._config.verifiersDir;
  }

  public getPtauPath(): string {
    return this._config.ptau.path;
  }

  public getCompiler(): string {
    return this._config.compiler;
  }

  public getTempDir(): string {
    return path.join(this._config.tempDir, uuid());
  }

  public getTemplate(templateType: TemplateType): string {
    switch (templateType) {
      case "groth16":
        return this._config.templates.groth16;
      default:
        throw new Error(`Ambiguous template type: ${templateType}.`);
    }
  }

  private async _fetchGlobalPtau(minConstraints: number): Promise<string> {
    const ptauId = Math.max(Math.ceil(Math.log2(minConstraints)), 8);

    if (ptauId > 20) {
      throw new Error(
        'Circuit has too many constraints. The maximum number of constraints is 2^20. Consider passing "ptau=PATH_TO_FILE".',
      );
    }

    const ptauInfo = this._searchGlobalPtau(ptauId);

    if (ptauInfo.url) {
      if (!(await this._askForDownloadAllowance(ptauInfo.url))) {
        throw new Error('Download is cancelled. Allow download or consider passing "ptauFile=PATH_TO_FILE"');
      }

      fs.mkdirSync(this._config.ptau.path, { recursive: true });

      await this._downloadPtau(ptauInfo.file, ptauInfo.url);
    }

    return ptauInfo.file;
  }

  private _fetchLocalPtau(): string {
    if (!fs.existsSync(this._config.ptau.path)) {
      throw new Error(`Ptau file "${this._config.ptau.path}" doesn't exist.`);
    }

    return this._config.ptau.path;
  }

  private _searchGlobalPtau(ptauId: number): { file: string; url: string | null } {
    let entries = [] as fs.Dirent[];

    if (fs.existsSync(this._config.ptau.path)) {
      entries = fs.readdirSync(this._config.ptau.path, { withFileTypes: true });
    }

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

    const file = path.join(this._config.ptau.path, entry ? entry.name : `powers-of-tau-${ptauId}.ptau`);
    const url = (() => {
      if (entry) {
        return null;
      }

      if (ptauId < 10) {
        return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_0${ptauId}.ptau`;
      }

      return `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauId}.ptau`;
    })();

    return { file, url };
  }

  private async _downloadPtau(file: string, url: string): Promise<boolean> {
    const ptauFileStream = fs.createWriteStream(file);

    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        response.pipe(ptauFileStream);
      });

      ptauFileStream.on("finish", () => resolve(true));

      request.on("error", (err) => {
        fs.unlink(file, () => reject(err));
      });

      ptauFileStream.on("error", (err) => {
        fs.unlink(file, () => reject(err));
      });

      request.end();
    });
  }

  private _askForDownloadAllowance(url: string): Promise<boolean> {
    const readLine = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) =>
      readLine.question(`No ptau found. Press [Y] to download it from "${url}": `, (response) => {
        readLine.close();
        resolve(response.toUpperCase() == "Y");
      }),
    );
  }
}
