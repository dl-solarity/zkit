import ejs from "ejs";
import fs from "fs";
import * as os from "os";
import path from "path";

import { expect } from "chai";
import { useFixtureProject } from "./helpers";

import { CircuitZKit, ProofStruct } from "../src";

describe("CircuitZKit", () => {
  function getArtifactsFullPath(circuitDirSourceName: string): string {
    return path.join(process.cwd(), "zkit", "artifacts", circuitDirSourceName);
  }

  function getVerifiersDirFullPath(): string {
    return path.join(process.cwd(), "contracts", "verifiers");
  }

  describe("CircuitZKit creation", () => {
    useFixtureProject("simple-circuits");

    it("should correctly set config parameters", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`${circuitName}.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      expect(multiplierCircuit.getCircuitName()).to.be.eq(circuitName);
      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}Verifier`);
      expect(multiplierCircuit.getProvingSystem()).to.be.eq("groth16");
    });
  });

  describe("getTemplate", () => {
    it("should return correct 'groth16' Solidity template", async () => {
      const groth16TemplatePath: string = path.join(
        __dirname,
        "..",
        "src",
        "core",
        "templates",
        "verifier_groth16.sol.ejs",
      );

      expect(CircuitZKit.getTemplate("groth16", "sol")).to.be.eq(fs.readFileSync(groth16TemplatePath, "utf-8"));
    });

    it("should return correct 'groth16' Vyper template", async () => {
      const groth16TemplatePath: string = path.join(
        __dirname,
        "..",
        "src",
        "core",
        "templates",
        "verifier_groth16.vy.ejs",
      );

      expect(CircuitZKit.getTemplate("groth16", "vy")).to.be.eq(fs.readFileSync(groth16TemplatePath, "utf-8"));
    });

    it("should get exception if pass invalid proving system", async () => {
      const circuitZKit: any = CircuitZKit;

      const invalidTemplate = "fflonk";

      expect(function () {
        circuitZKit.getTemplate(invalidTemplate, "sol");
      }).to.throw(`Ambiguous proving system: ${invalidTemplate}.`);
    });
  });

  describe("createVerifier", () => {
    useFixtureProject("simple-circuits");

    afterEach("cleanup", async () => {
      fs.rmSync(getVerifiersDirFullPath(), { recursive: true, force: true });
    });

    it("should correctly create verifier Solidity file", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}Verifier`);

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.false;

      await multiplierCircuit.createVerifier("sol");

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = CircuitZKit.getTemplate("groth16", "sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();
      templateParams["signals"] = multiplierCircuit.getPublicSignalsInfo();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create verifier Vyper file", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      expect(multiplierCircuit.getVerifierName()).to.be.eq(`${circuitName}Verifier`);

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.vy`);

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.false;

      await multiplierCircuit.createVerifier("vy");

      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = CircuitZKit.getTemplate("groth16", "vy");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should correctly create Solidity verifier and verify proof", async function () {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
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

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierVerifier");

      const verifier = await MultiplierVerifierFactory.deploy();

      expect(await verifier.verifyProof(...data)).to.be.true;
    });

    it("should correctly create Solidity verifier and verify proof with public signals struct", async function () {
      const circuitName = "MultiDimensionalArray";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const mdArrayCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${mdArrayCircuit.getVerifierName()}.sol`);

      await mdArrayCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true });

      const a = [30, 40, 22, 14];
      const b = 2;
      const c = [
        [2, 17, 4348, 14, 12, 11, 9, 333, 77],
        [12, 10, 4, 3, 2, 99999, 82, 2, 2],
      ];

      const proof: any = await mdArrayCircuit.generateProof({ a, b, c });

      expect(await mdArrayCircuit.verifyProof(proof)).to.be.true;

      const data = await mdArrayCircuit.generateCalldata(proof);

      const MdArrayVerifierFactory = await this.hre.ethers.getContractFactory("MultiDimensionalArrayVerifier");
      const verifier = await MdArrayVerifierFactory.deploy();

      const out1 = 2;
      const out2 = [
        [3, 6],
        [12, 24],
      ];

      const calldata = [data[0], data[1], data[2], { out1, out2, a, b, c }];

      expect(await verifier.verifyProofWithStruct(...calldata)).to.be.true;
    });

    it("should correctly create Vyper verifier and verify proof", async function () {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.vy`);

      await multiplierCircuit.createVerifier("vy");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await this.hre.run("compile", { quiet: true });

      const proof = await multiplierCircuit.generateProof({
        a: 10,
        b: 20,
      });

      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;

      const data = await multiplierCircuit.generateCalldata(proof);

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierVerifier");

      const verifier = await MultiplierVerifierFactory.deploy();

      expect(await verifier.verifyProof(...data)).to.be.true;
    });

    it("should correctly create verifier several times", async () => {
      const circuitName = "Multiplier";
      const verifierDirPath = getVerifiersDirFullPath();
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath,
      });

      const expectedVerifierFilePath = path.join(verifierDirPath, `${multiplierCircuit.getVerifierName()}.sol`);

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      await multiplierCircuit.createVerifier("sol");
      expect(fs.existsSync(expectedVerifierFilePath)).to.be.true;

      const expectedVKeyFilePath = path.join(artifactsDirFullPath, `${circuitName}.vkey.json`);
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(expectedVKeyFilePath);

      const template = CircuitZKit.getTemplate("groth16", "sol");
      const templateParams = JSON.parse(fs.readFileSync(expectedVKeyFilePath, "utf-8"));
      templateParams["verifier_id"] = multiplierCircuit.getVerifierName();
      templateParams["signals"] = multiplierCircuit.getPublicSignalsInfo();

      expect(fs.readFileSync(expectedVerifierFilePath, "utf-8")).to.be.eq(ejs.render(template, templateParams));
    });

    it("should get exception if vKey file does not exist", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`a/Addition.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const invalidVKeyFilePath = multiplierCircuit.getArtifactsFilePath("vkey");

      await expect(multiplierCircuit.createVerifier("sol")).to.be.rejectedWith(
        `Expected the file "${invalidVKeyFilePath}" to exist`,
      );
    });
  });

  describe("calculateWitness", () => {
    useFixtureProject("simple-circuits");

    it("should correctly create witness", async () => {
      const circuitName = "Multiplier";
      const circuitArtifactsPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const b = 10,
        a = 20;

      const tmpDir = path.join(os.tmpdir(), ".zkit");

      fs.rmSync(tmpDir, { force: true, recursive: true });

      expect(await multiplierCircuit.calculateWitness({ a, b })).to.deep.eq([1n, 200n, 20n, 10n]);
      expect(await multiplierCircuit.calculateWitness({ a, b })).to.deep.eq([1n, 200n, 20n, 10n]);
      expect(await multiplierCircuit.calculateWitness({ a, b: 30 })).to.deep.eq([1n, 600n, 20n, 30n]);
    });
  });

  describe("generateProof/verifyProof", () => {
    useFixtureProject("simple-circuits");

    it("should correctly generate and verify proof", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`${circuitName}.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const b = 10,
        a = 20;

      const proof: ProofStruct = await multiplierCircuit.generateProof({ a, b });

      expect(proof.publicSignals).to.be.deep.eq([(b * a).toString()]);
      expect(await multiplierCircuit.verifyProof(proof)).to.be.true;
    });
  });

  describe("generateCalldata", () => {
    useFixtureProject("simple-circuits");

    afterEach("cleanup", async () => {
      fs.rmSync(getVerifiersDirFullPath(), { recursive: true, force: true });
    });

    it("should correctly generate calldata and verify proof on the verifier contract", async function () {
      const circuitName = "Multiplier";

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`${circuitName}.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      await multiplierCircuit.createVerifier("sol");

      await this.hre.run("compile", { quiet: true });

      const MultiplierVerifierFactory = await this.hre.ethers.getContractFactory("MultiplierVerifier");
      const verifier = await MultiplierVerifierFactory.deploy();

      const b = 10,
        a = 20;

      const proof: ProofStruct = await multiplierCircuit.generateProof({ a, b });
      const generatedCalldata = await multiplierCircuit.generateCalldata(proof);

      expect(
        await verifier.verifyProof(
          generatedCalldata[0],
          generatedCalldata[1],
          generatedCalldata[2],
          generatedCalldata[3],
        ),
      );
    });
  });

  describe("mustGetArtifactsFilePath", () => {
    useFixtureProject("simple-circuits");

    it("should return correct file path", async () => {
      const circuitName = "Multiplier";
      const artifactsDirFullPath = getArtifactsFullPath(`${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      expect(multiplierCircuit.mustGetArtifactsFilePath("wasm")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_js`, `${circuitName}.wasm`),
      );
    });

    it("should get exception if file does not exist", async () => {
      const circuitName = "Addition";
      const artifactsDirFullPath = getArtifactsFullPath(`a/${circuitName}.circom`);

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
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

      const multiplierCircuit: CircuitZKit = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: artifactsDirFullPath,
        verifierDirPath: getVerifiersDirFullPath(),
      });

      expect(multiplierCircuit.getArtifactsFilePath("r1cs")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.r1cs`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("zkey")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.zkey`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("vkey")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.vkey.json`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("sym")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}.sym`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("constraints")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_constraints.json`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("artifacts")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_artifacts.json`),
      );
      expect(multiplierCircuit.getArtifactsFilePath("wasm")).to.be.eq(
        path.join(artifactsDirFullPath, `${circuitName}_js`, `${circuitName}.wasm`),
      );
    });

    it("should get exception if pass invalid file type", async () => {
      const circuitName = "Multiplier";

      const multiplierCircuit: any = new CircuitZKit({
        circuitName,
        circuitArtifactsPath: getArtifactsFullPath(`${circuitName}.circom`),
        verifierDirPath: getVerifiersDirFullPath(),
      });

      const invalidFileType = "wwasm";

      expect(function () {
        multiplierCircuit.getArtifactsFilePath(invalidFileType);
      }).to.throw(`Ambiguous file type: ${invalidFileType}.`);
    });
  });
});
