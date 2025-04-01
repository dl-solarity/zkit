import os from "os";
import fs from "fs";
import path from "path";

import { BN128_CURVE_NAME } from "./constants";

import * as snarkjs from "snarkjs";
// @ts-ignore
import { Scalar } from "ffjavascript";
// @ts-ignore
import * as binFileUtils from "@iden3/binfileutils";

export async function terminateCurve() {
  await (await (snarkjs as any).curves.getCurveFromName(BN128_CURVE_NAME)).terminate();
}

export function getTmpDir(): string {
  const tmpDir = path.join(os.tmpdir(), ".zkit");

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  return tmpDir;
}

export async function getWitnessPrime(wtnsPath: string): Promise<bigint> {
  const { fd, sections } = await binFileUtils.readBinFile(wtnsPath, "wtns", 2);

  await binFileUtils.startReadUniqueSection(fd, sections, 1);

  const n8 = await fd.readULE32();
  const prime = await binFileUtils.readBigInt(fd, n8);
  await fd.readULE32();

  await binFileUtils.endReadSection(fd);
  await fd.close();

  return prime;
}

export async function writeWitnessFile(witnessPath: string, witness: bigint[], prime: bigint) {
  const fd = await binFileUtils.createBinFile(witnessPath, "wtns", 2, 2);

  await binFileUtils.startWriteSection(fd, 1);

  const n8 = (Math.floor((Scalar.bitLength(prime) - 1) / 64) + 1) * 8;
  await fd.writeULE32(n8);
  await binFileUtils.writeBigInt(fd, prime, n8);

  await fd.writeULE32(witness.length);

  await binFileUtils.endWriteSection(fd);

  await binFileUtils.startWriteSection(fd, 2);

  for (let i = 0; i < witness.length; i++) {
    await binFileUtils.writeBigInt(fd, witness[i], n8);
  }

  await binFileUtils.endWriteSection(fd, 2);

  await fd.close();
}
