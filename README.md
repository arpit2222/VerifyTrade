# VerifyTrade

**Fair DeFi trading execution with cryptographic proofs** — built for the 0G APAC Hackathon.

VerifyTrade eliminates front-running, price manipulation, and opaque execution by attaching a verifiable on-chain proof to every trade. Traders can independently confirm that their order was executed at the quoted price with zero slippage manipulation.

---

## Why VerifyTrade?

| Problem | VerifyTrade's answer |
|---------|----------------------|
| MEV / front-running | Commit-reveal scheme + block-delay enforcement |
| Opaque price feeds | 0G AI network validates price at execution time |
| Unverifiable fills | zkProof anchored to trade hash stored on 0G Storage |
| No audit trail | Permanent, tamper-proof record on Arbitrum + 0G |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.24, OpenZeppelin 5, Hardhat |
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Wallet | wagmi v2, viem, Web3Modal |
| AI / Proof layer | 0G Network (inference + storage) |
| Testnet | Arbitrum Sepolia |
| Types | TypeScript strict mode throughout |

---

## Folder Structure

```
verifytrade/
├── contracts/                  # Hardhat smart-contract workspace
│   ├── src/                    # Solidity source files
│   │   ├── VerifyTrade.sol     # Core trading contract
│   │   ├── TradeVerifier.sol   # Proof verification logic
│   │   ├── PriceOracle.sol     # 0G-backed price feed
│   │   ├── interfaces/         # Contract interfaces (IVerifyTrade…)
│   │   └── libraries/          # Shared Solidity libraries
│   ├── scripts/                # Deployment & admin scripts
│   ├── test/                   # Hardhat/Mocha test suites
│   ├── ignition/               # Hardhat Ignition deployment modules
│   ├── hardhat.config.ts       # (symlinked from root)
│   └── package.json
│
├── frontend/                   # Next.js application workspace
│   ├── src/
│   │   ├── app/                # App Router pages & layouts
│   │   │   ├── trade/          # Trade execution UI
│   │   │   ├── verify/         # Proof verification UI
│   │   │   ├── dashboard/      # Portfolio & history
│   │   │   └── api/            # Next.js API routes
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui primitives
│   │   │   ├── trade/          # Domain components (TradeForm, ProofCard…)
│   │   │   └── layout/         # Header, Sidebar, Footer
│   │   ├── hooks/              # Custom React hooks (useVerifyTrade…)
│   │   ├── lib/                # ethers/wagmi config, utilities
│   │   └── types/              # Frontend-specific TypeScript types
│   ├── public/                 # Static assets
│   ├── next.config.js
│   └── package.json
│
├── packages/
│   └── shared/                 # Shared types & utilities (used by both)
│       └── src/
│           ├── types/          # TradeOrder, Proof, ChainConfig…
│           ├── constants/      # Contract addresses, chain IDs
│           └── utils/          # ABI helpers, formatters
│
├── .env.example                # Environment variable template
├── .gitignore
├── hardhat.config.ts           # Root Hardhat config (used by contracts/)
├── package.json                # Root workspace manifest
├── setup.sh                    # One-command project initializer
└── tsconfig.json               # Root TypeScript config
```

---

## Quick Start

### Prerequisites

- Node.js 18+ — `brew install node`
- Git — `brew install git`
- MetaMask browser extension

### 1. Clone & setup

```bash
git clone https://github.com/arpit2222/VerifyTrade.git
cd VerifyTrade

# One-command setup (installs deps, copies .env, compiles contracts)
bash setup.sh
```

### 2. Configure environment

```bash
# Open .env and fill in your values
nano .env
```

Required keys:
- `PRIVATE_KEY` — deployer wallet (fund via [Arbitrum Sepolia faucet](https://faucet.triangleplatform.com/arbitrum/sepolia))
- `ARBITRUM_SEPOLIA_RPC_URL` — get from [Alchemy](https://www.alchemy.com/)
- `ARBISCAN_API_KEY` — get from [Arbiscan](https://arbiscan.io/myapikey)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — get from [WalletConnect Cloud](https://cloud.walletconnect.com)

### 3. Start local development

```bash
# Terminal 1 — local blockchain
npm run node --workspace=contracts

# Terminal 2 — deploy contracts locally
npm run deploy:local

# Terminal 3 — start frontend
npm run dev
# → http://localhost:3000
```

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build of frontend |
| `npm run build:contracts` | Compile Solidity + generate TypeChain types |
| `npm test` | Run all contract tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run deploy:testnet` | Deploy to Arbitrum Sepolia |
| `npm run verify` | Verify contracts on Arbiscan |
| `npm run format` | Prettier format all files |
| `npm run lint` | ESLint check |
| `npm run clean` | Delete all build artifacts |

---

## Deployment (Arbitrum Sepolia)

```bash
# Ensure .env has PRIVATE_KEY and ARBITRUM_SEPOLIA_RPC_URL set
npm run deploy:testnet

# After deployment, copy the printed addresses into .env:
# NEXT_PUBLIC_VERIFY_TRADE_ADDRESS=0x...
# NEXT_PUBLIC_TRADE_VERIFIER_ADDRESS=0x...

# Verify on Arbiscan
npm run verify
```

---

## Smart Contract Architecture

```
VerifyTrade.sol          — entry point: submitOrder(), executeOrder(), cancelOrder()
  └── TradeVerifier.sol  — verifyProof(), validateExecution()
  └── PriceOracle.sol    — getPrice(), validatePrice() (backed by 0G AI)
```

Each trade produces a `TradeProof` struct containing:
- `tradeHash` — keccak256(orderId, trader, amount, price, timestamp)
- `executionPrice` — actual fill price
- `proofSignature` — 0G AI validator signature
- `storageRef` — 0G Storage content hash for full audit log

---

## License

MIT © 2024 VerifyTrade — Built for 0G APAC Hackathon
