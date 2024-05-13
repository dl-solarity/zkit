const { Context } = require("@distributedlab/circom2");

export type ManagerZKitConfig = {
  circuitsDir: string;
  artifactsDir: string;
  verifiersDir: string;
  ptauFile: string;
};

export const defaultManagerOptions: Partial<ManagerZKitConfig> = {
  circuitsDir: "circuits",
  artifactsDir: "zkit-artifacts",
  verifiersDir: "contracts/verifiers",
};

export type CompileOptions = {
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
};

export const defaultCompileOptions: CompileOptions = {
  sym: false,
  json: false,
  c: false,
  quiet: false,
};

export type ManagerZKitPrivateConfig = {
  circuitsDir: string;
  artifactsDir: string;
  verifiersDir: string;
  tempDir: string;
  ptau: {
    isGlobal: boolean;
    path: string;
  };
  compiler: typeof Context;
  templates: {
    groth16: string;
  };
};
