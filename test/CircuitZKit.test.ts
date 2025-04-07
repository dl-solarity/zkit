import ejs from "ejs";
import fs from "fs";
import path from "path";
import * as os from "os";

import { expect } from "chai";
import { createHash } from "crypto";
import { AddressLike, BigNumberish } from "ethers";

import { useFixtureProject } from "./helpers";

import {
  CircuitZKit,
  CircuitZKitConfig,
  Groth16Implementer,
  PlonkImplementer,
  ProvingSystemType,
  IProtocolImplementer,
  Groth16ProofStruct,
  PlonkProofStruct,
  Groth16CalldataStruct,
  PlonkCalldataStruct,
} from "../src";

export type Groth16ProofVerifierStruct = {
  proofPoints: Groth16ProofPointsStruct;
  publicSignals: BigNumberish[];
};

export type Groth16ProofPointsStruct = {
  a: [BigNumberish, BigNumberish];
  b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
  c: [BigNumberish, BigNumberish];
};

export interface ShortTestGroth16VerifierType {
  verifyProof(
    verifier_: AddressLike,
    a_: [BigNumberish, BigNumberish],
    b_: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]],
    c_: [BigNumberish, BigNumberish],
    pubSignals_: BigNumberish[],
  ): Promise<boolean>;
  verifyProofPointsStruct(
    verifier_: AddressLike,
    proofPoints_: Groth16ProofPointsStruct,
    pubSignals_: BigNumberish[],
  ): Promise<boolean>;
  verifyProofGroth16ProofStruct(verifier_: AddressLike, groth16Proof_: Groth16ProofVerifierStruct): Promise<boolean>;
}

export type PlonkProofVerifierStruct = {
  proofPoints: PlonkProofPointsStruct;
  publicSignals: BigNumberish[];
};

export type PlonkProofPointsStruct = {
  proofData: BigNumberish[];
};

export interface ShortTestPlonkVerifierType {
  verifyProof(verifier_: AddressLike, proofData_: BigNumberish[], pubSignals_: BigNumberish[]): Promise<boolean>;
  verifyProofPointsStruct(
    verifier_: AddressLike,
    proofPoints_: PlonkProofPointsStruct,
    pubSignals_: BigNumberish[],
  ): Promise<boolean>;
  verifyProofPlonkProofStruct(verifier_: AddressLike, plonkProof_: PlonkProofVerifierStruct): Promise<boolean>;
}

