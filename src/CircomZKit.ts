import os from "os";
import path from "path";

import { CircuitZKit } from "./CircuitZKit";
import { ManagerZKit } from "./ManagerZKit";
import { CircuitInfo } from "./types";
import { readDirRecursively } from "./utils";

/**
 * `CircomZKit` acts as a factory for `CircuitZKit` instances.
 */
export class CircomZKit {
  private readonly _manager: ManagerZKit;

  /**
   * Creates a new `CircomZKit` instance.
   *
   * @dev If no `ManagerZKit` instance is provided, a default instance will be created.
   *
   * @param {ManagerZKit | undefined} manager - The `ManagerZKit` instance to use.
   */
  constructor(manager?: ManagerZKit) {
    this._manager = manager ?? new ManagerZKit();
  }

  /**
   * Returns a `CircuitZKit` instance for the specified circuit.
   *
   * @dev If the circuit id is not unique, the path to the circuit file must be provided.
   *
   * @param {string} circuit - The path to the circuit file or the circuit id (filename without extension).
   * @returns {CircomZKit} The `CircuitZKit` instance.
   */
  public getCircuit(circuit: string): CircuitZKit {
    const circuits = this._getAllCircuits();

    const candidates = circuits.filter((file) => {
      if (circuit.endsWith(".circom")) {
        return file == path.normalize(circuit);
      }

      return path.basename(file) == `${circuit}.circom`;
    });

    if (candidates.length == 0) {
      throw Error(`No circuits with name \"${circuit}\" found`);
    }

    if (candidates.length > 1) {
      throw Error(
        `Found multiple entries for the circuit "${circuit}".

        \rConsider replacing \"${circuit}\" with one of the valid paths:
        \r${candidates.map((candidate) => `"${candidate}"`).join(os.EOL)}`,
      );
    }

    return new CircuitZKit(this._manager, path.join(this._manager.getCircuitsDir(), candidates[0]));
  }

  /**
   * Returns an array of all circuits available in the circuits directory.
   *
   * @dev If a circuit id is not unique, the id will be set to `null`.
   *
   * @returns {CircuitInfo[]} An array of circuit information objects.
   */
  public getCircuits(): CircuitInfo[] {
    const circuits = this._getAllCircuits();

    let circuitsCount = {} as Record<string, number>;

    for (const circuit of circuits) {
      const circuitId = path.parse(circuit).name;

      circuitsCount[circuitId] = (circuitsCount[circuitId] || 0) + 1;
    }

    let result = [] as CircuitInfo[];

    for (const circuit of circuits) {
      const circuitId = path.parse(circuit).name;

      result.push({
        path: circuit,
        id: circuitsCount[circuitId] > 1 ? null : circuitId,
      });
    }

    return result;
  }

  /**
   * Returns an array of all circuits paths available in the circuits directory.
   *
   * @returns {string[]} An array of circuit paths.
   */
  private _getAllCircuits(): string[] {
    const circuitsDir = this._manager.getCircuitsDir();

    let circuits = [] as string[];

    readDirRecursively(circuitsDir, (dir: string, file: string) => {
      if (path.extname(file) == ".circom") {
        circuits.push(path.relative(circuitsDir, file));
      }
    });

    return circuits;
  }
}
