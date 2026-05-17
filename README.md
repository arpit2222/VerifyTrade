<div align="center">

# VerifyTrade

### Fair DeFi Trading with Cryptographic Proofs

*Every trade. Encrypted. Executed in a secure enclave. Proven on-chain.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Arbitrum%20Sepolia-orange.svg)](https://sepolia.arbiscan.io)
[![Built with 0G](https://img.shields.io/badge/Built%20with-0G%20Network-purple.svg)](https://0g.ai)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black.svg)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Contracts-Solidity%200.8.24-363636.svg)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-84%20passing-green.svg)](#testing)

**[Live Demo](https://verifytrade.vercel.app)** · **[GitHub](https://github.com/arpit2222/VerifyTrade)**

</div>

---

## What We Built

VerifyTrade is a **MEV-protected DeFi trading platform** built for the 0G APAC Hackathon 2026. It solves the front-running and sandwich attack problem that costs DeFi traders over $1.2 billion per year — using 0G's full AI stack: Storage, Compute (TEE), KV Store, and on-chain Agentic Identity.

Every trade goes through four steps:

```
1. ENCRYPT    Your order is AES-256-GCM encrypted in the browser
      ↓
2. STORE      Encrypted order uploaded to 0G Storage (Galileo testnet)
      ↓
3. EXECUTE    0G Compute TEE decrypts and executes inside a hardware enclave
      ↓
4. PROVE      Fairness attestation written permanently to Arbitrum Sepolia
```

MEV bots cannot see your order before it executes. Every trade comes with a **blockchain-verifiable fairness proof** that anyone can check at `/verify`.

---

## 0G Integrations

All four 0G network components are integrated with real SDK calls and graceful fallbacks:

### 0G Storage — Order Privacy
Encrypted trade orders are uploaded to 0G Storage before the on-chain `submitTrade()` call. The content-addressed CID is the only thing recorded on Arbitrum — order details are never exposed on-chain before execution.

```typescript
// frontend/src/lib/0g-storage.ts
const encrypted = encryptOrder(JSON.stringify(order)); // AES-256-GCM
const { cid }   = await uploadEncryptedOrder(encrypted); // → 0G Storage Galileo
```

### 0G Compute — TEE Execution + Price Oracle
0G Compute serves two roles: executing trades inside TEE hardware enclaves, and providing live token prices via AI inference (used in the `/api/prices` endpoint and the `LivePrices` dashboard widget).

```typescript
// frontend/src/lib/0g-compute.ts
const result = await executeTradeInTEE({ tradeId, orderCID, tokenIn, tokenOut, inputAmount });
// → { outputAmount, slippage, teeMeasurement, attestation, executorId }

const prices = await fetchLivePrices(["ETH", "WBTC", "ARB", "USDC"]);
// → { ETH: 3420, WBTC: 98000, ... } via 0G Compute AI inference
```

### 0G KV Store — Trade Index
Trade IDs are appended to a 0G KV stream keyed by trader address, enabling efficient per-wallet history lookups without scanning on-chain events.

```typescript
// frontend/src/lib/0g-kv.ts
await appendTradeId(traderAddress, tradeId); // indexed by SHA-256 stream ID
```

### 0G Agentic Identity — ERC-7857
VerifyTrade's executor carries a verifiable on-chain identity via ERC-7857 (Token #101 on 0G Galileo). Every trade attestation is tagged with the agent's execution signature. The `/agent` page shows live agent status, capabilities, and authorization model.

```typescript
// frontend/src/lib/0g-agentic-id.ts
const info  = await getAgentInfo();    // ERC-7857 token metadata
const alive = await isAgentAlive();    // on-chain liveness check
await authorizeTrader(traderAddress);  // grant trade allowance
```

---

## Features

### Core Trading
- **AES-256-GCM order encryption** — orders encrypted in-browser before any network call
- **0G Storage upload** — content-addressed CID returned before on-chain submission
- **TEE execution** — 0G Compute hardware enclave, no MEV exposure
- **Counterfactual fairness analysis** — shows what slippage would have been without VerifyTrade
- **On-chain fairness proofs** — `FairnessProof.sol` records every attestation permanently
- **MEV registry** — `MevRegistry.sol` logs every MEV check with USD savings estimates

### Frontend Pages
| Page | Description |
|------|-------------|
| `/trade` | Trade form with live prices sidebar, MEV stats, how-it-works |
| `/verify` | Verify any trade proof by ID, shareable URL (`?id=42`) |
| `/dashboard` | Real-time MEV stats, 0G network status, live prices, recent trades |
| `/agent` | ERC-7857 agent detail — capabilities, auth model, Galileo explorer links |

### API Routes
| Route | Description |
|-------|-------------|
| `POST /api/trade/submit` | Encrypt → 0G Storage → on-chain submit |
| `POST /api/trade/execute` | TEE execution → fairness proof → MEV record |
| `GET /api/trade/[id]` | Full trade details from contracts |
| `GET /api/stats/mev` | Global MEV stats, 30s cache |
| `GET /api/prices` | Live prices from 0G Compute AI, 60s cache |
| `GET /api/agent` | ERC-7857 agent metadata, 5min cache |
| `GET /api/health` | Full system health — RPC, 0G, contracts, 15s cache |

### Security & Reliability
- Per-IP rate limiting (20 req/min submit, 10 req/min execute)
- CORS origin allowlist (no wildcard `*` in production)
- Public Arbitrum Sepolia RPC fallback when no custom key configured
- All `console.log/warn` guarded by `NODE_ENV !== production`
- Graceful mock fallback for all 0G services when testnet unreachable

### Developer Experience
- **84 automated contract tests** — all passing
- TypeScript strict mode, zero `tsc` errors
- Loading skeletons for all pages
- Custom 404 and global error boundary
- robots.txt, sitemap.xml, OpenGraph metadata

---

## Smart Contracts

### Deployed — Arbitrum Sepolia (Chain ID 421614)

| Contract | Address |
|----------|---------|
| `VerifiableTradeExecutor` | `0xe7C677376dB8ad746dc9Ef0f55aB8cF545ebd21F` |
| `FairnessProof` | `0xB1D61252D7D20974de42097ad10C93040cb5d15D` |
| `MevRegistry` | `0x9Bb73F6B36Cf763285fdc919Da541Da45D73FAEB` |
| `VerifyTrade` | `0xd6947eDcaA5A2C259d3B66D3274ca20CfDc2939f` |

### Deployed — 0G Galileo Testnet (Chain ID 16602)

| Contract | Address |
|----------|---------|
| `VerifiableTradeExecutor` | `0xaEAD54C9251D14113f9d71Fee95183751a6F8bd1` |
| `FairnessProof` | `0x1B1aB51446fCEcBFF632FFCec769C55504E50a02` |
| `MevRegistry` | `0xdaa0675bf1592FE3A0a822b0194bA2b9e9BFfB92` |
| `VerifyTrade` | `0x08d3c771E9f1C527f9a6798148953F1C898Ee1a5` |

### ERC-7857 Agentic ID (0G Galileo)

| Item | Value |
|------|-------|
| Contract | `0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F` |
| Token ID | `#101` |
| Standard | ERC-7857 On-chain AI Agent Identity |

---

## Architecture

```
verifytrade/
├── contracts/                         # Hardhat workspace
│   ├── src/
│   │   ├── VerifiableTradeExecutor.sol   # Trade ledger + attestation
│   │   ├── FairnessProof.sol             # TEE attestation registry
│   │   ├── MevRegistry.sol               # MEV event log + savings
│   │   └── mocks/MockERC20.sol           # Test token
│   ├── test/                             # 84 tests across 4 suites
│   └── scripts/deploy.ts                # Multi-network deployer
│
├── frontend/                          # Next.js 14 App Router workspace
│   └── src/
│       ├── app/
│       │   ├── trade/page.tsx            # Trade form + execution
│       │   ├── verify/page.tsx           # Proof verifier + share link
│       │   ├── dashboard/page.tsx        # Stats + 0G status + prices
│       │   ├── agent/page.tsx            # ERC-7857 agent detail
│       │   ├── not-found.tsx             # Custom 404
│       │   ├── error.tsx                 # Global error boundary
│       │   └── api/
│       │       ├── trade/submit/         # POST — encrypt & store
│       │       ├── trade/execute/        # POST — TEE execution
│       │       ├── trade/[tradeId]/      # GET — trade detail
│       │       ├── stats/mev/            # GET — global stats
│       │       ├── prices/               # GET — 0G Compute prices
│       │       ├── agent/                # GET — ERC-7857 agent info
│       │       └── health/               # GET — system health
│       ├── components/
│       │   ├── TradeForm.tsx             # Order form with validation
│       │   ├── TradeExecution.tsx        # TEE execution flow
│       │   ├── TradeStatus.tsx           # Live trade tracker
│       │   ├── FairnessComparison.tsx    # Counterfactual MEV analysis
│       │   ├── MevStats.tsx              # Stats dashboard + charts
│       │   ├── ZeroGStatus.tsx           # 0G network health panel
│       │   ├── AgentCard.tsx             # ERC-7857 agent summary
│       │   ├── LivePrices.tsx            # 0G Compute price oracle
│       │   ├── CompliancePDF.tsx         # Trade proof PDF export
│       │   ├── Header.tsx                # Nav + wallet connect
│       │   ├── Footer.tsx                # Links + attribution
│       │   └── ui/                       # Button, Card, Input, Select, Toast
│       ├── hooks/useTrade.ts             # React Query hooks
│       ├── middleware/auth.ts            # CORS, rate limiting, validation
│       └── lib/
│           ├── 0g-storage.ts             # 0G Storage SDK (+ mock)
│           ├── 0g-compute.ts             # 0G Compute SDK / TEE (+ mock)
│           ├── 0g-kv.ts                  # 0G KV Store SDK (+ mock)
│           ├── 0g-agentic-id.ts          # ERC-7857 agent SDK
│           ├── contracts.ts              # ethers.js contract layer
│           ├── api-client.ts             # Typed fetch wrapper
│           ├── encryption.ts             # AES-256-GCM utilities
│           ├── env.ts                    # Env validation
│           └── types.ts                  # Canonical TypeScript types
│
└── packages/shared/                   # Shared types & utilities
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.24 + OpenZeppelin 5 |
| Contract framework | Hardhat + ethers.js |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| UI components | Radix UI primitives |
| Charts | Recharts |
| Wallet | wagmi v2 + viem + Web3Modal |
| Server state | TanStack React Query v5 |
| Encryption | Node.js crypto (AES-256-GCM) |
| 0G Storage | `@0gfoundation/0g-storage-ts-sdk` v1.2.9 |
| 0G Compute | `@0gfoundation/0g-compute-ts-sdk` v0.8.3 |
| Blockchain | Arbitrum Sepolia + 0G Galileo |
| Language | TypeScript (strict mode) |
| Package manager | npm workspaces (monorepo) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- A funded Arbitrum Sepolia wallet ([get testnet ETH](https://faucet.triangleplatform.com/arbitrum/sepolia))

```bash
# 1. Clone
git clone https://github.com/arpit2222/VerifyTrade.git && cd VerifyTrade

# 2. Install all workspaces
npm install

# 3. Configure environment
cp .env.example .env
# Fill in: PRIVATE_KEY, ZEROG_PRIVATE_KEY, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# ARBITRUM_SEPOLIA_RPC_URL is optional — falls back to public RPC automatically

# 4. Deploy contracts (already deployed on testnet — skip if using existing addresses)
npm run deploy:testnet    # writes addresses to frontend/.env.local

# 5. Start frontend + API
npm run dev               # → http://localhost:3000
```

> **No 0G credentials?** The app auto-switches to mock mode. All UI works with simulated data.

---

## Testing

```bash
# All contract tests (84 passing)
cd contracts && npx hardhat test

# Specific suites
npx hardhat test --grep "VerifiableTradeExecutor"
npx hardhat test --grep "FairnessProof"
npx hardhat test --grep "MevRegistry"
npx hardhat test --grep "VerifyTrade"

# Frontend build check
cd frontend && npm run build

# API smoke tests (dev server running)
curl http://localhost:3000/api/health | jq .
curl http://localhost:3000/api/stats/mev | jq .
curl http://localhost:3000/api/prices | jq .
curl http://localhost:3000/api/agent | jq .
```

---

## Deployment (Vercel)

```bash
cd frontend && vercel --prod

# Required env vars on Vercel:
# NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS
# NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS
# NEXT_PUBLIC_MEV_REGISTRY_ADDRESS
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# ENCRYPTION_KEY
# ZEROG_PRIVATE_KEY       (or EXECUTOR_PRIVATE_KEY)
# ARBITRUM_SEPOLIA_RPC_URL (optional — public fallback available)
# NEXT_PUBLIC_APP_URL     (your Vercel domain)
# CORS_ORIGIN             (your Vercel domain)
```

---

## Roadmap

| Version | Features |
|---------|---------|
| v1.1 | ZK-SNARKs for slippage proof, batch execution |
| v1.2 | Ethereum + Optimism + Base deployment |
| v1.3 | WebSocket event feed, bulk history export |
| v2.0 | 0G AI price prediction, DEX aggregation |

---

## Team

Built solo by **Arpit Chauhan** for the **0G APAC Hackathon 2026**.

---

## License

[MIT](LICENSE) © 2026 Arpit Chauhan

---

<div align="center">

**Built on [0G Network](https://0g.ai) · Deployed on [Arbitrum](https://arbitrum.io)**

*VerifyTrade — because every trade deserves a proof.*

</div>
