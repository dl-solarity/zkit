import "@nomicfoundation/hardhat-toolbox";

import "@typechain/hardhat";

import "@nomicfoundation/hardhat-ethers";
import "@nomiclabs/hardhat-vyper";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      initialDate: "1970-01-01T00:00:00Z",
    },
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  typechain: {
    outDir: "generated-types/ethers",
    target: "ethers-v6",
    alwaysGenerateOverloads: true,
    discriminateTypes: true,
  },
  vyper: {
    version: "0.4.0",
  },
};

export default config;
