import fs from "fs";
import * as snarkjs from "snarkjs";

import { AbstractProtocolImplementer } from "./AbstractImplementer";

import { Signals } from "../../types/proof-utils";
import { Groth16ProofStruct, ProvingSystemType, Groth16Calldata } from "../../types/protocols";

import { terminateCurve } from "../../utils";

export class Groth16Implementer extends AbstractProtocolImplementer<"groth16"> {
  public async generateProof(inputs: Signals, zKeyFilePath: string, wasmFilePath: string): Promise<Groth16ProofStruct> {
    const fullProof = await snarkjs.groth16.fullProve(inputs, wasmFilePath, zKeyFilePath);

    await terminateCurve();

    return fullProof;
  }

  public async verifyProof(proof: Groth16ProofStruct, vKeyFilePath: string): Promise<boolean> {
    const verifier = JSON.parse(fs.readFileSync(vKeyFilePath).toString());

    const proofVerification = await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);

    await terminateCurve();

    return proofVerification;
  }

  public async generateCalldata(proof: Groth16ProofStruct): Promise<Groth16Calldata> {
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    return JSON.parse(`[${calldata}]`) as Groth16Calldata;
  }

  public getProvingSystemType(): ProvingSystemType {
    return "groth16";
  }
}
