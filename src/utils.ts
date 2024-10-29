import * as snarkjs from "snarkjs";
import { BN128_CURVE_NAME } from "./constants";

export async function getBn128Curve() {
  return (snarkjs as any).curves.getCurveFromName(BN128_CURVE_NAME);
}
