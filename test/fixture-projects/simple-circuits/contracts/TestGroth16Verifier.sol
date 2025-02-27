// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

contract TestGroth16Verifier {
    using VerifierHelper for address;

    function verifyProofStruct(
        address verifier_,
        uint256[] memory pubSignals_,
        VerifierHelper.ProofPoints memory proofPoints_
    ) external view returns (bool) {
        return verifier_.verifyProof(pubSignals_, proofPoints_);
    }

    function verifyProof(
        address verifier_,
        uint256[] memory pubSignals_,
        uint256[2] memory a_,
        uint256[2][2] memory b_,
        uint256[2] memory c_
    ) external view returns (bool) {
        return verifier_.verifyProof(pubSignals_, a_, b_, c_);
    }
}
