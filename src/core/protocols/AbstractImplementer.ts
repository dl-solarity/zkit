import fs from "fs";
import ejs from "ejs";
import path from "path";

import {
  IProtocolImplementer,
  ProvingSystemType,
  ProofStructByProtocol,
  CalldataByProtocol,
} from "../../types/protocols";
import { VerifierLanguageType } from "../../types/circuit-zkit";

export abstract class AbstractProtocolImplementer<T extends ProvingSystemType> implements IProtocolImplementer<T> {
  public async createVerifier(
    vKeyFilePath: string,
    verifierFilePath: string,
    languageExtension: VerifierLanguageType,
  ): Promise<void> {
    const verifierTemplate: string = this.getTemplate(languageExtension);

    if (!fs.existsSync(path.dirname(verifierFilePath))) {
      fs.mkdirSync(path.dirname(verifierFilePath), { recursive: true });
    }

    const templateParams = JSON.parse(fs.readFileSync(vKeyFilePath, "utf-8"));
    templateParams["verifier_id"] = path.parse(verifierFilePath).name;

    const verifierCode = ejs.render(verifierTemplate, templateParams);

    fs.writeFileSync(verifierFilePath, verifierCode, "utf-8");
  }

  public abstract generateProof(zKeyFilePath: string, witnessFilePath: string): Promise<ProofStructByProtocol<T>>;

  public abstract verifyProof(proof: ProofStructByProtocol<T>, vKeyFilePath: string): Promise<boolean>;

  public abstract generateCalldata(proof: ProofStructByProtocol<T>): Promise<CalldataByProtocol<T>>;

  public abstract getProvingSystemType(): ProvingSystemType;

  public getTemplate(languageExtension: VerifierLanguageType): string {
    return fs.readFileSync(
      path.join(__dirname, "..", "templates", `verifier_${this.getProvingSystemType()}.${languageExtension}.ejs`),
      "utf8",
    );
  }

  public getVerifierName(circuitName: string, verifierNameSuffix?: string): string {
    const protocolType: ProvingSystemType = this.getProvingSystemType();
    const nameSuffix: string = verifierNameSuffix ?? "";

    return `${circuitName}${nameSuffix}${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}Verifier`;
  }

  public getZKeyFileName(circuitName: string): string {
    return `${circuitName}.${this.getProvingSystemType()}.zkey`;
  }

  public getVKeyFileName(circuitName: string): string {
    return `${circuitName}.${this.getProvingSystemType()}.vkey.json`;
  }
}
