/**
 * 0G Agentic ID (ERC-7857) integration.
 *
 * VerifyTrade's executor is registered as an on-chain AI agent on the 0G network.
 * Token ID 101 — minted at 0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F (Galileo testnet).
 *
 * This gives the executor a verifiable on-chain identity:
 *   - Every trade attestation is signed by a recognized AI agent
 *   - Authorization can be scoped per user/trade via authorizeUsage()
 *   - The agent can be cloned, traded, or listed on the 0G marketplace
 *
 * Docs: https://build.0g.ai → Agentic ID
 */

import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AGENTIC_ID_CONTRACT = "0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F";
export const VERIFYTRADE_AGENT_TOKEN_ID = BigInt(101);
export const VERIFYTRADE_AGENT_OWNER    = "0x79601AC98F844aD09b485F739D3C478C5b131A10";

const ZG_RPC_URL = (process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai").replace(/\/$/, "");
const ZG_KEY     = process.env.ZEROG_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "";

const AGENTIC_ID_ABI = [
  "function mint(address to) returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function authorizeUsage(uint256 tokenId, address user, uint256 limit)",
  "function revokeAuthorization(uint256 tokenId, address user)",
  "function authorizedTokensOf(address user) view returns (uint256[])",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ZG_RPC_URL);
}

function getSigner(): ethers.Wallet {
  const provider = getProvider();
  const key = ZG_KEY.startsWith("0x") ? ZG_KEY : `0x${ZG_KEY}`;
  return new ethers.Wallet(key, provider);
}

function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    AGENTIC_ID_CONTRACT,
    AGENTIC_ID_ABI,
    signerOrProvider ?? getProvider()
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AgentInfo {
  tokenId:     number;
  owner:       string;
  name:        string;
  symbol:      string;
  totalSupply: number;
  contractUrl: string;
  agentName:   string;
  capabilities: string[];
  network:     string;
}

/** Get info about the VerifyTrade executor agent. */
export async function getAgentInfo(): Promise<AgentInfo> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = getContract() as any;
  const [name, symbol, totalSupply, owner] = await Promise.all([
    contract.name()        as Promise<string>,
    contract.symbol()      as Promise<string>,
    contract.totalSupply() as Promise<bigint>,
    contract.ownerOf(VERIFYTRADE_AGENT_TOKEN_ID) as Promise<string>,
  ]);

  return {
    tokenId:      Number(VERIFYTRADE_AGENT_TOKEN_ID),
    owner:        String(owner),
    name:         String(name),
    symbol:       String(symbol),
    totalSupply:  Number(totalSupply),
    contractUrl:  `https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`,
    agentName:    "VerifyTrade Executor Agent",
    capabilities: [
      "trade-execution",
      "mev-protection",
      "fairness-verification",
      "tee-attestation",
      "0g-compute-inference",
    ],
    network: "0G Galileo Testnet",
  };
}

/**
 * Authorize a trader's address to use the agent for a specific number of trades.
 * Called once per user on first connect — allows the agent to act on their behalf.
 */
export async function authorizeTrader(traderAddress: string, tradeLimit = 100): Promise<string> {
  const signer   = getSigner();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = getContract(signer) as any;
  const tx = await contract.authorizeUsage(
    VERIFYTRADE_AGENT_TOKEN_ID,
    traderAddress,
    BigInt(tradeLimit)
  );
  await tx.wait();
  console.log(`[AgenticID] Authorized trader ${traderAddress} for ${tradeLimit} trades. TX: ${tx.hash}`);
  return tx.hash as string;
}

/** Check whether a trader is authorized to use the agent. */
export async function isTraderAuthorized(traderAddress: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = getContract() as any;
    const tokens   = await contract.authorizedTokensOf(traderAddress) as bigint[];
    return tokens.some(t => t === VERIFYTRADE_AGENT_TOKEN_ID);
  } catch {
    return false;
  }
}

/** Returns the agent's on-chain token ID as a string for embedding in attestations. */
export function getAgentId(): string {
  return `0g-agent:${AGENTIC_ID_CONTRACT}#${VERIFYTRADE_AGENT_TOKEN_ID}`;
}

/** Returns a short agent reference for embedding in trade execution details. */
export function agentExecutionTag(): string {
  return `agent_id=${getAgentId()} network=0g-galileo`;
}

/** Health check — verifies the agent token still exists on-chain. */
export async function isAgentAlive(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = getContract() as any;
    const owner    = await contract.ownerOf(VERIFYTRADE_AGENT_TOKEN_ID) as string;
    return owner.toLowerCase() === VERIFYTRADE_AGENT_OWNER.toLowerCase();
  } catch {
    return false;
  }
}
