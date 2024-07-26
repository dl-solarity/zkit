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

export type ProofStruct = {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
};

export type NumberLike = number | bigint | `${number}`;
export type ArrayLike = NumberLike[] | ArrayLike[];
export type SignalLike = NumberLike | ArrayLike;
export type Signals = Record<string, SignalLike>;

export type ArtifactsFileType = "r1cs" | "zkey" | "vkey" | "sym" | "json" | "wasm";
export type VerifierTemplateType = "groth16";

export type CircuitZKitConfig = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
  templateType?: VerifierTemplateType;
};
