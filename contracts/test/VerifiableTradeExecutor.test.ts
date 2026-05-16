import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { VerifiableTradeExecutor } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

async function deployFixture() {
  const [owner, trader, executor, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("VerifiableTradeExecutor");
  const contract = (await Factory.deploy()) as VerifiableTradeExecutor;

  await contract.setExecutor(executor.address, true);

  const TRADE_ARGS = {
    encryptedOrder:     "ipfs://Qm0000000000000000000000000000000000000000000",
    inputAmount:        ethers.parseUnits("100", 6),
    tokenIn:            "USDC",
    tokenOut:           "WETH",
    maxSlippagePercent: 50n,   // 0.50%
  } as const;

  return { contract, owner, trader, executor, other, TRADE_ARGS };
}

// Helper: submit a trade and return tradeId
async function submitAndGetId(
  contract: VerifiableTradeExecutor,
  trader: HardhatEthersSigner,
  overrides: Partial<typeof TRADE_ARGS_DEFAULTS> = {}
) {
  const defaults = {
    encryptedOrder:     "ipfs://Qm0000000000000000000000000000000000000000000",
    inputAmount:        ethers.parseUnits("100", 6),
    tokenIn:            "USDC",
    tokenOut:           "WETH",
    maxSlippagePercent: 50n,
  };
  const args = { ...defaults, ...overrides };

  const tx = await contract.connect(trader).submitTrade(
    args.encryptedOrder,
    args.inputAmount,
    args.tokenIn,
    args.tokenOut,
    args.maxSlippagePercent
  );
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((l) => {
      try { return contract.interface.parseLog(l as unknown as { topics: string[]; data: string }); }
      catch { return null; }
    })
    .find((e) => e?.name === "TradeSubmitted");

  return event?.args[0] as bigint;
}

const TRADE_ARGS_DEFAULTS = {
  encryptedOrder:     "ipfs://Qm0000000000000000000000000000000000000000000",
  inputAmount:        ethers.parseUnits("100", 6),
  tokenIn:            "USDC",
  tokenOut:           "WETH",
  maxSlippagePercent: 50n,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VerifiableTradeExecutor", function () {

  // ── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets owner correctly", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with nextTradeId = 1 and zero counters", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.nextTradeId()).to.equal(1n);
      expect(await contract.totalTradesSubmitted()).to.equal(0n);
      expect(await contract.totalTradesExecuted()).to.equal(0n);
    });

    it("authorizes the executor address", async function () {
      const { contract, executor } = await loadFixture(deployFixture);
      expect(await contract.authorizedExecutors(executor.address)).to.be.true;
    });
  });

  // ── submitTrade ─────────────────────────────────────────────────────────────
  describe("submitTrade()", function () {
    it("records a valid trade and returns tradeId = 1", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);

      const tx = await contract.connect(trader).submitTrade(
        TRADE_ARGS.encryptedOrder,
        TRADE_ARGS.inputAmount,
        TRADE_ARGS.tokenIn,
        TRADE_ARGS.tokenOut,
        TRADE_ARGS.maxSlippagePercent
      );

      await expect(tx).to.emit(contract, "TradeSubmitted")
        .withArgs(1n, trader.address, "USDC", "WETH", TRADE_ARGS.inputAmount, 50n, await getBlockTimestamp(tx));

      expect(await contract.totalTradesSubmitted()).to.equal(1n);
    });

    it("increments tradeId for consecutive submissions", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);

      await contract.connect(trader).submitTrade(
        TRADE_ARGS.encryptedOrder, TRADE_ARGS.inputAmount,
        TRADE_ARGS.tokenIn, TRADE_ARGS.tokenOut, TRADE_ARGS.maxSlippagePercent
      );
      await contract.connect(trader).submitTrade(
        TRADE_ARGS.encryptedOrder, TRADE_ARGS.inputAmount,
        TRADE_ARGS.tokenIn, TRADE_ARGS.tokenOut, TRADE_ARGS.maxSlippagePercent
      );

      expect(await contract.nextTradeId()).to.equal(3n);
      expect(await contract.totalTradesSubmitted()).to.equal(2n);
    });

    it("stores the trade with correct fields", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);
      const trade = await contract.getTrade(tradeId);

      expect(trade.tradeId).to.equal(1n);
      expect(trade.trader).to.equal(trader.address);
      expect(trade.tokenIn).to.equal("USDC");
      expect(trade.tokenOut).to.equal("WETH");
      expect(trade.inputAmount).to.equal(TRADE_ARGS.inputAmount);
      expect(trade.maxSlippagePercent).to.equal(50n);
      expect(trade.isExecuted).to.be.false;
      expect(trade.isFair).to.be.false;
    });

    it("reverts on zero inputAmount", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);
      await expect(
        contract.connect(trader).submitTrade(
          TRADE_ARGS.encryptedOrder, 0n, TRADE_ARGS.tokenIn, TRADE_ARGS.tokenOut, 50n
        )
      ).to.be.revertedWithCustomError(contract, "ZeroInputAmount");
    });

    it("reverts on empty encryptedOrder hash", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);
      await expect(
        contract.connect(trader).submitTrade(
          "", TRADE_ARGS.inputAmount, TRADE_ARGS.tokenIn, TRADE_ARGS.tokenOut, 50n
        )
      ).to.be.revertedWithCustomError(contract, "EmptyOrderHash");
    });

    it("reverts on empty tokenIn symbol", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);
      await expect(
        contract.connect(trader).submitTrade(
          TRADE_ARGS.encryptedOrder, TRADE_ARGS.inputAmount, "", "WETH", 50n
        )
      ).to.be.revertedWithCustomError(contract, "EmptyTokenSymbol");
    });

    it("reverts when slippage exceeds MAX_SLIPPAGE_SCALE (10000)", async function () {
      const { contract, trader, TRADE_ARGS } = await loadFixture(deployFixture);
      await expect(
        contract.connect(trader).submitTrade(
          TRADE_ARGS.encryptedOrder, TRADE_ARGS.inputAmount,
          TRADE_ARGS.tokenIn, TRADE_ARGS.tokenOut, 10_001n
        )
      ).to.be.revertedWithCustomError(contract, "InvalidSlippage");
    });

    it("appends tradeId to getTradeHistory()", async function () {
      const { contract, trader } = await loadFixture(deployFixture);
      const id1 = await submitAndGetId(contract, trader);
      const id2 = await submitAndGetId(contract, trader);
      const history = await contract.getTradeHistory(trader.address);

      expect(history).to.deep.equal([id1, id2]);
    });
  });

  // ── recordTradeResult ───────────────────────────────────────────────────────
  describe("recordTradeResult()", function () {
    it("records result and marks trade as executed and fair", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await expect(
        contract.connect(executor).recordTradeResult(
          tradeId,
          ethers.parseUnits("0.04", 18),
          "0xATTESTATION_HASH_GOES_HERE",
          30n,   // 0.30% — within the 0.50% limit
          '{"price":"2500","source":"0g-ai"}'
        )
      ).to.emit(contract, "TradeExecuted");

      const trade = await contract.getTrade(tradeId);
      expect(trade.isExecuted).to.be.true;
      expect(trade.isFair).to.be.true;
      expect(trade.actualSlippagePercent).to.equal(30n);
    });

    it("marks trade as unfair when slippage exceeds limit", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await contract.connect(executor).recordTradeResult(
        tradeId,
        ethers.parseUnits("0.038", 18),
        "0xBAD_EXECUTION_ATTESTATION",
        80n,   // 0.80% — exceeds the 0.50% limit
        "{}"
      );

      const trade = await contract.getTrade(tradeId);
      expect(trade.isFair).to.be.false;
      expect(trade.actualSlippagePercent).to.equal(80n);
    });

    it("reverts when called by unauthorized address", async function () {
      const { contract, trader, other } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await expect(
        contract.connect(other).recordTradeResult(tradeId, 0n, "hash", 0n, "")
      ).to.be.revertedWithCustomError(contract, "UnauthorizedExecutor");
    });

    it("reverts on double-execution of the same tradeId", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await contract.connect(executor).recordTradeResult(
        tradeId, 0n, "hash1", 0n, ""
      );

      await expect(
        contract.connect(executor).recordTradeResult(tradeId, 0n, "hash2", 0n, "")
      ).to.be.revertedWithCustomError(contract, "TradeAlreadyExecuted");
    });

    it("reverts when tradeId does not exist", async function () {
      const { contract, executor } = await loadFixture(deployFixture);
      await expect(
        contract.connect(executor).recordTradeResult(999n, 0n, "hash", 0n, "")
      ).to.be.revertedWithCustomError(contract, "TradeNotFound");
    });

    it("increments totalTradesExecuted after successful recording", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await contract.connect(executor).recordTradeResult(tradeId, 0n, "hash", 0n, "");
      expect(await contract.totalTradesExecuted()).to.equal(1n);
    });
  });

  // ── verifyAttestation ───────────────────────────────────────────────────────
  describe("verifyAttestation()", function () {
    it("returns true for matching attestation hash", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);
      const hash = "0xMyTEEAttestationHash";

      await contract.connect(executor).recordTradeResult(tradeId, 0n, hash, 0n, "");

      expect(await contract.verifyAttestation(tradeId, hash)).to.be.true;
    });

    it("returns false for non-matching attestation hash", async function () {
      const { contract, trader, executor } = await loadFixture(deployFixture);
      const tradeId = await submitAndGetId(contract, trader);

      await contract.connect(executor).recordTradeResult(tradeId, 0n, "correct-hash", 0n, "");

      expect(await contract.verifyAttestation(tradeId, "wrong-hash")).to.be.false;
    });

    it("reverts when verifying a non-existent trade", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.verifyAttestation(404n, "hash")
      ).to.be.revertedWithCustomError(contract, "TradeNotFound");
    });
  });

  // ── getTrades (batch) ───────────────────────────────────────────────────────
  describe("getTrades() batch fetch", function () {
    it("returns multiple trades in one call", async function () {
      const { contract, trader } = await loadFixture(deployFixture);
      const id1 = await submitAndGetId(contract, trader);
      const id2 = await submitAndGetId(contract, trader);
      const trades = await contract.getTrades([id1, id2]);

      expect(trades.length).to.equal(2);
      expect(trades[0]!.tradeId).to.equal(id1);
      expect(trades[1]!.tradeId).to.equal(id2);
    });
  });

  // ── Admin ───────────────────────────────────────────────────────────────────
  describe("Access control", function () {
    it("allows owner to add an executor", async function () {
      const { contract, other } = await loadFixture(deployFixture);
      await contract.setExecutor(other.address, true);
      expect(await contract.authorizedExecutors(other.address)).to.be.true;
    });

    it("prevents non-owner from adding an executor", async function () {
      const { contract, trader, other } = await loadFixture(deployFixture);
      await expect(
        contract.connect(trader).setExecutor(other.address, true)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("reverts setExecutor with zero address", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.setExecutor(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });
  });
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

async function getBlockTimestamp(tx: Awaited<ReturnType<typeof ethers.provider.getTransaction>>) {
  const receipt = await (tx as unknown as { wait: () => Promise<{ blockNumber: number }> }).wait();
  const block = await ethers.provider.getBlock((receipt as unknown as { blockNumber: number }).blockNumber);
  return BigInt(block?.timestamp ?? 0);
}
