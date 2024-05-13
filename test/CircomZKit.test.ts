import { CircomZKit } from "../src";

jest.mock("readline", () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest
        .fn()
        .mockImplementation((_query: string, cb: (answer: string) => void) => {
          cb("Y");
        }),
    close: jest.fn().mockImplementation(() => undefined),
  }),
}));

describe("happy flow", function () {
  test("happy flow", async () => {
    const circom = new CircomZKit({
      circuitsDir: "test/circuits",
      artifactsDir: "test/zkit-artifacts",
      verifiersDir: "test/verifiers",
      ptauDir: "test/ptau",
      allowDownload: false,
    });

    console.log(circom.getCircuits());

    const circuit = circom.getCircuit("Addition");

    await circuit.compile({ quiet: true });

    const proof = await circuit.generateProof({ a: 1337, b: 1337 });

    await circuit.createVerifier();

    console.log(await circuit.verifyProof(proof));
    console.log(await circuit.generateCalldata(proof));
  });
});
