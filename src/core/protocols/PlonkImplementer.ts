import fs from "fs";
import * as snarkjs from "snarkjs";

import { AbstractProtocolImplementer } from "./AbstractImplementer";

import { Signals } from "../../types/proof-utils";
import { PlonkCalldata, PlonkProofStruct, ProvingSystemType } from "../../types/protocols";

import { terminateCurve } from "../../utils";

export class PlonkImplementer extends AbstractProtocolImplementer<"plonk"> {
  public async generateProof(inputs: Signals, zKeyFilePath: string, wasmFilePath: string): Promise<PlonkProofStruct> {
    const fullProof = await snarkjs.plonk.fullProve(inputs, wasmFilePath, zKeyFilePath);

    await terminateCurve();

    return fullProof as PlonkProofStruct;
  }

  public async verifyProof(proof: PlonkProofStruct, vKeyFilePath: string): Promise<boolean> {
    const verifier = JSON.parse(fs.readFileSync(vKeyFilePath).toString());

    const proofVerification = await snarkjs.plonk.verify(verifier, proof.publicSignals, proof.proof);

    await terminateCurve();

    return proofVerification;
  }

  public async generateCalldata(proof: PlonkProofStruct): Promise<PlonkCalldata> {
    const calldata = await snarkjs.plonk.exportSolidityCallData(proof.proof, proof.publicSignals);
    const proofArrEndIndex: number = calldata.indexOf("]") + 1;

    return JSON.parse(
      `[${calldata.slice(0, proofArrEndIndex)},${calldata.slice(proofArrEndIndex, calldata.length)}]`,
    ) as PlonkCalldata;
  }

  public getProvingSystemType(): ProvingSystemType {
    return "plonk";
  }
}
