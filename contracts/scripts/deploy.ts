import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  VerifyTrade Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Network:  ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // For testnet, deployer acts as the initial proof validator
  // Replace with your 0G AI validator address for production
  const proofValidator = deployer.address;

  // ---------------------------------------------------------------------------
  // Deploy VerifyTrade
  // ---------------------------------------------------------------------------
  console.log("Deploying VerifyTrade...");
  const VerifyTrade = await ethers.getContractFactory("VerifyTrade");
  const verifyTrade = await VerifyTrade.deploy(proofValidator);
  await verifyTrade.waitForDeployment();
  const verifyTradeAddress = await verifyTrade.getAddress();
  console.log(`✓ VerifyTrade deployed: ${verifyTradeAddress}`);

  // Authorize deployer as executor for initial testing
  await verifyTrade.setExecutor(deployer.address, true);
  console.log(`✓ Deployer authorized as executor`);

  // ---------------------------------------------------------------------------
  // Save deployment artifacts
  // ---------------------------------------------------------------------------
  const deploymentInfo = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    proofValidator,
    contracts: {
      VerifyTrade: verifyTradeAddress,
    },
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const filename = `${network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // ---------------------------------------------------------------------------
  // Print summary
  // ---------------------------------------------------------------------------
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nAdd these to your .env:\n`);
  console.log(`NEXT_PUBLIC_VERIFY_TRADE_ADDRESS=${verifyTradeAddress}`);

  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log(`\nVerify on Arbiscan:`);
    console.log(`npx hardhat verify --network ${network.name} ${verifyTradeAddress} "${proofValidator}"\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
