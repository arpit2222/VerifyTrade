import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { VerifyTrade } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

async function deployFixture() {
  const [owner, trader, executor, validator] = await ethers.getSigners();

  const VerifyTrade = await ethers.getContractFactory("VerifyTrade");
  const verifyTrade = await VerifyTrade.deploy(validator.address) as VerifyTrade;

  await verifyTrade.setExecutor(executor.address, true);

  // Deploy mock ERC-20 tokens for testing
  const MockToken = await ethers.getContractFactory("MockERC20");
  const tokenIn  = await MockToken.deploy("Mock USDC", "mUSDC", 6);
  const tokenOut = await MockToken.deploy("Mock WETH", "mWETH", 18);

  // Fund trader
  const AMOUNT_IN = ethers.parseUnits("100", 6); // 100 USDC
  await tokenIn.mint(trader.address, AMOUNT_IN);
  await tokenIn.connect(trader).approve(await verifyTrade.getAddress(), AMOUNT_IN);

  return { verifyTrade, tokenIn, tokenOut, owner, trader, executor, validator, AMOUNT_IN };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VerifyTrade", function () {
  describe("Deployment", function () {
    it("sets the correct proof validator", async function () {
      const { verifyTrade, validator } = await loadFixture(deployFixture);
      expect(await verifyTrade.proofValidator()).to.equal(validator.address);
    });

    it("sets owner correctly", async function () {
      const { verifyTrade, owner } = await loadFixture(deployFixture);
      expect(await verifyTrade.owner()).to.equal(owner.address);
    });
  });

  describe("Order submission", function () {
    it("accepts a valid order and pulls tokens", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader, AMOUNT_IN } = await loadFixture(deployFixture);

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const tx = await verifyTrade.connect(trader).submitOrder(
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        AMOUNT_IN,
        ethers.parseUnits("0.04", 18), // minAmountOut
        50,   // 0.5% slippage
        deadline
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Tokens pulled from trader
      expect(await tokenIn.balanceOf(trader.address)).to.equal(0n);
      expect(await tokenIn.balanceOf(await verifyTrade.getAddress())).to.equal(AMOUNT_IN);
    });

    it("reverts on zero amount", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader } = await loadFixture(deployFixture);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        verifyTrade.connect(trader).submitOrder(
          await tokenIn.getAddress(),
          await tokenOut.getAddress(),
          0n,
          0n,
          50,
          deadline
        )
      ).to.be.revertedWithCustomError(verifyTrade, "ZeroAmount");
    });

    it("reverts when slippage exceeds maximum", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader, AMOUNT_IN } = await loadFixture(deployFixture);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        verifyTrade.connect(trader).submitOrder(
          await tokenIn.getAddress(),
          await tokenOut.getAddress(),
          AMOUNT_IN,
          0n,
          1100, // 11% — over the 10% cap
          deadline
        )
      ).to.be.revertedWithCustomError(verifyTrade, "SlippageTooHigh");
    });

    it("reverts on expired deadline", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader, AMOUNT_IN } = await loadFixture(deployFixture);

      await expect(
        verifyTrade.connect(trader).submitOrder(
          await tokenIn.getAddress(),
          await tokenOut.getAddress(),
          AMOUNT_IN,
          0n,
          50,
          1 // past deadline
        )
      ).to.be.revertedWithCustomError(verifyTrade, "InvalidDeadline");
    });
  });

  describe("Order cancellation", function () {
    it("allows trader to cancel and receive refund", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader, AMOUNT_IN } = await loadFixture(deployFixture);

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const tx = await verifyTrade.connect(trader).submitOrder(
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        AMOUNT_IN,
        0n,
        50,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((l) => {
          try { return verifyTrade.interface.parseLog(l as unknown as { topics: string[]; data: string }); }
          catch { return null; }
        })
        .find((e) => e?.name === "OrderSubmitted");

      const orderId = event?.args[0] as string;

      await verifyTrade.connect(trader).cancelOrder(orderId);

      expect(await tokenIn.balanceOf(trader.address)).to.equal(AMOUNT_IN);
    });
  });

  describe("Access control", function () {
    it("prevents unauthorized executors from calling executeOrder", async function () {
      const { verifyTrade, trader } = await loadFixture(deployFixture);

      await expect(
        verifyTrade.connect(trader).executeOrder(
          ethers.ZeroHash,
          0n,
          0n,
          ethers.ZeroHash,
          "0x"
        )
      ).to.be.revertedWithCustomError(verifyTrade, "UnauthorizedExecutor");
    });

    it("allows owner to add and remove executors", async function () {
      const { verifyTrade, owner, executor } = await loadFixture(deployFixture);

      // executor is authorized from fixture
      expect(await verifyTrade.authorizedExecutors(executor.address)).to.be.true;

      // Remove executor
      await verifyTrade.connect(owner).setExecutor(executor.address, false);
      expect(await verifyTrade.authorizedExecutors(executor.address)).to.be.false;
    });

    it("prevents non-owner from modifying executors", async function () {
      const { verifyTrade, trader, executor } = await loadFixture(deployFixture);

      await expect(
        verifyTrade.connect(trader).setExecutor(executor.address, false)
      ).to.be.reverted;
    });
  });

  describe("Order submission events", function () {
    it("emits OrderSubmitted event with correct orderId", async function () {
      const { verifyTrade, tokenIn, tokenOut, trader, AMOUNT_IN } = await loadFixture(deployFixture);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const tx = await verifyTrade.connect(trader).submitOrder(
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        AMOUNT_IN,
        0n,
        50,
        deadline
      );

      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((l) => {
          try { return verifyTrade.interface.parseLog(l as unknown as { topics: string[]; data: string }); }
          catch { return null; }
        })
        .find((e) => e?.name === "OrderSubmitted");

      expect(event).to.not.be.null;
      expect(event?.args[1]).to.equal(trader.address); // second arg is trader
    });
  });
});
