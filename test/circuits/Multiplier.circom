pragma circom 2.1.6;

template Multiplier() {
   signal input a;
   signal input b;
   signal output out;
   out <== a * b;
}

component main = Multiplier();