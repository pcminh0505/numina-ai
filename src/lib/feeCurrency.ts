import { celo, celoSepolia } from "wagmi/chains";
import { TOKENS } from "./tokens";

/**
 * CIP-64 fee currency adapter addresses.
 *
 * 6-decimal tokens (USDC, USDT) require an adapter because the Celo fee
 * mechanism expects 18-decimal precision. 18-decimal tokens (USDm) use
 * their token contract address directly as feeCurrency.
 *
 * Source: https://docs.celo.org/tooling/overview/fee-abstraction
 */
export const FEE_CURRENCY_ADAPTERS: Partial<
  Record<string, Partial<Record<number, `0x${string}`>>>
> = {
  USDC: {
    [celo.id]: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
    [celoSepolia.id]: "0x4822e58de6f5e485eF90df51C41CE01721331dC0",
  },
  USDT: {
    [celo.id]: "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72",
    // No USDT adapter on Celo Sepolia
  },
};

/**
 * Returns the feeCurrency address for a CIP-64 transaction.
 * Returns undefined for CELO (native — omit feeCurrency field entirely).
 *
 * - 18-decimal tokens (USDm): token contract address used directly
 * - 6-decimal tokens (USDC, USDT): adapter address required
 */
export function getFeeCurrencyAddress(
  symbol: string,
  chainId: number,
): `0x${string}` | undefined {
  if (symbol === "CELO") return undefined;

  // 6-decimal tokens need the adapter
  const adapter = FEE_CURRENCY_ADAPTERS[symbol]?.[chainId];
  if (adapter) return adapter;

  // 18-decimal tokens (e.g. USDm) use their token address directly
  return TOKENS.find((t) => t.symbol === symbol)?.addresses[chainId];
}

/**
 * Returns true if this token can be used to pay gas on the given chain.
 */
export function isSupportedFeeCurrency(
  symbol: string,
  chainId: number,
): boolean {
  if (symbol === "CELO") return true;
  return !!getFeeCurrencyAddress(symbol, chainId);
}
