import fs from "fs";
import ejs from "ejs";
import path from "path";

import { Signals } from "../../types/proof-utils";
import { IProtocolImplementer, ProtocolType, ProofStructByProtocol, CalldataByProtocol } from "../../types/protocols";

export abstract class AbstractProtocolImplementer<T extends ProtocolType> implements IProtocolImplementer<T> {
  public async createVerifier(circuitName: string, vKeyFilePath: string, verifierFilePath: string): Promise<void> {
    const verifierTemplate: string = this.getTemplate();

    if (!fs.existsSync(path.dirname(verifierFilePath))) {
      fs.mkdirSync(path.dirname(verifierFilePath), { recursive: true });
    }

    const templateParams = JSON.parse(fs.readFileSync(vKeyFilePath, "utf-8"));
    templateParams["verifier_id"] = this.getVerifierName(circuitName);

    const verifierCode = ejs.render(verifierTemplate, templateParams);

    fs.writeFileSync(verifierFilePath, verifierCode, "utf-8");
  }

  public abstract generateProof(
    inputs: Signals,
    zKeyFilePath: string,
    wasmFilePath: string,
  ): Promise<ProofStructByProtocol<T>>;

  public abstract verifyProof(proof: ProofStructByProtocol<T>, vKeyFilePath: string): Promise<boolean>;

  public abstract generateCalldata(proof: ProofStructByProtocol<T>): Promise<CalldataByProtocol<T>>;

  public abstract getProtocolType(): ProtocolType;

  public getTemplate(): string {
    return fs.readFileSync(
      path.join(__dirname, "..", "templates", `verifier_${this.getProtocolType()}.sol.ejs`),
      "utf8",
    );
  }

  public getVerifierName(circuitName: string): string {
    const protocolType: ProtocolType = this.getProtocolType();

    return `${circuitName}${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}Verifier`;
  }

  public getZKeyFileName(circuitName: string): string {
    return `${circuitName}.${this.getProtocolType()}.zkey`;
  }

  public getVKeyFileName(circuitName: string): string {
    return `${circuitName}.${this.getProtocolType()}.vkey.json`;
  }
}
