import {
  IProtocolImplementer,
  ProvingSystemType,
  ProofStructByProtocol,
  CalldataByProtocol,
  VerifierLanguageType,
} from "../../types";
export declare abstract class AbstractProtocolImplementer<T extends ProvingSystemType>
  implements IProtocolImplementer<T>
{
  createVerifier(
    vKeyFilePath: string,
    verifierFilePath: string,
    languageExtension: VerifierLanguageType,
  ): Promise<void>;
  abstract generateProof(zKeyFilePath: string, witnessFilePath: string): Promise<ProofStructByProtocol<T>>;
  abstract verifyProof(proof: ProofStructByProtocol<T>, vKeyFilePath: string): Promise<boolean>;
  abstract generateCalldata(proof: ProofStructByProtocol<T>): Promise<CalldataByProtocol<T>>;
  abstract getProvingSystemType(): ProvingSystemType;
  getTemplate(languageExtension: VerifierLanguageType): string;
  getVerifierName(circuitName: string, verifierNameSuffix?: string): string;
  getZKeyFileName(circuitName: string): string;
  getVKeyFileName(circuitName: string): string;
  protected withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>;
}
//# sourceMappingURL=AbstractImplementer.d.ts.map
