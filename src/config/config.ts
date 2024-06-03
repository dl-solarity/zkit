import { TemplateType } from "../types/types";

const { Context } = require("@distributedlab/circom2");

export type ManagerZKitConfig = {
  circuitsDir: string;
  artifactsDir: string;
  verifiersDir: string;
  ptauDir: string;
  allowDownload: boolean;
};

export const defaultManagerOptions: Partial<ManagerZKitConfig> = {
  circuitsDir: "circuits",
  artifactsDir: "zkit-artifacts",
  verifiersDir: "contracts/verifiers",
  allowDownload: true,
};

export type CompileOptions = {
  sym: boolean;
  json: boolean;
  c: boolean;
  quiet: boolean;
  setup: TemplateType;
  contributions: number;
};

export const defaultCompileOptions: CompileOptions = {
  sym: false,
  json: false,
  c: false,
  quiet: false,
  setup: "groth16",
  contributions: 5,
};

export type ManagerZKitPrivateConfig = ManagerZKitConfig & {
  compiler: typeof Context;
  templates: {
    groth16: string;
  };
};
