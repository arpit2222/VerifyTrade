<div align="center">

# 🛡️ VerifyTrade

### Fair DeFi Trading with Cryptographic Proofs

*Every trade. Encrypted. Executed in a secure enclave. Proven on-chain.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Arbitrum%20Sepolia-orange.svg)](https://sepolia.arbiscan.io)
[![Built with 0G](https://img.shields.io/badge/Built%20with-0G%20Network-purple.svg)](https://0g.ai)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Contracts-Solidity%200.8.24-363636.svg)](https://soliditylang.org)

**[Live Demo](https://verifytrade.vercel.app)** · **[Demo Video](https://youtube.com/watch?v=PLACEHOLDER)** · **[GitHub](https://github.com/arpit2222/VerifyTrade)**

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [How It Works](#-how-it-works)
- [Features](#-features)
- [0G Integration](#-0g-integration)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Smart Contracts](#-smart-contracts)
- [API Documentation](#-api-documentation)
- [Quick Start](#-quick-start)
- [Testing Guide](#-testing-guide)
- [Deployment](#-deployment)
- [Future Roadmap](#-future-roadmap)
- [Team](#-team)
- [License](#-license)

---

## 🔥 Problem Statement

**MEV (Maximal Extractable Value) attacks cost DeFi traders over $1.2 billion per year.**

When you submit a trade on a public blockchain, your transaction sits in the mempool — visible to the entire world — before it's included in a block. Sophisticated bots:

- 🤖 **Front-run** your trade by submitting higher-gas transactions before yours
- 🥪 **Sandwich** you by buying before and selling immediately after your transaction
- 📉 **Manipulate** price oracles to guarantee worse fills on your order

For retail traders this means consistently worse prices. For institutions managing large positions it means **millions of dollars lost on every trade** — and zero way to prove it happened.

---

## 💡 Solution Overview

VerifyTrade makes every trade **provably fair** using a three-layer approach:

```
┌─────────────────────────────────────────────────────┐
│                    YOUR ORDER                        │
│          AES-256 Encrypted before submission         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                  0G STORAGE                          │
│     Encrypted order stored — never visible           │
│          on-chain before execution                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           TRUSTED EXECUTION ENVIRONMENT              │
│     Order decrypted and executed inside a            │
│     hardware-secured enclave (0G Compute)            │
│     No MEV bot can see the trade before execution    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│             ON-CHAIN FAIRNESS PROOF                  │
│     Cryptographic attestation recorded on            │
│     Arbitrum — anyone can verify your trade          │
│     was executed at the quoted price                 │
└─────────────────────────────────────────────────────┘
```

The result: **institutional-grade execution with retail accessibility** — every trade comes with a blockchain-verifiable proof that slippage was within agreed limits.

---

## ⚙️ How It Works

### Step-by-step flow

```
Trader                0G Storage           TEE Enclave          Arbitrum
  │                       │                     │                    │
  │── Encrypt order ──────►                     │                    │
  │   (AES-256-GCM)        │                    │                    │
  │◄─ CID returned ────────│                    │                    │
  │                        │                    │                    │
  │── submitTrade() ───────────────────────────────────────────────►│
  │   (on-chain: CID,      │                    │                    │
  │    tokenIn/Out,        │                    │                    │
  │    maxSlippage)        │                    │                    │
  │◄─ tradeId ─────────────────────────────────────────────────────│
  │                        │                    │                    │
  │── executeTrade() ──────────────────────────►                    │
  │   (tradeId + CID)      │                    │                    │
  │                        │◄── fetch order ────│                    │
  │                        │─── encrypted ─────►│                    │
  │                        │                    │── decrypt ─────    │
  │                        │                    │── execute trade    │
  │                        │                    │── compute proof    │
  │                        │                    │                    │
  │                        │                    │── recordResult ───►│
  │                        │                    │── recordProof ────►│
  │                        │                    │── recordMev ──────►│
  │◄─ fairness proof ──────────────────────────────────────────────│
```

### Key invariants

| Invariant | How it's enforced |
|-----------|-------------------|
| Order privacy | Encrypted before leaving browser; only TEE can decrypt |
| Slippage guarantee | TEE checks `actualSlippage ≤ maxSlippage` before settling |
| Immutability | All results written on Arbitrum; content-addressed on 0G |
| Verifiability | Anyone can call `verifyAttestation(tradeId, hash)` on-chain |

---

## ✨ Features

### Core
- 🔒 **AES-256-GCM order encryption** — orders are encrypted in the browser before any network call
- 📦 **0G Storage integration** — encrypted orders pinned with content-addressed CIDs
- 🖥️ **TEE execution** — orders execute inside 0G Compute's hardware enclaves
- ✅ **On-chain fairness proofs** — `FairnessProof.sol` records every attestation permanently
- 🛡️ **MEV registry** — `MevRegistry.sol` logs every MEV check with savings estimates

### Frontend
- 📊 **Live MEV stats dashboard** — auto-refreshing KPIs with recharts visualisations
- 🔄 **Real-time trade status** — polls every 10 s, stops when trade is finalised
- 🦊 **Multi-wallet support** — MetaMask, Coinbase Wallet, WalletConnect, 300+ wallets
- 🌐 **Wrong-network detection** — one-click switch to Arbitrum Sepolia
- 📋 **Copy-to-clipboard** — attestation hashes and TEE measurements
- 🔗 **Arbiscan deep links** — every transaction linkable

### Developer
- 🧪 **72 automated tests** — unit tests for all three contracts
- 🔧 **Mock mode** — full local dev without 0G credentials
- 📝 **Complete API docs** — 5 endpoints with request/response schemas
- 🏗️ **TypeScript strict** — zero `any` in business logic, zero `tsc` errors

---

## 🟣 0G Integration

VerifyTrade integrates all three pillars of the 0G ecosystem:

### 1. 0G Storage — Order Privacy

```typescript
// frontend/src/lib/0g-storage.ts
const payload = encryptOrder(JSON.stringify(orderData));   // AES-256-GCM
const result  = await uploadEncryptedOrder(payload);        // → 0G Storage
// Returns a content-addressable CID stored on-chain
```

Encrypted trade orders are uploaded to 0G Storage before the on-chain `submitTrade()` call. The CID is the only thing recorded on Arbitrum — **the order details are never on-chain** until after execution.

### 2. 0G Compute — TEE Execution

```typescript
// frontend/src/lib/0g-compute.ts
const result = await executeTradeInTEE({
  tradeId, encryptedOrder, tokenIn, tokenOut,
  inputAmount, maxSlippageBps,
});
// Returns: outputAmount, actualSlippage, teeMeasurement, attestation
```

The 0G Compute node fetches the encrypted order from 0G Storage, decrypts it inside the TEE hardware enclave, executes the swap against live prices, and generates a cryptographically signed attestation. **MEV bots cannot see the order** until the block is already settled.

### 3. On-chain Settlement — Arbitrum

```solidity
// Fairness proof recorded permanently
fairnessProof.recordProof(
    tradeId,
    teeMeasurement,      // TEE enclave identity hash
    maxSlippagePct,
    actualSlippagePct,
    executorAddress
);
```

All results — output amounts, actual slippage, TEE measurement, and fairness verdict — are recorded on Arbitrum Sepolia. This creates a **public, tamper-proof audit trail** for every trade.

### Mock mode (development)

When `ZEROG_STORAGE_NODE` and `ZEROG_COMPUTE_NODE` are not set, the system automatically uses in-memory mock implementations that simulate realistic latency, slippage, and MEV detection. This lets you run the full app locally with zero credentials.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart contracts** | Solidity 0.8.24 | Trade ledger, fairness proofs, MEV registry |
| **Contract framework** | Hardhat + OpenZeppelin 5 | Testing, deployment, standards |
| **Frontend** | Next.js 14 (App Router) | SSR, routing, API routes |
| **Styling** | Tailwind CSS | Utility-first dark UI |
| **UI components** | Radix UI primitives | Accessible, unstyled primitives |
| **Charts** | Recharts | AreaChart + PieChart for MEV stats |
| **Wallet** | wagmi v2 + viem | Wallet state, transaction sending |
| **Web3Modal** | @web3modal/wagmi v5 | Multi-wallet connect UI |
| **Server state** | @tanstack/react-query v5 | Queries, mutations, caching |
| **Encryption** | Node.js crypto (AES-256-GCM) | Order privacy |
| **Storage** | 0G Storage (Newton testnet) | Encrypted order persistence |
| **Compute / TEE** | 0G Compute | Secure trade execution |
| **Blockchain** | Arbitrum Sepolia | Low-cost proof settlement |
| **Language** | TypeScript (strict) | End-to-end type safety |
| **Package manager** | npm workspaces | Monorepo (`contracts`, `frontend`, `packages/shared`) |

---

## 🏗️ Architecture

```
verifytrade/
├── contracts/                    # Hardhat workspace
│   ├── src/
│   │   ├── VerifiableTradeExecutor.sol   # Trade ledger
│   │   ├── FairnessProof.sol             # TEE attestation registry
│   │   ├── MevRegistry.sol               # MEV event log
│   │   └── mocks/MockERC20.sol           # Test token
│   ├── test/                             # 72 tests
│   └── scripts/deploy.ts                # Multi-contract deployer
│
├── frontend/                     # Next.js 14 workspace
│   └── src/
│       ├── app/                          # App Router pages
│       │   ├── trade/page.tsx            # Main trade UI
│       │   ├── trade/[id]/page.tsx       # Trade detail
│       │   ├── dashboard/page.tsx        # MEV dashboard
│       │   ├── verify/page.tsx           # Proof verifier
│       │   └── api/                      # Route handlers
│       │       ├── trade/submit/         # POST — encrypt & store
│       │       ├── trade/execute/        # POST — TEE execution
│       │       ├── trade/[tradeId]/      # GET — trade detail
│       │       ├── stats/mev/            # GET — global stats
│       │       └── health/               # GET — system health
│       ├── components/                   # React components
│       │   ├── TradeForm.tsx             # Order submission form
│       │   ├── TradeExecution.tsx        # TEE execution flow
│       │   ├── TradeStatus.tsx           # Live trade tracking
│       │   ├── MevStats.tsx              # Stats dashboard
│       │   ├── Header.tsx                # Nav + wallet connect
│       │   ├── WalletProvider.tsx        # wagmi + Web3Modal
│       │   └── ui/                       # Button, Card, Input, Select
│       ├── hooks/useTrade.ts             # React Query hooks
│       └── lib/
│           ├── wagmi-config.ts           # Chain + wallet config
│           ├── api-client.ts             # Typed fetch wrapper
│           ├── contracts.ts              # ethers.js contract layer
│           ├── 0g-storage.ts             # 0G Storage (+ mock)
│           ├── 0g-compute.ts             # 0G Compute / TEE (+ mock)
│           ├── encryption.ts             # AES-256-GCM utilities
│           └── types.ts                  # Canonical TypeScript types
│
└── packages/shared/              # Shared types & utilities
    └── src/
        ├── types.ts
        ├── constants.ts
        └── utils.ts
```

### Data flow (production)

```
Browser → API Route → 0G Storage → Arbitrum
                   ↓
              0G Compute (TEE)
                   ↓
              Arbitrum (FairnessProof + MevRegistry)
```

---

## 📄 Smart Contracts

### Deployed Addresses (Arbitrum Sepolia)

> ⚠️ Run `npm run deploy:testnet` to deploy and populate these addresses.
> After deployment, addresses are saved to `deployments/arbitrum-sepolia.json`.

| Contract | Address | Arbiscan |
|---------|---------|---------|
| `VerifiableTradeExecutor` | `0x...` | [View →](https://sepolia.arbiscan.io/address/0x) |
| `FairnessProof` | `0x...` | [View →](https://sepolia.arbiscan.io/address/0x) |
| `MevRegistry` | `0x...` | [View →](https://sepolia.arbiscan.io/address/0x) |

### Contract summaries

#### VerifiableTradeExecutor.sol

The core trade ledger. Stores every order with its encrypted CID and settles results.

```solidity
// Submit an order — anyone can call
function submitTrade(
    string calldata encryptedOrder,  // 0G Storage CID
    uint256 inputAmount,
    string calldata tokenIn,
    string calldata tokenOut,
    uint256 maxSlippagePercent       // e.g. 50 = 0.50%
) external returns (uint256 tradeId);

// Record execution result — executor only
function recordTradeResult(
    uint256 tradeId,
    uint256 outputAmount,
    string calldata attestationHash,
    uint256 actualSlippagePercent,
    string calldata executionDetails
) external onlyExecutor returns (bool);

// Public verification — callable by anyone
function verifyAttestation(
    uint256 tradeId,
    string calldata expectedHash
) external view returns (bool matches);
```

#### FairnessProof.sol

TEE attestation registry — records whether each trade executed within agreed slippage.

```solidity
function recordProof(
    uint256 tradeId,
    string calldata teeMeasurement,       // TEE enclave identity
    uint256 expectedSlippagePercent,
    uint256 actualSlippagePercent,
    string calldata executorAddress
) external onlyProver returns (uint256 proofId);

// Returns true if actualSlippage <= expectedSlippage
function isTradeFair(uint256 proofId) external view returns (bool);

// Platform-wide fairness ratio in basis points
function globalFairnessRatioBps() external view returns (uint256);
```

#### MevRegistry.sol

MEV event log with per-trader savings tracking.

```solidity
function recordMevCheck(
    uint256 tradeId,
    address trader,
    bool mevDetected,
    uint256 mevAmount,           // USD × 1e6
    uint256 protectionSavings,   // USD × 1e6
    string calldata protectionMethod
) external onlyRecorder returns (uint256 checkId);

function getMevStats() external view returns (
    uint256 checks,
    uint256 detections,
    uint256 savingsUsd6,
    uint256 detectionRate        // basis points
);
```

---

## 📡 API Documentation

Base URL: `http://localhost:3000` (dev) or your deployed URL.

All responses use the envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

### `POST /api/trade/submit`

Encrypt order → upload to 0G Storage → submit on-chain.

```bash
curl -X POST http://localhost:3000/api/trade/submit \
  -H "Content-Type: application/json" \
  -d '{"inputAmount":"1000000000","tokenIn":"USDC","tokenOut":"WETH","maxSlippage":0.5}'
```

```json
{
  "success": true,
  "data": {
    "tradeId": "42",
    "orderCID": "bafkreihdwdcefgh...",
    "txHash": "0xabc123...",
    "status": "committed"
  }
}
```

### `POST /api/trade/execute`

Execute inside TEE → record result on-chain.

```bash
curl -X POST http://localhost:3000/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{"tradeId":"42","orderCID":"bafkreihdwdcefgh..."}'
```

```json
{
  "success": true,
  "data": {
    "tradeId": "42",
    "outputAmount": "499800000000000000",
    "slippage": 0.04,
    "proof": "fairness_verified",
    "proofId": "17",
    "attestation": "0xdeadbeef...",
    "txHash": "0xabc456..."
  }
}
```

### `GET /api/trade/:tradeId`

Full trade details including proof and MEV status.

```bash
curl http://localhost:3000/api/trade/42
```

### `GET /api/stats/mev`

Global MEV protection stats (30 s cache).

```bash
curl http://localhost:3000/api/stats/mev
```

### `GET /api/health`

System health — RPC, contracts, 0G Storage.

```bash
curl http://localhost:3000/api/health
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- A funded Arbitrum Sepolia wallet ([get testnet ETH](https://faucet.triangleplatform.com/arbitrum/sepolia))
- A [WalletConnect Cloud](https://cloud.walletconnect.com) project ID (free)

```bash
# 1. Clone
git clone https://github.com/arpit2222/VerifyTrade.git && cd VerifyTrade

# 2. Install all workspaces
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env: add PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, ENCRYPTION_KEY

# 4. Compile & test contracts
npm run compile
npm run test:contracts      # 72 tests should pass

# 5. Deploy to Arbitrum Sepolia
npm run deploy:testnet      # writes addresses to frontend/.env.local

# 6. Start frontend
npm run dev                 # → http://localhost:3000
```

> 💡 **No 0G credentials?** The app auto-switches to mock mode — you'll see realistic simulated results with no extra setup.

---

## 🧪 Testing Guide

```bash
# All contract tests
cd contracts && npx hardhat test

# Specific suites
npx hardhat test --grep "VerifiableTradeExecutor"
npx hardhat test --grep "FairnessProof"
npx hardhat test --grep "MevRegistry"

# Coverage
npx hardhat coverage
```

```bash
# API smoke tests (dev server must be running)
curl http://localhost:3000/api/health | jq .data.status
curl -X POST http://localhost:3000/api/trade/submit \
     -H "Content-Type: application/json" \
     -d '{"inputAmount":"1000000","tokenIn":"USDC","tokenOut":"WETH","maxSlippage":0.5}' | jq
```

---

## 🌐 Deployment

### Vercel

```bash
cd frontend
vercel --prod

# Set env vars
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID production
vercel env add NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS production
vercel env add NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS production
vercel env add NEXT_PUBLIC_MEV_REGISTRY_ADDRESS production
vercel env add ENCRYPTION_KEY production
vercel env add EXECUTOR_PRIVATE_KEY production
vercel env add ARBITRUM_SEPOLIA_RPC_URL production
```

### Arbitrum Mainnet

1. Add network to `contracts/hardhat.config.ts`
2. Fund deployer wallet with mainnet ETH
3. `npx hardhat run scripts/deploy.ts --network arbitrum`
4. `npx hardhat verify --network arbitrum <ADDRESS>`

---

## 🔮 Future Roadmap

| Version | Features |
|---------|---------|
| **v1.1** | ZK-SNARKs for slippage proof, batch execution, order-book matching |
| **v1.2** | Ethereum + Optimism + Base deployment, cross-chain routing |
| **v1.3** | API-key auth, bulk history export, WebSocket event feed |
| **v2.0** | 0G AI price prediction, automated MEV strategy, DEX aggregation |

---

## 👤 Team

| Name | Role | Links |
|------|------|-------|
| **Arpit Chauhan** | Full-stack Web3 Developer | [GitHub](https://github.com/arpit2222) |

Built solo for the **0G APAC Hackathon** in 4 days.

---

## 📜 License

[MIT](LICENSE) © 2024 Arpit Chauhan

---

<div align="center">

**Built with ❤️ on [0G Network](https://0g.ai) · Deployed on [Arbitrum](https://arbitrum.io)**

*VerifyTrade — because every trade deserves a proof.*

</div>
