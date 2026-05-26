/**
 * One-time script to register this app as an on-chain agent per ERC-8004
 * on Celo Sepolia (testnet) or Celo mainnet.
 *
 * Usage:
 *   pnpm register:agent
 *
 * Required env vars (in .env):
 *   REGISTER_PRIVATE_KEY   — deployer wallet private key (0x...)
 *   AGENT_URI              — publicly accessible URL to agent metadata JSON
 *   REGISTER_CHAIN         — "mainnet" | "testnet" (default: testnet)
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoSepolia } from 'viem/chains';

const PRIVATE_KEY = process.env.REGISTER_PRIVATE_KEY as `0x${string}` | undefined;
const AGENT_URI   = process.env.AGENT_URI;
const USE_MAINNET = process.env.REGISTER_CHAIN === 'mainnet';

// ERC-8004 Identity Registry — verified deployed addresses
// Source: https://eips.ethereum.org/EIPS/eip-8004 / ai-agents.md
const IDENTITY_REGISTRY: Record<string, `0x${string}`> = {
  mainnet: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  testnet: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
};

const IDENTITY_ABI = parseAbi([
  'function register(string calldata agentURI) external returns (uint256 agentId)',
  'event Registered(address indexed owner, uint256 indexed agentId, string agentURI)',
]);

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('REGISTER_PRIVATE_KEY is required in .env');
  }
  if (!AGENT_URI) {
    throw new Error(
      'AGENT_URI is required — host agent-metadata.json first, then set this env var.\n' +
      'Quick option: create a GitHub Gist and paste the raw URL here.',
    );
  }

  const chain    = USE_MAINNET ? celo : celoSepolia;
  const registry = IDENTITY_REGISTRY[USE_MAINNET ? 'mainnet' : 'testnet'];
  const rpc      = USE_MAINNET
    ? 'https://forno.celo.org'
    : 'https://forno.celo-sepolia.celo-testnet.org/';

  const account      = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  console.log(`\nRegistering on ${USE_MAINNET ? 'Celo mainnet' : 'Celo Sepolia'}…`);
  console.log(`  wallet   : ${account.address}`);
  console.log(`  registry : ${registry}`);
  console.log(`  agentURI : ${AGENT_URI}\n`);

  const hash = await walletClient.writeContract({
    address: registry,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [AGENT_URI],
  });

  console.log(`  tx hash  : ${hash}`);
  console.log('Waiting for confirmation…');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted. Receipt: ${JSON.stringify(receipt)}`);
  }

  // Extract agentId from the Registered event
  const explorer = USE_MAINNET
    ? 'https://celoscan.io'
    : 'https://sepolia.celoscan.io';

  console.log(`\n✓ Agent registered successfully!`);
  console.log(`  block    : ${receipt.blockNumber}`);
  console.log(`  explorer : ${explorer}/tx/${hash}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy the tx hash above for your Proof of Ship submission`);
  console.log(`  2. Add SELF_AGENT_ID to .env after completing Self.xyz registration`);
}

main().catch(err => {
  console.error('\nRegistration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
