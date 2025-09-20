"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Groth16Implementer = void 0;
const fs_1 = __importDefault(require("fs"));
const snarkjs = __importStar(require("snarkjs"));
const AbstractImplementer_1 = require("./AbstractImplementer");
const utils_1 = require("../../utils");
class Groth16Implementer extends AbstractImplementer_1.AbstractProtocolImplementer {
    async generateProof(zKeyFilePath, witnessFilePath, timeout = 30000) {
        const generate = async () => {
            const proof = await snarkjs.groth16.prove(zKeyFilePath, witnessFilePath);
            await (0, utils_1.terminateCurve)();
            return proof;
        };
        return await this.withTimeout(generate(), timeout);
    }
    async verifyProof(proof, vKeyFilePath) {
        const verifier = JSON.parse(fs_1.default.readFileSync(vKeyFilePath).toString());
        const proofVerification = await snarkjs.groth16.verify(verifier, proof.publicSignals, proof.proof);
        await (0, utils_1.terminateCurve)();
        return proofVerification;
    }
    async generateCalldata(proof) {
        const calldataRawArray = JSON.parse(`[${await snarkjs.groth16.exportSolidityCallData(proof.proof, proof.publicSignals)}]`);
        return {
            proofPoints: {
                a: calldataRawArray[0],
                b: calldataRawArray[1],
                c: calldataRawArray[2],
            },
            publicSignals: calldataRawArray[3],
        };
    }
    getProvingSystemType() {
        return "groth16";
    }
}
exports.Groth16Implementer = Groth16Implementer;
//# sourceMappingURL=Groth16Implementer.js.map