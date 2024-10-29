import fs from "fs";
import * as snarkjs from "snarkjs";

import { AbstractProtocolImplementer } from "./AbstractImplementer";

import { Signals } from "../../types/proof-utils";
import { Groth16ProofStruct, ProvingSystemType, Groth16Calldata } from "../../types/protocols";

import { getBn128Curve } from "../../utils";

export class Groth16Implementer extends AbstractProtocolImplementer<"groth16"> {
  public async generateProof(inputs: Signals, zKeyFilePath: string, wasmFilePath: string): Promise<Groth16ProofStruct> {
    const curve = await getBn128Curve();

    const fullProof = await snarkjs.groth16.fullProve(inputs, wasmFilePath, zKeyFilePath);

    curve.terminate();

    return fullProof as Groth16ProofStruct;
  }

  public async verifyProof(proof: Groth16ProofStruct, vKeyFilePath: string): Promise<boolean> {
    const verifier = JSON.parse(fs.readFileSync(vKeyFilePath).toString());

    const curve = await getBn128Curve();

    const proofVerification = await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);

    curve.terminate();

    return proofVerification;
  }

  public async generateCalldata(proof: Groth16ProofStruct): Promise<Groth16Calldata> {
    const curve = await getBn128Curve();

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals);

    curve.terminate();

    return JSON.parse(`[${calldata}]`) as Groth16Calldata;
  }

  public getProvingSystemType(): ProvingSystemType {
    return "groth16";
  }
}
