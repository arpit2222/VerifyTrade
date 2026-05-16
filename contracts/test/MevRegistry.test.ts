import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { MevRegistry } from "../typechain-types";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

async function deployFixture() {
  const [owner, recorder, trader, trader2, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("MevRegistry");
  const contract = (await Factory.deploy()) as MevRegistry;

  await contract.setRecorder(recorder.address, true);

  const NO_MEV_ARGS = {
    tradeId:            1n,
    trader:             trader.address,
    mevDetected:        false,
    mevAmount:          0n,
    protectionSavings:  0n,
    protectionMethod:   "commit-reveal",
  } as const;

  const MEV_DETECTED_ARGS = {
    tradeId:            2n,
    trader:             trader.address,
    mevDetected:        true,
    mevAmount:          5_000_000n,   // $5.00
    protectionSavings:  4_500_000n,   // $4.50 saved
    protectionMethod:   "flashbots-protect",
  } as const;

  return { contract, owner, recorder, trader, trader2, other, NO_MEV_ARGS, MEV_DETECTED_ARGS };
}

// Helper: record a check and return checkId
async function recordAndGetId(
  contract: MevRegistry,
  recorder: Awaited<ReturnType<typeof ethers.getSigner>>,
  overrides: Partial<{
    tradeId: bigint;
    trader: string;
    mevDetected: boolean;
    mevAmount: bigint;
    protectionSavings: bigint;
    protectionMethod: string;
  }> = {}
) {
  const defaults = {
    tradeId:           99n,
    trader:            (await ethers.getSigners())[2]!.address,
    mevDetected:       false,
    mevAmount:         0n,
    protectionSavings: 0n,
    protectionMethod:  "commit-reveal",
  };
  const args = { ...defaults, ...overrides };
  const tx = await contract.connect(recorder).recordMevCheck(
    args.tradeId,
    args.trader,
    args.mevDetected,
    args.mevAmount,
    args.protectionSavings,
    args.protectionMethod
  );
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((l) => {
      try { return contract.interface.parseLog(l as unknown as { topics: string[]; data: string }); }
      catch { return null; }
    })
    .find((e) => e?.name === "MevCheckRecorded");
  return event?.args[0] as bigint;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MevRegistry", function () {

  // ── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets owner correctly", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with nextCheckId = 1 and zero global counters", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.nextCheckId()).to.equal(1n);
      expect(await contract.totalChecks()).to.equal(0n);
      expect(await contract.totalMevDetections()).to.equal(0n);
      expect(await contract.totalGlobalSavingsUsd6()).to.equal(0n);
    });
  });

  // ── recordMevCheck — no MEV ─────────────────────────────────────────────────
  describe("recordMevCheck() — no MEV detected", function () {
    it("emits MevCheckRecorded with mevDetected = false", async function () {
      const { contract, recorder, NO_MEV_ARGS } = await loadFixture(deployFixture);

      await expect(
        contract.connect(recorder).recordMevCheck(
          NO_MEV_ARGS.tradeId,
          NO_MEV_ARGS.trader,
          NO_MEV_ARGS.mevDetected,
          NO_MEV_ARGS.mevAmount,
          NO_MEV_ARGS.protectionSavings,
          NO_MEV_ARGS.protectionMethod
        )
      ).to.emit(contract, "MevCheckRecorded");
    });

    it("stores the event correctly with zero amounts", async function () {
      const { contract, recorder, trader, NO_MEV_ARGS } = await loadFixture(deployFixture);
      const checkId = await recordAndGetId(contract, recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>, {
        tradeId: NO_MEV_ARGS.tradeId,
        trader: trader.address,
        mevDetected: false,
        mevAmount: 0n,
        protectionSavings: 0n,
        protectionMethod: "commit-reveal",
      });

      const evt = await contract.getMevEvent(checkId);
      expect(evt.mevDetected).to.be.false;
      expect(evt.mevAmount).to.equal(0n);
      expect(evt.protectionSavings).to.equal(0n);
      expect(evt.protectionMethod).to.equal("commit-reveal");
    });

    it("does NOT increment totalMevDetections", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      await recordAndGetId(contract, recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>, {
        trader: trader.address,
        mevDetected: false,
      });
      expect(await contract.totalMevDetections()).to.equal(0n);
    });
  });

  // ── recordMevCheck — MEV detected ───────────────────────────────────────────
  describe("recordMevCheck() — MEV detected", function () {
    it("stores mevDetected = true and correct amounts", async function () {
      const { contract, recorder, trader, MEV_DETECTED_ARGS } = await loadFixture(deployFixture);
      const checkId = await recordAndGetId(
        contract,
        recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        {
          tradeId: MEV_DETECTED_ARGS.tradeId,
          trader: trader.address,
          mevDetected: true,
          mevAmount: 5_000_000n,
          protectionSavings: 4_500_000n,
          protectionMethod: "flashbots-protect",
        }
      );

      const evt = await contract.getMevEvent(checkId);
      expect(evt.mevDetected).to.be.true;
      expect(evt.mevAmount).to.equal(5_000_000n);
      expect(evt.protectionSavings).to.equal(4_500_000n);
    });

    it("increments totalMevDetections", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      await recordAndGetId(contract, recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>, {
        trader: trader.address,
        mevDetected: true,
        mevAmount: 1_000_000n,
        protectionSavings: 900_000n,
        protectionMethod: "flashbots",
      });
      expect(await contract.totalMevDetections()).to.equal(1n);
    });

    it("wasMevDetected() returns true after recording", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const tradeId = 77n;
      await recordAndGetId(contract, recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>, {
        tradeId,
        trader: trader.address,
        mevDetected: true,
        mevAmount: 2_000_000n,
        protectionSavings: 1_800_000n,
        protectionMethod: "private-mempool",
      });
      expect(await contract.wasMevDetected(tradeId)).to.be.true;
    });
  });

  // ── getTotalMevSavings ──────────────────────────────────────────────────────
  describe("getTotalMevSavings()", function () {
    it("accumulates savings across multiple trades for the same trader", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const r = recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      await recordAndGetId(contract, r, {
        tradeId: 1n, trader: trader.address,
        mevDetected: true, mevAmount: 1_000_000n,
        protectionSavings: 800_000n, protectionMethod: "flashbots",
      });
      await recordAndGetId(contract, r, {
        tradeId: 2n, trader: trader.address,
        mevDetected: true, mevAmount: 2_000_000n,
        protectionSavings: 1_700_000n, protectionMethod: "private-mempool",
      });
      await recordAndGetId(contract, r, {
        tradeId: 3n, trader: trader.address,
        mevDetected: false, mevAmount: 0n,
        protectionSavings: 0n, protectionMethod: "commit-reveal",
      });

      const savings = await contract.getTotalMevSavings(trader.address);
      expect(savings).to.equal(2_500_000n); // 800_000 + 1_700_000
    });

    it("returns 0 for a trader with no history", async function () {
      const { contract, other } = await loadFixture(deployFixture);
      expect(await contract.getTotalMevSavings(other.address)).to.equal(0n);
    });

    it("keeps savings separate between two traders", async function () {
      const { contract, recorder, trader, trader2 } = await loadFixture(deployFixture);
      const r = recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      await recordAndGetId(contract, r, {
        tradeId: 10n, trader: trader.address,
        mevDetected: true, mevAmount: 3_000_000n,
        protectionSavings: 2_500_000n, protectionMethod: "flashbots",
      });
      await recordAndGetId(contract, r, {
        tradeId: 11n, trader: trader2.address,
        mevDetected: true, mevAmount: 1_000_000n,
        protectionSavings: 900_000n, protectionMethod: "commit-reveal",
      });

      expect(await contract.getTotalMevSavings(trader.address)).to.equal(2_500_000n);
      expect(await contract.getTotalMevSavings(trader2.address)).to.equal(900_000n);
    });
  });

  // ── getMevStats ─────────────────────────────────────────────────────────────
  describe("getMevStats()", function () {
    it("returns zero stats before any checks", async function () {
      const { contract } = await loadFixture(deployFixture);
      const stats = await contract.getMevStats();
      expect(stats.checks).to.equal(0n);
      expect(stats.detections).to.equal(0n);
      expect(stats.savingsUsd6).to.equal(0n);
      expect(stats.detectionRate).to.equal(0n);
    });

    it("calculates detectionRate in basis points correctly", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const r = recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      // 2 checks: 1 MEV detected → 50% → 5000 bps
      await recordAndGetId(contract, r, {
        tradeId: 20n, trader: trader.address,
        mevDetected: true, mevAmount: 500_000n,
        protectionSavings: 450_000n, protectionMethod: "flashbots",
      });
      await recordAndGetId(contract, r, {
        tradeId: 21n, trader: trader.address,
        mevDetected: false, mevAmount: 0n,
        protectionSavings: 0n, protectionMethod: "commit-reveal",
      });

      const stats = await contract.getMevStats();
      expect(stats.checks).to.equal(2n);
      expect(stats.detections).to.equal(1n);
      expect(stats.detectionRate).to.equal(5_000n); // 50% in bps
    });

    it("accumulates global savings correctly", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const r = recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      await recordAndGetId(contract, r, {
        tradeId: 30n, trader: trader.address,
        mevDetected: true, mevAmount: 2_000_000n,
        protectionSavings: 1_800_000n, protectionMethod: "flashbots",
      });
      await recordAndGetId(contract, r, {
        tradeId: 31n, trader: trader.address,
        mevDetected: true, mevAmount: 500_000n,
        protectionSavings: 450_000n, protectionMethod: "private-mempool",
      });

      const stats = await contract.getMevStats();
      expect(stats.savingsUsd6).to.equal(2_250_000n);
    });
  });

  // ── getMevHistoryByTrader ───────────────────────────────────────────────────
  describe("getMevHistoryByTrader()", function () {
    it("returns all checkIds for a trader", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const r = recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      const id1 = await recordAndGetId(contract, r, { tradeId: 40n, trader: trader.address });
      const id2 = await recordAndGetId(contract, r, { tradeId: 41n, trader: trader.address });

      const history = await contract.getMevHistoryByTrader(trader.address);
      expect(history).to.deep.equal([id1, id2]);
    });

    it("reverts for a trader with no history", async function () {
      const { contract, other } = await loadFixture(deployFixture);
      await expect(
        contract.getMevHistoryByTrader(other.address)
      ).to.be.revertedWithCustomError(contract, "NoMevHistoryForTrader");
    });
  });

  // ── getMevEventByTrade ──────────────────────────────────────────────────────
  describe("getMevEventByTrade()", function () {
    it("returns the event for a trade that was checked", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      const tradeId = 55n;
      await recordAndGetId(contract, recorder as unknown as Awaited<ReturnType<typeof ethers.getSigner>>, {
        tradeId, trader: trader.address,
        mevDetected: true, mevAmount: 1_000_000n,
        protectionSavings: 800_000n, protectionMethod: "flashbots",
      });

      const evt = await contract.getMevEventByTrade(tradeId);
      expect(evt.tradeId).to.equal(tradeId);
      expect(evt.mevDetected).to.be.true;
    });

    it("reverts for a trade that was never checked", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.getMevEventByTrade(9999n)
      ).to.be.revertedWithCustomError(contract, "NoCheckForTrade");
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  describe("Input validation", function () {
    it("reverts on empty protectionMethod", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);
      await expect(
        contract.connect(recorder).recordMevCheck(1n, trader.address, false, 0n, 0n, "")
      ).to.be.revertedWithCustomError(contract, "EmptyProtectionMethod");
    });

    it("reverts on zero trader address", async function () {
      const { contract, recorder } = await loadFixture(deployFixture);
      await expect(
        contract.connect(recorder).recordMevCheck(
          1n, ethers.ZeroAddress, false, 0n, 0n, "commit-reveal"
        )
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("reverts when called by unauthorized recorder", async function () {
      const { contract, trader, other } = await loadFixture(deployFixture);
      await expect(
        contract.connect(other).recordMevCheck(1n, trader.address, false, 0n, 0n, "method")
      ).to.be.revertedWithCustomError(contract, "UnauthorizedRecorder");
    });

    it("allows owner to grant and revoke recorder role", async function () {
      const { contract, owner, other } = await loadFixture(deployFixture);

      await contract.connect(owner).setRecorder(other.address, true);
      expect(await contract.authorizedRecorders(other.address)).to.be.true;

      await contract.connect(owner).setRecorder(other.address, false);
      expect(await contract.authorizedRecorders(other.address)).to.be.false;
    });
  });

  // ── totalTradesSafe ──────────────────────────────────────────────────────────
  describe("totalTradesSafe()", function () {
    it("counts trades where MEV was not detected as safe", async function () {
      const { contract, recorder, trader } = await loadFixture(deployFixture);

      // 2 safe, 1 detected
      await contract.connect(recorder).recordMevCheck(1n, trader.address, false, 0n, 0n, "commit-reveal");
      await contract.connect(recorder).recordMevCheck(2n, trader.address, false, 0n, 0n, "commit-reveal");
      await contract.connect(recorder).recordMevCheck(3n, trader.address, true, 1000n, 900n, "flashbots");

      const [checks, detections] = await contract.getMevStats();
      const safe = Number(checks) - Number(detections);
      expect(safe).to.equal(2);
    });
  });
});
