// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {PlonkVerifierHelper} from "@solarity/solidity-lib/libs/zkp/PlonkVerifierHelper.sol";

contract TestPlonkVerifier {
    using PlonkVerifierHelper for address;

    function verifyProofPlonkProofStruct(
        address verifier_,
        PlonkVerifierHelper.PlonkProof memory groth16Proof_
    ) external view returns (bool) {
        return verifier_.verifyProof(groth16Proof_);
    }

    function verifyProofPointsStruct(
        address verifier_,
        PlonkVerifierHelper.ProofPoints memory proofPoints_,
        uint256[] memory pubSignals_
    ) external view returns (bool) {
        return verifier_.verifyProof(proofPoints_, pubSignals_);
    }

    function verifyProof(
        address verifier_,
        uint256[24] memory proofData_,
        uint256[] memory pubSignals_
    ) external view returns (bool) {
        return verifier_.verifyProof(proofData_, pubSignals_);
    }
}
