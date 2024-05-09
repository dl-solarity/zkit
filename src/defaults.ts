import { CompileOptions, ManagerZKitConfig } from "./types";

export const defaultManagerOptions: Partial<ManagerZKitConfig> = {
  circuitsDir: "circuits",
  artifactsDir: "zkit-artifacts",
  verifiersDir: "contracts/verifiers",
};

export const defaultCompileOptions: CompileOptions = {
  sym: false,
  json: false,
  c: false,
  quiet: false,
};
