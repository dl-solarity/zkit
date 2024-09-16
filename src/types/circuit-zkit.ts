export type NumericString = `${number}` | string;

export type PublicSignals = NumericString[];

export type Groth16Proof = {
  pi_a: [NumericString, NumericString];
  pi_b: [[NumericString, NumericString], [NumericString, NumericString]];
  pi_c: [NumericString, NumericString];
  protocol: string;
  curve: string;
};

export type Calldata = [
  [NumericString, NumericString],
  [[NumericString, NumericString], [NumericString, NumericString]],
  [NumericString, NumericString],
  PublicSignals,
];

export type ArtifactSignal = {
  name: string;
  dimension: string[];
  type: string;
  visibility: string;
};

export type PublicSignalInfo = {
  name: string;
  dimension: string[];
};

export type ProofStruct = {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
};

export type NumberLike = number | bigint | `${number}`;
export type ArrayLike = NumberLike[] | ArrayLike[];
export type Signal = NumberLike | ArrayLike;
export type Signals = Record<string, Signal>;

export type ArtifactsFileType = "r1cs" | "zkey" | "vkey" | "sym" | "constraints" | "artifacts" | "wasm";
export type VerifierProvingSystem = "groth16";
export type VerifierLanguageType = "sol" | "vy";

export type CircuitZKitConfig = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
  provingSystem?: VerifierProvingSystem;
};
