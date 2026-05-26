import { celo, celoSepolia } from 'wagmi/chains';

export const READING_CONTRACT_ABI = [
  {
    name: 'unlockAdvanced',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'buyCredits',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'packs', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'hasAdvanced',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'creditsPurchased',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const READING_CONTRACT_ADDRESSES: Partial<Record<number, `0x${string}`>> = {
  [celoSepolia.id]: (import.meta.env.VITE_READING_CONTRACT_TESTNET ?? '') as `0x${string}`,
  [celo.id]:        (import.meta.env.VITE_READING_CONTRACT_MAINNET  ?? '') as `0x${string}`,
};

export function getReadingContractAddress(chainId: number): `0x${string}` | undefined {
  const addr = READING_CONTRACT_ADDRESSES[chainId];
  return addr && addr.length > 10 ? addr : undefined;
}
