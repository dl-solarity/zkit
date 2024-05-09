import os from "os";
import path from "path";

import { CircuitZKit } from "./CircuitZKit";
import { ManagerZKit } from "./ManagerZKit";
import { CircuitInfo } from "./types";
import { readDirRecursively } from "./utils";

export class CircomZKit {
  constructor(private readonly _manager: ManagerZKit) {}

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
