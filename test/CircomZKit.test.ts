import { CircomZKit, ManagerZKit } from "../src";

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
    const manager = new ManagerZKit({
      circuits: "test/circuits",
      artifacts: "test/zkit-artifacts",
      verifiers: "test/verifiers"
    });

    const circom = new CircomZKit(manager);

    console.log(circom.getCircuits());

    const circuit = circom.getCircuit("Addition");

    await circuit.compile({ quiet: true });

    const proof = await circuit.generateProof({ a: 1337, b: 1337 });

    await circuit.createVerifier();

    console.log(await circuit.verifyProof(proof));
    console.log(await circuit.generateCalldata(proof));
  });
});
