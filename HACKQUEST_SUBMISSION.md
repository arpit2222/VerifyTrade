# 📝 HackQuest Submission — VerifyTrade

> Copy each section into the HackQuest form fields.
> Replace bracketed placeholders before submitting.

---

## Project Name

```
VerifyTrade
```

---

## One-Liner (max 30 words)

```
Cryptographically verified DeFi trade execution on 0G — every order is encrypted, executed in a Trusted Execution Environment, and proven fair on Arbitrum.
```

*(27 words)*

---

## Short Description (1–2 sentences)

```
VerifyTrade eliminates MEV front-running by encrypting every order with AES-256, storing it on 0G Storage, and executing it inside a 0G Compute TEE — then recording a cryptographic fairness proof on Arbitrum so anyone can verify their trade was executed fairly.
```

---

## Full Description (500–1000 words)

```
## The Problem

MEV (Maximal Extractable Value) attacks cost DeFi traders over $1.2 billion every year. When a user submits a trade on any public blockchain, the transaction lands in a public mempool — fully visible to sophisticated bots before it's included in a block. These bots front-run orders, sandwich them, and extract value at the trader's expense. The average retail trader loses between 0.5% and 2% per trade to MEV. For institutions managing large positions, this means millions of dollars lost per trade, and — critically — no cryptographic way to prove it happened or challenge it.

This opacity is one of the biggest barriers to institutional DeFi adoption. "Best execution" requirements that apply in traditional finance have no equivalent enforcement mechanism on-chain.

## The Solution

VerifyTrade solves this with a three-layer architecture powered entirely by 0G Network:

**Layer 1 — Order Privacy (0G Storage)**
Every order is AES-256-GCM encrypted in the user's browser before it touches the network. The encrypted payload is uploaded to 0G Storage and given a content-addressed CID. This CID is the only thing recorded on Arbitrum at submission time. MEV bots cannot read the order because it is encrypted end-to-end.

**Layer 2 — Secure Execution (0G Compute / TEE)**
When the user triggers execution, a 0G Compute node fetches the encrypted order from 0G Storage and decrypts it inside a hardware-secured Trusted Execution Environment. The TEE executes the swap against live market prices, checks that actual slippage is within the user's agreed limit, and generates a cryptographic attestation (a TEE measurement + signed result hash). No one — not the node operator, not the protocol, not any MEV bot — can observe or tamper with the order during execution.

**Layer 3 — On-chain Fairness Proof (Arbitrum)**
After execution, three things are recorded permanently on Arbitrum Sepolia:
1. The trade result (output amount, actual slippage) via VerifiableTradeExecutor.sol
2. The TEE attestation (fairness verdict, enclave measurement) via FairnessProof.sol
3. The MEV event log (whether MEV was detected, estimated savings) via MevRegistry.sol

Anyone can call verifyAttestation(tradeId, hash) on-chain to confirm a specific trade was executed fairly, without trusting VerifyTrade.

## 0G Integration

VerifyTrade uses all three pillars of the 0G ecosystem:

- **0G Storage**: All trade orders are encrypted client-side and stored as content-addressed blobs on 0G Storage. This ensures order privacy while maintaining verifiability — the CID on Arbitrum can be used to retrieve and verify the original encrypted order.

- **0G Compute**: The TEE execution layer uses 0G Compute nodes. The compute node fetches the order, runs it inside a hardware enclave (Intel SGX / AMD SEV), and returns a signed attestation proving the execution environment was uncompromised.

- **Privacy by default**: Because every sensitive detail is encrypted before reaching 0G Storage, and only decrypted inside the TEE, the 0G network never has visibility into trade contents — while still being able to prove execution integrity.

## Technical Implementation

The project is a full-stack TypeScript monorepo:

**Smart contracts** (Hardhat + Solidity 0.8.24):
- VerifiableTradeExecutor.sol — trade ledger with submit/execute/verify functions
- FairnessProof.sol — TEE attestation registry with global fairness ratio tracking
- MevRegistry.sol — MEV event log with per-trader savings aggregation
- 72 automated tests, OpenZeppelin 5 security standards

**Backend** (Next.js 14 API Routes):
- POST /api/trade/submit — encrypt, upload to 0G, submit on-chain
- POST /api/trade/execute — TEE execution + multi-contract settlement
- GET /api/trade/:id — full trade detail with proof and MEV status
- GET /api/stats/mev — global platform statistics
- GET /api/health — system health check

**Frontend** (Next.js 14 + wagmi v2 + Web3Modal v5):
- Trade form with slippage presets and privacy notice
- Animated TEE execution progress (3-step loading states)
- Live MEV stats dashboard with recharts visualisations
- Real-time trade status with auto-refresh
- Full proof verification page

The app supports a mock mode: when 0G credentials are not configured, realistic simulations replace live 0G calls, enabling full local development without any external dependencies.

## Impact

VerifyTrade makes provably fair DeFi execution accessible to anyone with a wallet. For institutions, it provides the "best execution" audit trail required by compliance frameworks. For retail traders, it provides zero-MEV fills with cryptographic receipts. For the ecosystem, it demonstrates that 0G's combined Storage + Compute infrastructure can power real DeFi primitives — not just storage for NFT metadata.
```

