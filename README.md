[![npm](https://img.shields.io/npm/v/@solarity/zkit.svg)](https://www.npmjs.com/package/@solarity/zkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# ZKit - Circom Zero Knowledge Kit

**A zero knowledge kit that helps you interact with Circom circuits.**

- Generate and verify ZK proofs with a single line of code.
- Leverage `groth16` and `plonk` proving systems.
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

- **`async createVerifier("sol" | "vy")`**

Creates a Solidity | Vyper verifier contract on `verifierDirPath` path, which was specified in the config.

```typescript
await circuit.createVerifier("sol");
```

- **`async calculateWitness(inputs) -> bigint[]`**

Calculates a witness in the `tmp` directory and returns its json representation.

```typescript
/// witness = [1n, 200n, 20n, 10n]
const witness = await circuit.calculateWitness({ a: 10, b: 20 });
```

- **`async generateProof(inputs) -> proof`**

Generates a proof for the given inputs.

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

Generates calldata by proof for the Solidity | Vyper verifier's `verifyProof()` method.

```typescript
/// You can use this calldata to call the verifier contract
const calldata = await circuit.generateCalldata(proof);
```

- **`getCircuitName() -> string`**

Returns the name of the circuit from the config.

- **`getVerifierName() -> string`**

Returns the name of the verifier in the following form:

```typescript
<Circuit name><Proving system>Verifier
```

- **`getProvingSystemType() -> "groth16" | "plonk"`**

Returns the current proving system in use.

- **`getVerifierTemplate() -> string`**

Returns the full `ejs` verifier template as a `string`.
