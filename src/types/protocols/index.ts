import { Groth16ProofStruct, Groth16Calldata } from "./groth16";
import { PlonkProofStruct, PlonkCalldata } from "./plonk";

import { Inputs } from "../proof-utils";

export * from "./groth16";
export * from "./plonk";

export interface IProtocolImplementer<T extends ProtocolType> {
  createVerifier(circuitName: string, vKeyFilePath: string, verifierFilePath: string): Promise<void>;

  generateProof(inputs: Inputs, zKeyFilePath: string, wasmFilePath: string): Promise<ProofStructByProtocol<T>>;

  verifyProof(proof: ProofStructByProtocol<T>, vKeyFilePath: string): Promise<boolean>;

  generateCalldata(proof: ProofStructByProtocol<T>): Promise<CalldataByProtocol<T>>;

  getProtocolType(): ProtocolType;

  getTemplate(): string;

  getVerifierName(circuitName: string): string;

  getZKeyFileName(circuitName: string): string;

  getVKeyFileName(circuitName: string): string;
}

export interface ProofStructMap {
  groth16: {
    proofStruct: Groth16ProofStruct;
    calldata: Groth16Calldata;
  };
  plonk: {
    proofStruct: PlonkProofStruct;
    calldata: PlonkCalldata;
  };
}

export type ProtocolType = keyof ProofStructMap;

export type ProofStructByProtocol<T extends ProtocolType> = ProofStructMap[T]["proofStruct"];
export type CalldataByProtocol<T extends ProtocolType> = ProofStructMap[T]["calldata"];
