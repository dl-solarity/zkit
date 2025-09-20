import { AbstractProtocolImplementer } from "./AbstractImplementer";
import { PlonkProofStruct, PlonkCalldataStruct, ProvingSystemType } from "../../types";
export declare class PlonkImplementer extends AbstractProtocolImplementer<"plonk"> {
  generateProof(zKeyFilePath: string, witnessFilePath: string, timeout?: number): Promise<PlonkProofStruct>;
  verifyProof(proof: PlonkProofStruct, vKeyFilePath: string): Promise<boolean>;
  generateCalldata(proof: PlonkProofStruct): Promise<PlonkCalldataStruct>;
  getProvingSystemType(): ProvingSystemType;
}
//# sourceMappingURL=PlonkImplementer.d.ts.map
