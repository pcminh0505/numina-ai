import { useState, useEffect, useCallback, useRef } from 'react';
import { useChainId, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, erc20Abi } from 'viem';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';
import { buildPaymentConfig, CREDITS_PRICE } from '../lib/x402';
import { useQueryClient } from '@tanstack/react-query';

export function useBuyCredits(wallet: string | undefined) {
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const {
    sendTransaction,
    data: txHash,
    isPending,
    error: sendError,
    reset,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [didPurchase, setDidPurchase] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifiedTxRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isSuccess || !txHash || !wallet) return;
    if (verifiedTxRef.current === txHash) return;
    verifiedTxRef.current = txHash;

    setIsVerifying(true);
    setVerifyError(null);

    fetch('/api/buy-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, txHash, chainId }),
    })
      .then(r => r.json())
      .then((data: { ok?: boolean; error?: string }) => {
        if (data.ok) {
          setDidPurchase(true);
          void queryClient.invalidateQueries({ queryKey: ['credits', wallet] });
        } else {
          setVerifyError(data.error ?? 'Verification failed');
        }
      })
      .catch(() => setVerifyError('Network error during verification'))
      .finally(() => setIsVerifying(false));
  }, [isSuccess, txHash, wallet, chainId, queryClient]);

  const initiate = useCallback(() => {
    if (!wallet) return;
    const config = buildPaymentConfig(chainId, CREDITS_PRICE);
    if (!config) {
      setVerifyError('Payment not configured (VITE_X402_TREASURY_ADDRESS missing)');
      return;
    }
    reset();
    setVerifyError(null);
    setDidPurchase(false);
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [config.payTo, config.amountUnits],
    });
    const feeCurrency = getFeeCurrencyAddress(config.feeCurrencySymbol, chainId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sendTransaction as any)({ to: config.asset, data, feeCurrency });
  }, [wallet, chainId, sendTransaction, reset]);

  return {
    didPurchase,
    isPaying: isPending,
    isConfirming,
    isVerifying,
    initiate,
    error: sendError?.message ?? verifyError,
  };
}
