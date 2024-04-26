import { CircomZKit } from "../src";
import { NumberLike } from "../src/types";

describe("happy flow", function () {
  test("happy flow", async () => {
    const circom = new CircomZKit({
      circuitsDir: "test/circuits",
      artifactsDir: "test/zkit-artifacts",
      verifiersDir: "test/verifiers",
    });

    type InputsMultiplier = {
      a: NumberLike;
      b: NumberLike;
    };

    const circuit = circom.getCircuit<InputsMultiplier>("Multiplier");

    await circuit.compile({ quiet: false });
    //
    // const proof = await circuit.generateProof({ a: 1337, b: 1337 });
    //
    // await circuit.createVerifier();
    //
    // console.log(await circuit.verifyProof(proof));
    // console.log(await circuit.generateCalldata(proof));
  });
});
