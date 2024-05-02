const { Context } = require("@distributedlab/circom2");

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

export type ManagerZKitConfig = {
  circuits: string;
  artifacts: string;
  verifiers: string;
  ptau: string;
};

export type ManagerZKitPrivateConfig = ManagerZKitConfig & {
  compiler: typeof Context;
  templates: {
    groth16: string;
  };
};

export type CompileOptions = {
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export type CircuitInfo = {
  path: string;
  id: string | null;
};

export type PtauInfo = {
  file: string;
  url: string | null;
};

export type FileType = "r1cs" | "zkey" | "vkey" | "sym" | "json" | "wasm" | "sol";
export type DirType = "circuit" | "artifact" | "verifier";
export type TemplateType = "groth16";
