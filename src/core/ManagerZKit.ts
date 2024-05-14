import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import * as readline from "readline";
import { v4 as uuid } from "uuid";

import { ManagerZKitConfig, ManagerZKitPrivateConfig, defaultManagerOptions } from "../config/config";
import { PtauInfo, TemplateType } from "../types/types";
import { downloadFile } from "../utils/utils";

/**
 * `ManagerZKit` provides configuration options and utility methods used by the `CircomZKit` and `CircuitZKit` classes.
 */
export class ManagerZKit {
  private _config: ManagerZKitPrivateConfig;

  /**
   * Creates a new `ManagerZKit` instance.
   *
   * @param {Partial<ManagerZKitConfig>} [config=defaultManagerOptions] - The configuration options to use.
   */
  constructor(config: Partial<ManagerZKitConfig> = defaultManagerOptions) {
    const overriddenConfig = { ...defaultManagerOptions, ...config } as ManagerZKitConfig;

    overriddenConfig.circuitsDir = path.join(process.cwd(), overriddenConfig.circuitsDir);
    overriddenConfig.artifactsDir = path.join(process.cwd(), overriddenConfig.artifactsDir);
    overriddenConfig.verifiersDir = path.join(process.cwd(), overriddenConfig.verifiersDir);

    if (overriddenConfig.ptauDir) {
      overriddenConfig.ptauDir = path.join(process.cwd(), overriddenConfig.ptauDir);
    } else {
      overriddenConfig.ptauDir = path.join(os.homedir(), ".zkit", ".ptau");
    }

    this._config = {
      ...overriddenConfig,
      compiler: fs.readFileSync(require.resolve("@distributedlab/circom2/circom.wasm")),
      templates: {
        groth16: fs.readFileSync(path.join(__dirname, "templates", "verifier_groth16.sol.ejs"), "utf8"),
      },
    };
  }

  /**
   * Fetches the `ptau` file.
   *
   * @dev If `ptau` file is not found, this method will try to download it. Use `allowDownload=false` to disable this behavior.
   *
   * @param {number} minConstraints - The minimum number of constraints the `ptau` file must support.
   * @returns {Promise<string>} The path to the `ptau` file.
   */
  public async fetchPtauFile(minConstraints: number): Promise<string> {
    const ptauId = Math.max(Math.ceil(Math.log2(minConstraints)), 8);

    if (ptauId > 20) {
      throw new Error(
        'Circuit has too many constraints. The maximum number of constraints is 2^20. Consider passing "ptauDir=PATH_TO_LOCAL_DIR".',
      );
    }

    const ptauInfo = this._searchPtau(ptauId);

    if (ptauInfo.url) {
      await this._downloadPtau(ptauInfo);
    }

    return ptauInfo.file;
  }

  /**
   * Returns the path to the artifacts' directory.
   *
   * @returns {string} The path to the artifacts' directory.
   */
  public getArtifactsDir(): string {
    return this._config.artifactsDir;
  }

  /**
   * Returns the path to the circuits' directory.
   *
   * @returns {string} The path to the circuits' directory.
   */
  public getCircuitsDir(): string {
    return this._config.circuitsDir;
  }

  /**
   * Returns the path to the verifiers' directory.
   *
   * @returns {string} The path to the verifiers' directory.
   */
  public getVerifiersDir(): string {
    return this._config.verifiersDir;
  }

  /**
   * Returns the path to the `ptau` directory.
   *
   * @dev The default `ptau` directory is located at `${HOME}/.zkit/.ptau`.
   *
   * @returns {string} The path to the `ptau` directory.
   */
  public getPtauDir(): string {
    return this._config.ptauDir;
  }

  /**
   * Returns a temporary directory path.
   *
   * @dev Temporary files are stored in the OS's temporary directory.
   *
   * @returns {string} A temporary directory path.
   */
  public getTempDir(): string {
    return path.join(os.tmpdir(), ".zkit", uuid());
  }

  /**
   * Returns the circom compiler's wasm binary.
   *
   * @returns {string} The circom compiler's wasm binary.
   */
  public getCompiler(): string {
    return this._config.compiler;
  }

  /**
   * Returns the Solidity verifier template for the specified proving system.
   *
   * @param {TemplateType} templateType - The template type.
   * @returns {string} The Solidity verifier template.
   */
  public getTemplate(templateType: TemplateType): string {
    switch (templateType) {
      case "groth16":
        return this._config.templates.groth16;
      default:
        throw new Error(`Ambiguous template type: ${templateType}.`);
    }
  }

  /**
   * Returns whether the download of the `ptau` file is allowed.
   *
   * @returns {boolean} Whether the download of the `ptau` file is allowed.
   */
  public getAllowDownload(): boolean {
    return this._config.allowDownload;
  }

  /**
   * Downloads the `ptau` file. The download is allowed only if the user confirms it.
   *
   * @param {PtauInfo} ptauInfo - The `ptau` file and download url.
   */
  private async _downloadPtau(ptauInfo: PtauInfo): Promise<void> {
    if (!this.getAllowDownload() && !(await this._askForDownloadAllowance(ptauInfo))) {
      throw new Error(
        'Download is cancelled. Allow download or consider passing "ptauDir=PATH_TO_LOCAL_DIR" to the existing ptau files',
      );
    }

    fs.mkdirSync(this.getPtauDir(), { recursive: true });

    if (!(await downloadFile(ptauInfo.file, ptauInfo.url!))) {
      throw new Error("Something went wrong while downloading the ptau file.");
    }
  }

  /**
   * Searches for the `ptau` file that supports the specified number of constraints.
   *
   * @param {number} ptauId - The `ptau` file id.
   * @returns {PtauInfo} The `ptau` file path and download url if the file doesn't exist.
   */
  private _searchPtau(ptauId: number): PtauInfo {
    let entries = [] as fs.Dirent[];

    if (fs.existsSync(this.getPtauDir())) {
      entries = fs.readdirSync(this.getPtauDir(), { withFileTypes: true });
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

    const file = path.join(this.getPtauDir(), entry ? entry.name : `powers-of-tau-${ptauId}.ptau`);
    const url = entry
      ? null
      : `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${ptauId.toString().padStart(2, "0")}.ptau`;

    return { file, url };
  }

  /**
   * Prompts the user to allow the download of the `ptau` file.
   *
   * @param {PtauInfo} ptauInfo - The `ptau` file and download url.
   * @returns {Promise<boolean>} Whether the download is allowed.
   */
  private _askForDownloadAllowance(ptauInfo: PtauInfo): Promise<boolean> {
    return new Promise((resolve) => {
      const readLine = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      readLine.question(
        `No ptau found. Press [Y] to download it from "${ptauInfo.url!}" to ${ptauInfo.file}: `,
        (response) => {
          readLine.close();
          resolve(response.toUpperCase() == "Y");
        },
      );
    });
  }
}
