import { useState, useCallback } from 'react';
import { useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { erc20Abi, encodeFunctionData } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { USDC_ADDRESSES, CREDITS_PRICE } from '../lib/x402';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';

const TREASURY = import.meta.env.VITE_X402_TREASURY_ADDRESS as `0x${string}` | undefined;

export function useBuyCredits(wallet: string | undefined) {
  const chainId      = useChainId();
  const queryClient  = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isPaying,     setIsPaying]     = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const initiate = useCallback(async () => {
    if (!wallet || !walletClient || !publicClient || !TREASURY) return;
    const usdcAddress = USDC_ADDRESSES[chainId];
    if (!usdcAddress) { setError('USDC not available on this chain'); return; }

    setIsPaying(true);
    setIsConfirming(false);
    setIsVerifying(false);
    setError(null);

    try {
      // Direct ERC-20 transfer to treasury — MiniPay shows "$0.20 USDC" clearly
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [TREASURY, CREDITS_PRICE],
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
      const resp = await fetch('/api/buy-credits', {
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
    isPaying,
    isConfirming,
    isVerifying,
    initiate,
    error,
  };
}
