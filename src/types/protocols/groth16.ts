import { NumericString, PublicSignals } from "../proof-utils";

export interface Groth16Proof {
  pi_a: [NumericString, NumericString];
  pi_b: [[NumericString, NumericString], [NumericString, NumericString]];
  pi_c: [NumericString, NumericString];
  protocol: string;
  curve: string;
}

export interface Groth16ProofStruct {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

export type Groth16Calldata = [
  [NumericString, NumericString],
  [[NumericString, NumericString], [NumericString, NumericString]],
  [NumericString, NumericString],
  PublicSignals,
];
