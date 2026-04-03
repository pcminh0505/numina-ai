import { useMemo } from "react";
import { createWalletClient, custom } from "viem";
import { celo, celoSepolia } from "wagmi/chains";
import { useChainId } from "wagmi";

/**
 * Creates a viem WalletClient backed by MiniPay's injected provider.
 * Used to call MiniPay-specific RPC methods (minipay_scanQrCode, minipay_getExchangeRate).
 * Returns null when window.ethereum is unavailable (outside MiniPay or browser).
 */
export function useMiniPayClient() {
  const chainId = useChainId();

  return useMemo(() => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    const chain = chainId === celo.id ? celo : celoSepolia;
    return createWalletClient({
      chain,
      transport: custom(window.ethereum),
    });
  }, [chainId]);
}
