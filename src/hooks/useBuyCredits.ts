import { useState, useCallback } from 'react';
import { useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { erc20Abi } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { USDC_ADDRESSES, CREDITS_PRICE } from '../lib/x402';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';
import { READING_CONTRACT_ABI, getReadingContractAddress } from '../lib/readingContract';

export function useBuyCredits(wallet: string | undefined) {
  const chainId      = useChainId();
  const queryClient  = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const contractAddress = getReadingContractAddress(chainId);

  const [isPaying,    setIsPaying]    = useState(false);
  const [didPurchase, setDidPurchase] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const initiate = useCallback(async () => {
    if (!wallet || !walletClient || !publicClient) return;
    if (!contractAddress) {
      setError('Contract not deployed — add VITE_READING_CONTRACT_TESTNET to .env after deploying');
      return;
    }
    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) { setError('USDC not available on this chain'); return; }

    setIsPaying(true);
    setDidPurchase(false);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const write = walletClient.writeContract as (args: any) => Promise<`0x${string}`>;
    const feeCurrency = getFeeCurrencyAddress('USDC', chainId);

    try {
      // 1. Approve (1 pack worth of USDC)
      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [wallet as `0x${string}`, contractAddress],
      }) as bigint;

      if (allowance < CREDITS_PRICE) {
        const approveHash = await write({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAddress, CREDITS_PRICE],
          feeCurrency,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Buy 1 pack (20 credits)
      const buyHash = await write({
        address: contractAddress,
        abi: READING_CONTRACT_ABI,
        functionName: 'buyCredits',
        args: [1n],
        feeCurrency,
      });
      await publicClient.waitForTransactionReceipt({ hash: buyHash });

      setDidPurchase(true);
      void queryClient.invalidateQueries({ queryKey: ['credits', wallet] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsPaying(false);
    }
  }, [wallet, walletClient, publicClient, contractAddress, chainId, queryClient]);

  return {
    didPurchase,
    isPaying,
    isConfirming: false,
    isVerifying: false,
    initiate,
    error,
  };
}
