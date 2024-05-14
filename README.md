[![npm](https://img.shields.io/npm/v/@solarity/zkit.svg)](https://www.npmjs.com/package/@solarity/zkit)

# ZKit

This package provides a set of utilities to help you develop zk circuits using circom.

## Installation

To install the package, run:

```bash
npm install --save-dev @solarity/zkit
```

## Usage

### CircomZKit

ZKit is a configless package, which means you don't need to provide any configuration to use it.

Suppose you have the following circuit:

```circom
pragma circom 2.1.6;

template Multiplier() {
    signal input a;
    signal input b;
    signal output out;
    out <== a * b;
}

component main = Multiplier();
```

You can start work with it as follows:

```typescript
import { CircomZKit } from "@solarity/zkit";

async function main() {
  const zkit = new CircomZKit();
  
  const multiplier = zkit.getCircuit("Multiplier");
  
  /// Generates artifacts in the "./zkit-artifacts" directory
  await multiplier.compile();
}

main()
  .catch((err) => {
    process.exit(1);
  });
```

By default, ZKit will look for the circuit file in the `./circuits` directory. However, you can change this by providing a custom one:

```typescript
new CircomZKit({ circuitsDir: "./my-circuits" });
```

To generate zkey, the power-of-tau file is required. ZKit automatically downloads those files from [Hermes](https://hermez.s3-eu-west-1.amazonaws.com/) to the `${HOME}/.zkit/.ptau` directory, so you don't need to re-download them every time you start a new project.

You can also provide a custom path to the directory where the power-of-tau files are stored:

```typescript
new CircomZKit({ ptauDir: "./my-ptau" });
```

> [!NOTE]
> Note that all the files in the `ptauDir` directory must have the `powers-of-tau-{x}.ptau` name format, where `{x}` is a maximum degree (2<sup>x</sup>) of constraints a `ptau` supports.

ZKit may also ask you for the permission to download the power-of-tau files. You can enable this by toggling off the `allowDownload` option:

```typescript
new CircomZKit({ allowDownload: false });
```

### CircuitZKit

Once you created a `CircuitZKit` instance using the `getCircuit` method, you can manage the underlying circuit using the following methods:

#### compile()

Compiles the circuit and generates the artifacts in the `./zkit-artifacts` or in the provided `artifactsDir` directory. The default output is `r1cs`, `zkey` and `vkey` files.

```typescript
await multiplier.compile();
```

#### createVerifier()

Creates Solidity verifier contract  in the `./contracts/verifiers` or in the provided `verifiersDir` directory. 

> [!NOTE]
> You should first compile the circuit before creating the verifier.

```typescript
await multiplier.createVerifier();
```

#### generateProof()

Generates a proof for the given inputs.

> [!NOTE]
> You should first compile the circuit before generating the proof.

```typescript
/// { proof: { pi_a, pi_b, pi_c, protocol, curve }, publicSignals: [6] }
const proof = await multiplier.createVerifier({ a: 2, b: 3});
```

#### verifyProof()

Verifies the proof.

```typescript
/// true
const isValidProof = await multiplier.verifyProof(proof);
```

#### generateCalldata()

Generates calldata by proof for the Solidity verifier's `verifyProof` method.

```typescript
/// You can use this calldata to call the verifier contract
const calldata = await multiplier.verifyProof(proof);
```

## Known limitations

- Currently, ZKit supports only the Groth16 proving system.
- The `compile` method may cause [issues](https://github.com/iden3/snarkjs/issues/494).