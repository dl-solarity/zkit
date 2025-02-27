import { NumericString, PublicSignals } from "../proof-utils";

export interface PlonkProof {
  A: [NumericString, NumericString];
  B: [NumericString, NumericString];
  C: [NumericString, NumericString];
  Z: [NumericString, NumericString];
  T1: [NumericString, NumericString];
  T2: [NumericString, NumericString];
  T3: [NumericString, NumericString];
  Wxi: [NumericString, NumericString];
  Wxiw: [NumericString, NumericString];
  eval_a: NumericString;
  eval_b: NumericString;
  eval_c: NumericString;
  eval_s1: NumericString;
  eval_s2: NumericString;
  eval_zw: NumericString;
  protocol: string;
  curve: string;
}

export interface PlonkProofStruct {
  proof: PlonkProof;
  publicSignals: PublicSignals;
}

export interface PlonkCalldataStruct {
  proofPoints: NumericString[];
  publicSignals: PublicSignals;
}

export type PlonkCalldata = [NumericString[], PublicSignals];
