import { useState, useCallback } from 'react';
import { useChainId, usePublicClient, useReadContract, useWalletClient } from 'wagmi';
import { erc20Abi, encodeFunctionData } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { USDC_ADDRESSES, ADVANCED_PRICE } from '../lib/x402';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';
import { READING_CONTRACT_ABI, getReadingContractAddress } from '../lib/readingContract';

const TREASURY = import.meta.env.VITE_X402_TREASURY_ADDRESS as `0x${string}` | undefined;

export function useAdvancedUnlock(wallet: string | undefined) {
  const chainId      = useChainId();
  const queryClient  = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const contractAddress = getReadingContractAddress(chainId);

  // Still read on-chain state — catches users who unlocked via old approve+contract flow
  const { data: isUnlocked = false } = useReadContract({
    address: contractAddress,
    abi: READING_CONTRACT_ABI,
    functionName: 'hasAdvanced',
    args: [wallet as `0x${string}`],
    query: { enabled: !!contractAddress && !!wallet },
  });

  const [isPaying,     setIsPaying]     = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const initiate = useCallback(async () => {
    if (!wallet || !walletClient || !publicClient || !TREASURY) return;
    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) { setError('USDC not available on this chain'); return; }

    // Check USDC balance before touching any tx — avoids raw viem gas-estimation errors
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    }) as bigint;
    if (balance < ADVANCED_PRICE) {
      setError('Insufficient USDC balance. You need at least $0.50 USDC to unlock advanced insights.');
      return;
    }

    setIsPaying(true);
    setIsConfirming(false);
    setIsVerifying(false);
    setError(null);

    try {
      // Direct ERC-20 transfer to treasury — MiniPay decodes this as "$0.50 USDC"
      // instead of "Unknown transaction" from the approve+transferFrom flow
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [TREASURY, ADVANCED_PRICE],
      });
      const feeCurrency = getFeeCurrencyAddress('USDC', chainId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txHash = await (walletClient.sendTransaction as (args: any) => Promise<`0x${string}`>)({
        to: usdcAddress,
        data,
        feeCurrency,
      });

      setIsPaying(false);
      setIsConfirming(true);
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setIsConfirming(false);
      setIsVerifying(true);
      const resp = await fetch('/api/unlock-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, txHash, chainId }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Payment verification failed');
      }

      void queryClient.invalidateQueries({ queryKey: ['credits', wallet] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsPaying(false);
      setIsConfirming(false);
      setIsVerifying(false);
    }
  }, [wallet, walletClient, publicClient, chainId, queryClient]);

  return {
    isUnlocked: isUnlocked as boolean,
    isPaying,
    isConfirming,
    isVerifying,
    initiate,
    error,
  };
}
