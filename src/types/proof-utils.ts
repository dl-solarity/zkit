export type NumericString = `${number}` | string;

export type PublicSignals = NumericString[];

export type NumberLike = number | bigint | string;
export type ArrayLike = NumberLike[] | ArrayLike[];
export type InputLike = NumberLike | ArrayLike;

export type Inputs = Record<string, InputLike>;
