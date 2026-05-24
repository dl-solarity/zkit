"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractProtocolImplementer = void 0;
const fs_1 = __importDefault(require("fs"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
class AbstractProtocolImplementer {
    async createVerifier(vKeyFilePath, verifierFilePath, languageExtension) {
        const verifierTemplate = this.getTemplate(languageExtension);
        if (!fs_1.default.existsSync(path_1.default.dirname(verifierFilePath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(verifierFilePath), { recursive: true });
        }
        const templateParams = JSON.parse(fs_1.default.readFileSync(vKeyFilePath, "utf-8"));
        templateParams["verifier_id"] = path_1.default.parse(verifierFilePath).name;
        const verifierCode = ejs_1.default.render(verifierTemplate, templateParams);
        fs_1.default.writeFileSync(verifierFilePath, verifierCode, "utf-8");
    }
    getTemplate(languageExtension) {
        return fs_1.default.readFileSync(path_1.default.join(__dirname, "..", "templates", `verifier_${this.getProvingSystemType()}.${languageExtension}.ejs`), "utf8");
    }
    getVerifierName(circuitName, verifierNameSuffix) {
        const protocolType = this.getProvingSystemType();
        const nameSuffix = verifierNameSuffix ?? "";
        return `${circuitName}${nameSuffix}${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}Verifier`;
    }
    getZKeyFileName(circuitName) {
        return `${circuitName}.${this.getProvingSystemType()}.zkey`;
    }
    getVKeyFileName(circuitName) {
        return `${circuitName}.${this.getProvingSystemType()}.vkey.json`;
    }
    async withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(() => reject(new Error("Operation timed out")), ms);
            promise
                .then((res) => {
                clearTimeout(id);
                resolve(res);
            })
                .catch((err) => {
                clearTimeout(id);
                reject(err);
            });
        });
    }
}
exports.AbstractProtocolImplementer = AbstractProtocolImplementer;
//# sourceMappingURL=AbstractImplementer.js.map