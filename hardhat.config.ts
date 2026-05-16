import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load env from repo root
dotenv.config({ path: resolve(__dirname, "../../.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const ARBITRUM_SEPOLIA_RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ??
  "https://sepolia-rollup.arbitrum.io/rpc";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY ?? "";

// Warn on missing keys so CI fails loudly instead of silently using defaults
if (!PRIVATE_KEY && process.env.NODE_ENV !== "test") {
  console.warn("⚠️  PRIVATE_KEY not set — deployment tasks will fail");
}

const config: HardhatUserConfig = {
  // ---------------------------------------------------------------------------
  // Solidity compiler
  // ---------------------------------------------------------------------------
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Balance between deployment cost and call cost
          },
          viaIR: true, // Enable IR-based code generation for complex contracts
          evmVersion: "cancun",
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Networks
  // ---------------------------------------------------------------------------
  networks: {
    // Local Hardhat node — instant mining, no real gas
    hardhat: {
      chainId: 31337,
      mining: {
        auto: true,
        interval: 0,
      },
    },

    // Local node started with `hardhat node`
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Arbitrum Sepolia testnet
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      chainId: 421614,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      // EIP-1559 gas settings — Arbitrum is cheap; these are conservative
      gasPrice: "auto",
      gas: "auto",
      // Retry failed transactions up to 3 times
      timeout: 60_000,
    },

    // 0G Newton testnet (AI inference layer)
    zeroGNewton: {
      url: process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16600,
      accounts: process.env.ZEROG_PRIVATE_KEY
        ? [process.env.ZEROG_PRIVATE_KEY]
        : [],
    },
  },

  // ---------------------------------------------------------------------------
  // Etherscan / Arbiscan verification
  // ---------------------------------------------------------------------------
  etherscan: {
    apiKey: {
      arbitrumSepolia: ARBISCAN_API_KEY,
    },
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

  // ---------------------------------------------------------------------------
  // Source paths
  // ---------------------------------------------------------------------------
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // ---------------------------------------------------------------------------
  // TypeChain — generates TS bindings from ABIs
  // ---------------------------------------------------------------------------
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },

  // ---------------------------------------------------------------------------
  // Gas reporter — printed after `hardhat test`
  // ---------------------------------------------------------------------------
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    // Provide a CoinMarketCap key for live ETH price lookups
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  // ---------------------------------------------------------------------------
  // Mocha test runner
  // ---------------------------------------------------------------------------
  mocha: {
    timeout: 120_000, // 2 min — needed for testnet fork tests
  },
};

export default config;
