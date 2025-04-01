import fs from "fs";
import * as snarkjs from "snarkjs";

import { AbstractProtocolImplementer } from "./AbstractImplementer";

import { Groth16ProofStruct, Groth16CalldataStruct, ProvingSystemType } from "../../types/protocols";

import { terminateCurve } from "../../utils";

export class Groth16Implementer extends AbstractProtocolImplementer<"groth16"> {
  public async generateProof(zKeyFilePath: string, witnessFilePath: string): Promise<Groth16ProofStruct> {
    const proof = await snarkjs.groth16.prove(zKeyFilePath, witnessFilePath);

    await terminateCurve();

    return proof as Groth16ProofStruct;
  }

  public async verifyProof(proof: Groth16ProofStruct, vKeyFilePath: string): Promise<boolean> {
    const verifier = JSON.parse(fs.readFileSync(vKeyFilePath).toString());

    const proofVerification = await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);

    await terminateCurve();

    return proofVerification;
  }

  public async generateCalldata(proof: Groth16ProofStruct): Promise<Groth16CalldataStruct> {
    const calldataRawArray = JSON.parse(
      `[${await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals)}]`,
    );

    return {
      proofPoints: {
        a: calldataRawArray[0],
        b: calldataRawArray[1],
        c: calldataRawArray[2],
      },
      publicSignals: calldataRawArray[3],
    };
  }

  public getProvingSystemType(): ProvingSystemType {
    return "groth16";
  }
}
