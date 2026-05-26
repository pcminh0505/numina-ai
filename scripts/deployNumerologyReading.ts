/**
 * Deploy NumerologyReading.sol to Celo Sepolia (testnet) or Celo mainnet.
 *
 * Usage:
 *   pnpm deploy:contract                   # testnet (default)
 *   DEPLOY_CHAIN=mainnet pnpm deploy:contract
 *
 * Required .env vars:
 *   REGISTER_PRIVATE_KEY  — deployer wallet private key
 *   X402_TREASURY_ADDRESS — wallet that receives USDC payments
 *
 * After deploying, paste the contract address into .env:
 *   VITE_READING_CONTRACT_TESTNET=0x...
 *   READING_CONTRACT_TESTNET=0x...
 */

import { execSync } from 'child_process';
import { config as loadEnv } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
loadEnv();

const PRIVATE_KEY      = process.env.REGISTER_PRIVATE_KEY;
const TREASURY         = process.env.X402_TREASURY_ADDRESS;
const USE_MAINNET      = process.env.DEPLOY_CHAIN === 'mainnet';
const ADVANCED_PRICE   = process.env.X402_ADVANCED_PRICE ?? '500000';
const CREDITS_PRICE    = process.env.X402_CREDITS_PRICE  ?? '200000';

// USDC addresses on Celo
const USDC: Record<string, string> = {
  mainnet: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  testnet: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
};

const RPC: Record<string, string> = {
  mainnet: 'https://forno.celo.org',
  testnet: 'https://forno.celo-sepolia.celo-testnet.org',
};

if (!PRIVATE_KEY) { console.error('REGISTER_PRIVATE_KEY missing in .env'); process.exit(1); }
if (!TREASURY)    { console.error('X402_TREASURY_ADDRESS missing in .env'); process.exit(1); }

// Owner = API server wallet (derived from private key so it can call record functions)
const OWNER_ADDRESS = privateKeyToAccount(PRIVATE_KEY as `0x${string}`).address;

const net     = USE_MAINNET ? 'mainnet' : 'testnet';
const rpc     = RPC[net];
const usdc    = USDC[net];
const envKey  = USE_MAINNET ? 'MAINNET' : 'TESTNET';

console.log(`\nDeploying NumerologyReading to Celo ${net}...`);
console.log(`  RPC      : ${rpc}`);
console.log(`  USDC     : ${usdc}`);
console.log(`  Treasury : ${TREASURY}`);
console.log(`  Owner    : ${OWNER_ADDRESS}`);
console.log(`  Advanced : ${ADVANCED_PRICE} (${Number(ADVANCED_PRICE) / 1e6} USDC)`);
console.log(`  Credits  : ${CREDITS_PRICE} (${Number(CREDITS_PRICE) / 1e6} USDC/pack)\n`);

// Use forge script (non-interactive) instead of forge create (requires confirmation in Foundry 1.5+)
const cmd = [
  'forge script scripts/DeployNumerologyReading.s.sol:DeployNumerologyReading',
  `--rpc-url ${rpc}`,
  `--private-key ${PRIVATE_KEY}`,
  '--broadcast',
  '--legacy',
].join(' ');

const env = {
  ...process.env,
  DEPLOY_USDC:           usdc,
  X402_TREASURY_ADDRESS: TREASURY,
  X402_ADVANCED_PRICE:   ADVANCED_PRICE,
  X402_CREDITS_PRICE:    CREDITS_PRICE,
};

try {
  const output = execSync(cmd, { encoding: 'utf-8', env });
  console.log(output);

  const match  = output.match(/Deployed to: (0x[0-9a-fA-F]{40})/);
  const address = match?.[1];

  if (address) {
    console.log('\n✓ Contract deployed!');
    console.log(`\nAdd to .env:\n  VITE_READING_CONTRACT_${envKey}=${address}`);
    console.log(`  READING_CONTRACT_${envKey}=${address}`);
  }
} catch (err) {
  console.error('Deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
