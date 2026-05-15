import { useState, useCallback } from 'react';
import { useChainId, usePublicClient, useReadContract, useWalletClient } from 'wagmi';
import { erc20Abi } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { USDC_ADDRESSES, ADVANCED_PRICE } from '../lib/x402';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';
import { READING_CONTRACT_ABI, getReadingContractAddress } from '../lib/readingContract';

export function useAdvancedUnlock(wallet: string | undefined) {
  const chainId      = useChainId();
  const queryClient  = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const contractAddress = getReadingContractAddress(chainId);

  // Read unlock state directly from the contract (on-chain source of truth)
  const { data: isUnlocked = false, refetch } = useReadContract({
    address: contractAddress,
    abi: READING_CONTRACT_ABI,
    functionName: 'hasAdvanced',
    args: [wallet as `0x${string}`],
    query: { enabled: !!contractAddress && !!wallet },
  });

  const [isPaying, setIsPaying] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const initiate = useCallback(async () => {
    if (!wallet || !walletClient || !publicClient) return;
    if (!contractAddress) {
      setError('Contract not deployed — add VITE_READING_CONTRACT_TESTNET to .env after deploying');
      return;
    }
    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) { setError('USDC not available on this chain'); return; }

    setIsPaying(true);
    setError(null);

    // Helper: cast away Celo-extension types that viem doesn't type natively
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const write = walletClient.writeContract as (args: any) => Promise<`0x${string}`>;
    const feeCurrency = getFeeCurrencyAddress('USDC', chainId);

    try {
      // 1. Approve the contract to spend USDC (if not already sufficient)
      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet as `0x${string}`, contractAddress],
      }) as bigint;

      if (allowance < ADVANCED_PRICE) {
        const approveHash = await write({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAddress, ADVANCED_PRICE],
          feeCurrency,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Call unlockAdvanced() — contract pulls USDC and sets hasAdvanced[msg.sender]
      const unlockHash = await write({
        address: contractAddress,
        abi: READING_CONTRACT_ABI,
        functionName: 'unlockAdvanced',
        feeCurrency,
      });
      await publicClient.waitForTransactionReceipt({ hash: unlockHash });

      await refetch();
      void queryClient.invalidateQueries({ queryKey: ['credits', wallet] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsPaying(false);
    }
  }, [wallet, walletClient, publicClient, contractAddress, chainId, refetch, queryClient]);

  return {
    isUnlocked: isUnlocked as boolean,
    isPaying,
    isConfirming: false,
    isVerifying: false,
    initiate,
    error,
  };
}
