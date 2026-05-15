import { celo, celoSepolia } from 'wagmi/chains';

export interface PaymentConfig {
  /** USDC contract address on the current chain */
  asset: `0x${string}`;
  /** Treasury wallet receiving the payment */
  payTo: `0x${string}`;
  /** Amount in USDC 6-decimal units (e.g. 500000n = $0.50) */
  amountUnits: bigint;
  /** Fee currency symbol for CIP-64 */
  feeCurrencySymbol: string;
}

export const USDC_ADDRESSES: Partial<Record<number, `0x${string}`>> = {
  [celo.id]:       '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  [celoSepolia.id]: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
};

/** $0.50 USDC (6 decimals) */
export const ADVANCED_PRICE = 500000n;

/** $0.20 USDC (6 decimals) — 20 chat credits */
export const CREDITS_PRICE = 200000n;

export function buildPaymentConfig(
  chainId: number,
  amountUnits: bigint,
): PaymentConfig | null {
  const treasuryRaw = import.meta.env.VITE_X402_TREASURY_ADDRESS as string | undefined;
  const asset = USDC_ADDRESSES[chainId];
  if (!treasuryRaw || !asset) return null;
  return {
    asset,
    payTo: treasuryRaw as `0x${string}`,
    amountUnits,
    feeCurrencySymbol: 'USDC',
  };
}
