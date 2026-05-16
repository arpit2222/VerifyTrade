import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { FairnessProof } from "../typechain-types";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

async function deployFixture() {
  const [owner, prover, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("FairnessProof");
  const contract = (await Factory.deploy()) as FairnessProof;

  await contract.setProver(prover.address, true);

  const PROOF_ARGS = {
    tradeId:                 1n,
    teeMeasurement:          "tee://0xABC123_MEASUREMENT_HASH",
    expectedSlippagePercent: 50n,   // 0.50%
    actualSlippagePercent:   30n,   // 0.30% — fair
    executorAddress:         "enclave://sgx-enclave-id-001",
  } as const;

  return { contract, owner, prover, other, PROOF_ARGS };
}

// Helper: record a proof and return its proofId
async function recordAndGetId(
  contract: FairnessProof,
  prover: Awaited<ReturnType<typeof ethers.getSigner>>,
  overrides: Partial<typeof defaults> = {}
) {
  const defaults = {
    tradeId:                 1n,
    teeMeasurement:          "tee://MEASUREMENT",
    expectedSlippagePercent: 50n,
    actualSlippagePercent:   30n,
    executorAddress:         "enclave://sgx-001",
  };
  const args = { ...defaults, ...overrides };
  const tx = await contract.connect(prover).recordProof(
    args.tradeId,
    args.teeMeasurement,
    args.expectedSlippagePercent,
    args.actualSlippagePercent,
    args.executorAddress
  );
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((l) => {
      try { return contract.interface.parseLog(l as unknown as { topics: string[]; data: string }); }
      catch { return null; }
    })
    .find((e) => e?.name === "ProofRecorded");
  return event?.args[0] as bigint;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FairnessProof", function () {

  // ── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets owner correctly", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with nextProofId = 1 and zero counters", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.nextProofId()).to.equal(1n);
      expect(await contract.totalProofsRecorded()).to.equal(0n);
      expect(await contract.totalFairProofs()).to.equal(0n);
    });
  });

  // ── recordProof — fair execution ────────────────────────────────────────────
  describe("recordProof() — fair execution", function () {
    it("emits ProofRecorded with slippageWithinLimit = true", async function () {
      const { contract, prover, PROOF_ARGS } = await loadFixture(deployFixture);

      await expect(
        contract.connect(prover).recordProof(
          PROOF_ARGS.tradeId,
          PROOF_ARGS.teeMeasurement,
          PROOF_ARGS.expectedSlippagePercent,
          PROOF_ARGS.actualSlippagePercent,
          PROOF_ARGS.executorAddress
        )
      )
        .to.emit(contract, "ProofRecorded")
        .withArgs(1n, 1n, true, 30n, anyValue);
    });

    it("stores all fields correctly", async function () {
      const { contract, prover, PROOF_ARGS } = await loadFixture(deployFixture);
      const proofId = await recordAndGetId(contract, prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>);
      const proof = await contract.getProof(proofId);

      expect(proof.proofId).to.equal(1n);
      expect(proof.tradeId).to.equal(PROOF_ARGS.tradeId);
      expect(proof.teeMeasurement).to.equal("tee://MEASUREMENT");
      expect(proof.expectedSlippagePercent).to.equal(50n);
      expect(proof.actualSlippagePercent).to.equal(30n);
      expect(proof.slippageWithinLimit).to.be.true;
      expect(proof.executorAddress).to.equal("enclave://sgx-001");
    });

    it("increments totalProofsRecorded and totalFairProofs", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      await recordAndGetId(contract, prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>);

      expect(await contract.totalProofsRecorded()).to.equal(1n);
      expect(await contract.totalFairProofs()).to.equal(1n);
    });
  });

  // ── recordProof — unfair execution ──────────────────────────────────────────
  describe("recordProof() — unfair execution", function () {
    it("marks slippageWithinLimit = false when actual > expected", async function () {
      const { contract, prover, PROOF_ARGS } = await loadFixture(deployFixture);
      const proofId = await recordAndGetId(
        contract,
        prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        { actualSlippagePercent: 200n }   // 2.00% > 0.50% limit
      );

      const proof = await contract.getProof(proofId);
      expect(proof.slippageWithinLimit).to.be.false;
    });

    it("does NOT increment totalFairProofs for unfair proof", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      await recordAndGetId(
        contract,
        prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        { actualSlippagePercent: 500n }
      );

      expect(await contract.totalFairProofs()).to.equal(0n);
      expect(await contract.totalProofsRecorded()).to.equal(1n);
    });
  });

  // ── isTradeFair ─────────────────────────────────────────────────────────────
  describe("isTradeFair()", function () {
    it("returns true for a fair proof", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const proofId = await recordAndGetId(
        contract,
        prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        { actualSlippagePercent: 10n }
      );
      expect(await contract.isTradeFair(proofId)).to.be.true;
    });

    it("returns false for an unfair proof", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const proofId = await recordAndGetId(
        contract,
        prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        { actualSlippagePercent: 999n }
      );
      expect(await contract.isTradeFair(proofId)).to.be.false;
    });

    it("reverts for a non-existent proofId", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.isTradeFair(404n))
        .to.be.revertedWithCustomError(contract, "ProofNotFound");
    });
  });

  // ── getProofsByTrade ────────────────────────────────────────────────────────
  describe("getProofsByTrade()", function () {
    it("returns all proofIds for a trade", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const p = prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;
      const id1 = await recordAndGetId(contract, p, { tradeId: 42n });
      const id2 = await recordAndGetId(contract, p, { tradeId: 42n, actualSlippagePercent: 100n });

      const proofIds = await contract.getProofsByTrade(42n);
      expect(proofIds).to.deep.equal([id1, id2]);
    });

    it("reverts when trade has no proofs", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getProofsByTrade(999n))
        .to.be.revertedWithCustomError(contract, "TradeHasNoProofs");
    });
  });

  // ── getTeeAttestation ───────────────────────────────────────────────────────
  describe("getTeeAttestation()", function () {
    it("returns the raw TEE measurement string", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const proofId = await recordAndGetId(
        contract,
        prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>,
        { teeMeasurement: "tee://unique-enclave-measurement-xyz" }
      );
      expect(await contract.getTeeAttestation(proofId))
        .to.equal("tee://unique-enclave-measurement-xyz");
    });
  });

  // ── globalFairnessRatioBps ──────────────────────────────────────────────────
  describe("globalFairnessRatioBps()", function () {
    it("returns 0 when no proofs recorded", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.globalFairnessRatioBps()).to.equal(0n);
    });

    it("returns 10000 when all proofs are fair", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const p = prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;
      await recordAndGetId(contract, p, { actualSlippagePercent: 10n });
      await recordAndGetId(contract, p, { actualSlippagePercent: 20n });

      expect(await contract.globalFairnessRatioBps()).to.equal(10_000n);
    });

    it("returns 5000 when half the proofs are fair", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const p = prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;
      await recordAndGetId(contract, p, { actualSlippagePercent: 10n });   // fair
      await recordAndGetId(contract, p, { actualSlippagePercent: 999n });  // unfair

      expect(await contract.globalFairnessRatioBps()).to.equal(5_000n);
    });
  });

  // ── Validation errors ───────────────────────────────────────────────────────
  describe("Input validation", function () {
    it("reverts on empty teeMeasurement", async function () {
      const { contract, prover, PROOF_ARGS } = await loadFixture(deployFixture);
      await expect(
        contract.connect(prover).recordProof(1n, "", 50n, 30n, "enclave://x")
      ).to.be.revertedWithCustomError(contract, "EmptyTeeMeasurement");
    });

    it("reverts on empty executorAddress", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      await expect(
        contract.connect(prover).recordProof(1n, "tee://meas", 50n, 30n, "")
      ).to.be.revertedWithCustomError(contract, "EmptyExecutorAddress");
    });

    it("reverts when called by unauthorized prover", async function () {
      const { contract, other } = await loadFixture(deployFixture);
      await expect(
        contract.connect(other).recordProof(1n, "tee://meas", 50n, 30n, "enc://x")
      ).to.be.revertedWithCustomError(contract, "UnauthorizedProver");
    });

    it("allows owner to grant and revoke prover role", async function () {
      const { contract, owner, other } = await loadFixture(deployFixture);

      // Grant
      await contract.connect(owner).setProver(other.address, true);
      expect(await contract.authorizedProvers(other.address)).to.be.true;

      // Revoke
      await contract.connect(owner).setProver(other.address, false);
      expect(await contract.authorizedProvers(other.address)).to.be.false;
    });

    it("prevents non-owner from granting prover role", async function () {
      const { contract, other, prover } = await loadFixture(deployFixture);
      await expect(
        contract.connect(other).setProver(prover.address, false)
      ).to.be.reverted;
    });
  });

  // ── Proof counter ────────────────────────────────────────────────────────────
  describe("Proof counter", function () {
    it("increments totalProofsRecorded with each new proof", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const p = prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      const before = await contract.totalProofsRecorded();
      await recordAndGetId(contract, p);
      await recordAndGetId(contract, p, { tradeId: 2n });

      expect(await contract.totalProofsRecorded()).to.equal(before + 2n);
    });

    it("increments totalFairProofs only for fair executions", async function () {
      const { contract, prover } = await loadFixture(deployFixture);
      const p = prover as unknown as Awaited<ReturnType<typeof ethers.getSigner>>;

      // fair: actual(10) <= expected(50)
      await recordAndGetId(contract, p, { tradeId: 1n, actualSlippagePercent: 10n });
      // unfair: actual(999) > expected(50)
      await recordAndGetId(contract, p, { tradeId: 2n, actualSlippagePercent: 999n });

      expect(await contract.totalFairProofs()).to.equal(1n);
      expect(await contract.totalProofsRecorded()).to.equal(2n);
    });
  });
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

async function latestTimestamp(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block?.timestamp ?? 0);
}
