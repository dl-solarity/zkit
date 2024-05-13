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

export type CircuitInfo = {
  path: string;
  id: string | null;
};

export type FileType = "r1cs" | "zkey" | "vkey" | "sym" | "json" | "wasm" | "sol";
export type DirType = "circuit" | "artifact" | "verifier";
export type TemplateType = "groth16";
