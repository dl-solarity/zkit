[![npm](https://img.shields.io/npm/v/@solarity/zkit.svg)](https://www.npmjs.com/package/@solarity/zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# ZKit - Circom Zero Knowledge Kit

**A zero knowledge kit that helps you interact with Circom circuits.**

- Generate and verify ZK proofs with a single line of code.
- Render optimized Solidity | Vyper verifiers.
- Build and work with ZK witnesses.

## Installation

To install the package, run:

```bash
npm install --save-dev @solarity/zkit
```

## Usage

> [!IMPORTANT]
> The kit is not meant to be used directly as its fitness relies heavily on the environment, Circom compilation artifacts management, processing of remappings, etc. Consider using [hardhat-zkit](https://github.com/dl-solarity/hardhat-zkit) which is a complete, developer-friendly package.

### CircuitZKit

`CircuitZKit` is a user-friendly interface for interacting with circom circuits.

To create a CircuitZKit object it is necessary to pass a config:

```typescript
CircuitZKitConfig = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
  provingSystem?: VerifierProvingSystem;
};
```

This config contains all the information required to work with the circuit, namely:

- `circuitName` - Name of the circuit file without extension
- `circuitArtifactsPath` - Full path to compilation artifacts for the desired circuit
- `verifierDirPath` - Full path to the directory where Solidity | Vyper verifier file will be generated
- `provingSystem` - The proving system that will be used to generate the verifier contract. Right now only `groth16` is supported

#### getTemplate()

Static `CircuitZKit` function that returns the contents of a template file by the passed type.

```typescript
const templateContent = CircuitZKit.getTemplate("groth16", "sol");
```

#### createVerifier()

Creates a Solidity | Vyper verifier contract on `verifierDirPath` path, which was specified in the config.

Two functions are available for proof verification within the contract:
- `verifyProof`: accepts an array of public inputs for verification.
- `verifyProofWithStruct`: allows passing public signals as a struct, enabling easier access and typization.

> [!TIP]
> It’s recommended to create structs using the `{ fieldName: value }` syntax. This ensures that your code 
> continues to work correctly even if the order of outputs in the circuit changes.

```typescript
await multiplier.createVerifier("sol");
```

#### calculateWitness()

Calculates a witness in the `tmp` directory and returns its json representation.

```typescript
/// witness = [1n, 200n, 20n, 10n]
const witness = await multiplier.calculateWitness({ a: 10, b: 20 });
```

#### generateProof()

Generates a proof for the given inputs.

```typescript
/// { proof: { pi_a, pi_b, pi_c, protocol, curve }, publicSignals: [6] }
const proof = await multiplier.generateProof({ a: 2, b: 3 });
```

#### verifyProof()

Verifies the proof.

```typescript
/// true
const isValidProof = await multiplier.verifyProof(proof);
```

#### generateCalldata()

Generates calldata by proof for the Solidity | Vyper verifier's `verifyProof()` method.

```typescript
/// You can use this calldata to call the verifier contract
const calldata = await multiplier.generateCalldata(proof);
```

## Known limitations

- Currently, ZKit supports only the Groth16 proving system.
