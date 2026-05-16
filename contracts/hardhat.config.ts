import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load env from repo root (one level up from contracts/)
dotenv.config({ path: resolve(__dirname, "../.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const ARBITRUM_SEPOLIA_RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ??
  "https://sepolia-rollup.arbitrum.io/rpc";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY ?? "";

if (!PRIVATE_KEY && process.env.NODE_ENV !== "test") {
  console.warn("⚠️  PRIVATE_KEY not set — deployment tasks will fail");
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
          evmVersion: "cancun",
        },
      },
    ],
  },

  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      chainId: 421614,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      timeout: 60_000,
    },
    zeroGNewton: {
      url: process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16600,
      accounts: process.env.ZEROG_PRIVATE_KEY ? [process.env.ZEROG_PRIVATE_KEY] : [],
    },
  },

  etherscan: {
    apiKey: { arbitrumSepolia: ARBISCAN_API_KEY },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },

  // All paths are relative to this file (contracts/ directory)
  paths: {
    sources:   "./src",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },

  mocha: { timeout: 120_000 },
};

export default config;
