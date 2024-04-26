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

export type Inputs = Record<string, NumberLike>;

export type CircuitZKitConfig = {
  circuitFile: string;
  artifactsDir: string;
  circuitOutDir: string;
  verifierOutDir: string;
};

export type CircomZKitConfig = {
  circuitsDir?: string;
  artifactsDir?: string;
  verifiersDir?: string;
};

export type CircomZKitPrivateConfig = {
  circuitsDir: string;
  artifactsDir: string;
  verifiersDir: string;
};

export type CircuitZKitPrivateConfig = {
  circuitFile: string;
  artifactsDir: string;
  circuitOutDir: string;
  verifierOutDir: string;
  r1csFile: string;
  zKeyFile: string;
  vKeyFile: string;
  wasmFile: string;
  verifierFile: string;
  ptauFile: string;
  ptauDir: string;
  circuitId: string;
  verifierId: string;
  wasmBytes: typeof Context;
  groth16Template: string;
};

export type CompileOptions = {
  sym?: boolean;
  c?: boolean;
  quiet?: boolean;
};
