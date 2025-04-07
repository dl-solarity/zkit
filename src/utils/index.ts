import os from "os";
import fs from "fs";
import path from "path";

import { BN128_CURVE_NAME } from "../constants";

import * as snarkjs from "snarkjs";

/**
 * Terminates the BN128 curve instance used by SnarkJS.
 */
export async function terminateCurve() {
  await (await (snarkjs as any).curves.getCurveFromName(BN128_CURVE_NAME)).terminate();
}

/**
 * Returns the path to the temporary directory used by ZKit.
 *
 * Creates the directory if it does not exist.
 *
 * @returns {string} The path to the temporary `.zkit` directory inside the OS temp folder.
 */
export function getTmpDir(): string {
  const tmpDir = path.join(os.tmpdir(), ".zkit");

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  return tmpDir;
}

export * from "./witness-utils";
