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
  [NumericString],
];

export type ProofStruct = {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
};

export type NumberLike = number | bigint | string;
export type ArrayLike = NumberLike[] | ArrayLike[];
export type InputLike = NumberLike | ArrayLike;

export type Inputs = Record<string, InputLike>;

export type ArtifactsFileType = "r1cs" | "zkey" | "vkey" | "sym" | "json" | "wasm";
export type VerifierTemplateType = "groth16";

export type CircuitZKitConfig = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
  templateType?: VerifierTemplateType;
};
