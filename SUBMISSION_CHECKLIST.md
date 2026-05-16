# ✅ VerifyTrade — Submission Checklist

Track every step before hitting "Submit" on HackQuest.

---

## 1. Smart Contracts

- [ ] **Funded deployer wallet** with ≥ 0.05 Arbitrum Sepolia ETH  
  → Faucet: https://faucet.triangleplatform.com/arbitrum/sepolia
- [ ] **`.env` configured** — `PRIVATE_KEY`, `ARBITRUM_SEPOLIA_RPC_URL`, `ARBISCAN_API_KEY`
- [ ] **Compiled successfully** — `npm run compile` (no errors)
- [ ] **Tests pass** — `npm run test:contracts` → 72/72 passing
- [ ] **Deployed to Arbitrum Sepolia** — `npm run deploy:testnet`
- [ ] **Deployment JSON saved** — `deployments/arbitrum-sepolia.json` exists
- [ ] **Contract addresses noted:**

| Contract | Address |
|---------|---------|
| VerifiableTradeExecutor | `0x` |
| FairnessProof | `0x` |
| MevRegistry | `0x` |

- [ ] **Verified on Arbiscan** (optional but impressive):
  ```bash
  cd contracts
  npx hardhat verify --network arbitrumSepolia <ADDR> <CONSTRUCTOR_ARGS>
  ```
- [ ] **Arbiscan links working** — click each link in README table

---

## 2. Frontend

- [ ] **`.env.local` populated** with contract addresses (done automatically by deploy script)
- [ ] **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** set
- [ ] **`ENCRYPTION_KEY`** set (32-byte hex)
- [ ] **`npm run dev` starts without errors**
- [ ] **`tsc --noEmit` passes** — zero TypeScript errors

### Page testing

| Page | Action | Expected result |
|------|--------|----------------|
| `/trade` | Load page | Hero, form, MEV stats visible |
| `/trade` | Connect wallet (MetaMask) | Address shown in header |
| `/trade` | Submit trade (USDC → WETH, 100, 0.5%) | Toast: "Trade submitted! Trade #X" |
| `/trade` | Click "Execute Trade in TEE" | Loading animation → green "Fairness Verified" |
| `/trade/[id]` | Navigate to trade detail | All fields populated, fairness proof visible |
| `/dashboard` | Load page | MEV stats chart renders |
| `/verify` | Enter a trade ID → click Verify | TradeStatus card loads |
| Any page | Wrong network → click banner | Switches to Arbitrum Sepolia |

---

## 3. Backend APIs

Run these curl commands against your deployed frontend URL:

```bash
BASE=http://localhost:3000   # or your Vercel URL

# Health check — should return "ok"
curl $BASE/api/health | jq .data.status

# Submit a trade
curl -X POST $BASE/api/trade/submit \
  -H "Content-Type: application/json" \
  -d '{"inputAmount":"1000000","tokenIn":"USDC","tokenOut":"WETH","maxSlippage":0.5}' | jq

# Execute the trade (replace 1 with returned tradeId)
curl -X POST $BASE/api/trade/execute \
  -H "Content-Type: application/json" \
  -d '{"tradeId":"1","orderCID":"replace-with-returned-cid"}' | jq

# Fetch trade status
curl $BASE/api/trade/1 | jq

# MEV stats
curl $BASE/api/stats/mev | jq .data.totalTradesSafe
```

- [ ] All 5 endpoints return `"success": true`
- [ ] `/api/health` shows `"contractsDeployed": true`

---

## 4. Demo Video

- [ ] **Script read through** — rehearse DEMO_SCRIPT.md at least twice
- [ ] **Browser set up** — 125% zoom, Arbitrum Sepolia connected
- [ ] **Screen recording started** — 1080p, system audio muted
- [ ] **Recorded full flow** — submit + execute + proof verification
- [ ] **Under 3 minutes 15 seconds**
- [ ] **Audio clear** — no background noise, no clipping
- [ ] **Post-production done** — trim, captions added, title card
- [ ] **Uploaded to YouTube** — set to **Unlisted** (not Private)
- [ ] **YouTube URL copied:** `https://youtube.com/watch?v=___________`
- [ ] **URL added to README demo video badge**

---

## 5. GitHub Repository

```bash
# Check these before submission
git log --oneline | wc -l    # should be 30+
git status                   # should be clean
cat .gitignore | grep ".env" # should be ignored
```

- [ ] **30+ commits** showing development history
- [ ] **`.env` NOT committed** — `git log --all --full-history -- .env` returns nothing
- [ ] **README complete** with demo video link updated
- [ ] **All code committed and pushed** to `main`
- [ ] **No `node_modules/` in git** — check `.gitignore`
- [ ] **Public repository** — verify in GitHub settings

---

## 6. Documentation

- [ ] **README.md** — complete with all sections
- [ ] **Demo video link** — updated in README badge
- [ ] **Contract addresses** — updated in README table
- [ ] **DEMO_SCRIPT.md** — complete
- [ ] **PITCH_DECK.md** — complete
- [ ] **HACKQUEST_SUBMISSION.md** — filled with actual contract addresses and video URL
- [ ] **API docs** — in README

---

## 7. Vercel Deployment (optional but recommended)

```bash
cd frontend
vercel --prod
```

- [ ] **Vercel deployment succeeds** — no build errors
- [ ] **Environment variables set** in Vercel dashboard
- [ ] **Live URL works** — open in incognito to confirm
- [ ] **Live URL added to README** badge and HACKQUEST_SUBMISSION.md

---

## 8. Twitter/X Post

- [ ] **Post drafted** — see TWITTER_POST.md
- [ ] **Under 280 characters** (or threaded)
- [ ] **Hashtags included:** `#0G #DeFi #MEV #Hackathon #Web3`
- [ ] **Mentions included:** `@0G_labs`
- [ ] **Demo video link included**
- [ ] **GitHub link included**
- [ ] **Posted and URL saved:** `https://twitter.com/___________`

---

## 9. HackQuest Submission

- [ ] **All fields completed** — see HACKQUEST_SUBMISSION.md
- [ ] **Project name:** `VerifyTrade`
- [ ] **One-liner:** filled
- [ ] **Description:** 500–1000 words, copied from HACKQUEST_SUBMISSION.md
- [ ] **GitHub URL:** `https://github.com/arpit2222/VerifyTrade`
- [ ] **Demo video URL:** YouTube unlisted link
- [ ] **Contract addresses:** all three, with network
- [ ] **0G integration proof:** described in detail
- [ ] **Team info:** filled
- [ ] **Submitted ✅**

---

## 10. Final Security Checks

```bash
# Scan for accidentally committed secrets
git log -p | grep -E "(PRIVATE_KEY|SECRET|PASSWORD|API_KEY)=" | grep -v ".example"

# Confirm .env is gitignored
git check-ignore -v .env

# Check no hardcoded keys in source
grep -r "0x[0-9a-f]{64}" frontend/src/ --include="*.ts" --include="*.tsx"
```

- [ ] **No private keys in code**
- [ ] **No API keys in code**
- [ ] **`.env.example` has placeholder values only**

---

## Submission deadline tracker

| Item | Status | Notes |
|------|--------|-------|
| Contracts deployed | ⬜ | |
| Tests passing | ⬜ | |
| Frontend live | ⬜ | |
| Demo video uploaded | ⬜ | |
| README updated | ⬜ | |
| Twitter posted | ⬜ | |
| HackQuest submitted | ⬜ | |
