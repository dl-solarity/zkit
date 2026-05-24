import { AbstractProtocolImplementer } from "./AbstractImplementer";
import { Groth16ProofStruct, Groth16CalldataStruct, ProvingSystemType } from "../../types";
export declare class Groth16Implementer extends AbstractProtocolImplementer<"groth16"> {
  generateProof(zKeyFilePath: string, witnessFilePath: string, timeout?: number): Promise<Groth16ProofStruct>;
  verifyProof(proof: Groth16ProofStruct, vKeyFilePath: string): Promise<boolean>;
  generateCalldata(proof: Groth16ProofStruct): Promise<Groth16CalldataStruct>;
  getProvingSystemType(): ProvingSystemType;
}
//# sourceMappingURL=Groth16Implementer.d.ts.map
