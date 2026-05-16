import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Deploy all VerifyTrade contracts in dependency order:
//   1. VerifiableTradeExecutor  — main ledger
//   2. FairnessProof            — TEE attestation storage
//   3. MevRegistry              — MEV event log
//   4. VerifyTrade              — token settlement (requires a proof validator)
//
// Usage:
//   npx hardhat run scripts/deploy.ts --network localhost
//   npx hardhat run scripts/deploy.ts --network arbitrumSepolia
// ---------------------------------------------------------------------------

interface DeploymentResult {
  network: string;
  chainId: number;
  deployer: string;
  contracts: {
    VerifiableTradeExecutor: string;
    FairnessProof: string;
    MevRegistry: string;
    VerifyTrade: string;
  };
  proofValidator: string;
  timestamp: string;
  blockNumber: number;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  VerifyTrade — Full Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network:  ${network.name} (chainId: ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log();

  const deploymentBlock = await ethers.provider.getBlockNumber();

  // -------------------------------------------------------------------------
  // 1. VerifiableTradeExecutor
  // -------------------------------------------------------------------------
  process.stdout.write("  [1/4] Deploying VerifiableTradeExecutor... ");
  const VTE = await ethers.getContractFactory("VerifiableTradeExecutor");
  const vte = await VTE.deploy();
  await vte.waitForDeployment();
  const vteAddress = await vte.getAddress();
  console.log(`✓ ${vteAddress}`);

  // Authorize deployer as executor for immediate testing
  await (await vte.setExecutor(deployer.address, true)).wait();
  console.log("           ↳ Deployer authorized as executor");

  // -------------------------------------------------------------------------
  // 2. FairnessProof
  // -------------------------------------------------------------------------
  process.stdout.write("  [2/4] Deploying FairnessProof............... ");
  const FP = await ethers.getContractFactory("FairnessProof");
  const fp = await FP.deploy();
  await fp.waitForDeployment();
  const fpAddress = await fp.getAddress();
  console.log(`✓ ${fpAddress}`);

  await (await fp.setProver(deployer.address, true)).wait();
  console.log("           ↳ Deployer authorized as prover");

  // -------------------------------------------------------------------------
  // 3. MevRegistry
  // -------------------------------------------------------------------------
  process.stdout.write("  [3/4] Deploying MevRegistry................. ");
  const MR = await ethers.getContractFactory("MevRegistry");
  const mr = await MR.deploy();
  await mr.waitForDeployment();
  const mrAddress = await mr.getAddress();
  console.log(`✓ ${mrAddress}`);

  await (await mr.setRecorder(deployer.address, true)).wait();
  console.log("           ↳ Deployer authorized as recorder");

  // -------------------------------------------------------------------------
  // 4. VerifyTrade (token settlement layer)
  // -------------------------------------------------------------------------
  // For testnet, deployer is the initial proof validator.
  // Replace with a 0G AI validator address before mainnet.
  const proofValidator = deployer.address;

  process.stdout.write("  [4/4] Deploying VerifyTrade................. ");
  const VT = await ethers.getContractFactory("VerifyTrade");
  const vt = await VT.deploy(proofValidator);
  await vt.waitForDeployment();
  const vtAddress = await vt.getAddress();
  console.log(`✓ ${vtAddress}`);

  await (await vt.setExecutor(deployer.address, true)).wait();
  console.log("           ↳ Deployer authorized as executor");

  // -------------------------------------------------------------------------
  // Save deployment artifact
  // -------------------------------------------------------------------------
  const result: DeploymentResult = {
    network:     network.name,
    chainId:     Number(chainId),
    deployer:    deployer.address,
    proofValidator,
    contracts: {
      VerifiableTradeExecutor: vteAddress,
      FairnessProof:           fpAddress,
      MevRegistry:             mrAddress,
      VerifyTrade:             vtAddress,
    },
    timestamp:   new Date().toISOString(),
    blockNumber: deploymentBlock,
  };

  // Write to /deployments/<network>-<timestamp>.json
  const deploymentsDir = path.resolve(__dirname, "../../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const artifactPath = path.join(deploymentsDir, `${network.name}-${Date.now()}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2));

  // Write/update .env.local in the repo root for immediate frontend use
  const envPath = path.resolve(__dirname, "../../.env.local");
  const envContent = `# Auto-generated by deploy.ts at ${result.timestamp}
# Network: ${network.name} (${chainId})

NEXT_PUBLIC_CHAIN_ID=${chainId}
NEXT_PUBLIC_NETWORK_ENV=${network.name === "arbitrumSepolia" ? "testnet" : "local"}

NEXT_PUBLIC_VERIFY_TRADE_ADDRESS=${vtAddress}
NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS=${vteAddress}
NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS=${fpAddress}
NEXT_PUBLIC_MEV_REGISTRY_ADDRESS=${mrAddress}
`;
  fs.writeFileSync(envPath, envContent);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
  console.log("  Contract addresses:");
  console.log(`    VerifiableTradeExecutor: ${vteAddress}`);
  console.log(`    FairnessProof:           ${fpAddress}`);
  console.log(`    MevRegistry:             ${mrAddress}`);
  console.log(`    VerifyTrade:             ${vtAddress}`);
  console.log();
  console.log(`  Artifact saved: ${artifactPath}`);
  console.log(`  .env.local updated: ${envPath}`);
  console.log();

  if (network.name === "arbitrumSepolia") {
    console.log("  Verify on Arbiscan (run after deployment):");
    console.log(`    npx hardhat verify --network arbitrumSepolia ${vteAddress}`);
    console.log(`    npx hardhat verify --network arbitrumSepolia ${fpAddress}`);
    console.log(`    npx hardhat verify --network arbitrumSepolia ${mrAddress}`);
    console.log(`    npx hardhat verify --network arbitrumSepolia ${vtAddress} "${proofValidator}"`);
    console.log();
  }

  console.log("  Next: npm run dev  →  http://localhost:3000");
  console.log();
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
