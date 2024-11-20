import { Groth16ProofStruct, Groth16Calldata } from "./groth16";
import { PlonkProofStruct, PlonkCalldata } from "./plonk";

import { Signals } from "../proof-utils";
import { VerifierLanguageType } from "../circuit-zkit";

export * from "./groth16";
export * from "./plonk";

export interface IProtocolImplementer<T extends ProvingSystemType> {
  createVerifier(
    vKeyFilePath: string,
    verifierFilePath: string,
    languageExtension: VerifierLanguageType,
  ): Promise<void>;

  generateProof(inputs: Signals, zKeyFilePath: string, wasmFilePath: string): Promise<ProofStructByProtocol<T>>;

  verifyProof(proof: ProofStructByProtocol<T>, vKeyFilePath: string): Promise<boolean>;

  generateCalldata(proof: ProofStructByProtocol<T>): Promise<CalldataByProtocol<T>>;

  getProvingSystemType(): ProvingSystemType;

  getTemplate(fileExtension: VerifierLanguageType): string;

  getVerifierName(circuitName: string, verifierNameSuffix?: string): string;

  getZKeyFileName(circuitName: string): string;

  getVKeyFileName(circuitName: string): string;
}

export interface ProvingSystemStructMap {
  groth16: {
    proofStruct: Groth16ProofStruct;
    calldata: Groth16Calldata;
  };
  plonk: {
    proofStruct: PlonkProofStruct;
    calldata: PlonkCalldata;
  };
}

export type ProvingSystemType = keyof ProvingSystemStructMap;

export type ProofStructByProtocol<T extends ProvingSystemType> = ProvingSystemStructMap[T]["proofStruct"];
export type CalldataByProtocol<T extends ProvingSystemType> = ProvingSystemStructMap[T]["calldata"];
