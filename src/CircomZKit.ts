import path from "path";
import { CircuitZKit } from "./CircuitZKit";
import process from "process";
import os from "os";
import { CircomZKitConfig, CircomZKitPrivateConfig, Inputs } from "./types";
import fs from "fs";

export class CircomZKit {
  public static readonly DEFAULT_CIRCUITS_DIR = "circuits";
  public static readonly DEFAULT_VERIFIERS_DIR = "contracts/verifiers";
  public static readonly DEFAULT_ARTIFACTS_DIR = "zkit-artifacts";

  private readonly config: CircomZKitPrivateConfig;

  constructor(config = {} as CircomZKitConfig) {
    const projectRoot = process.cwd();

    this.config = {
      circuitsDir: path.join(projectRoot, config.circuitsDir ?? CircomZKit.DEFAULT_CIRCUITS_DIR),
      artifactsDir: path.join(projectRoot, config.artifactsDir ?? CircomZKit.DEFAULT_ARTIFACTS_DIR),
      verifiersDir: path.join(projectRoot, config.verifiersDir ?? CircomZKit.DEFAULT_VERIFIERS_DIR),
    };
  }

  public getCircuit<I extends Inputs>(circuit: string): CircuitZKit<I> {
    const circuits = this._getAllCircuits();

    const candidates = circuits.filter((file) => {
      if (circuit.endsWith(".circom")) {
        return file == path.relative(this.config.circuitsDir, path.join(this.config.circuitsDir, circuit));
      }

      return path.parse(file).base == `${circuit}.circom`;
    });

    if (candidates.length == 0) {
      throw Error(`No circuits with name \"${circuit}\" found`);
    }

    if (candidates.length > 1) {
      throw Error(
        `Found multiple entries for the circuit "${circuit}".

        \rConsider replace \"${circuit}\" with one of the valid paths:
        \r${candidates.map((candidate) => `"${candidate}"`).join(os.EOL)}`,
      );
    }

    const circuitFile = path.join(this.config.circuitsDir, candidates[0]);
    const circuitOutDir = path.join(this.config.artifactsDir, candidates[0]);
    const verifierOutDir = path.join(this.config.verifiersDir, candidates[0], "..");

    return new CircuitZKit<I>({
      circuitFile,
      circuitOutDir,
      verifierOutDir,
      globalOutDir: this.config.artifactsDir,
    });
  }

  public getCircuits(): [string, string | null][] {
    const circuits = this._getAllCircuits();

    let circuitsCount = {} as Record<string, number>;

    for (const circuit of circuits) {
      const circuitId = path.parse(circuit).name;

      circuitsCount[circuitId] = (circuitsCount[circuitId] || 0) + 1;
    }

    let result = [] as [string, string | null][];

    for (const circuit of circuits) {
      const circuitId = path.parse(circuit).name;

      result.push([circuit, circuitsCount[circuitId] > 1 ? null : circuitId]);
    }

    return result;
  }

  private _getAllCircuits(): string[] {
    let circuits = [] as string[];

    const getAllCircuits = (dir: string) => {
      /// @dev After NodeJS v20 `recursive` flag can be passed
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          getAllCircuits(entryPath);
        }

        if (entry.isFile() && path.parse(entry.name).ext == ".circom") {
          circuits.push(path.relative(this.config.circuitsDir, entryPath));
        }
      }
    };

    getAllCircuits(this.config.circuitsDir);

    return circuits;
  }
}
