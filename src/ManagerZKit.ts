import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import process from "process";
import * as readline from "readline";
import { v4 as uuid } from "uuid";

import { ManagerZKitConfig, ManagerZKitPrivateConfig, defaultManagerOptions } from "./config";
import { TemplateType } from "./types";

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
    const overriddenConfig = {
      ...defaultManagerOptions,
      ...config,
    } as ManagerZKitConfig;

    const projectRoot = process.cwd();

    const isGlobalPtau = !overriddenConfig.ptauFile;

    if (!isGlobalPtau && path.extname(overriddenConfig.ptauFile!) != ".ptau") {
      throw new Error('Ptau file must have ".ptau" extension.');
    }

    const tempDir = path.join(os.tmpdir(), ".zkit");
    const ptauPath = isGlobalPtau
      ? path.join(os.homedir(), ".zkit", ".ptau")
      : path.join(projectRoot, overriddenConfig.ptauFile!);

    this._config = {
      circuitsDir: path.join(projectRoot, overriddenConfig.circuitsDir),
      artifactsDir: path.join(projectRoot, overriddenConfig.artifactsDir),
      verifiersDir: path.join(projectRoot, overriddenConfig.verifiersDir),
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

  /**
   * Fetches the `ptau` file.
   *
   * @dev If the local `ptauFile` is not provided, the method will attempt to download it.
   * The user will be prompted every time a download is required.
   *
   * @param {number} minConstraints - The minimum number of constraints the `ptau` file must support.
   * @returns {Promise<string>} The path to the `ptau` file.
   */
  public async fetchPtauFile(minConstraints: number): Promise<string> {
    if (this._config.ptau.isGlobal) {
      return await this._fetchGlobalPtau(minConstraints);
    }

    return this._fetchLocalPtau();
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
   * Returns the path to the `ptau` file or directory.
   *
   * @dev If the local `ptauFile` is not provided, the method will return the global `ptau` directory.
   * @dev The global `ptau` directory is located at `~/.zkit/.ptau`.
   *
   * @returns {string} The path to the `ptau` file or directory.
   */
  public getPtauPath(): string {
    return this._config.ptau.path;
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
   * Returns a temporary directory path.
   *
   * @dev Temporary files are stored in the OS's temporary directory.
   *
   * @returns {string} A temporary directory path.
   */
  public getTempDir(): string {
    return path.join(this._config.tempDir, uuid());
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
   * Fetches the `ptau` file from the global directory that supports the specified number of constraints.
   * Downloads the `ptau` file if it doesn't exist.
   *
   * @param {number} minConstraints - The minimum number of constraints the `ptau` file must support.
   * @returns {Promise<string>} The path to the `ptau` file.
   */
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

      if (!(await this._downloadPtau(ptauInfo.file, ptauInfo.url))) {
        throw new Error("Something went wrong while downloading the ptau file.");
      }
    }

    return ptauInfo.file;
  }

  /**
   * Fetches the `ptau` file from the local directory.
   *
   * @returns {string} The path to the `ptau` file.
   */
  private _fetchLocalPtau(): string {
    if (!fs.existsSync(this._config.ptau.path)) {
      throw new Error(`Ptau file "${this._config.ptau.path}" doesn't exist.`);
    }

    return this._config.ptau.path;
  }

  /**
   * Searches for the `ptau` file that supports the specified number of constraints.
   *
   * @param {number} ptauId - The `ptau` file id.
   * @returns {{ file: string; url: string | null }} The `ptau` file path and download url if the file doesn't exist.
   */
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

  /**
   * Downloads the `ptau` file from the specified url.
   *
   * @param {string} file - The path to the `ptau` file.
   * @param {string} url - The url to download the `ptau` file from.
   * @returns {Promise<boolean>} Whether the download is successful.
   */
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

  /**
   * Prompts the user to allow the download of the `ptau` file.
   *
   * @param {string} url - The url to download the `ptau` file from.
   * @returns {Promise<boolean>} Whether the download is allowed.
   */
  private _askForDownloadAllowance(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const readLine = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      readLine.question(`No ptau found. Press [Y] to download it from "${url}": `, (response) => {
        readLine.close();
        resolve(response.toUpperCase() == "Y");
      });
    });
  }
}
