import { useState, useEffect, useCallback, useRef } from 'react';
import { useChainId, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, erc20Abi } from 'viem';
import { getFeeCurrencyAddress } from '../lib/feeCurrency';
import { buildPaymentConfig, ADVANCED_PRICE } from '../lib/x402';
import { useQueryClient } from '@tanstack/react-query';

export function useAdvancedUnlock(wallet: string | undefined) {
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

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifiedTxRef = useRef<string | undefined>(undefined);

  // After tx confirmed, notify server to verify and unlock
  useEffect(() => {
    if (!isSuccess || !txHash || !wallet) return;
    if (verifiedTxRef.current === txHash) return;
    verifiedTxRef.current = txHash;

    setIsVerifying(true);
    setVerifyError(null);

    fetch('/api/unlock-advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, txHash, chainId }),
    })
      .then(r => r.json())
      .then((data: { ok?: boolean; error?: string }) => {
        if (data.ok) {
          setIsUnlocked(true);
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
    const config = buildPaymentConfig(chainId, ADVANCED_PRICE);
    if (!config) {
      setVerifyError('Payment not configured (VITE_X402_TREASURY_ADDRESS missing)');
      return;
    }
    reset();
    setVerifyError(null);
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [config.payTo, config.amountUnits],
    });
    const feeCurrency = getFeeCurrencyAddress(config.feeCurrencySymbol, chainId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sendTransaction as any)({ to: config.asset, data, feeCurrency });
  }, [wallet, chainId, sendTransaction, reset]);

  const error = sendError?.message ?? verifyError;

  return {
    isUnlocked,
    isPaying: isPending,
    isConfirming,
    isVerifying,
    initiate,
    error,
    txHash,
  };
}