describe("CircuitZKit", () => {
  function getArtifactsFullPath(circuitDirSourceName: string): string {
    return path.join(process.cwd(), "zkit", "artifacts", circuitDirSourceName);
  }

  function getVerifiersDirFullPath(): string {
    return path.join(process.cwd(), "contracts", "verifiers");
  }

  function getCircuitZKit<T extends ProvingSystemType>(
    circuitName: string,
    protocolType: ProvingSystemType,
    config?: CircuitZKitConfig,
  ): CircuitZKit<T> {
    let implementer: IProtocolImplementer<T>;

    switch (protocolType) {
      case "groth16":
        implementer = new Groth16Implementer();
        break;
      case "plonk":
        implementer = new PlonkImplementer();
        break;
      default:
        throw new Error(`Invalid protocol type - ${protocolType}`);
    }

    if (!config) {
      config = {
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`${circuitName}.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      };
    }

    return new CircuitZKit<T>(config, implementer);
  }

  describe("CircuitZKit creation", () => {
    useFixtureProject("simple-circuits");

    it("should correctly set config parameters", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      expect(multiplierCircuit.getCircuitName()).to.be.eq(circuitName);
      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}Groth16Verifier`);
      expect(multiplierCircuit.getProvingSystemType()).to.be.eq("groth16");
    });
  });

  describe("getTemplate", () => {
    it("should return correct 'groth16' Solidity template", async () => {
      const multiplierCircuit = getCircuitZKit<"groth16">("Multiplier", "groth16");

      const groth16TemplatePath: string = path.join(
        __dirname,
        "..",
        "src",
        "core",
        "templates",
        "verifier_groth16.sol.ejs",
      );

      expect(multiplierCircuit.getVerifierTemplate("sol")).to.be.eq(fs.readFileSync(groth16TemplatePath, "utf-8"));
    });

    it("should return correct 'groth16' Vyper template", async () => {
      const multiplierCircuit = getCircuitZKit<"groth16">("Multiplier", "groth16");

      const groth16TemplatePath: string = path.join(
        __dirname,
        "..",
        "src",
        "core",
        "templates",
        "verifier_groth16.vy.ejs",
      );

      expect(multiplierCircuit.getVerifierTemplate("vy")).to.be.eq(fs.readFileSync(groth16TemplatePath, "utf-8"));
    });

    it("should return correct 'plonk' Solidity template", async () => {
      const multiplierCircuit = getCircuitZKit<"plonk">("Multiplier", "plonk");

      const plonkTemplatePath: string = path.join(
        __dirname,
        "..",
        "src",
        "core",
        "templates",
        "verifier_plonk.sol.ejs",
      );

      expect(multiplierCircuit.getVerifierTemplate("sol")).to.be.eq(fs.readFileSync(plonkTemplatePath, "utf-8"));
    });
  });

  describe("createVerifier", () => {
    useFixtureProject("simple-circuits");

    afterEach("cleanup", async () => {
      fs.rmSync(getVerifiersDirFullPath(), { recursive: true, force: true });
    });

    it("should correctly create 'groth16' Solidity verifier file", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);
      const protocolType: ProvingSystemType = "groth16";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}Groth16Verifier`);

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.false;

      await multiplierCircuit.createVerifier("sol");

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.${protocolType}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = multiplierCircuit.getVerifierTemplate("sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create 'plonk' verifier file", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);
      const protocolType: ProvingSystemType = "plonk";

      const multiplierCircuit = getCircuitZKit<"plonk">(circuitName, "plonk", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}PlonkVerifier`);

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.false;

      await multiplierCircuit.createVerifier("sol");

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.${protocolType}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = multiplierCircuit.getVerifierTemplate("sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create verifier file with the name suffix", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);
      const protocolType: ProvingSystemType = "plonk";

      const multiplierCircuit = getCircuitZKit<"plonk">(circuitName, "plonk", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const nameSuffix: string = "_2_3_";

      expect(multiplierCircuit.getVerifierName(nameSuffix)).to.be.eq(`${circuitName}${nameSuffix}PlonkVerifier`);

      const expectedVerifierFilePath = path.join(
        verifierDirPath,
        `${multiplierCircuit.getVerifierName(nameSuffix)}.sol`,
      );

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.false;

      await multiplierCircuit.createVerifier("sol", nameSuffix);

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.${protocolType}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = multiplierCircuit.getVerifierTemplate("sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName(nameSuffix);

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create Solidity verifier and verify 'groth16' proof", async function () {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true, force: true });

      const proof = await multiplierCircuit.generateProof({
        a: 10,
        b: 20,
      });

      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;

      const data = await multiplierCircuit.generateCalldata(proof);

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierGroth16Verifier");

      const verifier = await MultiplierVerifierFactory.deploy();

      expect(await verifier.verifyProof(data.proofPoints.a, data.proofPoints.b, data.proofPoints.c, data.publicSignals))
        .to.be.true;
    });

    it("should correctly create Solidity verifier and verify 'plonk' proof", async function () {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"plonk">(circuitName, "plonk", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true });

      const proof = await multiplierCircuit.generateProof({
        a: 10,
        b: 20,
      });

      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;

      const data = await multiplierCircuit.generateCalldata(proof);

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierPlonkVerifier");

      const verifier = await MultiplierVerifierFactory.deploy();

      expect(await verifier.verifyProof(data.proofPoints.proofData, data.publicSignals)).to.be.true;
    });

    it("should correctly create Vyper verifier and verify 'groth16' proof", async function () {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.vy`);

      await multiplierCircuit.createVerifier("vy");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true });

      const a = 2;
      const b = 3;

      const proof: any = await multiplierCircuit.generateProof({ a, b });

      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;

      let data = await multiplierCircuit.generateCalldata(proof);

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierGroth16Verifier");
      const verifier = await MultiplierVerifierFactory.deploy();

      expect(await verifier.verifyProof(data.proofPoints.a, data.proofPoints.b, data.proofPoints.c, data.publicSignals))
        .to.be.true;
    });

    it("should correctly create Vyper verifier and verify 'plonk' proof", async function () {
      const circuitName = "MultiDimensionalArray";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const mdArrayCircuit = getCircuitZKit<"plonk">(circuitName, "plonk", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${mdArrayCircuit.getVerifierName()}.vy`);

      await mdArrayCircuit.createVerifier("vy");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true });

      const a = 2;
      const b = [
        [3, 1],
        [44, 2],
      ];

      const proof: any = await mdArrayCircuit.generateProof({ a, b });

      expect(await mdArrayCircuit.verifyProof(proof)).to.be.true;

      let data = await mdArrayCircuit.generateCalldata(proof);

      const MdArrayVerifierFactory = await this.hre.ethers.getContractFactory("MultiDimensionalArrayPlonkVerifier");
      const verifier = await MdArrayVerifierFactory.deploy();

      expect(await verifier.verifyProof(data.proofPoints.proofData, data.publicSignals)).to.be.true;
    });

    it("should correctly create verifier several times", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);
      const protocolType: ProvingSystemType = "groth16";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, protocolType, {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.${protocolType}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = multiplierCircuit.getVerifierTemplate("sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create verifier with long suffix name", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);
      const protocolType: ProvingSystemType = "groth16";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, protocolType, {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const longSuffixName = `_L${"o".repeat(220)}ngSuffixName_`;
      const expectedSuffix = `_0x${createHash("sha1").update(longSuffixName).digest("hex").slice(0, 8)}_`;

      const expectedVerifierFilePath = path.join(
        verifierDirPath,
        `${multiplierCircuit.getVerifierName(expectedSuffix)}.sol`,
      );

      await multiplierCircuit.createVerifier("sol", longSuffixName);
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;
    });

    it("should get exception if vKey file does not exist", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`a/Addition.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const invalidVKeyFilePath = multiplierCircuit.getArtifactsFilePath("vkey");

      await expect(multiplierCircuit.createVerifier("sol")).to.be.rejectedWith(
        `Expected the file "${invalidVKeyFilePath}" to exist`,
      );
    });

    it("should get exception if the new verifier file name length exceeds the maximum file name length", async () => {
      const circuitName = `L${"o".repeat(223)}ngNameCircuit`;
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const longNameCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedCircuitVerifierfileName = `${longNameCircuit.getVerifierName()}.sol`;

      await expect(longNameCircuit.createVerifier("sol")).to.be.rejectedWith(
        `Verifier file name "${expectedCircuitVerifierfileName}" exceeds the maximum file name length`,
      );
    });
  });

  describe("calculateWitness", () => {
    useFixtureProject("simple-circuits");

    it("should correctly create witness", async () => {
      const circuitName = "Multiplier";
      const circuitArtifactsPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const tmpDir = path.join(os.tmpdir(), ".zkit");
      fs.rmSync(tmpDir, { recursive: true, force: true });

      const b = 10,
        a = 20;

      expect(await multiplierCircuit.calculateWitness({ a, b })).to.deep.eq([1n, 200n, 20n, 10n]);
      expect(await multiplierCircuit.calculateWitness({ a, b })).to.deep.eq([1n, 200n, 20n, 10n]);
      expect(await multiplierCircuit.calculateWitness({ a, b: 30 })).to.deep.eq([1n, 600n, 20n, 30n]);

      expect(fs.readdirSync(tmpDir)).to.be.deep.equal([`${circuitName}.wtns`]);
    });

    it("should correctly calculate witness with overrides", async () => {
      const circuitName = "Multiplier";
      const circuitArtifactsPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const tmpDir = path.join(os.tmpdir(), ".zkit");
      fs.rmSync(tmpDir, { recursive: true, force: true });

      const b = 10,
        a = 20;

      expect(await multiplierCircuit.calculateWitness({ a, b }, { "main.a": 15n })).to.deep.eq([1n, 200n, 15n, 10n]);
      expect(await multiplierCircuit.calculateWitness({ a, b }, { "main.b": 100n })).to.deep.eq([1n, 200n, 20n, 100n]);
      expect(await multiplierCircuit.calculateWitness({ a, b: 30 }, { "main.a": 70n, "main.out": 50n })).to.deep.eq([
        1n,
        50n,
        70n,
        30n,
      ]);

      expect(fs.readdirSync(tmpDir)).to.be.deep.equal([`${circuitName}.wtns`]);
    });

    it("should get exception if try to calculate witness with invalid overrides", async () => {
      const circuitName = "Multiplier";
      const circuitArtifactsPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const b = 10,
        a = 20;

      await expect(multiplierCircuit.calculateWitness({ a, b }, { "main.c": 10n })).to.be.rejectedWith(
        "Signals not found in .sym file: main.c",
      );

      await expect(
        multiplierCircuit.calculateWitness({ a, b }, { "main.a": 10n, "main.output": 10n, "main.c": 10n }),
      ).to.be.rejectedWith("Signals not found in .sym file: main.output, main.c");

      await expect(multiplierCircuit.calculateWitness({ a, b }, { "main.c": 10n, "main.d": 10n })).to.be.rejectedWith(
        "Signals not found in .sym file: main.c, main.d",
      );
    });

    it("should get exception if try to calculate witness with overrides for a signal that was simplified", async () => {
      const circuitName = "MultiDimensionalArray";
      const circuitArtifactsPath = getArtifactsFullPath(`${circuitName}.circom`);

      const mdCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const a = 2;
      const b = [
        [3, 1],
        [44, 2],
      ];

      await expect(mdCircuit.calculateWitness({ a, b }, { "main.isEqual": 20n })).to.be.rejectedWith(
        "Signals not found in .sym file: main.isEqual",
      );
    });
  });

  describe("generateProof/verifyProof", () => {
    useFixtureProject("simple-circuits");

    it("should correctly generate and verify 'groth16' proof", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      const b = 10,
        a = 20;

      const proof: Groth16ProofStruct = await multiplierCircuit.generateProof({ a, b });

      expect(proof.publicSignals).to.be.deep.eq([(b * a).toString()]);
      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;
    });

    it("should correctly generate and verify 'plonk' proof", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"plonk">(circuitName, "plonk");

      const b = 10,
        a = 20;

      const proof: PlonkProofStruct = await multiplierCircuit.generateProof({ a, b });

      expect(proof.publicSignals).to.be.deep.eq([(b * a).toString()]);
      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;
    });

    it("should correctly generate and verify proofs with witness overrides", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      const b = 10,
        a = 20;

      const proof1: Groth16ProofStruct = await multiplierCircuit.generateProof({ a, b }, { "main.a": 5n });

      expect(proof1.publicSignals).to.be.deep.eq([(b * a).toString()]);
      expect(await multiplierCircuit.verifyProof(proof1)).to.be.false;

      const proof2: Groth16ProofStruct = await multiplierCircuit.generateProof(
        { a, b },
        { "main.a": 5n, "main.out": 50n },
      );

      expect(proof2.publicSignals).to.be.deep.eq([(b * 5).toString()]);
      expect(await multiplierCircuit.verifyProof(proof2)).to.be.true;

      const proof3: Groth16ProofStruct = await multiplierCircuit.generateProof({ a, b }, { "main.out": 2n });

      expect(proof3.publicSignals).to.be.deep.eq(["2"]);
      expect(await multiplierCircuit.verifyProof(proof3)).to.be.false;
    });

    it("should get exception if try to generate proof with invalid witness overrides", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      const b = 10,
        a = 20;

      await expect(multiplierCircuit.generateProof({ a, b }, { a: 5n })).to.be.rejectedWith(
        "Signals not found in .sym file: a",
      );
    });
  });

  describe("generateCalldata", () => {
    useFixtureProject("simple-circuits");

    afterEach("cleanup", async () => {
      fs.rmSync(getVerifiersDirFullPath(), { recursive: true, force: true });
    });

    it("should correctly generate 'groth16' calldata and verify proof on the verifier contract", async function () {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      await multiplierCircuit.createVerifier("sol");

      await this.hre.run("compile", { quiet: true });

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierGroth16Verifier");
      const TestGroth16VerifierFactory = await this.hre.ethers.getContractFactory("TestGroth16Verifier");

      const verifier = await MultiplierVerifierFactory.deploy();
      const testGroth16Verifier: ShortTestGroth16VerifierType = await TestGroth16VerifierFactory.deploy();

      const b = 10,
        a = 20;

      const proof: Groth16ProofStruct = await multiplierCircuit.generateProof({ a, b });
      const generatedCalldata: Groth16CalldataStruct = await multiplierCircuit.generateCalldata(proof);

      expect(
        await testGroth16Verifier.verifyProof(
          verifier,
          generatedCalldata.proofPoints.a,
          generatedCalldata.proofPoints.b,
          generatedCalldata.proofPoints.c,
          generatedCalldata.publicSignals,
        ),
      ).to.be.true;
      expect(
        await testGroth16Verifier.verifyProofPointsStruct(
          verifier,
          generatedCalldata.proofPoints,
          generatedCalldata.publicSignals,
        ),
      ).to.be.true;
      expect(await testGroth16Verifier.verifyProofGroth16ProofStruct(verifier, generatedCalldata)).to.be.true;
    });

    it("should correctly generate 'plonk' calldata and verify proof on the verifier contract", async function () {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"plonk">(circuitName, "plonk");

      await multiplierCircuit.createVerifier("sol");

      await this.hre.run("compile", { quiet: true });

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierPlonkVerifier");
      const TestPlonkVerifierFactory = await this.hre.ethers.getContractFactory("TestPlonkVerifier");

      const verifier = await MultiplierVerifierFactory.deploy();
      const testPlonkVerifier: ShortTestPlonkVerifierType = await TestPlonkVerifierFactory.deploy();

      const b = 10,
        a = 20;

      const proof: PlonkProofStruct = await multiplierCircuit.generateProof({ a, b });
      const generatedCalldata: PlonkCalldataStruct = await multiplierCircuit.generateCalldata(proof);

      expect(await verifier.verifyProof(generatedCalldata.proofPoints.proofData, generatedCalldata.publicSignals));

      expect(
        await testPlonkVerifier.verifyProof(
          verifier,
          generatedCalldata.proofPoints.proofData,
          generatedCalldata.publicSignals,
        ),
      ).to.be.true;
      expect(
        await testPlonkVerifier.verifyProofPointsStruct(
          verifier,
          generatedCalldata.proofPoints,
          generatedCalldata.publicSignals,
        ),
      ).to.be.true;
      expect(await testPlonkVerifier.verifyProofPlonkProofStruct(verifier, generatedCalldata)).to.be.true;
    });
  });

  describe("mustGetArtifactsFilePath", () => {
    useFixtureProject("simple-circuits");

    it("should return correct file path", async () => {
      const circuitName = "Multiplier";
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      expect(multiplierCircuit.mustGetArtifactsFilePath("wasm")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_js`, `${circuitName}.wasm`),
      );
    });

    it("should get exception if file does not exist", async () => {
      const circuitName = "Addition";
      const artifactsDirFullPath = getArtifactsFullPath(`a/${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16", {
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const expectedR1CSFilePath = path.join(artifactsDirFullPath, `${circuitName}.r1cs`);

      expect(function () {
        multiplierCircuit.mustGetArtifactsFilePath("r1cs");
      }).to.throw(`Expected the file "${expectedR1CSFilePath}" to exist`);
    });
  });

  describe("getArtifactsFilePath", () => {
    it("should return correct artifacts file path", async () => {
      const circuitName = "Multiplier";
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16");

      expect(multiplierCircuit.getArtifactsFilePath("r1cs")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.r1cs`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("zkey")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.groth16.zkey`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.groth16.vkey.json`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("sym")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.sym`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("json")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_constraints.json`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("wasm")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_js`, `${circuitName}.wasm`),
      );
    });

    it("should get exception if pass invalid file type", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit = getCircuitZKit<"groth16">(circuitName, "groth16") as any;

      const invalidFileType = "wwasm";

      expect(function () {
        multiplierCircuit.getArtifactsFilePath(invalidFileType);
      }).to.throw(`Ambiguous file type: ${invalidFileType}.`);
    });
  });
});
