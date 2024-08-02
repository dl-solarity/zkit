export type NumericString = `${number}` | string;

export type PublicSignals = NumericString[];

export type NumberLike = number | bigint | `${number}`;
export type ArrayLike = NumberLike[] | ArrayLike[];

export type Signal = NumberLike | ArrayLike;
export type Signals = Record<string, Signal>;