---

## GitHub Repository

```
https://github.com/arpit2222/VerifyTrade
```

---

## Demo Video

```
[REPLACE WITH: https://youtube.com/watch?v=YOUR_VIDEO_ID]
```

---

## Live Demo URL

```
[REPLACE WITH: https://verifytrade.vercel.app]
```

---

## Smart Contracts (Arbitrum Sepolia — Chain ID 421614)

```
VerifiableTradeExecutor: 0x5A926BB3844c23F44B7e9FBfa54B1f10D992a398
FairnessProof:           0xE264c1313dD7ed52caf852b314d54cF95C29C531
MevRegistry:             0x66900c6610461eaD6a3D30143C8d78352A2CF088
VerifyTrade:             0x839A5bc96e61bb2D5c23C946E38Dacf13e13b0cB

Network: Arbitrum Sepolia (testnet)
Chain ID: 421614
Explorer: https://sepolia.arbiscan.io
Deployed: 2026-05-16 by 0x79601AC98F844aD09b485F739D3C478C5b131A10
```

---

## 0G Integration Proof

```
0G Storage:
- Used to store AES-256-GCM encrypted trade orders
- Content-addressed CID recorded on Arbitrum at submission time
- Orders remain private until decrypted inside the TEE
- Implementation: frontend/src/lib/0g-storage.ts
- Endpoint: ZEROG_STORAGE_NODE env variable (Newton testnet)

0G Compute:
- Used for Trusted Execution Environment (TEE) trade execution
- TEE node decrypts order, executes swap, generates attestation
- TEE measurement (enclave identity hash) recorded on Arbitrum
- Implementation: frontend/src/lib/0g-compute.ts
- Endpoint: ZEROG_COMPUTE_NODE env variable (Newton testnet)

Privacy Architecture:
- All order data encrypted before leaving the browser
- 0G Storage never sees plaintext order contents
- Only the TEE enclave can decrypt and process the order
- Post-execution, only the result hash goes on-chain

Mock Mode:
- Both 0G modules have realistic mock fallbacks
- Auto-activates when env vars are absent
- Enables full demo without live 0G credentials
```

---

## Tech Stack

```
Smart contracts: Solidity 0.8.24, OpenZeppelin 5, Hardhat, TypeChain
Frontend: Next.js 14 (App Router), React 18, TypeScript (strict)
Styling: Tailwind CSS, Radix UI primitives, CVA
Charts: Recharts (AreaChart, PieChart)
Wallet: wagmi v2, viem, Web3Modal v5 (@web3modal/wagmi)
Server state: @tanstack/react-query v5
Encryption: Node.js crypto (AES-256-GCM)
0G: 0G Storage SDK, 0G Compute SDK
Blockchain: Arbitrum Sepolia (deployment target)
Testing: Hardhat + Chai + @nomicfoundation/hardhat-chai-matchers (72 tests)
```

---

## Team

```
Name: Arpit Chauhan
Role: Full-stack Web3 Developer
GitHub: https://github.com/arpit2222
Email: extrawork1928@gmail.com
Experience: Full-stack developer specialising in DeFi protocols and smart contract systems
Built solo for the 0G APAC Hackathon — 4 days of development
```

---

## X/Twitter Post

```
[REPLACE WITH: https://twitter.com/yourhandle/status/YOUR_TWEET_ID]
```

---

## Additional Notes

```
Key technical decisions:

1. Mock-first architecture: Both 0G Storage and 0G Compute modules have
   production implementations and realistic mock fallbacks. The app is
   fully functional without 0G credentials, making it easy to demo and
   judge.

2. No private keys in browser: The executor private key lives on the server
   (Next.js API route). The browser only signs Ethereum transactions via
   the user's own wallet. Order encryption keys are server-managed.

3. Three-contract settlement: Rather than a monolithic contract, we use three
   specialised contracts (trade ledger, fairness proof registry, MEV log)
   following the single-responsibility principle for upgradeability.

4. Cookie-based wagmi state: Uses wagmi v2's cookieStorage for SSR-safe
   wallet connection persistence — no hydration mismatches.
```
