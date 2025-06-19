[![npm](https://img.shields.io/npm/v/@solarity/zkit.svg)](https://www.npmjs.com/package/@solarity/zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/dl-solarity/zkit/actions/workflows/tests.yml/badge.svg)](https://github.com/dl-solarity/zkit/actions/workflows/tests.yml)

# ZKit - Circom Zero Knowledge Kit

**A zero knowledge kit that helps you interact with Circom circuits.**

- Generate and verify ZK proofs with a single line of code.
- Leverage `groth16` and `plonk` proving systems.
- Render optimized Solidity | Vyper verifiers.
- Build and work with ZK witnesses.
- Substitute witness signals for advanced circuits testing.

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

To create a `CircuitZKit` object it is necessary to pass a circuit config and a `ProtocolImplementer` instance:

```typescript
const config = {
  circuitName: string;
  circuitArtifactsPath: string;
  verifierDirPath: string;
};

const implementer = new Groth16Implementer() | new PlonkImplementer();

const circuit = new CircuitZKit<"groth16" | "plonk">(config, implementer);
```

The `config` contains all the information required to work with the circuit, namely:

- `circuitName` - Name of the circuit file without extension.
- `circuitArtifactsPath` - Full path to compilation artifacts for the desired circuit.
- `verifierDirPath` - Full path to the directory where Solidity | Vyper verifier file will be generated.

The `implementer` is the instance of a certain proving system. Currently `groth16` and `plonk` systems are supported.

#### API reference

---

- **`async createVerifier("sol" | "vy", verifierNameSuffix?: string)`**

Creates a Solidity | Vyper verifier contract with the optional `verifierNameSuffix` on `verifierDirPath` path, which was specified in the config.

```typescript
await circuit.createVerifier("sol");
await circuit.createVerifier("sol", "_suffix_");
```

- **`async calculateWitness(inputs, witnessOverrides?) -> bigint[]`**

Calculates a witness in the `tmp` directory and returns its json representation.
An optional `witnessOverrides` parameter can be provided to replace specific signal values in the generated witness file.

```typescript
/// witness = [1n, 200n, 20n, 10n]
const witness = await circuit.calculateWitness({ a: 10, b: 20 });

/// witness = [1n, 200n, 35n, 10n]
const witness = await circuit.calculateWitness({ a: 10, b: 20 }, { "main.a": 35 });
```

- **`async generateProof(inputs, witnessOverrides?) -> proof`**

Generates a proof for the given `inputs` and `witnessOverrides`.

```typescript
/// { proof: { pi_a, pi_b, pi_c, protocol, curve }, publicSignals: [6] }
const proof = await circuit.generateProof({ a: 2, b: 3 });
```

- **`async verifyProof(proof) -> bool`**

Verifies the proof.

```typescript
/// true
const isValidProof = await circuit.verifyProof(proof);
```

- **`async generateCalldata(proof) -> calldata`**

Generates `Calldata` struct by proof for the Solidity | Vyper verifier's `verifyProof()` method.

```typescript
/// You can use this `calldata` sturct in the circuit verifier contract.
/// calldata: { proofPoints: { a, b, c }, publicSignals: [6] }
const calldata = await circuit.generateCalldata(proof);
```

- **`getCircuitName() -> string`**

Returns the name of the circuit from the config.

- **`getVerifierName(verifierNameSuffix?: string) -> string`**

Returns the name of the verifier in the following form:

```typescript
<Circuit name><Suffix><Proving system>Verifier
```

- **`getProvingSystemType() -> "groth16" | "plonk"`**

Returns the current proving system in use.

- **`getVerifierTemplate() -> string`**

Returns the full `ejs` verifier template as a `string`.
