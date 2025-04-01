import fs from "fs";
import * as snarkjs from "snarkjs";

import { AbstractProtocolImplementer } from "./AbstractImplementer";

import { PlonkProofStruct, PlonkCalldataStruct, ProvingSystemType } from "../../types/protocols";

import { terminateCurve } from "../../utils";

export class PlonkImplementer extends AbstractProtocolImplementer<"plonk"> {
  public async generateProof(zKeyFilePath: string, witnessFilePath: string): Promise<PlonkProofStruct> {
    const proof = await snarkjs.plonk.prove(zKeyFilePath, witnessFilePath);

    await terminateCurve();

    return proof as PlonkProofStruct;
  }

  public async verifyProof(proof: PlonkProofStruct, vKeyFilePath: string): Promise<boolean> {
    const verifier = JSON.parse(fs.readFileSync(vKeyFilePath).toString());

    const proofVerification = await snarkjs.plonk.verify(verifier, proof.publicSignals, proof.proof);

    await terminateCurve();

    return proofVerification;
  }

  public async generateCalldata(proof: PlonkProofStruct): Promise<PlonkCalldataStruct> {
    const calldata = await snarkjs.plonk.exportSolidityCallData(proof.proof, proof.publicSignals);
    const proofArrEndIndex: number = calldata.indexOf("]") + 1;

    const calldataRawArray = JSON.parse(
      `[${calldata.slice(0, proofArrEndIndex)},${calldata.slice(proofArrEndIndex, calldata.length)}]`,
    );

    return {
      proofPoints: {
        proofData: calldataRawArray[0],
      },
      publicSignals: calldataRawArray[1],
    };
  }

  public getProvingSystemType(): ProvingSystemType {
    return "plonk";
  }
}
