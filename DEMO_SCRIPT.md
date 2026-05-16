# 🎬 VerifyTrade — Demo Video Script

**Target length:** 3:00–3:15  
**Resolution:** 1080p minimum  
**Browser zoom:** 125% (makes UI elements clearly visible)  
**Audio:** Speak clearly; aim for ~130 words per minute  

---

## Pre-recording checklist

- [ ] Local server running (`npm run dev` in `frontend/`)
- [ ] MetaMask connected to **Arbitrum Sepolia**
- [ ] Test wallet funded with Sepolia ETH (≥ 0.01 ETH)
- [ ] Browser at 125% zoom
- [ ] Mock mode active (no need for real 0G credentials)
- [ ] Browser dev tools **closed**
- [ ] Notifications / system popups **silenced**
- [ ] Tab open at `http://localhost:3000/trade`

---

## Scene-by-scene breakdown

---

### 🎬 Scene 1 — Hook `[0:00 – 0:10]`

**Screen:** VerifyTrade homepage / trade page  
**Action:** Slow pan across the UI, then zoom to the "MEV Protection Stats" card

**Script:**
> "This is VerifyTrade — solving the one-point-two-billion-dollar MEV problem in DeFi. In the next three minutes I'll show you how every trade on this platform comes with a cryptographic proof of fairness — recorded permanently on the blockchain."

**Notes:**
- Keep mouse still during the opening pan
- The MEV stats card should show non-zero numbers (mock mode provides these)

---

### 🎬 Scene 2 — Problem `[0:10 – 0:30]`

