import { NumberLike } from "./proof-utils";

export type SignalInfo = {
  id: NumberLike;
  witnessIndex: NumberLike;
  componentId: NumberLike;
  signalName: string;
};
