# 🚀 VerifyTrade — Deployment Guide

Complete instructions for deploying VerifyTrade to production.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Deploy Smart Contracts](#1-deploy-smart-contracts)
- [2. Deploy Frontend — Vercel](#2-deploy-frontend--vercel)
- [3. Deploy Frontend — Railway / Render](#3-deploy-frontend--railway--render)
- [4. Deploy Frontend — Self-hosted (Docker)](#4-deploy-frontend--self-hosted-docker)
- [5. Arbitrum Mainnet](#5-arbitrum-mainnet)
- [6. Verify Contracts on Arbiscan](#6-verify-contracts-on-arbiscan)
- [7. Post-deployment checks](#7-post-deployment-checks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum version | Check |
|------------|----------------|-------|
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| Git | Any | `git --version` |
| Funded wallet | ≥ 0.05 Sepolia ETH | — |
| Alchemy / Infura key | Free tier | — |
| WalletConnect project ID | Free | cloud.walletconnect.com |

---

## 1. Deploy Smart Contracts

### Step 1 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required
PRIVATE_KEY=your_deployer_private_key_without_0x
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ARBISCAN_API_KEY=your_arbiscan_key      # needed for verification

# Optional but recommended
GAS_PRICE_GWEI=0.1                      # override if auto-detection is slow
```

### Step 2 — Compile

```bash
npm run compile
# Expected: Compiled N Solidity files successfully
```

### Step 3 — Run tests

```bash
npm run test:contracts
# Expected: 72 passing
```

### Step 4 — Deploy

```bash
npm run deploy:testnet
```

This script:
1. Deploys `VerifiableTradeExecutor`
2. Deploys `FairnessProof`
3. Deploys `MevRegistry`
4. Authorises the deployer wallet as executor / prover / recorder on each contract
5. Saves a deployment JSON to `deployments/arbitrum-sepolia.json`
6. Writes a `frontend/.env.local` file with all contract addresses

**Sample output:**
```
Deploying VerifyTrade contracts to arbitrum-sepolia...
Deployer: 0xYourAddress (balance: 0.05 ETH)

Deploying VerifiableTradeExecutor...  ✓ 0xABC123...
Deploying FairnessProof...            ✓ 0xDEF456...
Deploying MevRegistry...              ✓ 0xGHI789...

Authorising deployer as executor/prover/recorder... ✓

Deployment complete!
Saved: deployments/arbitrum-sepolia.json
Wrote: frontend/.env.local
```

### Step 5 — Note the addresses

```bash
cat deployments/arbitrum-sepolia.json
```

Copy the three addresses into:
- `README.md` — contract addresses table
- `HACKQUEST_SUBMISSION.md` — smart contracts section
- Your Vercel / hosting environment variables

---

## 2. Deploy Frontend — Vercel

Vercel is the recommended hosting platform for Next.js.

### Install Vercel CLI

```bash
npm i -g vercel
```

### Link the project

```bash
cd frontend
vercel link
# Follow prompts: create new project or link existing
```

### Add environment variables

```bash
# Required
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID production
vercel env add NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS production
vercel env add NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS production
vercel env add NEXT_PUBLIC_MEV_REGISTRY_ADDRESS production
vercel env add ENCRYPTION_KEY production
vercel env add EXECUTOR_PRIVATE_KEY production
vercel env add ARBITRUM_SEPOLIA_RPC_URL production
vercel env add NEXT_PUBLIC_RPC_URL production

# Optional
vercel env add ZEROG_STORAGE_NODE production
vercel env add ZEROG_COMPUTE_NODE production
vercel env add CORS_ORIGIN production
```

### Deploy

```bash
vercel --prod
```

**Expected:** `✓ Production: https://verifytrade-xxxx.vercel.app [2m]`

### Custom domain (optional)

```bash
vercel domains add verifytrade.xyz
vercel alias set verifytrade-xxxx.vercel.app verifytrade.xyz
```

---

## 3. Deploy Frontend — Railway / Render

### Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select the `VerifyTrade` repository
3. Set **Root Directory** to `frontend`
4. Set **Build Command** to `npm run build`
5. Set **Start Command** to `npm start`
6. Add environment variables in the Railway dashboard (copy from `.env.production`)

### Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub → select `VerifyTrade`
3. Set **Root Directory**: `frontend`
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npm start`
6. Add environment variables from `.env.production`

---

## 4. Deploy Frontend — Self-hosted (Docker)

```dockerfile
# Dockerfile (place in frontend/)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.js`:

```javascript
// frontend/next.config.js
module.exports = {
  output: 'standalone',
  // ... rest of config
}
```

Build and run:

```bash
cd frontend
docker build -t verifytrade .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxx \
  -e NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS=0x... \
  # ... all env vars
  verifytrade
```

---

## 5. Arbitrum Mainnet

### Step 1 — Add network to Hardhat config

```typescript
// contracts/hardhat.config.ts
networks: {
  arbitrum: {
    url: process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
    accounts: [process.env.PRIVATE_KEY!],
    chainId: 42161,
  },
}
```

### Step 2 — Update .env

```bash
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=42161
NEXT_PUBLIC_CHAIN_NAME=Arbitrum One
NEXT_PUBLIC_NETWORK_ENV=mainnet
```

### Step 3 — Deploy

```bash
npx hardhat run scripts/deploy.ts --network arbitrum
```

### Step 4 — Update frontend chain config

In `frontend/src/lib/wagmi-config.ts`, add `arbitrum` to `SUPPORTED_CHAINS`:

```typescript
import { arbitrumSepolia, arbitrum } from "wagmi/chains";
export const SUPPORTED_CHAINS = [arbitrum, arbitrumSepolia] as const;
export const DEFAULT_CHAIN    = arbitrum;
```

---

## 6. Verify Contracts on Arbiscan

Verification makes contract source code publicly readable on Arbiscan (highly recommended for hackathon judges).

```bash
cd contracts

# VerifiableTradeExecutor (no constructor args)
npx hardhat verify --network arbitrumSepolia 0xYOUR_VTE_ADDRESS

# FairnessProof (no constructor args)
npx hardhat verify --network arbitrumSepolia 0xYOUR_FP_ADDRESS

# MevRegistry (no constructor args)
npx hardhat verify --network arbitrumSepolia 0xYOUR_MR_ADDRESS
```

After verification, the Arbiscan page will show a green ✓ "Contract Source Code Verified" badge.

---

## 7. Post-deployment checks

Run these after every deployment:

```bash
BASE=https://your-vercel-url.vercel.app

# 1. Health check
curl $BASE/api/health | jq '{status: .data.status, contracts: .data.contractsDeployed, rpc: .data.rpcConnected}'

# 2. Submit a test trade
curl -X POST $BASE/api/trade/submit \
  -H "Content-Type: application/json" \
  -d '{"inputAmount":"1000000","tokenIn":"USDC","tokenOut":"WETH","maxSlippage":0.5}' | jq .data.tradeId

# 3. Execute it (replace 1 with returned tradeId)
curl -X POST $BASE/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{"tradeId":"1","orderCID":"returned-cid"}' | jq .data.proof

# 4. Check MEV stats
curl $BASE/api/stats/mev | jq .data.totalTradesSafe
```

**All four should succeed without errors.**

---

## Troubleshooting

### `Nothing to compile` on Hardhat

The `contracts/` workspace has its own `hardhat.config.ts`. Make sure you're running Hardhat commands from inside `contracts/`, or use the root npm scripts which delegate correctly.

```bash
# Wrong
npx hardhat compile  # from repo root

# Correct
cd contracts && npx hardhat compile
# or
npm run compile  # from repo root (uses workspace flag)
```

### `Cannot find module '@/...'`

TypeScript path aliases are configured in `frontend/tsconfig.json`. Make sure `baseUrl` is `"."` and paths include `"@/*": ["./src/*"]`.

### Wallet connect modal not showing

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` must be a real project ID from cloud.walletconnect.com. The placeholder value `YOUR_PROJECT_ID` will not work in production.

### Contract calls failing with `insufficient funds`

The executor wallet (set by `EXECUTOR_PRIVATE_KEY`) must hold Arbitrum Sepolia ETH. Get it from the faucet linked in the README.

### 0G Storage returning 404

If `ZEROG_STORAGE_NODE` is set but the node is unreachable, the app will throw rather than fall back to mock. Either:
- Remove the env var to use mock mode
- Or verify the node URL is correct: `curl $ZEROG_STORAGE_NODE/api/v1/status`

### `tsc` errors after pull

Run `npm install` — a workspace dependency may have changed. Then re-run `tsc --noEmit`.