**Screen:** Split — left side shows a normal Uniswap-style trade, right side shows the VerifyTrade UI  
*(If you can't show Uniswap, just narrate while pointing at the trade form)*

**Script:**
> "Right now, every time you submit a trade on a public blockchain, your transaction sits in the public mempool — fully visible to MEV bots. These bots front-run your order, sandwich it, and pocket the difference. The average trader loses between zero-point-five and two percent per trade to MEV. That's hundreds of millions of dollars every single day — and you have absolutely no way to prove it happened or get compensation."

**Action:** Hover over the privacy notice at the bottom of the TradeForm card to highlight it

---

### 🎬 Scene 3 — Solution intro `[0:30 – 1:00]`

**Screen:** Trade page, focus on the left column (TradeForm)

**Script:**
> "VerifyTrade solves this with a three-layer approach. First — your order is AES-256 encrypted right here in your browser before it ever touches the network. Second — the encrypted order goes to 0G Storage, a decentralised storage network. Nobody can read it. Third — execution happens inside a Trusted Execution Environment powered by 0G Compute. MEV bots literally cannot see the trade until after it's settled. And the entire result — the output amount, actual slippage, fairness verdict — is recorded permanently on Arbitrum."

**Action:** Point (mouse hover) to each step as you mention it:
1. The form (encryption happens here)
2. The "0G Storage CID" label (appears after submit)
3. The "Execute in TEE" button

---

### 🎬 Scene 4 — Fill the form `[1:00 – 1:30]`

**Screen:** TradeForm in focus

**Script:**
> "Let's place a real trade. I'll trade one thousand USDC for WETH — a common institutional-sized position. Slippage tolerance: zero-point-five percent. That's the maximum I'm willing to accept."

**Action:**
1. Type `1000` in the Amount field
2. Token In: already set to USDC — leave it
3. Token Out: already set to WETH — leave it
4. Click the `0.5%` slippage preset button
5. Pause for a second, pointing at the privacy notice

**Script (continued):**
> "Notice the privacy notice — AES-256 encrypted, stored on 0G Storage, executed inside a TEE. This isn't marketing copy. This is exactly what happens when I click submit."

---

### 🎬 Scene 5 — Submit `[1:30 – 1:45]`

**Screen:** TradeForm, then toast notification

**Script:**
> "Submitting now."

**Action:**
1. Click **Submit Order**
2. Button shows "Submitting…" spinner — pause here
3. Toast notification appears: "Trade submitted! Trade #X is queued for execution."

**Script (continued):**
> "The order is encrypted, uploaded to 0G Storage, and the content-addressed CID is recorded on-chain in a single transaction. The Trade ID is our reference for everything that follows."

**Notes:**
- If the transaction fails (wrong network, no gas), cut and retry. Have the backup trade ID ready.
- Highlight the trade ID in the toast

---

### 🎬 Scene 6 — Execute in TEE `[1:45 – 2:00]`

**Screen:** TradeExecution card (appears below the form after successful submit)

**Script:**
> "Now I'll trigger execution inside the Trusted Execution Environment. In production this calls a 0G Compute node — a hardware-secured enclave that decrypts the order, executes the swap, and signs the result. Nobody — not even the node operator — can tamper with or observe the trade."

**Action:**
1. Show the Order CID field — read out the first few characters
2. Click **Execute Trade in TEE**

---

### 🎬 Scene 7 — Loading state `[2:00 – 2:30]`

**Screen:** Animated loading steps inside TradeExecution card

**Script:**
> "Watch the execution progress. Connecting to the 0G Compute node… decrypting the order inside the enclave… generating the fairness attestation. This whole process takes a few seconds in production. The TEE measures its own environment and signs the result — creating what's called a remote attestation."

**Action:** Point to each animated step as it appears:
1. 🔵 "Connecting to 0G Compute node…"
2. 🔵 "Decrypting order inside TEE enclave…"
3. 🔵 "Generating fairness attestation…"

---

### 🎬 Scene 8 — Result `[2:30 – 2:50]`

**Screen:** ExecutionResult component — green "Fairness Verified ✓" banner

**Script:**
> "And here's the result. Fairness — verified. The trade received zero-point-zero-four percent actual slippage, well within our zero-point-five percent limit. The output amount is shown in WETH. And critically — here's the attestation hash. This is the cryptographic fingerprint of everything that happened inside the secure enclave."

**Action:**
1. Point to the green banner ("Fairness Verified ✓")
2. Point to the slippage metric
3. Click the Copy button on the attestation hash
4. Point to the "View on Arbiscan" button

---

### 🎬 Scene 9 — On-chain proof `[2:50 – 3:00]`

**Screen:** Click "View Trade Details" → navigate to `/trade/[id]` page

**Script:**
> "Every result is stored on Arbitrum. This is the permanent on-chain record — trade ID, input and output amounts, actual slippage, the fairness verdict from the TEE, and the full attestation hash. Anyone can verify this independently by calling the FairnessProof contract directly."

**Action:**
1. Scroll through the TradeStatus card to show all fields
2. Pause on the "Fairness Proof" section — show "VERIFIED"
3. Point to the "MEV: No MEV detected" section

---

### 🎬 Scene 10 — MEV Dashboard `[3:00 – 3:07]`

**Screen:** Navigate to `/dashboard`

**Script:**
> "The platform dashboard shows real-time MEV protection stats — how many trades have been protected, total savings in USD, detection rate, and the global fairness ratio. Built entirely on 0G's infrastructure."

**Action:** Let the MEV stats chart animate in — don't rush this

---

### 🎬 Scene 11 — Closing `[3:07 – 3:15]`

**Screen:** Return to `/trade` page — the hero section

**Script:**
> "VerifyTrade makes institutional-grade DeFi execution accessible to everyone — with cryptographic proof that your trade was fair. Built on 0G Storage, 0G Compute, and Arbitrum. The code is open-source on GitHub. Thank you."

**Action:** Slowly scroll the page to show the "How it works" panel and the MevStats card together

---

## B-roll / backup shots

Have these ready in case live transactions fail:

| Shot | Description |
|------|-------------|
| Pre-recorded submit | A screen recording of a successful submit flow |
| Pre-recorded execute | A screen recording of the TEE execution + green result |
| Arbiscan screenshot | The FairnessProof contract on Arbiscan showing stored proofs |
| Dashboard screenshot | MEV stats dashboard with realistic numbers |

---

## Post-production checklist

- [ ] Trim dead air at the beginning and end
- [ ] Add captions / subtitles (accessibility + silent viewing)
- [ ] Add intro title card: "VerifyTrade — 0G APAC Hackathon"
- [ ] Add outro: GitHub URL + "Built on 0G"
- [ ] Export at 1080p 30fps minimum
- [ ] Upload to YouTube as **Unlisted**
- [ ] Copy the video URL and add to README and HackQuest submission
