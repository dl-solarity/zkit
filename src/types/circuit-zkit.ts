export type ArtifactsFileType = "r1cs" | "zkey" | "vkey" | "sym" | "json" | "wasm";
export type VerifierLanguageType = "sol" | "vy";

export type CircuitZKitConfig = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
};
